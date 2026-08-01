'use client'

/**
 * Renders an agent run's output as a report rather than a JSON dump.
 *
 * Output shape depends on whatever the agent's endpoint returned, so this
 * sniffs for the shapes we know — an SEO score payload, a marketing strategy,
 * a list of generated items — and falls back to readable text. Nothing here
 * is required for a run to work; it is presentation over data we already store.
 *
 * Keeping the results in our own run log (rather than reading them back from
 * the service that produced them) is the point: history survives the upstream
 * being asleep.
 */

import { AlertTriangle, CheckCircle2, Lightbulb, TrendingUp } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Best-effort parse: output is a string column that usually holds JSON. */
export function parseOutput(output: string | null | undefined): unknown {
  if (!output) return null

  const trimmed = output.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return trimmed

  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function AgentResult({ output }: { output: string | null | undefined }) {
  const parsed = parseOutput(output)

  if (parsed === null) {
    return <p className="text-sm text-muted-foreground">This run produced no output.</p>
  }

  if (typeof parsed === 'string') {
    return (
      <div className="whitespace-pre-wrap rounded-xl border border-border bg-muted/20 p-4 text-sm leading-relaxed text-foreground">
        {parsed}
      </div>
    )
  }

  const record = asRecord(parsed)

  if (record) {
    // Unwrap a single envelope key so {data: {...}} renders as its contents.
    const inner = asRecord(record.data) ?? asRecord(record.result) ?? record

    if (num(inner.seo_score) !== null || num(inner.score) !== null) {
      return <SeoResult data={inner} />
    }

    if (str(inner.strategy)) {
      return <StrategyResult data={inner} />
    }
  }

  return <StructuredResult value={parsed} />
}

/* ------------------------------------------------------------------ *
 * SEO
 * ------------------------------------------------------------------ */

function SeoResult({ data }: { data: Record<string, unknown> }) {
  const score = num(data.seo_score) ?? num(data.score) ?? 0
  const grade = str(data.grade)
  const issues = list(data.issues)
  const recommendations = list(data.recommendations)

  // Bands match the old screen so a familiar score reads the same way.
  const tone =
    score >= 80
      ? 'text-emerald-600'
      : score >= 60
        ? 'text-amber-600'
        : score >= 40
          ? 'text-orange-600'
          : 'text-destructive'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6 rounded-xl border border-border p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SEO Score</p>
          <p className={cn('text-4xl font-bold tabular-nums', tone)}>{Math.round(score)}</p>
        </div>

        {grade && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grade</p>
            <p className={cn('text-4xl font-bold', tone)}>{grade}</p>
          </div>
        )}

        {num(data.pagespeed_score) !== null && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PageSpeed</p>
            <p className="text-4xl font-bold tabular-nums text-foreground">{num(data.pagespeed_score)}</p>
          </div>
        )}

        {str(data.url) && (
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Analysed</p>
            <p className="truncate font-mono text-xs text-foreground">{str(data.url)}</p>
          </div>
        )}
      </div>

      {issues.length > 0 && (
        <Section title={`Issues (${issues.length})`} icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}>
          {issues.slice(0, 40).map((issue, index) => (
            <Bullet key={index} value={issue} />
          ))}
        </Section>
      )}

      {recommendations.length > 0 && (
        <Section
          title={`Recommendations (${recommendations.length})`}
          icon={<Lightbulb className="h-4 w-4 text-primary" />}
        >
          {recommendations.slice(0, 40).map((item, index) => (
            <Bullet key={index} value={item} />
          ))}
        </Section>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Marketing strategy
 * ------------------------------------------------------------------ */

/** Headings the strategy text is written under, in the order they appear. */
const STRATEGY_SECTIONS = [
  'Platform Strategy',
  'Content Plan',
  'Posting Frequency',
  'Lead Generation Tactics',
  'Growth Hacks',
  'Unique Angle',
]

/** Splits the strategy prose into its named sections; [] when unrecognised. */
export function splitStrategy(content: string): { title: string; body: string }[] {
  const sections: { title: string; body: string }[] = []

  for (const title of STRATEGY_SECTIONS) {
    const pattern = new RegExp(`${title}:\\s*([\\s\\S]*?)(?=\\n\\n|\\n[A-Z]|$)`, 'i')
    const match = content.match(pattern)

    if (match?.[1]?.trim()) sections.push({ title, body: match[1].trim() })
  }

  return sections
}

function StrategyResult({ data }: { data: Record<string, unknown> }) {
  const strategy = str(data.strategy) ?? ''
  const sections = splitStrategy(strategy)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          ['Business Type', str(data.business_type)],
          ['Target Audience', str(data.target_audience)],
          ['Goal', str(data.goal)],
          ['Focus Area', str(data.focus_area)],
        ]
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
            </div>
          ))}
      </div>

      {sections.length > 0 ? (
        <div className="space-y-3">
          {sections.map((section, index) => (
            <div key={section.title} className="rounded-xl border border-border p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  {index + 1}
                </span>
                {section.title}
              </p>
              <p className="whitespace-pre-wrap pl-7 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="whitespace-pre-wrap rounded-xl border border-border bg-muted/20 p-4 text-sm leading-relaxed text-foreground">
          {strategy}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Fallbacks
 * ------------------------------------------------------------------ */

/** Readable key/value rendering for a shape we do not specifically know. */
function StructuredResult({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <Section title={`${value.length} items`} icon={<TrendingUp className="h-4 w-4 text-primary" />}>
        {value.slice(0, 50).map((item, index) => (
          <Bullet key={index} value={item} />
        ))}
      </Section>
    )
  }

  const record = asRecord(value)
  if (!record) return null

  return (
    <div className="space-y-2 rounded-xl border border-border p-4">
      {Object.entries(record).map(([key, entry]) => (
        <div key={key} className="grid grid-cols-1 gap-1 border-b border-border py-2 last:border-0 sm:grid-cols-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {key.replace(/_/g, ' ')}
          </p>
          <div className="sm:col-span-2">
            <Value value={entry} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Value({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  if (typeof value === 'boolean') {
    return <span className="text-sm text-foreground">{value ? 'Yes' : 'No'}</span>
  }

  if (Array.isArray(value)) {
    return (
      <ul className="space-y-1">
        {value.slice(0, 20).map((item, index) => (
          <Bullet key={index} value={item} />
        ))}
      </ul>
    )
  }

  if (typeof value === 'object') {
    return (
      <pre className="overflow-x-auto rounded-lg bg-muted/40 p-2 text-xs text-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  }

  return <span className="whitespace-pre-wrap text-sm text-foreground">{String(value)}</span>
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
        {icon}
        {title}
      </p>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  )
}

/** One list entry, whether the item is a string or an object with a message. */
function Bullet({ value }: { value: unknown }) {
  const record = asRecord(value)
  const text = record
    ? (str(record.message) ?? str(record.title) ?? str(record.text) ?? str(record.issue) ?? JSON.stringify(record))
    : String(value)
  const severity = record ? str(record.severity) ?? str(record.priority) : null

  return (
    <li className="flex gap-2 text-sm text-foreground">
      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="whitespace-pre-wrap">{text}</span>
        {severity && (
          <span className="ml-2 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
            {severity}
          </span>
        )}
      </span>
    </li>
  )
}
