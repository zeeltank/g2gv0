'use client'

/**
 * Editors for the workstream's records.
 *
 * ── TWO WRITE SHAPES, MATCHING THE API ──────────────────────────────────────
 *
 * LIST EDITORS (responsibilities, scope, contributors) send the whole set,
 * because that is how they are authored — you edit eleven lines and save.
 * RECORD DIALOGS (deliverable, checkpoint, KPI, risk, dependency) save one row
 * at a time, because each carries its own status, owner and dates.
 *
 * ── ERRORS RENDER INSIDE THE DIALOG ─────────────────────────────────────────
 *
 * Not in the page behind it. The dependency view carries the note explaining
 * why this matters: a banner behind the overlay made a 422 look like the button
 * simply doing nothing.
 */

import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, Info, Pencil, Plus, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type {
  WorkstreamCheckpoint, WorkstreamDeliverable, WorkstreamDependency,
  WorkstreamKpi, WorkstreamMember, WorkstreamOptions, WorkstreamRisk, WorkstreamStatement,
} from '@/types/task-management'

/* ------------------------------------------------------------------ *
 * Shared shell
 * ------------------------------------------------------------------ */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {label}
        {/* The hint is a definition, not a sentence the form has to say out loud. */}
        {hint && (
          <Tooltip side="bottom" content={<span className="block max-w-[15rem] text-left text-xs leading-relaxed">{hint}</span>}>
            {/* The hint used to be visible text under the field. lucide stamps
                aria-hidden on a childless icon, so without a name the hint would
                now exist for a mouse and for nothing else. */}
            <Info role="img" aria-label={hint} className="size-3.5 text-muted-foreground" />
          </Tooltip>
        )}
      </span>
      {children}
    </label>
  )
}

function RecordDialog({
  open, title, description, error, saving, onClose, onSave, saveLabel, children,
}: {
  open: boolean; title: string; description?: string; error: string; saving: boolean
  onClose: () => void; onSave: () => void; saveLabel: string; children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[560px]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-foreground">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          {/* INSIDE the dialog, deliberately — see the file header. */}
          {error && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </div>
          )}
          {children}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? 'Saving…' : saveLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Options → the Select shape, with a leading blank when the field is optional. */
const opts = (values: string[], blank?: string) => [
  ...(blank ? [{ value: '', label: blank }] : []),
  ...values.map((value) => ({ value, label: value })),
]

/* ------------------------------------------------------------------ *
 * ③ + ⑧  Responsibilities, in scope, out of scope
 * ------------------------------------------------------------------ */

/**
 * An ordered list of one-line statements, edited in place.
 *
 * Nothing like this existed in the codebase — there is no add/edit/delete row
 * component anywhere, and no reordering of any kind. This is assembled from the
 * two closest precedents: the taxonomy manager's Pencil → Input → Check/X
 * rename, and the competency form's add/remove repeating rows.
 *
 * Ordering is up/down buttons rather than drag. There is no drag precedent in
 * this repo to follow, and building one for a list of eleven lines would be out
 * of proportion to the problem.
 */
export function StatementListEditor({
  title, description, level = 3, statements, canManage, saving, onSave,
}: {
  title: string
  description?: string
  /**
   * 2 when this editor heads its own card, 3 when it is a group inside one.
   *
   * Responsibilities is a card of its own; In scope and Out of scope are two
   * columns under the "Scope boundaries" heading. Rendering all three as h3
   * made the document jump h1 -> h3 and told a screen reader that the scope
   * columns are peers of the card above them.
   */
  level?: 2 | 3
  statements: WorkstreamStatement[]
  canManage: boolean
  saving: boolean
  onSave: (bodies: string[]) => Promise<{ ok: boolean; message: string }>
}) {
  // A capitalised binding so JSX reads it as a component rather than the
  // literal tag <Heading>.
  const Heading = level === 2 ? 'h2' : 'h3'
  const [draft, setDraft] = useState<string[] | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [rowDraft, setRowDraft] = useState('')
  const [adding, setAdding] = useState('')
  const [error, setError] = useState('')

  const rows = draft ?? statements.map((s) => s.body)
  const dirty = draft !== null

  const mutate = (next: string[]) => { setDraft(next); setError('') }

  const commit = async () => {
    // A row naming nothing is a blank somebody added and abandoned; sending it
    // would store an empty responsibility. Same rule the competency form uses.
    const cleaned = rows.map((r) => r.trim()).filter((r) => r !== '')
    const result = await onSave(cleaned)
    if (result.ok) { setDraft(null); setEditingIndex(null) } else { setError(result.message) }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Heading className={cn(
            'flex items-center gap-1.5 font-semibold text-foreground',
            level === 2 ? 'text-base tracking-tight' : 'text-sm',
          )}>
            {title}
            {description && (
              <Tooltip side="bottom" content={<span className="block max-w-[15rem] text-left text-xs leading-relaxed">{description}</span>}>
                <Info role="img" aria-label={description} className="size-3.5 text-muted-foreground" />
              </Tooltip>
            )}
          </Heading>
        </div>
        {dirty && canManage && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setDraft(null); setEditingIndex(null); setError('') }} disabled={saving}>
              Discard
            </Button>
            <Button size="sm" onClick={() => void commit()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {rows.length === 0 && !canManage && (
        <p className="text-sm text-muted-foreground">None recorded.</p>
      )}

      <ol className="space-y-1.5">
        {rows.map((body, index) => (
          <li key={index} className="flex items-start gap-2 rounded-lg border bg-card px-3 py-2">
            <span className="mt-0.5 w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{index + 1}.</span>

            {editingIndex === index ? (
              <>
                <Input
                  autoFocus
                  value={rowDraft}
                  onChange={(e) => setRowDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { mutate(rows.map((r, i) => (i === index ? rowDraft : r))); setEditingIndex(null) }
                    if (e.key === 'Escape') setEditingIndex(null)
                  }}
                  className="h-8"
                />
                <Button size="sm" className="h-8 px-2" aria-label="Apply"
                  onClick={() => { mutate(rows.map((r, i) => (i === index ? rowDraft : r))); setEditingIndex(null) }}>
                  <Check className="size-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-8 px-2" aria-label="Cancel" onClick={() => setEditingIndex(null)}>
                  <X className="size-3.5" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-foreground">{body}</span>
                {canManage && (
                  <span className="flex shrink-0 gap-0.5">
                    <Button size="sm" variant="ghost" className="h-7 px-1.5" aria-label="Move up" disabled={index === 0}
                      onClick={() => { const n = [...rows]; [n[index - 1], n[index]] = [n[index], n[index - 1]]; mutate(n) }}>
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-1.5" aria-label="Move down" disabled={index === rows.length - 1}
                      onClick={() => { const n = [...rows]; [n[index + 1], n[index]] = [n[index], n[index + 1]]; mutate(n) }}>
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-1.5" aria-label="Edit"
                      onClick={() => { setEditingIndex(index); setRowDraft(body) }}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-1.5 text-danger" aria-label="Remove"
                      onClick={() => mutate(rows.filter((_, i) => i !== index))}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ol>

      {canManage && (
        <div className="flex gap-2">
          <Input
            value={adding}
            placeholder={`Add to ${title.toLowerCase()}…`}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && adding.trim() !== '') { mutate([...rows, adding.trim()]); setAdding('') }
            }}
            className="h-9"
          />
          <Button variant="outline" className="h-9 shrink-0"
            disabled={adding.trim() === ''}
            onClick={() => { mutate([...rows, adding.trim()]); setAdding('') }}>
            <Plus className="mr-1 size-3.5" /> Add
          </Button>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * ②  Contributors
 * ------------------------------------------------------------------ */

/**
 * Owner plus contributors, each with their lane.
 *
 * The lane is not decoration. The source model warns directly against splitting
 * Frontend, Backend and AI into three workstreams — "they are technical lanes
 * inside one delivery workstream" — and this field is where that is recorded.
 * Without somewhere to put it, the pressure to split returns.
 *
 * Select-plus-chips, the house idiom (three existing call sites), rather than
 * the old drawer's raw-checkbox list.
 */
export function ContributorsEditor({
  members, projectMembers, ownerId, ownerName, canManage, saving, onSave,
}: {
  members: WorkstreamMember[]
  projectMembers: Array<{ id: string; name: string }>
  ownerId: string | null
  ownerName: string | null
  canManage: boolean
  saving: boolean
  onSave: (members: Array<{ user_id: string; role?: string; lane?: string | null }>) => Promise<{ ok: boolean; message: string }>
}) {
  const [draft, setDraft] = useState<Array<{ user_id: string; user_name: string; lane: string }> | null>(null)
  const [error, setError] = useState('')

  const rows = draft ?? members.map((m) => ({
    user_id: m.user_id, user_name: m.user_name ?? m.user_id, lane: m.lane ?? '',
  }))
  const dirty = draft !== null

  const available = projectMembers.filter(
    (p) => p.id !== ownerId && !rows.some((r) => r.user_id === p.id),
  )

  const commit = async () => {
    const result = await onSave(rows.map((r) => ({
      user_id: r.user_id, role: 'CONTRIBUTOR', lane: r.lane.trim() === '' ? null : r.lane.trim(),
    })))
    if (result.ok) { setDraft(null) } else { setError(result.message) }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-foreground">
          Contributors
          <Tooltip
            content={(
              <span className="block max-w-[15rem] text-left text-xs leading-relaxed">
                Technical lanes — frontend, backend, AI — belong here as a contributor&apos;s lane, not as separate workstreams.
              </span>
            )}
          >
            <Info role="img"
              aria-label="Technical lanes — frontend, backend, AI — belong here as a contributor’s lane, not as separate workstreams."
              className="size-3.5 text-muted-foreground" />
          </Tooltip>
        </h2>
        {dirty && canManage && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setDraft(null); setError('') }} disabled={saving}>Discard</Button>
            <Button size="sm" onClick={() => void commit()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* The owner is shown first and cannot be removed here — accountability is
          singular and belongs to the workstream, not to this list. */}
      <div className="rounded-lg border bg-muted/30 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{ownerName ?? 'No owner set'}</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Accountable</span>
        </div>
      </div>

      {rows.length === 0 && <p className="text-sm text-muted-foreground">No contributors yet.</p>}

      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li key={row.user_id} className="rounded-lg border px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">{row.user_name}</span>
              {canManage && (
                <Button size="sm" variant="ghost" className="h-7 px-1.5 text-danger" aria-label={`Remove ${row.user_name}`}
                  onClick={() => { setDraft(rows.filter((_, i) => i !== index)); setError('') }}>
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
            {canManage ? (
              <Input
                value={row.lane}
                placeholder="Lane — e.g. Backend, APIs, database"
                onChange={(e) => { setDraft(rows.map((r, i) => (i === index ? { ...r, lane: e.target.value } : r))); setError('') }}
                className="mt-1.5 h-8 text-xs"
              />
            ) : (
              row.lane && <p className="mt-0.5 text-xs text-muted-foreground">{row.lane}</p>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <Select
          value=""
          onChange={(id) => {
            const person = projectMembers.find((p) => p.id === id)
            if (person) { setDraft([...rows, { user_id: person.id, user_name: person.name, lane: '' }]); setError('') }
          }}
          placeholder={available.length ? 'Add a contributor…' : 'Everyone on the project is already here'}
          disabled={available.length === 0}
          options={available.map((p) => ({ value: p.id, label: p.name }))}
        />
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * ④  Deliverable
 * ------------------------------------------------------------------ */

export function DeliverableDialog({
  open, initial, options, checkpoints, people, saving, error, onClose, onSave,
}: {
  open: boolean
  initial: WorkstreamDeliverable | null
  options: WorkstreamOptions
  checkpoints: WorkstreamCheckpoint[]
  people: Array<{ id: string; name: string }>
  saving: boolean
  error: string
  onClose: () => void
  onSave: (payload: Record<string, unknown>) => void
}) {
  const [form, setForm] = useState(emptyDeliverable())
  const seedKey = open ? (initial?.id ?? 'new') : null
  const [lastSeed, setLastSeed] = useState<string | null>(null)

  // Render-phase seeding keyed on open + record, the create-project-modal
  // pattern: re-opening re-seeds, an in-progress edit is never overwritten.
  if (seedKey !== lastSeed) {
    setLastSeed(seedKey)
    if (seedKey !== null) {
      setForm(initial ? {
        name: initial.name, description: initial.description ?? '',
        acceptance_criteria: initial.acceptance_criteria ?? '', status: initial.status,
        owner_id: initial.owner_id ?? '', checkpoint_id: initial.checkpoint_id ?? '',
        due_date: initial.due_date ?? '', delivered_at: initial.delivered_at ?? '',
      } : emptyDeliverable())
    }
  }

  const set = (k: keyof ReturnType<typeof emptyDeliverable>, v: string) => setForm((c) => ({ ...c, [k]: v }))

  return (
    <RecordDialog
      open={open} title={initial ? 'Edit deliverable' : 'Add deliverable'}
      description="Something this workstream produces."
      error={error} saving={saving} onClose={onClose}
      saveLabel={initial ? 'Save changes' : 'Add deliverable'}
      onSave={() => onSave({ ...form, owner_id: form.owner_id || null, checkpoint_id: form.checkpoint_id || null })}
    >
      <Field label="Name"><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
      <Field label="Status">
        <Select value={form.status} onChange={(v) => set('status', v)} options={opts(options.deliverable_statuses)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Owner">
          <Select value={form.owner_id} onChange={(v) => set('owner_id', v)} placeholder="Unassigned"
            options={opts([], 'Unassigned').concat(people.map((p) => ({ value: p.id, label: p.name })))} />
        </Field>
        <Field label="Due date">
          <Input type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
        </Field>
      </div>
      <Field label="Gated by checkpoint" hint="Optional.">
        <Select value={form.checkpoint_id} onChange={(v) => set('checkpoint_id', v)} placeholder="None"
          options={opts([], 'None').concat(checkpoints.map((c) => ({ value: c.id, label: c.name })))} />
      </Field>
      <Field label="Acceptance criteria">
        <Textarea rows={3} value={form.acceptance_criteria} onChange={(e) => set('acceptance_criteria', e.target.value)} />
      </Field>
      <Field label="Description">
        <Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
      </Field>
    </RecordDialog>
  )
}

const emptyDeliverable = () => ({
  name: '', description: '', acceptance_criteria: '', status: 'NOT STARTED',
  owner_id: '', checkpoint_id: '', due_date: '', delivered_at: '',
})

/* ------------------------------------------------------------------ *
 * ⑤  Checkpoint
 * ------------------------------------------------------------------ */

export function CheckpointDialog({
  open, initial, options, saving, error, onClose, onSave,
}: {
  open: boolean; initial: WorkstreamCheckpoint | null; options: WorkstreamOptions
  saving: boolean; error: string; onClose: () => void; onSave: (payload: Record<string, unknown>) => void
}) {
  const [form, setForm] = useState(emptyCheckpoint())
  const seedKey = open ? (initial?.id ?? 'new') : null
  const [lastSeed, setLastSeed] = useState<string | null>(null)

  if (seedKey !== lastSeed) {
    setLastSeed(seedKey)
    if (seedKey !== null) {
      setForm(initial ? {
        name: initial.name, description: initial.description ?? '',
        target_date: initial.target_date ?? '', status: initial.status,
        is_critical: initial.is_critical,
      } : emptyCheckpoint())
    }
  }

  return (
    <RecordDialog
      open={open} title={initial ? 'Edit checkpoint' : 'Add checkpoint'}
      description="A dated gate inside this workstream."
      error={error} saving={saving} onClose={onClose}
      saveLabel={initial ? 'Save changes' : 'Add checkpoint'}
      onSave={() => onSave(form)}
    >
      <Field label="Name"><Input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Target date">
          <Input type="date" value={form.target_date} onChange={(e) => setForm((c) => ({ ...c, target_date: e.target.value }))} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(v) => setForm((c) => ({ ...c, status: v }))} options={opts(options.checkpoint_statuses)} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <input type="checkbox" checked={form.is_critical}
          onChange={(e) => setForm((c) => ({ ...c, is_critical: e.target.checked }))} />
        Critical checkpoint
      </label>
      <Field label="Description">
        <Textarea rows={2} value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} />
      </Field>
    </RecordDialog>
  )
}

const emptyCheckpoint = () => ({ name: '', description: '', target_date: '', status: 'UPCOMING', is_critical: false })

/* ------------------------------------------------------------------ *
 * ⑦  KPI
 * ------------------------------------------------------------------ */

export function KpiDialog({
  open, initial, options, people, saving, error, onClose, onSave,
}: {
  open: boolean; initial: WorkstreamKpi | null; options: WorkstreamOptions
  people: Array<{ id: string; name: string }>
  saving: boolean; error: string; onClose: () => void; onSave: (payload: Record<string, unknown>) => void
}) {
  const [form, setForm] = useState(emptyKpi())
  const seedKey = open ? (initial?.id ?? 'new') : null
  const [lastSeed, setLastSeed] = useState<string | null>(null)

  if (seedKey !== lastSeed) {
    setLastSeed(seedKey)
    if (seedKey !== null) {
      setForm(initial ? {
        name: initial.name, metric: initial.metric ?? '', unit: initial.unit ?? '',
        direction: initial.direction, baseline_value: initial.baseline_value ?? '',
        target_value: initial.target_value ?? '', current_value: initial.current_value ?? '',
        source: initial.source ?? '', owner_id: initial.owner_id ?? '',
      } : emptyKpi())
    }
  }

  const set = (k: keyof ReturnType<typeof emptyKpi>, v: string) => setForm((c) => ({ ...c, [k]: v }))

  return (
    <RecordDialog
      open={open} title={initial ? 'Edit success metric' : 'Add success metric'}
      description="A quantifiable target for this workstream."
      error={error} saving={saving} onClose={onClose}
      saveLabel={initial ? 'Save changes' : 'Add metric'}
      onSave={() => onSave({ ...form, owner_id: form.owner_id || null })}
    >
      <Field label="Name"><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
      <Field label="What is measured" hint="e.g. p95 API response time">
        <Input value={form.metric} onChange={(e) => set('metric', e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Free text, deliberately. "15% reduction in latency" and "Zero P1
            incidents" are legitimate targets and neither is a number. */}
        <Field label="Target" hint='e.g. "15% reduction in latency"'>
          <Input value={form.target_value} onChange={(e) => set('target_value', e.target.value)} />
        </Field>
        <Field label="Baseline">
          <Input value={form.baseline_value} onChange={(e) => set('baseline_value', e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Unit" hint="ms, %, incidents…">
          <Input value={form.unit} onChange={(e) => set('unit', e.target.value)} />
        </Field>
        <Field label="Better when">
          <Select value={form.direction} onChange={(v) => set('direction', v)}
            options={options.kpi_directions.map((d) => ({ value: d, label: d === 'UP' ? 'Higher' : 'Lower' }))} />
        </Field>
      </div>
      <Field label="Current reading" hint="Blank means unmeasured, not zero.">
        <Input value={form.current_value} onChange={(e) => set('current_value', e.target.value)} />
      </Field>
      <Field label="Where the number comes from">
        <Input value={form.source} onChange={(e) => set('source', e.target.value)} />
      </Field>
      <Field label="Owner">
        <Select value={form.owner_id} onChange={(v) => set('owner_id', v)} placeholder="Unassigned"
          options={opts([], 'Unassigned').concat(people.map((p) => ({ value: p.id, label: p.name })))} />
      </Field>
    </RecordDialog>
  )
}

const emptyKpi = () => ({
  name: '', metric: '', unit: '', direction: 'UP', baseline_value: '',
  target_value: '', current_value: '', source: '', owner_id: '',
})

/* ------------------------------------------------------------------ *
 * ⑨  Risk
 * ------------------------------------------------------------------ */

export function RiskDialog({
  open, initial, options, people, saving, error, onClose, onSave,
}: {
  open: boolean; initial: WorkstreamRisk | null; options: WorkstreamOptions
  people: Array<{ id: string; name: string }>
  saving: boolean; error: string; onClose: () => void; onSave: (payload: Record<string, unknown>) => void
}) {
  const [form, setForm] = useState(emptyRisk())
  const seedKey = open ? (initial?.id ?? 'new') : null
  const [lastSeed, setLastSeed] = useState<string | null>(null)

  if (seedKey !== lastSeed) {
    setLastSeed(seedKey)
    if (seedKey !== null) {
      setForm(initial ? {
        title: initial.title, description: initial.description ?? '',
        probability: initial.probability, impact: initial.impact,
        mitigation: initial.mitigation ?? '', contingency: initial.contingency ?? '',
        status: initial.status, owner_id: initial.owner_id ?? '', due_date: initial.due_date ?? '',
      } : emptyRisk())
    }
  }

  const set = (k: keyof ReturnType<typeof emptyRisk>, v: string) => setForm((c) => ({ ...c, [k]: v }))

  return (
    <RecordDialog
      open={open} title={initial ? 'Edit risk' : 'Add risk'}
      description="A roadblock specific to this workstream."
      error={error} saving={saving} onClose={onClose}
      saveLabel={initial ? 'Save changes' : 'Add risk'}
      onSave={() => onSave({ ...form, owner_id: form.owner_id || null })}
    >
      <Field label="Risk"><Input value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Probability">
          <Select value={form.probability} onChange={(v) => set('probability', v)} options={opts(options.risk_probabilities)} />
        </Field>
        {/* Severity is derived server-side from probability x impact and is not
            editable here — two people typing a severity by hand is how a
            register stops being sortable. */}
        <Field label="Impact" hint="Severity is worked out from these two.">
          <Select value={form.impact} onChange={(v) => set('impact', v)} options={opts(options.risk_levels)} />
        </Field>
      </div>
      <Field label="Mitigation">
        <Textarea rows={3} value={form.mitigation} onChange={(e) => set('mitigation', e.target.value)} />
      </Field>
      <Field label="Contingency">
        <Textarea rows={2} value={form.contingency} onChange={(e) => set('contingency', e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status">
          <Select value={form.status} onChange={(v) => set('status', v)} options={opts(options.risk_statuses)} />
        </Field>
        <Field label="Owner">
          <Select value={form.owner_id} onChange={(v) => set('owner_id', v)} placeholder="Unassigned"
            options={opts([], 'Unassigned').concat(people.map((p) => ({ value: p.id, label: p.name })))} />
        </Field>
      </div>
      <Field label="Description">
        <Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
      </Field>
    </RecordDialog>
  )
}

const emptyRisk = () => ({
  title: '', description: '', probability: 'Medium', impact: 'Medium',
  mitigation: '', contingency: '', status: 'OPEN', owner_id: '', due_date: '',
})

/* ------------------------------------------------------------------ *
 * ⑥  External dependency
 * ------------------------------------------------------------------ */

export function DependencyDialog({
  open, initial, direction, options, saving, error, onClose, onSave,
}: {
  open: boolean; initial: WorkstreamDependency | null; direction: 'UPSTREAM' | 'DOWNSTREAM'
  options: WorkstreamOptions
  saving: boolean; error: string; onClose: () => void; onSave: (payload: Record<string, unknown>) => void
}) {
  const [form, setForm] = useState(emptyDependency(direction))
  const seedKey = open ? (initial?.id ?? `new-${direction}`) : null
  const [lastSeed, setLastSeed] = useState<string | null>(null)

  if (seedKey !== lastSeed) {
    setLastSeed(seedKey)
    if (seedKey !== null) {
      setForm(initial ? {
        direction, description: initial.description, source: initial.source ?? '',
        needed_by: initial.needed_by ?? '', status: initial.status, is_blocking: initial.is_blocking,
      } : emptyDependency(direction))
    }
  }

  const upstream = direction === 'UPSTREAM'

  return (
    <RecordDialog
      open={open}
      title={initial ? 'Edit dependency' : upstream ? 'Add something this needs' : 'Add someone waiting on this'}
      description={upstream
        ? 'What this workstream needs before it can start.'
        : 'Who is waiting on this workstream\'s output.'}
      error={error} saving={saving} onClose={onClose}
      saveLabel={initial ? 'Save changes' : 'Add'}
      onSave={() => onSave(form)}
    >
      <Field label={upstream ? 'What is needed' : 'What they are waiting for'}>
        <Textarea rows={2} value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} />
      </Field>
      <Field label={upstream ? 'Who provides it' : 'Who is waiting'} hint="A team, a vendor, a person — free text.">
        <Input value={form.source} onChange={(e) => setForm((c) => ({ ...c, source: e.target.value }))} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Needed by">
          <Input type="date" value={form.needed_by} onChange={(e) => setForm((c) => ({ ...c, needed_by: e.target.value }))} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(v) => setForm((c) => ({ ...c, status: v }))} options={opts(options.dependency_statuses)} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <input type="checkbox" checked={form.is_blocking}
          onChange={(e) => setForm((c) => ({ ...c, is_blocking: e.target.checked }))} />
        Currently blocking work
      </label>
    </RecordDialog>
  )
}

const emptyDependency = (direction: 'UPSTREAM' | 'DOWNSTREAM') => ({
  direction, description: '', source: '', needed_by: '', status: 'OPEN', is_blocking: false,
})

/* ------------------------------------------------------------------ *
 * KPI measurement — its own small dialog
 * ------------------------------------------------------------------ */

/**
 * Recording a reading is a different act from redefining what is measured, and
 * it happens far more often — so it is a two-field dialog rather than the full
 * KPI form.
 */
export function MeasurementDialog({
  open, kpi, options, saving, error, onClose, onSave,
}: {
  open: boolean; kpi: WorkstreamKpi | null; options: WorkstreamOptions
  saving: boolean; error: string; onClose: () => void
  onSave: (payload: { current_value: string | null; measured_at?: string; status?: string }) => void
}) {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState('')
  const seedKey = open && kpi ? kpi.id : null
  const [lastSeed, setLastSeed] = useState<string | null>(null)

  if (seedKey !== lastSeed) {
    setLastSeed(seedKey)
    if (seedKey !== null && kpi) { setValue(kpi.current_value ?? ''); setStatus(kpi.status === 'UNMEASURED' ? '' : kpi.status) }
  }

  return (
    <RecordDialog
      open={open} title="Record a measurement"
      description={kpi ? `${kpi.name}${kpi.target_value ? ` — target: ${kpi.target_value}` : ''}` : ''}
      error={error} saving={saving} onClose={onClose} saveLabel="Record"
      onSave={() => onSave({
        current_value: value.trim() === '' ? null : value.trim(),
        status: status || undefined,
      })}
    >
      <Field label="Current reading" hint="Clear it to return this metric to unmeasured.">
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={kpi?.unit ? `e.g. 340${kpi.unit}` : ''} />
      </Field>
      <Field label="Judgement">
        <Select value={status} onChange={setStatus} placeholder="Decide from the reading"
          options={opts([], 'Decide from the reading').concat(
            options.kpi_statuses.filter((s) => s !== 'UNMEASURED').map((s) => ({ value: s, label: s.replace(/_/g, ' ') })),
          )} />
      </Field>
    </RecordDialog>
  )
}

/** Shared severity styling, matching the existing risk palette. */
export const RISK_TONE: Record<string, string> = {
  Low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Medium: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  High: 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400',
  Regulated: 'border-destructive/30 bg-destructive/10 text-destructive',
}

export function RiskSeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
      RISK_TONE[severity] ?? RISK_TONE.Medium)}>
      {severity}
    </span>
  )
}
