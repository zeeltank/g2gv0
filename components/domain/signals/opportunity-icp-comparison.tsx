'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleHelp, ExternalLink, Loader2, MinusCircle, XCircle } from 'lucide-react'
import { apiErrorText } from '@/lib/api-messages'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { opportunitiesService, type IcpComparisonResponse, type IcpCriterionStatus } from '@/services/signals/opportunities'

const STATUS: Record<IcpCriterionStatus, { cls: string; Icon: typeof CheckCircle2 }> = {
  Matched: { cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', Icon: CheckCircle2 },
  'Not found': { cls: 'border-border bg-muted text-muted-foreground', Icon: MinusCircle },
  'Needs review': { cls: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300', Icon: CircleHelp },
  Excluded: { cls: 'border-destructive/40 bg-destructive/10 text-destructive', Icon: XCircle },
}

/**
 * This signal laid next to its product's ICP, criterion by criterion. Read from the server only when opened (it starts nothing and changes nothing).
 * Evidence and sources are exactly what is stored; where none is stored the cell says so. It never says the signal is qualified: the server's own
 * stored result is shown as it is.
 */
export function OpportunityIcpComparison({ opportunityId }: { opportunityId: number }) {
  const [data, setData] = useState<IcpComparisonResponse['data'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (data || loading) return
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return
    setLoading(true)
    setError('')
    try {
      setData((await opportunitiesService.getIcpComparison(context, opportunityId)).data)
    } catch (e) {
      setError(apiErrorText(e, 'Could not load the comparison.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <details className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) void load() }}>
      <summary className="cursor-pointer text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Compare with the ICP</summary>
      <div className="mt-2 space-y-3" aria-live="polite">
        {loading && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Loading…</p>}
        {error && <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive"><AlertTriangle className="size-3.5" />{error}</p>}
        {data && !data.available && <p className="text-xs text-muted-foreground">{data.reason}</p>}
        {data && data.available && (
          <>
            <p className="text-xs text-muted-foreground">
              {data.product?.label} ICP{data.icp?.name ? ` “${data.icp.name}”` : ''}{data.icp?.version ? ` · version ${data.icp.version}` : ''}{data.icp?.status ? ` · ${data.icp.status}` : data.icp?.source === 'template' ? ' · built-in definition' : ''}.
              {' '}{data.stored_result.note}
            </p>
            {data.summary && (
              <p className="flex flex-wrap gap-1.5 text-xs">
                {(Object.keys(STATUS) as IcpCriterionStatus[]).map((s) => data.summary![s] > 0 && <span key={s} className={`rounded-full border px-2 py-0.5 ${STATUS[s].cls}`}>{data.summary![s]} {s}</span>)}
              </p>
            )}
            {data.criteria.length === 0 ? (
              <p className="text-xs text-muted-foreground">{data.notes[0] ?? 'This ICP has no criteria to compare.'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground">
                      <th scope="col" className="py-1.5 pr-3 font-medium">Criterion</th>
                      <th scope="col" className="py-1.5 pr-3 font-medium">Status</th>
                      <th scope="col" className="py-1.5 pr-3 font-medium">Evidence</th>
                      <th scope="col" className="py-1.5 pr-3 font-medium">Source</th>
                      <th scope="col" className="py-1.5 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.criteria.map((r, i) => {
                      const { cls, Icon } = STATUS[r.status]
                      return (
                        <tr key={`${r.kind}-${i}`} className="border-b border-border/40 align-top">
                          <td className="py-2 pr-3 text-foreground"><span className="block break-words">{r.criterion}</span><span className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.kind === 'must_have' ? 'Must have' : 'Exclusion'}</span></td>
                          <td className="py-2 pr-3"><span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 ${cls}`}><Icon className="size-3" aria-hidden />{r.status}</span></td>
                          <td className="py-2 pr-3 text-foreground"><span className="block break-words">{r.evidence ? r.evidence.text : <span className="text-muted-foreground">None stored</span>}</span></td>
                          <td className="py-2 pr-3 text-muted-foreground">
                            {r.source ? (
                              r.source.url
                                ? <a href={r.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">{r.source.label ?? 'Source'} <ExternalLink className="size-3" /></a>
                                : <span>{r.source.label}{r.source.ref ? ` · ${r.source.ref}` : ''}</span>
                            ) : '—'}
                          </td>
                          <td className="py-2 text-muted-foreground"><span className="block break-words">{r.reason}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {data.evidence.available
                ? <>Signal evidence: “{data.evidence.quote}”{data.evidence.quote_verified === false ? ' (not verified)' : ''}{data.evidence.source_url ? <> · <a href={data.evidence.source_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{data.evidence.source_title ?? 'source'}</a></> : null}</>
                : 'No verified evidence quote is stored for this signal.'}
              {data.stored_result.qualification ? ` Stored qualification: ${data.stored_result.qualification}.` : ''}
            </p>
          </>
        )}
      </div>
    </details>
  )
}
