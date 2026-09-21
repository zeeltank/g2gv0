'use client'

/**
 * Recommendation Engine — the queue, the explanation, and the decision.
 *
 * A static route, so it takes precedence over `app/ai/[capability]/page.tsx`.
 *
 * WHY THE DECISION BUTTONS ARE NOT ON THE LIST
 *
 * They are on the detail panel, under the reasoning step and the evidence. That is
 * deliberate and it is the whole ethic of this capability: approving a recommendation
 * from a list means approving a headline, and the headline is the one part of a
 * recommendation that carries no justification. Making the buttons reachable only
 * after the explanation has rendered costs one click and is the difference between a
 * decision and a reflex.
 *
 * The API agrees rather than trusting this: it refuses a decision on anything that is
 * not still pending, with a 409.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'

import {
  decideRecommendation,
  fetchRecommendationChain,
  fetchRecommendations,
  type Recommendation,
  type RecommendationChain,
  type RecommendationCounts,
  type RecommendationDecision,
} from '@/lib/intelligence/ai-recommendations'
import { describeAiError } from '@/lib/intelligence/client'

import { CapabilityShell } from '../_components/CapabilityShell'

const FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'deferred', label: 'Deferred' },
]

export default function AiRecommendationsPage() {
  return (
    <CapabilityShell slug="recommendations">
      <RecommendationConsole />
    </CapabilityShell>
  )
}

function RecommendationConsole() {
  const [rows, setRows] = useState<Recommendation[]>([])
  const [counts, setCounts] = useState<RecommendationCounts | null>(null)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [openId, setOpenId] = useState<string | null>(null)
  const [chain, setChain] = useState<RecommendationChain | null>(null)
  const [chainError, setChainError] = useState('')
  const [deciding, setDeciding] = useState(false)
  const [note, setNote] = useState('')

  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    // `status=pending` is not a value the table holds — the repository maps it onto
    // both 'open' and 'pending' — so the queue endpoint serves that filter and the
    // general one serves the rest.
    const request =
      filter === 'pending'
        ? fetchRecommendations('pending')
        : fetchRecommendations(filter === '' ? null : filter)

    request
      .then((data) => {
        if (cancelled) return
        setRows(data.recommendations)
        setCounts(data.counts)
        setError('')
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(describeAiError(cause))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filter, reloadToken])

  /*
   * The loaded chain is not cleared when the selection changes — it is matched
   * against the current selection at render time instead.
   *
   * Clearing it in the effect body is a synchronous setState inside an effect, which
   * React flags as a cascading render. Matching on the id also fixes the bug that
   * clearing was papering over: a slow response for recommendation A could land after
   * the user had opened B, and the old code would have shown A's evidence under B's
   * title.
   */
  useEffect(() => {
    if (openId === null) return

    let cancelled = false

    fetchRecommendationChain(openId)
      .then((data) => {
        if (!cancelled) {
          setChainError('')
          setChain(data)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setChainError(describeAiError(cause))
      })

    return () => {
      cancelled = true
    }
  }, [openId, reloadToken])

  /** The chain only counts as loaded when it is the one that was asked for. */
  const shownChain = chain?.recommendation?.id === openId ? chain : null

  const reload = useCallback(() => {
    setLoading(true)
    setReloadToken((token) => token + 1)
  }, [])

  const decide = async (decision: RecommendationDecision) => {
    if (openId === null) return

    setDeciding(true)
    setError('')

    try {
      const result = await decideRecommendation(openId, decision, note.trim() || undefined)
      setCounts(result.counts)
      setNotice(`Recommendation ${decision}${decision === 'defer' ? 'red' : 'd'}.`)
      setNote('')
      reload()
    } catch (cause) {
      setError(describeAiError(cause))
    } finally {
      setDeciding(false)
    }
  }

  if (loading && rows.length === 0 && error === '') {
    return (
      <div className="mt-8 flex items-center gap-2 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading recommendations…
      </div>
    )
  }

  return (
    <section className="mt-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Recommendations</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Ranked by confidence, not by date — this is a work queue. Open one to read the reasoning
            and the evidence before deciding.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {counts && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {FILTERS.map((option) => {
            const value =
              option.value === ''
                ? counts.total
                : (counts[option.value as keyof RecommendationCounts] as number)

            return (
              <button
                key={option.value || 'all'}
                type="button"
                onClick={() => setFilter(option.value)}
                className={`rounded-md border px-2.5 py-1.5 font-medium transition-colors ${
                  filter === option.value
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-card text-foreground hover:bg-muted'
                }`}
              >
                {option.label}{' '}
                <span className="tabular-nums text-muted-foreground">{value}</span>
              </button>
            )
          })}
        </div>
      )}

      {notice && (
        <p className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <Check className="size-4" />
          {notice}
        </p>
      )}

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {rows.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nothing in this view.
            </li>
          )}
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setOpenId(row.id)}
                className={`flex w-full items-start gap-2 px-4 py-3 text-left transition-colors hover:bg-muted ${
                  openId === row.id ? 'bg-muted' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{row.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <PriorityChip priority={row.priority} />
                    <StatusChip status={row.status} />
                    {row.confidence !== null && (
                      <span className="tabular-nums">
                        confidence {(row.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </p>
                </div>
                <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>

        <div className="min-w-0">
          {openId === null ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">
              Select a recommendation to see the reasoning and evidence behind it.
            </p>
          ) : chainError !== '' ? (
            <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {chainError}
            </p>
          ) : shownChain === null ? (
            <p className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading the explanation…
            </p>
          ) : (
            <ChainPanel
              chain={shownChain}
              note={note}
              onNote={setNote}
              deciding={deciding}
              onDecide={decide}
            />
          )}
        </div>
      </div>
    </section>
  )
}

function ChainPanel({
  chain,
  note,
  onNote,
  deciding,
  onDecide,
}: {
  chain: RecommendationChain
  note: string
  onNote: (value: string) => void
  deciding: boolean
  onDecide: (decision: RecommendationDecision) => void
}) {
  const recommendation = chain.recommendation

  if (recommendation === null) return null

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-base font-semibold text-card-foreground">{recommendation.title}</h3>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
          <PriorityChip priority={recommendation.priority} />
          <StatusChip status={recommendation.status} />
          {recommendation.confidence !== null && (
            <span className="text-muted-foreground tabular-nums">
              confidence {(recommendation.confidence * 100).toFixed(0)}%
            </span>
          )}
          {recommendation.category && (
            <span className="text-muted-foreground">{recommendation.category}</span>
          )}
        </p>
        {recommendation.description && (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{recommendation.description}</p>
        )}

        {/* Prose, not labels — these columns hold sentences in G2G's data. */}
        <dl className="mt-3 space-y-2">
          {(['impact', 'cost', 'risk'] as const).map((key) =>
            recommendation[key] && recommendation[key] !== '-' ? (
              <div key={key}>
                <dt className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  {key}
                </dt>
                <dd className="text-sm leading-6 text-foreground">{recommendation[key]}</dd>
              </div>
            ) : null,
          )}
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h4 className="text-sm font-semibold text-card-foreground">Why this was recommended</h4>
        {chain.reasoning === null ? (
          // Stated rather than left as an empty panel: a recommendation with no
          // reasoning step is a real state in this data, and "none recorded" is a
          // different fact from "the lookup failed".
          <p className="mt-2 text-sm text-muted-foreground">
            No reasoning step is recorded for this recommendation.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-foreground">{chain.reasoning.description}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {chain.reasoning.step_order !== null && `Step ${chain.reasoning.step_order}`}
              {chain.reasoning.confidence !== null &&
                ` · confidence ${(chain.reasoning.confidence * 100).toFixed(0)}%`}
            </p>
          </>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h4 className="text-sm font-semibold text-card-foreground">
          Evidence <span className="text-muted-foreground">({chain.evidence.length})</span>
        </h4>
        {chain.evidence.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No evidence is linked to this one.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {chain.evidence.map((record) => (
              <li key={record.id} className="rounded-md border border-border bg-background p-3">
                <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{record.evidence_type}</span>
                  {record.source && <span>{record.source}</span>}
                  {record.confidence !== null && (
                    <span className="tabular-nums">{(record.confidence * 100).toFixed(0)}%</span>
                  )}
                  {record.observed_date && <span>{record.observed_date.slice(0, 10)}</span>}
                </p>
                <pre className="mt-1.5 overflow-x-auto font-mono text-[11px] leading-5 whitespace-pre-wrap text-muted-foreground">
                  {record.content}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recommendation.is_pending ? (
        <section className="rounded-lg border border-border bg-card p-4">
          <h4 className="text-sm font-semibold text-card-foreground">Decide</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            The note is stored in the audit trail, which is where &ldquo;who decided this, and
            why&rdquo; belongs.
          </p>
          <input
            value={note}
            onChange={(event) => onNote(event.target.value)}
            placeholder="Optional note"
            className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={deciding}
              onClick={() => onDecide('approve')}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {deciding ? <Loader2 className="size-4 animate-spin" /> : <ThumbsUp className="size-4" />}
              Approve
            </button>
            <button
              type="button"
              disabled={deciding}
              onClick={() => onDecide('reject')}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              <ThumbsDown className="size-4" />
              Reject
            </button>
            <button
              type="button"
              disabled={deciding}
              onClick={() => onDecide('defer')}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
            >
              <Clock className="size-4" />
              Defer
            </button>
          </div>
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Already {recommendation.status}. Only an open recommendation can be decided — the API
          refuses the rest, so a decision cannot be silently overwritten.
        </p>
      )}
    </div>
  )
}

function PriorityChip({ priority }: { priority: string }) {
  const tone =
    priority === 'critical'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : priority === 'high'
        ? 'border-primary/30 bg-primary/10 text-primary'
        : 'border-border bg-muted text-muted-foreground'

  if (!priority) return null

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${tone}`}>
      {priority}
    </span>
  )
}

function StatusChip({ status }: { status: string }) {
  return (
    <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
      {status}
    </span>
  )
}
