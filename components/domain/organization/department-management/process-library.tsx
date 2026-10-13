'use client'

import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Copy, MoreVertical, Pencil, PlayCircle, Plus, Trash2, Workflow } from 'lucide-react'
import { SelectInput } from '../components'
import { Notice } from './signals-ui'
import type { Department } from '@/lib/gtg-org-data'
import type { LaravelContext } from '@/lib/laravel-context'
import { organizationService } from '@/services/organization'
import type { DepartmentProcess, DepartmentProcessTemplates } from '@/services/organization'
import { useDepartmentProcesses, useDepartmentProcessTemplates } from './use-department-processes'
import { useProcessRuns } from './use-process-runs'
import { ProcessMiniPreview } from './process-mini-preview'
import { ProcessCanvasBuilder } from './process-canvas-builder'
import { ProcessRunMonitor } from './process-run-monitor'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'muted'> = {
  active: 'success',
  draft: 'warning',
  archived: 'muted',
}

/**
 * Create AND edit share this form - creating is just editing a blank
 * process that also offers a template. `mode` only changes which fields show
 * (the template picker makes no sense once a process already has steps) and
 * the dialog's copy; the submit handler is supplied by the caller either way.
 */
function ProcessDetailsDialog({
  mode,
  initial,
  categories,
  hasTemplate,
  onCancel,
  onSubmit,
}: {
  mode: 'create' | 'edit'
  initial?: { name: string; category?: string | null; description?: string | null }
  categories: { key: string; label: string; group: string }[]
  hasTemplate: (key: string) => boolean
  onCancel: () => void
  onSubmit: (data: { name: string; category?: string; description?: string; template_key?: string }) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [useTemplate, setUseTemplate] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const grouped = useMemo(() => {
    const byGroup = new Map<string, { key: string; label: string }[]>()
    for (const c of categories) {
      if (!byGroup.has(c.group)) byGroup.set(c.group, [])
      byGroup.get(c.group)!.push({ key: c.key, label: c.label })
    }
    return byGroup
  }, [categories])

  const categoryOptions = [
    { value: '', label: 'No category' },
    ...Array.from(grouped.entries()).flatMap(([group, items]) =>
      items.map((item) => ({ value: item.key, label: `${group} — ${item.label}` })),
    ),
  ]

  const templateAvailable = mode === 'create' && category !== '' && hasTemplate(category)

  async function handleSubmit() {
    if (!name.trim()) return
    setIsSubmitting(true)
    setError('')
    try {
      await onSubmit({
        name: name.trim(),
        category: category || undefined,
        description: description.trim() || undefined,
        template_key: templateAvailable && useTemplate ? category : undefined,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Failed to ${mode === 'create' ? 'create' : 'update'} the process.`)
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New Process' : 'Edit Process Details'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Start from a template, or build a blank process from scratch.'
              : 'Rename this process or change its category and description.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Name</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Candidate Hiring Process" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Category</label>
            <SelectInput value={category} onChange={setCategory} options={categoryOptions} />
          </div>

          {templateAvailable && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={useTemplate} onChange={(event) => setUseTemplate(event.target.checked)} />
              Start from the {categories.find((c) => c.key === category)?.label} template
            </label>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Description (optional)</label>
            <Textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>

          {error && <Notice tone="error">{error}</Notice>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!name.trim() || isSubmitting}>
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Process' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProcessCard({
  process,
  stepTypes,
  canManage,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete,
  onViewRuns,
}: {
  process: DepartmentProcess
  stepTypes: Record<string, { label: string; color: string }>
  canManage: boolean
  onOpen: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onViewRuns: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <p className="truncate text-sm font-semibold text-foreground hover:text-primary">{process.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {process.step_count ?? process.steps?.length ?? 0} steps
            {process.updated_at ? ` · ${new Date(process.updated_at).toLocaleDateString()}` : ''}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={STATUS_VARIANT[process.status] ?? 'muted'} className="text-[10px] capitalize">
            {process.status === 'active' ? `Active · v${process.current_version}` : process.status}
          </Badge>
          {canManage && (
            <div className="relative">
              <button
                type="button"
                aria-label="More options"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MoreVertical className="size-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    onClick={() => {
                      setMenuOpen(false)
                      onEdit()
                    }}
                  >
                    <Pencil className="size-3.5" /> Edit details
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    onClick={() => {
                      setMenuOpen(false)
                      onDuplicate()
                    }}
                  >
                    <Copy className="size-3.5" /> Duplicate
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setMenuOpen(false)
                      onDelete()
                    }}
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <button type="button" onClick={onOpen} className="block w-full">
        <ProcessMiniPreview
          steps={process.steps ?? []}
          edges={process.edges ?? []}
          stepTypes={stepTypes}
          active={process.status === 'active'}
        />
      </button>

      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onViewRuns}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
        >
          <PlayCircle className="size-3.5" aria-hidden="true" />
          {process.status === 'active' ? 'Runs' : 'View runs'}
        </button>
        {process.status !== 'active' && (
          <span className="text-[11px] text-muted-foreground">Publish to start a run</span>
        )}
      </div>
    </div>
  )
}

/** Every run of one process - start a new one, or open an existing one into the live monitor. */
function ProcessRunsDialog({
  process,
  context,
  canManage,
  onClose,
  onOpenRun,
}: {
  process: DepartmentProcess
  context: LaravelContext
  canManage: boolean
  onClose: () => void
  onOpenRun: (runId: string) => void
}) {
  const { items, isLoading, error, reload } = useProcessRuns(context, String(process.id))
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState('')

  async function handleStart() {
    setIsStarting(true)
    setStartError('')
    try {
      const response = await organizationService.startDepartmentProcessRun(context, String(process.id), {})
      await reload()
      if (response.data) onOpenRun(String(response.data.id))
    } catch (cause) {
      setStartError(cause instanceof Error ? cause.message : 'Failed to start a run.')
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Runs · {process.name}</DialogTitle>
          <DialogDescription>Every time this process has been started, newest first.</DialogDescription>
        </DialogHeader>

        {canManage && process.status === 'active' && (
          <Button size="sm" onClick={() => void handleStart()} disabled={isStarting}>
            <PlayCircle className="size-4" aria-hidden="true" />
            {isStarting ? 'Starting...' : 'Start New Run'}
          </Button>
        )}
        {startError && <Notice tone="error">{startError}</Notice>}

        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {isLoading && <p className="text-sm text-muted-foreground">Loading runs...</p>}
          {error && <Notice tone="error">{error}</Notice>}
          {!isLoading && !error && items.length === 0 && (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          )}
          {items.map((run) => (
            <button
              key={run.id}
              type="button"
              onClick={() => onOpenRun(String(run.id))}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{run.name || process.name}</p>
                <p className="text-xs text-muted-foreground">
                  {run.started_at ? new Date(run.started_at).toLocaleString() : '-'}
                </p>
              </div>
              <Badge variant={run.status === 'completed' ? 'success' : run.status === 'cancelled' ? 'muted' : 'warning'} className="shrink-0 text-[10px] capitalize">
                {run.status}
              </Badge>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The Process tab's library: every process a department has defined, grouped
 * by category, each with an animated glance at its shape. Opening a card (or
 * "+ New Process") launches the full-screen canvas builder.
 */
export function ProcessLibrary({
  department,
  context,
  canManage,
}: {
  department: Department
  context: LaravelContext
  canManage: boolean
}) {
  const { items, isLoading, error, reload, setError, create, update, duplicate, remove } = useDepartmentProcesses(
    context,
    department.id,
  )
  const { templates } = useDepartmentProcessTemplates(context)

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<DepartmentProcess | null>(null)
  const [deleting, setDeleting] = useState<DepartmentProcess | null>(null)
  const [openProcess, setOpenProcess] = useState<DepartmentProcess | null>(null)
  const [viewingRunsFor, setViewingRunsFor] = useState<DepartmentProcess | null>(null)
  const [openRunId, setOpenRunId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const grouped = useMemo(() => {
    const groups = new Map<string, DepartmentProcess[]>()
    for (const process of items) {
      const label =
        templates?.categories.find((c) => c.key === process.category)?.label || process.category || 'Uncategorized'
      if (!groups.has(label)) groups.set(label, [])
      groups.get(label)!.push(process)
    }
    return groups
  }, [items, templates])

  if (!templates) {
    return <div className="p-4 text-sm text-muted-foreground">Loading...</div>
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Processes ({items.length})</h3>
        {canManage && (
          <Button size="sm" className="h-9" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" />
            New Process
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading processes...</p>}
      {error && <Notice tone="error">{error}</Notice>}
      {!error && notice && <p className="text-xs font-medium text-success">{notice}</p>}

      {!isLoading && !error && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
          <Workflow className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No processes defined for {department.name} yet. Create one from a template or start blank.
          </p>
        </div>
      )}

      {Array.from(grouped.entries()).map(([label, processes]) => (
        <div key={label}>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {processes.map((process) => (
              <ProcessCard
                key={process.id}
                process={process}
                stepTypes={templates.step_types}
                canManage={canManage}
                onOpen={() => setOpenProcess(process)}
                onEdit={() => setEditing(process)}
                onDuplicate={async () => {
                  setError('')
                  try {
                    await duplicate(String(process.id))
                    setNotice(`"${process.name}" duplicated.`)
                  } catch (cause) {
                    setNotice('')
                    setError(cause instanceof Error ? cause.message : 'Failed to duplicate the process.')
                  }
                }}
                onDelete={() => setDeleting(process)}
                onViewRuns={() => setViewingRunsFor(process)}
              />
            ))}
          </div>
        </div>
      ))}

      {creating && (
        <ProcessDetailsDialog
          mode="create"
          categories={templates.categories}
          hasTemplate={(key) => Boolean(templates.templates[key]?.length)}
          onCancel={() => setCreating(false)}
          onSubmit={async (data) => {
            setError('')
            const created = await create(data)
            setCreating(false)
            setNotice(`"${data.name}" created.`)
            if (created) setOpenProcess(created)
          }}
        />
      )}

      {editing && (
        <ProcessDetailsDialog
          mode="edit"
          initial={{ name: editing.name, category: editing.category, description: editing.description }}
          categories={templates.categories}
          hasTemplate={() => false}
          onCancel={() => setEditing(null)}
          onSubmit={async (data) => {
            setError('')
            const target = editing
            await update(String(target.id), data)
            setEditing(null)
            setNotice(`"${data.name}" updated.`)
          }}
        />
      )}

      {deleting && (
        <Dialog open onOpenChange={(open) => !open && setDeleting(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete process</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{deleting.name}&quot;? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  const target = deleting
                  setDeleting(null)
                  setError('')
                  try {
                    await remove(String(target.id))
                    setNotice(`"${target.name}" deleted.`)
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : 'Failed to delete the process.')
                  }
                }}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {openProcess && (
        <ProcessCanvasBuilder
          department={department}
          process={openProcess}
          templates={templates}
          context={context}
          canManage={canManage}
          onClose={() => {
            setOpenProcess(null)
            void reload()
          }}
          onChanged={() => void reload()}
        />
      )}

      {viewingRunsFor && !openRunId && (
        <ProcessRunsDialog
          process={viewingRunsFor}
          context={context}
          canManage={canManage}
          onClose={() => setViewingRunsFor(null)}
          onOpenRun={(runId) => setOpenRunId(runId)}
        />
      )}

      {openRunId && (
        <ProcessRunMonitor
          department={department}
          runId={openRunId}
          templates={templates}
          context={context}
          canManage={canManage}
          onClose={() => setOpenRunId(null)}
          onChanged={() => void reload()}
        />
      )}
    </div>
  )
}
