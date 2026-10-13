'use client'

/**
 * The backlog — work written down before it has an owner.
 *
 * ── ONE COMPONENT, TWO HOSTS ────────────────────────────────────────────────
 *
 * `projectId` decides which. A project id files new items there automatically
 * and shows only that project's; `null` is the task dashboard, where items
 * group by project with a "Not filed" bucket at the top. Two components would
 * drift the first time either gained a field; one with a prop cannot.
 *
 * ── WHY IT IS A NOTEPAD ─────────────────────────────────────────────────────
 *
 * Only the title is required. The point of a backlog is that somebody can
 * write "post on social media" without first answering who, when, under which
 * project, or against which job role — every one of which the task form asks.
 * Type, priority, notes and workstream are all optional and can arrive later.
 *
 * ── THE TYPE VOCABULARY IS DELIBERATELY NOT SOFTWARE ────────────────────────
 *
 * Story / Epic / Bug would be meaningless to a property or clinical team, and
 * this module is used by both. Each of these completes the sentence "this is…"
 * in any industry.
 *
 * ── ORDERING SERVES BOTH GESTURES ───────────────────────────────────────────
 *
 * Drag is hand-rolled HTML5 — there is no drag library in this project and
 * adding one for a single list would be out of proportion. HTML5 drag has NO
 * keyboard path, so the up/down buttons are the accessible equivalent rather
 * than a lesser alternative, and both call the same endpoint. Choosing a
 * non-manual sort disables dragging, because a drag under a priority sort
 * would write an order the view cannot show.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, CheckCircle2, Eye, GripVertical, Inbox, Pencil, Plus, Send, Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import { cn } from '@/lib/utils'
import { PriorityBadge } from './priority-badge'
import type {
  BacklogItem, BacklogPayload, BacklogStatus, BacklogType, WorkstreamSummary,
} from '@/types/task-management'

/** Domain-neutral: each completes "this is…" for software, property or care. */
const TYPE_LABEL: Record<BacklogType, string> = {
  NEW: 'New work',        // "create new feature" · list a new property
  FIX: 'Fix',             // "bug fix in this module" · repair the boiler
  IMPROVE: 'Improvement', // make something existing better
  SETUP: 'Setup',         // "onboarding creation" · credential a new nurse
  ROUTINE: 'Routine',     // "post on social media" · monthly cabinet audit
  REQUEST: 'Request',     // somebody asked for it — and the column default
}

const SORTS = [
  { value: 'rank', label: 'Manual order' },
  { value: 'priority', label: 'Priority' },
  { value: 'newest', label: 'Newest first' },
] as const

const PRIORITY_WEIGHT: Record<string, number> = { High: 0, Medium: 1, Low: 2 }

/** Mirrors BacklogController::RANK_STEP — the optimistic local reorder below
 *  computes the same midpoint the backend will, so the one display re-sort
 *  this triggers already matches what the server is about to confirm. */
const RANK_STEP = 1000

type SubTab = 'open' | 'assigned' | 'closed'

const SUB_TABS: Array<{ key: SubTab; label: string; icon: typeof Inbox }> = [
  { key: 'open', label: 'Open', icon: Inbox },
  { key: 'assigned', label: 'Assigned', icon: Send },
  { key: 'closed', label: 'Closed', icon: CheckCircle2 },
]

const EMPTY_FOR_TAB: Record<SubTab, string> = {
  open: 'Nothing open right now — the backlog is clear.',
  assigned: 'Nothing assigned yet. Use Assign on an open item to hand it to someone.',
  closed: 'Nothing closed yet.',
}

export interface BacklogBoardHandle {
  refresh: () => void
}

export function BacklogBoard({
  projectId, workstreams, onAssign, onCountChange,
}: {
  /** null = the task dashboard: everything, grouped by project. */
  projectId: string | null
  workstreams?: WorkstreamSummary[]
  /** Opens the task assign drawer, pre-filled from this item. */
  onAssign?: (item: BacklogItem) => void
  onCountChange?: (open: number) => void
}) {
  const [items, setItems] = useState<BacklogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [dialog, setDialog] = useState<{ open: boolean; item: BacklogItem | null }>({ open: false, item: null })
  const [viewing, setViewing] = useState<BacklogItem | null>(null)
  const [sort, setSort] = useState<(typeof SORTS)[number]['value']>('rank')
  const [dragging, setDragging] = useState<string | null>(null)
  const [subTab, setSubTab] = useState<SubTab>('open')

  const load = useCallback(async () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await taskService.getBacklog(context, projectId ?? undefined)
      setItems(response.data.items)
    } catch (reason) {
      /*
       * A 404 on the COLLECTION is not "not found" in the way a 404 on an item
       * is — the list endpoint always exists and always answers, even when the
       * backlog is empty. It can only mean the route is absent, i.e. this
       * server is running a build from before the backlog shipped. That is a
       * deployment fact, and "API Error: 404 Not Found" sends the reader to
       * look for a missing record that was never missing.
       *
       * Only this one case is translated. Every other failure keeps the
       * server's own sentence, which is usually the more useful half.
       */
      const status = (reason as { status?: number } | null)?.status
      setError(
        status === 404
          ? 'The backlog service is not available on this server yet. It arrives with the next backend deployment.'
          : reason instanceof Error ? reason.message : 'Unable to load the backlog.',
      )
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { queueMicrotask(() => { void load() }) }, [load])

  /*
   * A ref, NOT a dependency. If a host passes an inline arrow, listing the
   * callback here makes the effect re-run every render, which calls setState
   * in the parent, which re-renders — the "Maximum update depth exceeded"
   * crash this module has already shipped once. The effect depends only on
   * the data that actually changed.
   */
  const countReporter = useRef(onCountChange)
  countReporter.current = onCountChange
  const openCount = items.filter((i) => i.status === 'OPEN').length
  useEffect(() => { countReporter.current?.(openCount) }, [openCount])

  const run = async (action: () => Promise<{ message: string }>) => {
    setSaving(true)
    try {
      const response = await action()
      setMessage(response.message)
      await load()
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const save = async (payload: BacklogPayload) => {
    const context = getLaravelContext()
    const editing = dialog.item
    const done = await run(() => editing
      ? taskService.updateBacklogItem(context, editing.id, payload)
      : taskService.createBacklogItem(context, { ...payload, project_id: projectId ?? payload.project_id ?? null }))
    if (done) setDialog({ open: false, item: null })
  }

  const remove = async (item: BacklogItem) => {
    if (!window.confirm(`Remove "${item.title}" from the backlog?`)) return
    await run(() => taskService.deleteBacklogItem(getLaravelContext(), item.id))
  }

  /*
   * Both the drag and the up/down buttons land here. One endpoint, one row.
   *
   * This reorders LOCALLY first — the new rank is the same midpoint the
   * backend computes (rankBetween, RANK_STEP=1000) — rather than going
   * through run()/load(), which flips `loading` true and swaps the whole
   * board for a spinner on every single drop. The API call still happens;
   * it only resyncs with a full reload if the server disagreed.
   */
  const move = async (id: string, beforeId: string | null, afterId: string | null) => {
    const before = beforeId ? items.find((i) => i.id === beforeId) : null
    const after = afterId ? items.find((i) => i.id === afterId) : null
    const newRank = before && after
      ? Math.floor((before.rank + after.rank) / 2)
      : after
        ? after.rank - RANK_STEP
        : before
          ? before.rank + RANK_STEP
          : 0
    setItems((current) => current.map((i) => (i.id === id ? { ...i, rank: newRank } : i)))
    try {
      await taskService.rankBacklogItem(getLaravelContext(), id, { before_id: beforeId, after_id: afterId })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reorder.')
      await load()
    }
  }

  const sorted = useMemo(() => {
    const rows = [...items]
    if (sort === 'priority') {
      rows.sort((a, b) => (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9))
    } else if (sort === 'newest') {
      rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    } else {
      rows.sort((a, b) => a.rank - b.rank)
    }
    return rows
  }, [items, sort])

  /*
   * Counted on ALL of `items`, not the sub-tab's own rows — a tab's own count
   * must stay visible while another tab is the one on screen, or the pill
   * bar can't show someone what's waiting in the tab they are not looking
   * at.
   */
  const counts: Record<SubTab, number> = useMemo(() => ({
    open: items.filter((i) => i.status === 'OPEN').length,
    assigned: items.filter((i) => i.status === 'ASSIGNED').length,
    closed: items.filter((i) => i.status === 'DONE' || i.status === 'DROPPED').length,
  }), [items])

  /*
   * Fully separated by status — an assigned item no longer appears anywhere
   * in the Open tab. Each tab is its own flat list rather than a grouped one,
   * since the group label would otherwise just repeat the tab's own name.
   */
  const visible = useMemo(() => sorted.filter((i) => (
    subTab === 'open' ? i.status === 'OPEN'
      : subTab === 'assigned' ? i.status === 'ASSIGNED'
        : i.status === 'DONE' || i.status === 'DROPPED'
  )), [sorted, subTab])

  if (loading) return <div className="flex h-40 items-center justify-center"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Backlog
            <span className="ml-1.5 text-[11px] font-normal tabular-nums text-muted-foreground">{items.length}</span>
          </span>
          <div className="w-40 min-w-0">
            {/* Sized wrapper, not className — Select's root is hardcoded
                w-full and its className reaches only the inner button. */}
            <Select value={sort} onChange={(v) => setSort(v as typeof sort)} size="sm"
              aria-label="Sort the backlog"
              options={SORTS.map((s) => ({ value: s.value, label: s.label }))} />
          </div>
          {sort !== 'rank' && (
            <span className="text-[11px] text-muted-foreground">
              Drag is off while sorted — switch to Manual order to reorder.
            </span>
          )}
        </div>

        <Button size="sm" onClick={() => setDialog({ open: true, item: null })}>
          <Plus className="mr-1 size-3.5" /> Add item
        </Button>
      </div>

      {/* Open / Assigned / Closed — a segmented control, not three sections
          in one scroll. An assigned item is never visible from here while
          the Open tab is the one showing. */}
      <div role="tablist" aria-label="Backlog status" className="inline-flex items-center gap-1 rounded-lg border bg-muted/30 p-0.5 text-xs font-medium">
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" role="tab" aria-selected={subTab === key}
            onClick={() => setSubTab(key)}
            className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 transition',
              subTab === key ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
            <span className="tabular-nums">{counts[key]}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}
      {message && <p role="status" className="text-sm text-success">{message}</p>}

      {/*
        * The empty state is an assertion — "there is nothing here" — so it may
        * only be shown when the list actually came back. After a failed load
        * `items` is empty because nothing arrived, not because the backlog is
        * empty, and saying so next to an error banner tells the reader two
        * different things at once.
        */}
      {error ? null : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Inbox className="mx-auto mb-2 size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Nothing in the backlog yet. Write down work you want done later — it needs a title and nothing else.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">{EMPTY_FOR_TAB[subTab]}</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {visible.map((item, index) => (
            <BacklogRow
              key={item.id}
              item={item}
              index={index}
              siblings={visible}
              reorderable={sort === 'rank' && subTab === 'open'}
              showProject={projectId === null}
              dragging={dragging}
              saving={saving}
              onDragStart={setDragging}
              onDragEnd={() => setDragging(null)}
              onMove={move}
              onView={() => setViewing(item)}
              onEdit={() => setDialog({ open: true, item })}
              onDelete={() => void remove(item)}
              onAssign={onAssign}
            />
          ))}
        </ul>
      )}

      <BacklogDialog
        open={dialog.open}
        item={dialog.item}
        workstreams={workstreams ?? []}
        saving={saving}
        onClose={() => setDialog({ open: false, item: null })}
        onSave={save}
      />

      <BacklogDetailsDrawer
        item={viewing}
        open={viewing !== null}
        onClose={() => setViewing(null)}
        onEdit={() => { setDialog({ open: true, item: viewing }); setViewing(null) }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function BacklogRow({
  item, index, siblings, reorderable, showProject, dragging, saving,
  onDragStart, onDragEnd, onMove, onView, onEdit, onDelete, onAssign,
}: {
  item: BacklogItem
  index: number
  siblings: BacklogItem[]
  reorderable: boolean
  showProject: boolean
  dragging: string | null
  saving: boolean
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onMove: (id: string, beforeId: string | null, afterId: string | null) => void
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onAssign?: (item: BacklogItem) => void
}) {
  const closed = item.status === 'DONE' || item.status === 'DROPPED'

  return (
    <li
      draggable={reorderable}
      onDragStart={(e) => {
        if (!reorderable) return
        e.dataTransfer.setData('text/backlog-id', item.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(item.id)
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { if (reorderable && dragging && dragging !== item.id) e.preventDefault() }}
      onDrop={(e) => {
        if (!reorderable) return
        e.preventDefault()
        const moved = e.dataTransfer.getData('text/backlog-id')
        if (!moved || moved === item.id) return
        // Dropped ON this row means "take its place": land between the row
        // above it and this row.
        onMove(moved, siblings[index - 1]?.id ?? null, item.id)
        onDragEnd()
      }}
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border bg-card px-3 py-2.5 shadow-sm transition-colors hover:bg-accent/40',
        reorderable && 'cursor-grab active:cursor-grabbing',
        dragging === item.id && 'opacity-40',
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {reorderable && (
          <GripVertical className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
        )}
        <span className="min-w-0">
          <span className={cn('block truncate text-sm font-medium',
            closed ? 'text-muted-foreground line-through' : 'text-foreground')}>
            {item.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
            <span>{TYPE_LABEL[item.type] ?? item.type}</span>
            {showProject && (
              <span>{item.project_name ?? 'Not filed'}</span>
            )}
            {item.workstream_name && <span className="truncate">{item.workstream_name}</span>}
            {item.task_title && (
              <span className="truncate text-success">→ {item.task_title}</span>
            )}
          </span>
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        <PriorityBadge priority={item.priority} />
        {item.task_status && (
          <StatusBadge status={item.task_status} size="sm">{item.task_status}</StatusBadge>
        )}

        {reorderable && (
          <>
            {/* The keyboard path. HTML5 drag has none, so these are the
                equivalent gesture, not a lesser one — same endpoint. */}
            <Button size="icon-sm" variant="ghost" aria-label={`Move ${item.title} up`}
              disabled={saving || index === 0}
              onClick={() => onMove(item.id, siblings[index - 2]?.id ?? null, siblings[index - 1]?.id ?? null)}>
              <ArrowUp className="size-3.5" />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={`Move ${item.title} down`}
              disabled={saving || index === siblings.length - 1}
              onClick={() => onMove(item.id, siblings[index + 1]?.id ?? null, siblings[index + 2]?.id ?? null)}>
              <ArrowDown className="size-3.5" />
            </Button>
          </>
        )}

        {onAssign && item.status === 'OPEN' && (
          <Button size="sm" variant="outline" onClick={() => onAssign(item)}>
            <Send className="mr-1 size-3.5" /> Assign
          </Button>
        )}
        <Button size="icon-sm" variant="ghost" aria-label={`View ${item.title}`} onClick={onView}>
          <Eye className="size-3.5" />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${item.title}`} onClick={onEdit}>
          <Pencil className="size-3.5" />
        </Button>
        <Button size="icon-sm" variant="ghost" className="text-destructive"
          aria-label={`Remove ${item.title}`} onClick={onDelete}>
          <Trash2 className="size-3.5" />
        </Button>
      </span>
    </li>
  )
}

/** One required field and three optional ones — a note, not a form. */
function BacklogDialog({
  open, item, workstreams, saving, onClose, onSave,
}: {
  open: boolean
  item: BacklogItem | null
  workstreams: WorkstreamSummary[]
  saving: boolean
  onClose: () => void
  onSave: (payload: BacklogPayload) => void
}) {
  const [form, setForm] = useState(() => empty())
  const seedKey = open ? (item?.id ?? 'new') : null
  const [lastSeed, setLastSeed] = useState<string | null>(null)

  // Render-phase seeding on a key, the module's idiom: reopening re-seeds and
  // an in-progress edit is never overwritten by a re-render.
  if (seedKey !== lastSeed) {
    setLastSeed(seedKey)
    if (seedKey !== null) {
      setForm(item ? {
        title: item.title, notes: item.notes ?? '', type: item.type,
        priority: item.priority, workstream_id: item.workstream_id ?? '',
      } : empty())
    }
  }

  const set = <K extends keyof ReturnType<typeof empty>>(key: K, value: ReturnType<typeof empty>[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[560px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{item ? 'Edit backlog item' : 'Add to backlog'}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <Field label="What needs doing *">
            <Input value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Post on social media" autoFocus />
          </Field>

          <Field label="Notes">
            <Textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)}
              placeholder="Anything worth remembering when somebody picks this up." />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select value={form.type} onChange={(v) => set('type', v as BacklogType)} size="sm"
                options={(Object.keys(TYPE_LABEL) as BacklogType[]).map((t) => ({ value: t, label: TYPE_LABEL[t] }))} />
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onChange={(v) => set('priority', v)} size="sm"
                options={['High', 'Medium', 'Low'].map((p) => ({ value: p, label: p }))} />
            </Field>
          </div>

          {workstreams.length > 0 && (
            <Field label="Workstream">
              <Select value={form.workstream_id} onChange={(v) => set('workstream_id', v)} size="sm"
                placeholder="Not filed under one"
                options={[{ value: '', label: 'Not filed under one' },
                  ...workstreams.map((w) => ({ value: w.id, label: w.name }))]} />
            </Field>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            disabled={saving || form.title.trim() === ''}
            onClick={() => onSave({
              title: form.title.trim(),
              notes: form.notes.trim() || null,
              type: form.type,
              priority: form.priority,
              workstream_id: form.workstream_id || null,
            })}>
            {saving ? 'Saving…' : item ? 'Save changes' : 'Add to backlog'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function empty() {
  return { title: '', notes: '', type: 'REQUEST' as BacklogType, priority: 'Medium', workstream_id: '' }
}

/** Read-only, with an Edit button that overlays BacklogDialog on top of it —
 *  one edit surface, not a second form written for the drawer. */
function BacklogDetailsDrawer({
  item, open, onClose, onEdit,
}: {
  item: BacklogItem | null
  open: boolean
  onClose: () => void
  onEdit: () => void
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-[480px]">
        <SheetHeader className="border-b p-6">
          <SheetTitle>{item?.title ?? 'Backlog item'}</SheetTitle>
        </SheetHeader>

        {item && (
          <div className="g2g-scrollbar overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 92px)' }}>
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <StatusBadge status={item.status} size="sm">{item.status}</StatusBadge>
                <PriorityBadge priority={item.priority} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField label="Type" value={TYPE_LABEL[item.type] ?? item.type} />
                <DetailField label="Created" value={item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'} />
                <DetailField label="Project" value={item.project_name ?? 'Not filed'} />
                <DetailField label="Workstream" value={item.workstream_name ?? '—'} />
              </div>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Notes</h3>
                <p className="rounded-xl bg-muted/30 p-4 text-sm leading-6 text-foreground/80">
                  {item.notes || 'No notes.'}
                </p>
              </section>

              {item.task_title && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Linked task</h3>
                  <div className="flex items-center justify-between gap-2 rounded-xl border p-4 text-sm">
                    <span className="truncate font-medium">{item.task_title}</span>
                    {item.task_status && <StatusBadge status={item.task_status} size="sm">{item.task_status}</StatusBadge>}
                  </div>
                </section>
              )}

              <div className="flex justify-end border-t pt-4">
                <Button variant="outline" onClick={onEdit}>
                  <Pencil className="mr-1.5 size-3.5" /> Edit
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
