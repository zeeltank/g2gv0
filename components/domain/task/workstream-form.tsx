'use client'

/**
 * Authoring a workstream, and connecting workstreams into a lifecycle.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 *
 * The old project drawer carried the only workstream form in the product — three
 * inputs: name, owner, status. When the drawer was replaced by a page, that form
 * went with it and nothing took its place, so a tenant could not create, rename
 * or delete a workstream at all. The lifecycle could only be produced by a seed
 * migration, which is exactly why it looked like a fixed template.
 *
 * The API had every one of these fields all along.
 *
 * ── THE AUTHORING ORDER IS THE CUSTOMER'S ───────────────────────────────────
 *
 * Create the workstreams first, fill in their fields, then connect them. So this
 * is a plain form plus a plain connection editor, not a wizard that decides the
 * shape for you — a tenant whose delivery model is not three-stages-plus-
 * governance must be able to express whatever theirs actually is.
 */

import { useState } from 'react'
import { ArrowRight, Link2, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type {
  ProjectStatus, WorkstreamKind, WorkstreamLink, WorkstreamLinkType,
  WorkstreamOptions, WorkstreamSummary,
} from '@/types/task-management'
import type { WorkstreamPayload } from '@/services/task'

/**
 * The relationship names a person is actually choosing between.
 *
 * `FLOW` / `FEEDBACK` / `GOVERNS` are the stored vocabulary; nobody setting up a
 * project thinks in those words. The stored value never changes — only the label.
 */
export const LINK_LABELS: Record<WorkstreamLinkType, string> = {
  FLOW: 'Feeds into',
  FEEDBACK: 'Feeds back into',
  GOVERNS: 'Governs',
}

const LINK_HELP: Record<WorkstreamLinkType, string> = {
  FLOW: 'The delivery chain — work passes from one stage to the next.',
  FEEDBACK: 'Closes the loop — what comes out of a later stage returns to an earlier one.',
  GOVERNS: 'A governance layer spanning the delivery flow rather than sitting inside it.',
}

const KIND_LABELS: Record<WorkstreamKind, string> = {
  DELIVERY: 'Delivery stage',
  GOVERNANCE: 'Governance layer',
}

/**
 * The next free code for a new workstream.
 *
 * Sequential where the project already uses WSnn, and a dotted suffix under a
 * parent (WS02 → WS02.1). Only ever a SUGGESTION: the field stays editable and
 * clearable, because a code is a convenience and a tenant may have their own
 * naming or want none at all.
 */
export function suggestCode(workstreams: WorkstreamSummary[], parentId: string | null): string {
  const taken = new Set(workstreams.map((w) => (w.code ?? '').toUpperCase()).filter(Boolean))

  if (parentId) {
    const parent = workstreams.find((w) => w.id === parentId)
    if (parent?.code) {
      for (let n = 1; n < 100; n++) {
        const candidate = `${parent.code}.${n}`
        if (!taken.has(candidate.toUpperCase())) return candidate
      }
    }
    return ''
  }

  for (let n = 1; n < 100; n++) {
    const candidate = `WS${String(n).padStart(2, '0')}`
    if (!taken.has(candidate)) return candidate
  }
  return ''
}

/* ------------------------------------------------------------------ *
 * Create / edit a workstream
 * ------------------------------------------------------------------ */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

export function WorkstreamDialog({
  open, initial, workstreams, projectMembers, options, saving, error, onClose, onSave,
}: {
  open: boolean
  initial: WorkstreamSummary | null
  workstreams: WorkstreamSummary[]
  projectMembers: Array<{ id: string; name: string }>
  options: WorkstreamOptions | null
  saving: boolean
  error: string
  onClose: () => void
  onSave: (payload: WorkstreamPayload) => void
}) {
  const [form, setForm] = useState(() => empty(workstreams))
  const seedKey = open ? (initial?.id ?? 'new') : null
  const [lastSeed, setLastSeed] = useState<string | null>(null)

  // Render-phase seeding on a key, the create-project-modal pattern: reopening
  // re-seeds, and an in-progress edit is never overwritten by a re-render.
  if (seedKey !== lastSeed) {
    setLastSeed(seedKey)
    if (seedKey !== null) {
      setForm(initial ? {
        name: initial.name,
        code: initial.code ?? '',
        kind: initial.kind,
        core_question: initial.core_question ?? '',
        purpose: initial.purpose ?? '',
        owner_id: initial.owner_id ?? '',
        parent_id: initial.parent_id ?? '',
        status: initial.status,
        start_date: initial.start_date ?? '',
        due_date: initial.due_date ?? '',
      } : empty(workstreams))
    }
  }

  const set = <K extends keyof ReturnType<typeof empty>>(key: K, value: ReturnType<typeof empty>[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  /** Changing the parent re-suggests the code, but never overwrites a typed one. */
  const chooseParent = (parentId: string) => {
    setForm((current) => {
      const wasSuggested = current.code === suggestCode(workstreams, current.parent_id || null)
      return {
        ...current,
        parent_id: parentId,
        code: wasSuggested || current.code === '' ? suggestCode(workstreams, parentId || null) : current.code,
      }
    })
  }

  // A workstream cannot parent itself, and nesting is one level deep — so only
  // top-level workstreams other than this one can be a parent.
  const parentChoices = workstreams.filter((w) => w.id !== initial?.id && !w.parent_id)

  const submit = () => onSave({
    name: form.name.trim(),
    // ALWAYS SENT. The server stopped defaulting `kind` on update because doing
    // so silently rewrote a governance workstream to a delivery stage.
    kind: form.kind,
    status: form.status,
    code: form.code.trim() || null,
    core_question: form.core_question.trim() || null,
    purpose: form.purpose.trim() || null,
    owner_id: form.owner_id || null,
    parent_id: form.parent_id || null,
    start_date: form.start_date || null,
    due_date: form.due_date || null,
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[620px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{initial ? 'Edit workstream' : 'New workstream'}</DialogTitle>
          <DialogDescription>
            A lane of related work inside this project, with its own owner and plan.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          {/* Inside the dialog: a banner behind the overlay reads as nothing happening. */}
          {error && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </div>
          )}

          <Field label="Name">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Engineering & AI Delivery" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" hint="Suggested — edit it or clear it.">
              <Input value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="WS01" />
            </Field>
            {/*
              THE DECISION THAT SHAPES THE LIFECYCLE.
              A delivery stage sits in the chain; a governance layer spans it.
              The diagram draws them differently because they ARE different.
            */}
            <Field label="Type" hint={form.kind === 'GOVERNANCE'
              ? 'Spans the delivery flow rather than sitting inside it.'
              : 'A stage in the delivery chain.'}>
              <Select value={form.kind} onChange={(v) => set('kind', v as WorkstreamKind)}
                options={(options?.kinds ?? ['DELIVERY', 'GOVERNANCE']).map((k) => ({ value: k, label: KIND_LABELS[k as WorkstreamKind] ?? k }))} />
            </Field>
          </div>

          <Field label="Core question" hint="The one line that says what this workstream is for.">
            <Input value={form.core_question} onChange={(e) => set('core_question', e.target.value)}
              placeholder="e.g. How do we build it?" />
          </Field>

          <Field label="Purpose">
            <Textarea rows={3} value={form.purpose} onChange={(e) => set('purpose', e.target.value)} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Accountable owner" hint="Must be a member of the project team.">
              <Select value={form.owner_id} onChange={(v) => set('owner_id', v)} placeholder="No owner"
                options={[{ value: '', label: 'No owner' },
                  ...projectMembers.map((m) => ({ value: m.id, label: m.name }))]} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(v) => set('status', v as ProjectStatus)}
                options={(options?.statuses ?? []).map((s) => ({ value: s, label: s }))} />
            </Field>
          </div>

          <Field label="Part of" hint="Optional. Makes this a sub-workstream; nesting is one level deep.">
            <Select value={form.parent_id} onChange={chooseParent} placeholder="Top level"
              options={[{ value: '', label: 'Top level' },
                ...parentChoices.map((w) => ({ value: w.id, label: w.name }))]} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Editable now. These used to be copied silently from the project,
                which is why every workstream on a project read the same span. */}
            <Field label="Start date">
              <Input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
            </Field>
            <Field label="Target completion">
              <Input type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
            </Field>
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || form.name.trim() === ''}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create workstream'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const empty = (workstreams: WorkstreamSummary[]) => ({
  name: '',
  code: suggestCode(workstreams, null),
  kind: 'DELIVERY' as WorkstreamKind,
  core_question: '',
  purpose: '',
  owner_id: '',
  parent_id: '',
  status: 'PLANNING' as ProjectStatus,
  start_date: '',
  due_date: '',
})

/* ------------------------------------------------------------------ *
 * Connect workstreams into a lifecycle
 * ------------------------------------------------------------------ */

/**
 * The connections panel — this is what "decide the delivery lifecycle" means.
 *
 * Every edge the diagram draws comes from here. Nothing about the shape is
 * assumed: a project with one long chain, two governance layers, or no
 * connections at all is equally expressible, and the diagram renders whatever
 * exists rather than forcing a template onto it.
 */
export function LifecycleConnections({
  workstreams, links, canManage, saving, error, onAdd, onRemove,
}: {
  workstreams: WorkstreamSummary[]
  links: WorkstreamLink[]
  canManage: boolean
  saving: boolean
  error: string
  onAdd: (payload: { predecessor_workstream_id: string; successor_workstream_id: string; link_type: WorkstreamLinkType; label?: string }) => void
  onRemove: (linkId: string) => void
}) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [type, setType] = useState<WorkstreamLinkType>('FLOW')
  const [label, setLabel] = useState('')

  const nameOf = (id: string) => workstreams.find((w) => w.id === id)?.name ?? 'Unknown workstream'

  const add = () => {
    onAdd({
      predecessor_workstream_id: from,
      successor_workstream_id: to,
      link_type: type,
      label: label.trim() || undefined,
    })
    setLabel('')
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <Link2 className="size-4 text-muted-foreground" /> Connections
        </h3>
        <p className="text-xs text-muted-foreground">
          How work moves between these workstreams. The diagram above is drawn from this list.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </div>
      )}

      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing connected yet — add a connection below to build the delivery flow.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                {/* Names, never codes — the reader is thinking about the work. */}
                <span className="font-medium">{nameOf(l.from_id)}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <ArrowRight className="size-3" /> {LINK_LABELS[l.link_type] ?? l.link_type}
                </span>
                <span className="font-medium">{nameOf(l.to_id)}</span>
                {l.label && <span className="text-xs text-muted-foreground">· {l.label}</span>}
              </span>
              {canManage && (
                <Button size="sm" variant="ghost" className="h-7 px-1.5 text-danger"
                  aria-label="Remove connection" disabled={saving} onClick={() => onRemove(l.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && workstreams.length >= 2 && (
        <div className="space-y-3 rounded-lg border border-dashed p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">From</span>
              <Select value={from} onChange={setFrom} placeholder="Select workstream"
                options={workstreams.map((w) => ({ value: w.id, label: w.name }))} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Relationship</span>
              <Select value={type} onChange={(v) => setType(v as WorkstreamLinkType)}
                options={(Object.keys(LINK_LABELS) as WorkstreamLinkType[]).map((k) => ({ value: k, label: LINK_LABELS[k] }))} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">To</span>
              <Select value={to} onChange={setTo} placeholder="Select workstream"
                options={workstreams.filter((w) => w.id !== from).map((w) => ({ value: w.id, label: w.name }))} />
            </label>
          </div>

          <p className="text-xs text-muted-foreground">{LINK_HELP[type]}</p>

          <div className="flex flex-wrap items-end gap-3">
            <label className="block flex-1 space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Caption (optional)</span>
              <Input value={label} onChange={(e) => setLabel(e.target.value)}
                placeholder={type === 'FLOW' ? 'e.g. WORKING PRODUCT' : type === 'FEEDBACK' ? 'e.g. USER FEEDBACK' : 'e.g. Delivery'} />
            </label>
            <Button onClick={add} disabled={saving || !from || !to || from === to}>
              <Plus className="mr-1 size-3.5" /> Add connection
            </Button>
          </div>
        </div>
      )}

      {canManage && workstreams.length < 2 && (
        <p className="text-sm text-muted-foreground">
          Create at least two workstreams before connecting them.
        </p>
      )}
    </section>
  )
}
