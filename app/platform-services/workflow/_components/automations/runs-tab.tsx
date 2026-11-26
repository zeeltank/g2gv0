'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { NativeSelect } from './native-select'
import { useConfirm } from '@/components/shared/scaffolds/use-confirm'
import { useListQuery } from '@/components/shared/scaffolds/use-list-query'
import type { ListQueryConfig } from '@/components/shared/scaffolds/list-query'
import { useGtmCanWrite, useGtmReady } from '@/components/domain/gtm/gtm-shared'
import { actionPhrase } from '@/lib/workflows/catalog'
import { workflowErrorMessage } from '@/lib/workflows/messages'
import { approveQuestion, decisionNotice, groupRunsByDay, OUTCOME_VALUES, outcomeOptions, runReason, runSubject } from '@/lib/workflows/runs'
import { runStatusChip } from '@/lib/workflows/status'
import { relativeTime } from '@/lib/workflows/time'
import { CHIP_BASE, chipClass, NOTE_TONE } from '@/lib/workflows/tones'
import { workflowsService, type GtmWorkflow, type WorkflowCatalog, type WorkflowRunRow } from '@/services/gtm/workflows'
import { cn } from '@/lib/utils'
import { RunDrawer } from './run-drawer'
import { TENANT_WIDE_NOTE } from './status-strip'

/** The status filter is `outcome` and the automation filter is `automation`; both live in the address, beside the tab and the module. */
const RUNS_CONFIG: ListQueryConfig = {
  filters: { outcome: { default: 'all', allowed: OUTCOME_VALUES }, automation: { default: 'all' } },
}

interface Loaded {
  catalog: WorkflowCatalog
  workflows: GtmWorkflow[]
  waiting: WorkflowRunRow[]
  runs: WorkflowRunRow[]
  counts: Record<string, number>
}

/** From this many rows on, the browser may skip drawing the rows that are off screen. */
const LONG_LIST = 50

const countsOf = (counts: Record<string, number> | []): Record<string, number> => (Array.isArray(counts) ? {} : counts)

/**
 * The Runs tab: what the automations did, as a timeline by day, with the runs that wait for an administrator first. Each run opens in a drawer with its
 * steps and, where the engine allows it, Approve, Reject, Retry and Cancel. The data is organisation-wide, like the Automations tab.
 */
export function RunsTab() {
  const ready = useGtmReady()
  const canWrite = useGtmCanWrite()
  const { query, setFilter } = useListQuery(RUNS_CONFIG)
  const { confirm, confirmDialog } = useConfirm()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState<Date>(() => new Date(0))
  const [open, setOpen] = useState<{ id: number; rejecting: boolean } | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const outcome = query.filters.outcome
  const automation = query.filters.automation
  const workflowId = /^\d+$/.test(automation) ? Number(automation) : undefined

  const load = useCallback(async () => {
    try {
      const status = outcome === 'all' ? undefined : outcome
      const [c, l, w, r] = await Promise.all([
        workflowsService.catalog(),
        workflowsService.list(),
        workflowsService.runs({ status: 'pending_approval', workflow_id: workflowId, limit: 50 }),
        status === 'pending_approval' ? Promise.resolve(null) : workflowsService.runs({ status, workflow_id: workflowId, limit: 100 }),
      ])
      setData({
        catalog: c.data,
        workflows: l.data.items,
        waiting: w.data.items,
        runs: r ? r.data.items : [],
        counts: countsOf((r ?? w).data.counts),
      })
      setNow(new Date())
      setError(null)
    } catch (e) {
      setError(workflowErrorMessage(e, 'The runs could not be loaded. Check your connection and try again.'))
    }
  }, [outcome, workflowId])

  useEffect(() => {
    if (!ready) return
    queueMicrotask(() => void load())
  }, [ready, load])

  // A run that waits has its own section, so the timeline leaves it out unless the filter asks for exactly those.
  const timeline = useMemo(() => (data ? data.runs.filter((r) => outcome !== 'all' || r.status !== 'pending_approval') : []), [data, outcome])
  const days = useMemo(() => groupRunsByDay(timeline, now), [timeline, now])
  const options = useMemo(() => outcomeOptions(data?.counts ?? {}), [data?.counts])
  const showWaiting = outcome === 'all' || outcome === 'pending_approval'

  const approve = async (run: WorkflowRunRow) => {
    if (!data) return
    const w = data.workflows.find((x) => x.id === run.workflow_id)
    const phrases = w ? w.actions.map((a) => actionPhrase(data.catalog, a.type)) : []
    if (!(await confirm({ ...approveQuestion(run, phrases), tone: 'default' }))) return
    setBusyId(run.id)
    setNotice(null)
    try {
      const r = await workflowsService.approve(run.id, '')
      setNotice({ tone: 'success', text: decisionNotice('approve', r.data.status) })
    } catch (e) {
      setNotice({ tone: 'error', text: workflowErrorMessage(e, 'That did not work. Check your connection and try again.', data.catalog) })
    } finally {
      setBusyId(null)
      await load()
    }
  }

  const automationsHref = (() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', 'automations')
    return `${pathname}?${params.toString()}`
  })()

  const nothingAtAll = data !== null && data.runs.length === 0 && data.waiting.length === 0 && outcome === 'all' && workflowId === undefined && Object.keys(data.counts).length === 0

  return (
    <div className="space-y-4">
      <p className="px-1 text-xs text-muted-foreground">{TENANT_WIDE_NOTE}</p>

      {notice && <p role={notice.tone === 'error' ? 'alert' : 'status'} className={cn('break-words rounded-lg border px-3 py-2 text-sm', NOTE_TONE[notice.tone])}>{notice.text}</p>}
      {error && <ErrorState title="The runs could not be loaded" description={error} retry={() => void load()} />}
      {!data && !error && (
        <div role="status" aria-label="Loading runs" className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      )}

      {data && nothingAtAll && (
        <EmptyState
          title="Nothing has run yet"
          description="A run is recorded each time something happens that an automation that is on is waiting for. Turn one on, and its runs appear here."
          action={<Link href={automationsHref} className="inline-flex min-h-8 items-center rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Go to Automations</Link>}
        />
      )}

      {data && !nothingAtAll && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Outcome
              <NativeSelect name="outcome" value={outcome} onChange={(e) => setFilter('outcome', e.target.value)} className="w-auto">
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                {!options.some((o) => o.value === outcome) && <option value={outcome}>{outcome}</option>}
              </NativeSelect>
            </label>
            <label className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              Automation
              <NativeSelect name="automation" value={automation} onChange={(e) => setFilter('automation', e.target.value)} className="w-auto max-w-full">
                <option value="all">All automations</option>
                {data.workflows.map((w) => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
              </NativeSelect>
            </label>
          </div>

          {showWaiting && (
            <section aria-labelledby="runs-waiting" className="space-y-3">
              <h2 id="runs-waiting" className="text-base font-semibold text-foreground">Waiting for you{data.waiting.length > 0 ? ` (${data.waiting.length})` : ''}</h2>
              {data.waiting.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing is waiting for your approval.</p>
              ) : (
                <ul className="space-y-3">
                  {data.waiting.map((run) => {
                    const w = data.workflows.find((x) => x.id === run.workflow_id)
                    const phrases = w ? w.actions.map((a) => actionPhrase(data.catalog, a.type)) : []
                    return (
                      <li key={run.id} data-run={run.id} className="space-y-3 rounded-lg border border-amber-500 bg-card p-4">
                        <div className="space-y-1">
                          <p className="break-words text-sm font-medium text-foreground">{run.workflow_name ?? 'An automation'}</p>
                          <p className="break-words text-sm text-muted-foreground">{runSubject(run)}, {relativeTime(run.created_at, now)}</p>
                          {phrases.length > 0 && <p className="break-words text-sm text-foreground">If you approve it: {phrases.join(', then ')}.</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {canWrite && <Button size="sm" disabled={busyId === run.id} onClick={() => void approve(run)}>Approve</Button>}
                          {canWrite && <Button size="sm" variant="outline" disabled={busyId === run.id} onClick={() => setOpen({ id: run.id, rejecting: true })}>Reject</Button>}
                          <Button size="sm" variant="ghost" aria-label={`Details of the run on ${runSubject(run)}`} onClick={() => setOpen({ id: run.id, rejecting: false })}>Details</Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )}

          {outcome !== 'pending_approval' && (
            <section aria-labelledby="runs-timeline" className="space-y-3">
              <h2 id="runs-timeline" className="text-base font-semibold text-foreground">What happened</h2>
              {days.length === 0 ? (
                <EmptyState
                  title="No runs match"
                  description="Try another outcome or another automation."
                  action={<Button variant="outline" onClick={() => { setFilter('outcome', 'all'); setFilter('automation', 'all') }}>Show all runs</Button>}
                />
              ) : days.map((day) => (
                <div key={day.heading} className="space-y-1.5">
                  <h3 className="px-1 text-xs font-medium text-muted-foreground">{day.heading}</h3>
                  <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                    {day.runs.map((run) => {
                      const chip = runStatusChip(run.status)
                      const reason = runReason(run, data.catalog, now)
                      return (
                        <li key={run.id} data-run={run.id} className={`flex flex-wrap items-start gap-x-4 gap-y-2 p-4${timeline.length > LONG_LIST ? ' [content-visibility:auto] [contain-intrinsic-size:auto_88px]' : ''}`}>
                          <div className="min-w-0 flex-1 basis-full space-y-1 sm:basis-0">
                            <p className="break-words text-sm font-medium text-foreground">{run.workflow_name ?? 'An automation'}</p>
                            <p className="break-words text-sm text-muted-foreground">{runSubject(run)}, {relativeTime(run.created_at, now)}</p>
                            {reason && <p className="break-words text-sm text-foreground">{reason}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`${CHIP_BASE} ${chipClass(chip.tone)}`}>{chip.word}</span>
                            <Button size="sm" variant="outline" aria-label={`Details of the run on ${runSubject(run)}`} onClick={() => setOpen({ id: run.id, rejecting: false })}>Details</Button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {open && data && (
        <RunDrawer
          key={`${open.id}-${open.rejecting}`}
          runId={open.id}
          catalog={data.catalog}
          workflows={data.workflows}
          canWrite={canWrite}
          startRejecting={open.rejecting}
          onClose={() => setOpen(null)}
          onChanged={() => void load()}
        />
      )}
      {confirmDialog}
    </div>
  )
}
