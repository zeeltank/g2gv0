'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Download, Eye, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { PageTabs, TabPanel, type PageTab } from '@/components/shared/scaffolds/page-tabs'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import { taskService } from '@/services/task'
import type { DeadlineExtension, ExtensionFilterOptions, ExtensionQueueSummary, ExtensionStatus } from '@/types/task-management'
import { formatDay, formatDayShort } from '../task-detail/date-utils'
import {
  EXTENSION_SORTS, EXTENSION_STATUSES, EXTENSION_TABS, PAGE_SIZES, SORT_LABELS, STATUS_LABELS, TAB_LABELS,
  clearedFilters, countCustomFilters, describeFilters, presetFor, readFilters, toQueueParams, writeFilters,
  type ExtensionFilters, type ExtensionTab,
} from './extension-filter-state'
import {
  ageTone, decidedCount, formatApprovalRate, formatDaysRequested, formatDecisionTime, isSelectable, needsAttention, ordinal, waitingDays, whyNotSelectable,
} from './extension-format'
import { ExtensionRequestSheet } from './extension-request-sheet'

/**
 * EVERY DEADLINE-EXTENSION REQUEST, WITH THE FILTERS THAT MAKE THE LIST USABLE.
 *
 * The Dashboard had no screen for these: a request lived on its task and nowhere
 * else, so a manager could not see what was waiting, for how long, or who asks
 * again and again. This is that screen - the headline numbers, saved views as
 * tabs, every filter the queue endpoint understands (kept in the URL), bulk
 * approve and decline, and a side preview with the request's history.
 *
 * Two rules are not obvious from the screen. A decline cannot be sent without a
 * reason - the requester is owed one. And nothing here guesses a role: whether a
 * row can be decided or withdrawn is the server's `can_decide` / `can_withdraw`,
 * which is also what the server enforces when the button is pressed.
 */
export function ExtensionRequestsView({ onChanged, onOpenTask }: {
  onChanged?: () => void
  onOpenTask: (taskId: string) => void
}) {
  const [filters, setFilters] = useState<ExtensionFilters>(() => presetFor('awaiting_me'))
  const [searchInput, setSearchInput] = useState('')
  const [rows, setRows] = useState<DeadlineExtension[]>([])
  const [summary, setSummary] = useState<ExtensionQueueSummary | null>(null)
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, per_page: 25, total: 0 })
  const [scope, setScope] = useState<'organisation' | 'own'>('own')
  const [options, setOptions] = useState<ExtensionFilterOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ text: string; failures: Array<{ title: string; reason: string }> } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<DeadlineExtension | null>(null)
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  const [declineIds, setDeclineIds] = useState<string[] | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [declineAttempted, setDeclineAttempted] = useState(false)
  const [approveIds, setApproveIds] = useState<string[] | null>(null)
  const [withdrawRow, setWithdrawRow] = useState<DeadlineExtension | null>(null)
  /** The URL has been read and the filters are the real ones: nothing loads before this, so there is no first request with the wrong filters. */
  const [urlRead, setUrlRead] = useState(false)
  const hadTab = useRef(true)
  const firstLoad = useRef(true)
  /** Ids that failed in the last bulk call: they stay ticked after the reload so the person can see and retry them. */
  const keepSelected = useRef<Set<string> | null>(null)

  // Read the URL once, after mount: a shared link or a reload lands on the same view.
  useEffect(() => {
    queueMicrotask(() => {
      const fromUrl = readFilters(window.location.search)
      hadTab.current = fromUrl.hadTab
      setFilters(fromUrl.hadTab ? fromUrl.filters : { ...fromUrl.filters, tab: 'awaiting_me' })
      setSearchInput(fromUrl.filters.q)
      setUrlRead(true)
    })
  }, [])

  // And keep it written, so what is on screen is what a copied link opens.
  useEffect(() => {
    if (!urlRead) return
    const search = writeFilters(filters, window.location.search)
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${search ? `?${search}` : ''}`)
  }, [filters, urlRead])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => (current.q === searchInput.trim() ? current : { ...current, q: searchInput.trim(), page: 1 }))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadSeq = useRef(0)
  const load = useCallback(async () => {
    // Only the NEWEST request may write to the screen. The first, unfiltered request is the slow one: without this it
    // finished after a filter click and put the whole list back (found live: "Mine" showed 1 row, then 25).
    const seq = ++loadSeq.current
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const response = await taskService.getExtensionQueue(context, { ...toQueueParams(filters), includeFilters: firstLoad.current })
      if (seq !== loadSeq.current) return
      const data = response.data
      setRows(data.requests); setSummary(data.summary); setPagination(data.pagination); setScope(data.scope)
      if (data.filters) setOptions(data.filters)
      const keep = keepSelected.current
      keepSelected.current = null
      setSelectedIds(keep ? new Set(data.requests.filter((row) => keep.has(row.id)).map((row) => row.id)) : new Set())
      // A link that named no view lands on the queue that has something in it.
      if (firstLoad.current && !hadTab.current && data.summary.counts.awaiting_me === 0 && filters.tab === 'awaiting_me') {
        setFilters((current) => ({ ...current, tab: 'all' }))
      }
      firstLoad.current = false
    } catch (reason) {
      if (seq === loadSeq.current) setError(reason instanceof Error ? reason.message : 'Unable to load the extension requests.')
    } finally { if (seq === loadSeq.current) setLoading(false) }
  }, [filters])

  useEffect(() => { if (urlRead) queueMicrotask(() => { void load() }) }, [load, reload, urlRead])

  useEffect(() => {
    if (!selectedIds.size) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedIds(new Set()) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds.size])

  const update = (patch: Partial<ExtensionFilters>) => setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }))
  const customCount = countCustomFilters(filters)
  const nameOf = (list: Array<{ id: string; name: string }> | undefined, id: string) => list?.find((item) => item.id === id)?.name ?? id
  const described = describeFilters(filters, {
    department: (id) => nameOf(options?.departments, id), requester: (id) => nameOf(options?.requesters, id), decider: (id) => nameOf(options?.deciders, id),
  })

  const changed = () => { setReload((value) => value + 1); onChanged?.() }
  const titleOf = (id: string) => rows.find((row) => row.id === id)?.task_title ?? `Request ${id}`

  /** One request, one endpoint: its own message is the most useful thing to show. Several go through the bulk endpoint. */
  async function decide(ids: string[], decision: 'approve' | 'reject', remarks = ''): Promise<boolean> {
    const context = getLaravelContext()
    setBusy(true); setNotice(null); setError('')
    try {
      if (ids.length === 1) {
        const response = await taskService.decideDeadlineExtension(context, ids[0], decision, remarks)
        setNotice({ text: response.message, failures: [] })
      } else {
        const response = await taskService.bulkDecideExtensions(context, ids, decision, remarks)
        const failed = response.data.results.filter((result) => !result.ok)
        keepSelected.current = new Set(failed.map((result) => result.id))
        setNotice({ text: response.message, failures: failed.map((result) => ({ title: titleOf(result.id), reason: result.reason ?? 'Not decided.' })) })
      }
      changed()
      return true
    } catch (reason) {
      // A 409 means somebody else got there first: say so, and reload to show what is true now.
      setError(reason instanceof Error ? reason.message : 'Unable to record the decision.')
      changed()
      return false
    } finally { setBusy(false) }
  }

  async function withdraw(row: DeadlineExtension): Promise<boolean> {
    setBusy(true); setNotice(null); setError('')
    try {
      const response = await taskService.withdrawDeadlineExtension(getLaravelContext(), row.id)
      setNotice({ text: response.message, failures: [] })
      changed()
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to withdraw the request.')
      changed()
      return false
    } finally { setBusy(false) }
  }

  const selectable = rows.filter(isSelectable)
  const allTicked = selectable.length > 0 && selectable.every((row) => selectedIds.has(row.id))
  const toggle = (id: string) => setSelectedIds((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next })

  const exportUrl = useMemo(() => {
    const context = getLaravelContext()
    return isLaravelContextReady(context) ? taskService.extensionQueueExportUrl(context, toQueueParams(filters)) : '#'
  }, [filters])

  const tabs: PageTab[] = EXTENSION_TABS.map((id) => ({
    id, label: TAB_LABELS[id],
    count: summary ? ({ awaiting_me: summary.counts.awaiting_me, mine: summary.counts.mine, all: summary.counts.all, decided: summary.counts.decided, overdue: null } as const)[id] : null,
  }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {scope === 'organisation'
            ? 'Every request in your organisation.'
            : 'Your own requests, and the ones on tasks you own.'}
        </p>
        <a href={exportUrl} download className="inline-flex h-8 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent">
          <Download className="size-4" aria-hidden="true" />Export CSV
        </a>
      </div>

      {summary && <Kpis summary={summary} onPending={() => update({ ...clearedFilters({ ...filters, tab: 'awaiting_me' }), tab: 'awaiting_me' })} onRepeat={() => update({ ...clearedFilters({ ...filters, tab: 'all' }), tab: 'all', repeat: true })} />}

      <PageTabs
        tabs={tabs}
        active={filters.tab}
        onChange={(id) => setFilters({ ...presetFor(id as ExtensionTab), sort: filters.sort, perPage: filters.perPage })}
        label="Extension request views"
        idPrefix="ext"
      />

      <TabPanel id={filters.tab} active={filters.tab} idPrefix="ext">
        <div className="space-y-3 pt-3">
          <FilterBar
            filters={filters} searchInput={searchInput} onSearch={setSearchInput} onChange={update} options={options}
            custom={customCount} onClear={() => { setSearchInput(''); setFilters(clearedFilters(filters)) }}
          />

          {notice && (
            <div role="status" className="rounded-xl border border-success/30 bg-success/5 p-3 text-sm">
              <div className="flex items-start justify-between gap-2"><p className="text-green-700 dark:text-green-300">{notice.text}</p>
                <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message" className="rounded p-0.5 hover:bg-accent"><X className="size-4" /></button></div>
              {notice.failures.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-red-700 dark:text-red-300">
                  {notice.failures.map((failure, index) => <li key={index}><strong>{failure.title}</strong>: {failure.reason}</li>)}
                </ul>
              )}
            </div>
          )}
          {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

          <p className="sr-only" aria-live="polite">{loading ? 'Loading requests' : `${pagination.total} request${pagination.total === 1 ? '' : 's'}`}</p>

          {loading && !rows.length ? (
            <div className="flex h-56 items-center justify-center rounded-2xl border bg-card"><Spinner /></div>
          ) : !rows.length ? (
            <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-2xl border bg-card px-6 text-center text-sm text-muted-foreground">
              {described.length
                ? <p>No requests match: {described.join(', ')}.</p>
                : <p>{filters.tab === 'awaiting_me' ? 'Nothing is waiting for you.' : filters.tab === 'mine' ? 'You have not asked for more time on any task.' : 'No extension requests yet.'}</p>}
              {customCount > 0 && <Button variant="outline" size="sm" onClick={() => { setSearchInput(''); setFilters(clearedFilters(filters)) }}>Clear filters</Button>}
            </div>
          ) : (
            <RequestTable
              rows={rows} selectedIds={selectedIds} allTicked={allTicked} selectableCount={selectable.length}
              onToggle={toggle} onToggleAll={(on) => setSelectedIds(on ? new Set(selectable.map((row) => row.id)) : new Set())}
              onOpen={setPreview} onApprove={(row) => setApproveIds([row.id])} onDecline={(row) => { setDeclineIds([row.id]); setDeclineReason(''); setDeclineAttempted(false) }}
              onWithdraw={setWithdrawRow} busy={busy}
            />
          )}

          {rows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground tabular-nums">
                Showing {(pagination.current_page - 1) * pagination.per_page + 1}-{(pagination.current_page - 1) * pagination.per_page + rows.length} of {pagination.total}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-muted-foreground">Per page
                  <select value={filters.perPage} onChange={(event) => update({ perPage: Number(event.target.value) })} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                    {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>
                <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}>Previous</Button>
                <span className="tabular-nums">Page {pagination.current_page} of {pagination.last_page}</span>
                <Button variant="outline" size="sm" disabled={filters.page >= pagination.last_page} onClick={() => update({ page: filters.page + 1 })}>Next</Button>
              </div>
            </div>
          )}
        </div>
      </TabPanel>

      {selectedIds.size > 0 && (
        <div role="region" aria-label="Bulk actions" className="sticky bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-2 shadow-lg">
          <span className="text-sm font-medium tabular-nums">{selectedIds.size} selected</span>
          {selectedIds.size < selectable.length && <Button variant="link" size="xs" onClick={() => setSelectedIds(new Set(selectable.map((row) => row.id)))}>Select all {selectable.length} on this page</Button>}
          <Button size="sm" disabled={busy} onClick={() => setApproveIds(Array.from(selectedIds))}>Approve selected</Button>
          <Button size="sm" variant="outline" className="text-red-700 dark:text-red-300" disabled={busy} onClick={() => { setDeclineIds(Array.from(selectedIds)); setDeclineReason(''); setDeclineAttempted(false) }}>Decline selected…</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      <ExtensionRequestSheet
        row={preview}
        busy={busy}
        onClose={() => setPreview(null)}
        onOpenTask={(taskId) => { setPreview(null); onOpenTask(taskId) }}
        onApprove={async (row) => { const ok = await decide([row.id], 'approve'); if (ok) setPreview(null); return ok }}
        onDecline={async (row, remarks) => { const ok = await decide([row.id], 'reject', remarks); if (ok) setPreview(null); return ok }}
        onWithdraw={async (row) => { const ok = await withdraw(row); if (ok) setPreview(null); return ok }}
      />

      <ConfirmDialog
        open={approveIds !== null}
        onOpenChange={(next) => { if (!next) setApproveIds(null) }}
        title={approveIds && approveIds.length > 1 ? `Approve ${approveIds.length} requests?` : 'Approve this request?'}
        description="The due date of each task moves to the date its requester asked for, and each requester is told."
        confirmLabel="Approve"
        tone="default"
        busy={busy}
        onConfirm={() => { const ids = approveIds ?? []; setApproveIds(null); void decide(ids, 'approve') }}
      />
      <ConfirmDialog
        open={withdrawRow !== null}
        onOpenChange={(next) => { if (!next) setWithdrawRow(null) }}
        title="Withdraw this request?"
        description="The task keeps its current due date, and the person who would have decided is told."
        confirmLabel="Withdraw request"
        busy={busy}
        onConfirm={() => { const target = withdrawRow; setWithdrawRow(null); if (target) void withdraw(target) }}
      />

      <Dialog open={declineIds !== null} onOpenChange={(next) => { if (!next) setDeclineIds(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{declineIds && declineIds.length > 1 ? `Decline ${declineIds.length} requests` : 'Decline this request'}</DialogTitle>
            <DialogDescription>The requester is owed a reason. It is sent to them and kept on the record.</DialogDescription>
          </DialogHeader>
          <textarea
            value={declineReason}
            onChange={(event) => setDeclineReason(event.target.value)}
            aria-label="Reason"
            aria-invalid={declineAttempted && !declineReason.trim()}
            className={cn('min-h-24 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/40', declineAttempted && !declineReason.trim() ? 'border-destructive' : 'border-input')}
          />
          {declineAttempted && !declineReason.trim() && <p className="text-xs text-red-700 dark:text-red-300">Say why it is declined.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeclineIds(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={() => { setDeclineAttempted(true); if (declineIds && declineReason.trim()) { const ids = declineIds; setDeclineIds(null); void decide(ids, 'reject', declineReason) } }}>Decline</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** The headline numbers. They describe everything the viewer can see, so they do not move while a filter is typed. */
function Kpis({ summary, onPending, onRepeat }: { summary: ExtensionQueueSummary; onPending: () => void; onRepeat: () => void }) {
  const decided = decidedCount(summary)
  const tiles: Array<{ label: string; value: string; note: string; tone?: 'warn'; action?: () => void }> = [
    { label: 'Pending', value: String(summary.pending), note: 'waiting for a decision', action: onPending },
    { label: 'Oldest pending', value: summary.oldest_pending_days === null ? '-' : `${summary.oldest_pending_days} d`, note: 'longest wait', tone: (summary.oldest_pending_days ?? 0) >= 3 ? 'warn' : undefined },
    { label: 'Approval rate', value: formatApprovalRate(summary.approval_rate), note: decided ? `of ${decided} decided` : 'nothing decided yet' },
    { label: 'Avg decision time', value: formatDecisionTime(summary.avg_decision_hours), note: 'from request to decision' },
    { label: 'Repeat extenders', value: String(summary.repeat_extenders), note: 'tasks asked about twice or more', action: onRepeat },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {tiles.map((tile) => {
        const body = (
          <div className={cn('h-full rounded-xl border bg-card p-3 text-left', tile.action && 'transition-colors hover:border-primary/40')}>
            <p className="text-xs font-medium text-muted-foreground">{tile.label}</p>
            <p className={cn('text-2xl font-bold tabular-nums', tile.tone === 'warn' && 'text-amber-700 dark:text-amber-300')}>{tile.value}</p>
            <p className="text-xs text-muted-foreground">{tile.note}</p>
          </div>
        )
        return tile.action
          ? <button key={tile.label} type="button" onClick={tile.action} className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">{body}</button>
          : <div key={tile.label}>{body}</div>
      })}
    </div>
  )
}

const FIELD = 'h-9 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

function FilterBar({ filters, searchInput, onSearch, onChange, options, custom, onClear }: {
  filters: ExtensionFilters
  searchInput: string
  onSearch: (value: string) => void
  onChange: (patch: Partial<ExtensionFilters>) => void
  options: ExtensionFilterOptions | null
  custom: number
  onClear: () => void
}) {
  const toggleStatus = (status: ExtensionStatus) => onChange({
    status: filters.status.includes(status) ? filters.status.filter((item) => item !== status) : [...filters.status, status],
  })
  return (
    <div className="space-y-2 rounded-2xl border border-primary/10 bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input value={searchInput} onChange={(event) => onSearch(event.target.value)} aria-label="Search requests" placeholder="Search reason, remarks or task…" className={cn(FIELD, 'w-full pl-9')} />
        </div>
        <div role="group" aria-label="Status" className="flex flex-wrap items-center gap-1.5">
          {EXTENSION_STATUSES.map((status) => (
            <button key={status} type="button" aria-pressed={filters.status.includes(status)} onClick={() => toggleStatus(status)}
              className={cn('h-8 rounded-full border px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring', filters.status.includes(status) ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-accent')}>
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">Sort
          <select value={filters.sort} onChange={(event) => onChange({ sort: event.target.value as ExtensionFilters['sort'] })} className={FIELD}>
            {EXTENSION_SORTS.map((sort) => <option key={sort} value={sort}>{SORT_LABELS[sort]}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Select label="Priority" value={filters.priority} onChange={(value) => onChange({ priority: value })} options={(options?.priorities ?? []).map((name) => ({ id: name, name }))} />
        <Select label="Department" value={filters.departmentId} onChange={(value) => onChange({ departmentId: value })} options={options?.departments ?? []} />
        <Select label="Requester" value={filters.requesterId} onChange={(value) => onChange({ requesterId: value })} options={options?.requesters ?? []} />
        <Select label="Decided by" value={filters.decidedBy} onChange={(value) => onChange({ decidedBy: value })} options={options?.deciders ?? []} />
        <fieldset className="flex items-end gap-1.5"><legend className="mb-1 text-xs text-muted-foreground">Requested between</legend>
          <input type="date" aria-label="Requested from" value={filters.requestedFrom} max={filters.requestedTo || undefined} onChange={(event) => onChange({ requestedFrom: event.target.value })} className={FIELD} />
          <input type="date" aria-label="Requested to" value={filters.requestedTo} min={filters.requestedFrom || undefined} onChange={(event) => onChange({ requestedTo: event.target.value })} className={FIELD} />
        </fieldset>
        <fieldset className="flex items-end gap-1.5"><legend className="mb-1 text-xs text-muted-foreground">Days extended</legend>
          <input inputMode="numeric" aria-label="Minimum days" placeholder="min" value={filters.minDays} onChange={(event) => onChange({ minDays: event.target.value.replace(/\D/g, '') })} className={cn(FIELD, 'w-16')} />
          <input inputMode="numeric" aria-label="Maximum days" placeholder="max" value={filters.maxDays} onChange={(event) => onChange({ maxDays: event.target.value.replace(/\D/g, '') })} className={cn(FIELD, 'w-16')} />
        </fieldset>
        <label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" checked={filters.repeat} onChange={(event) => onChange({ repeat: event.target.checked })} />Repeat extenders only</label>
        <label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" checked={filters.overdueAtRequest} onChange={(event) => onChange({ overdueAtRequest: event.target.checked })} />Overdue at request</label>
        <div className="ml-auto flex items-center gap-2">
          {custom > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary" aria-label={`${custom} filters applied`}>Custom · {custom}</span>}
          <Button variant="ghost" size="sm" disabled={custom === 0} onClick={onClear}>Clear all</Button>
        </div>
      </div>
    </div>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ id: string; name: string }> }) {
  return (
    <label className="flex flex-col text-xs text-muted-foreground">{label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={cn(FIELD, 'mt-1 min-w-32 text-foreground')}>
        <option value="">Any</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  )
}

function RequestTable({ rows, selectedIds, allTicked, selectableCount, onToggle, onToggleAll, onOpen, onApprove, onDecline, onWithdraw, busy }: {
  rows: DeadlineExtension[]
  selectedIds: Set<string>
  allTicked: boolean
  selectableCount: number
  onToggle: (id: string) => void
  onToggleAll: (on: boolean) => void
  onOpen: (row: DeadlineExtension) => void
  onApprove: (row: DeadlineExtension) => void
  onDecline: (row: DeadlineExtension) => void
  onWithdraw: (row: DeadlineExtension) => void
  busy: boolean
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-primary/10 bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-primary/[0.045]">
            <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-4 py-3"><input type="checkbox" checked={allTicked} disabled={selectableCount === 0} onChange={(event) => onToggleAll(event.target.checked)} aria-label="Select every request on this page that you can decide" /></th>
              <th className="px-3 py-3">Task</th><th className="px-3 py-3">Requester</th><th className="px-3 py-3">Dates</th><th className="px-3 py-3">Reason</th>
              <th className="px-3 py-3">Waiting</th><th className="px-3 py-3">Ask #</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const days = formatDaysRequested(row.days_requested)
              const tone = ageTone(row)
              const original = row.original_date ?? (row.status === 'approved' ? null : row.current_due_date)
              return (
                <tr key={row.id} className={cn('border-b last:border-0 hover:bg-muted/30', selectedIds.has(row.id) ? 'bg-primary/5' : needsAttention(row) && 'bg-warning/[0.04]')}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selectedIds.has(row.id)} disabled={!isSelectable(row)} title={isSelectable(row) ? undefined : whyNotSelectable(row)} onChange={() => onToggle(row.id)} aria-label={`Select ${row.task_title}`} />
                  </td>
                  <td className="max-w-64 px-3 py-3"><button type="button" onClick={() => onOpen(row)} className="text-left font-semibold hover:underline">{row.task_title}</button>{row.priority && <p className="text-xs text-muted-foreground">{row.priority}</p>}</td>
                  <td className="px-3 py-3">{row.requested_by ?? '-'}{row.department && <p className="text-xs text-muted-foreground">{row.department}</p>}</td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                    <span>{original ? `${formatDayShort(original)} → ` : ''}{formatDay(row.requested_date)}</span>
                    {days && <span className="ml-1.5 text-muted-foreground">{days}</span>}
                    {row.overdue_at_request && <p className="mt-0.5"><span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-300">Overdue at request</span></p>}
                  </td>
                  <td className="max-w-56 px-3 py-3"><p className="truncate" title={row.reason ?? undefined}>{row.reason || <span className="text-muted-foreground">-</span>}</p></td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                    {row.status === 'pending'
                      ? <span className={cn(tone === 'late' && 'font-semibold text-red-700 dark:text-red-300', tone === 'warn' && 'font-semibold text-amber-700 dark:text-amber-300')}>{waitingDays(row)} d{tone === 'late' ? ' - long wait' : ''}</span>
                      : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="px-3 py-3 tabular-nums">{(row.nth ?? 1) >= 2 ? <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">{ordinal(row.nth ?? 1)}</span> : <span className="text-muted-foreground">1st</span>}</td>
                  <td className="px-3 py-3"><StatusBadge status={row.status} label={STATUS_LABELS[row.status]} size="sm" /></td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1">
                      {row.can_decide && <>
                        <Button variant="ghost" size="icon" title="Approve" aria-label={`Approve ${row.task_title}`} disabled={busy} onClick={() => onApprove(row)}><Check className="size-4 text-green-700 dark:text-green-300" /></Button>
                        <Button variant="ghost" size="icon" title="Decline" aria-label={`Decline ${row.task_title}`} disabled={busy} onClick={() => onDecline(row)}><X className="size-4 text-red-700 dark:text-red-300" /></Button>
                      </>}
                      {row.can_withdraw && <Button variant="outline" size="xs" disabled={busy} onClick={() => onWithdraw(row)}>Withdraw</Button>}
                      <Button variant="ghost" size="icon" title="Details" aria-label={`Details of ${row.task_title}`} onClick={() => onOpen(row)}><Eye className="size-4" /></Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
