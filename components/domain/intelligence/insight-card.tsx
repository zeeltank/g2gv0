'use client'

import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { EvidenceRecord, IntelligenceInsight } from '@/types/intelligence'
import { CLASS_LABEL, SEVERITY, ScreenLink, SeverityBadge } from './intelligence-shared'

type Cell = EvidenceRecord[string]
type Column = { key: string; header: string; format?: (v: Cell) => string }

const yesNo = (v: Cell) => (v ? 'Yes' : 'No')
const dash = (v: Cell) => (v === null || v === undefined || v === '' ? '—' : String(v))

/** Which supporting rows to show for which insight. An insight with no entry shows its metrics only. */
const RECORD_COLUMNS: Record<string, Column[]> = {
  capability_gaps: [
    { key: 'competency', header: 'Competency' },
    { key: 'role', header: 'Role', format: dash },
    { key: 'mandatory', header: 'Mandatory', format: yesNo },
    { key: 'required_level', header: 'Required level', format: dash },
    { key: 'people_affected', header: 'People affected' },
    { key: 'average_shortfall', header: 'Average shortfall', format: dash },
    { key: 'days_waiting', header: 'Days waiting', format: dash },
  ],
  certification_risk: [
    { key: 'certificate', header: 'Certificate' },
    { key: 'department', header: 'Department' },
    { key: 'expires', header: 'Expires', format: dash },
    { key: 'days', header: 'Days left', format: dash },
  ],
}

const DEPARTMENT_COLUMNS: Column[] = [
  { key: 'department', header: 'Department' },
  { key: 'expired_or_revoked', header: 'Expired or revoked' },
  { key: 'expiring', header: 'Expiring soon' },
]

function EvidenceTable({ columns, rows, caption }: { columns: Column[]; rows: EvidenceRecord[]; caption: string }) {
  if (rows.length === 0) return null

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className="px-3 py-2 font-medium">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2 text-foreground">
                  {c.format ? c.format(row[c.key]) : String(row[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A labelled block, so evidence, interpretation, action and impact never read as one paragraph. */
function Block({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</h4>
      {children}
    </section>
  )
}

export function InsightCard({ insight }: { insight: IntelligenceInsight }) {
  const cls = CLASS_LABEL[insight.class]
  const columns = RECORD_COLUMNS[insight.key]
  const departments = insight.evidence.by_department ?? []

  return (
    <Card className="overflow-hidden" data-insight={insight.key}>
      <div className="flex">
        <div className={cn('w-1.5 shrink-0', SEVERITY[insight.severity].bar)} aria-hidden="true" />
        <CardContent className="flex-1 space-y-4 p-5">
          <header className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={insight.severity} />
              <Badge variant="muted">{insight.area}</Badge>
              <span className="text-xs text-muted-foreground" title={cls.hint}>
                {cls.label}
              </span>
            </div>
            <h3 className="text-base font-semibold text-foreground">{insight.title}</h3>
            <p className="text-sm text-foreground">{insight.detected}</p>
          </header>

          <Block label="Why it matters">
            <p className="text-sm text-muted-foreground">{insight.why_it_matters}</p>
          </Block>

          <Block label="Evidence">
            <dl className="mb-3 flex flex-wrap gap-3">
              {insight.evidence.metrics.map((m) => (
                <div key={m.label} className="min-w-28 rounded-md border border-border bg-muted/30 px-3 py-2">
                  <dt className="text-[11px] text-muted-foreground">{m.label}</dt>
                  <dd className="text-sm font-semibold text-foreground">{m.value}</dd>
                </div>
              ))}
            </dl>
            {columns && (
              <EvidenceTable columns={columns} rows={insight.evidence.records} caption={`${insight.title}: supporting records`} />
            )}
            {departments.length > 0 && (
              <div className="mt-3">
                <EvidenceTable columns={DEPARTMENT_COLUMNS} rows={departments} caption="By department" />
              </div>
            )}
            {insight.evidence.ranking && <p className="mt-2 text-xs text-muted-foreground">{insight.evidence.ranking}</p>}
          </Block>

          <div className="grid gap-4 md:grid-cols-2">
            <Block label="Recommended action" className="rounded-md border border-primary/20 bg-primary/5 p-3">
              <p className="text-sm text-foreground">{insight.recommended_action}</p>
            </Block>
            <Block label="Expected impact" className="rounded-md border border-border p-3">
              <p className="text-sm text-foreground">{insight.expected_impact}</p>
            </Block>
          </div>

          <footer className="flex justify-end">
            <ScreenLink to={insight.link} reason={insight.link_reason}>
              Open the related screen
            </ScreenLink>
          </footer>
        </CardContent>
      </div>
    </Card>
  )
}
