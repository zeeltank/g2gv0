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
  ArrowDown, ArrowUp, GripVertical, Inbox, Pencil, Plus, Send, Trash2,
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
  const [sort, setSort] = useState<(typeof SORTS)[number]['value']>('rank')
  const [dragging, setDragging] = useState<string | null>(null)

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
      setError(reason instanceof Error ? reason.message : 'Unable to load the backlog.')
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

  /** Both the drag and the up/down buttons land here. One endpoint, one row. */
  const move = async (id: string, beforeId: string | null, afterId: string | null) => {
    await run(() => taskService.rankBacklogItem(getLaravelContext(), id, {
      before_id: beforeId, after_id: afterId,
    }))
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
   * Status first, because "what is still open" is the question a backlog is
   * asked. Within a status the chosen sort applies. On the dashboard an extra
   * split by project sits inside Open, since that is where filing happens.
   */
  const groups = useMemo(() => {
    const open = sorted.filter((i) => i.status === 'OPEN')
    const assigned = sorted.filter((i) => i.status === 'ASSIGNED')
    const done = sorted.filter((i) => i.status === 'DONE' || i.status === 'DROPPED')
    return [
      { key: 'OPEN' as const, label: 'Open', rows: open },
      { key: 'ASSIGNED' as const, label: 'Assigned', rows: assigned },
      { key: 'DONE' as const, label: 'Closed', rows: done },
    ].filter((g) => g.rows.length > 0)
  }, [sorted])

  if (loading) return <div className="flex h-40 items-center justify-center"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Backlog
            <span className="ml-1.5 tabular-nums">{items.length}</span>
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

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}
      {message && <p role="status" className="text-sm text-success">{message}</p>}

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Inbox className="mx-auto mb-2 size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Nothing in the backlog yet. Write down work you want done later — it needs a title and nothing else.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-1">
            <h3 className="flex items-center gap-2">
              <span className={cn('size-2 shrink-0 rounded-full',
                group.key === 'OPEN' ? 'bg-primary'
                  : group.key === 'ASSIGNED' ? 'bg-success' : 'bg-muted-foreground/40')}
                aria-hidden="true" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">{group.label}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">{group.rows.length}</span>
            </h3>

            <ul className="divide-y divide-border rounded-lg border">
              {group.rows.map((item, index) => (
                <BacklogRow
                  key={item.id}
                  item={item}
                  index={index}
                  siblings={group.rows}
                  reorderable={sort === 'rank' && group.key === 'OPEN'}
                  showProject={projectId === null}
                  dragging={dragging}
                  saving={saving}
                  onDragStart={setDragging}
                  onDragEnd={() => setDragging(null)}
                  onMove={move}
                  onEdit={() => setDialog({ open: true, item })}
                  onDelete={() => void remove(item)}
                  onAssign={onAssign}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      <BacklogDialog
        open={dialog.open}
        item={dialog.item}
        workstreams={workstreams ?? []}
        saving={saving}
        onClose={() => setDialog({ open: false, item: null })}
        onSave={save}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function BacklogRow({
  item, index, siblings, reorderable, showProject, dragging, saving,
  onDragStart, onDragEnd, onMove, onEdit, onDelete, onAssign,
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
        'flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2',
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
