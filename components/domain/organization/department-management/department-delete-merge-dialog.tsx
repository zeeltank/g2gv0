'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Department } from '@/lib/gtg-org-data'
import type { LaravelContext } from '@/lib/laravel-context'
import { organizationService, type DepartmentImpact } from '@/services/organization'

/**
 * Removing a department: delete it, or merge it into another.
 *
 * This replaces an AlertDialog that offered one irreversible button and stated
 * no consequences at all - it said the department would be removed "from
 * Laravel department management" and nothing about the employees, job roles or
 * LMS content attached to it. Deleting used to leave every one of those
 * pointing at a row the UI could no longer show; that is how nine departments
 * were destroyed on live and 77 skill records stranded.
 *
 * An AlertDialog cannot hold a picker, hence a Dialog.
 */

type Mode = 'delete' | 'merge'
type ImpactState = 'idle' | 'loading' | 'error'

export function DepartmentDeleteMergeDialog({
  department,
  departments,
  context,
  isSaving,
  onCancel,
  onDelete,
  onMerge,
}: {
  department: Department | null
  departments: Department[]
  context: LaravelContext
  isSaving: boolean
  onCancel: () => void
  onDelete: () => void
  onMerge: (targetDepartmentId: string) => void
}) {
  const [mode, setMode] = useState<Mode>('delete')
  const [target, setTarget] = useState<string>('')
  const [search, setSearch] = useState('')
  const [impact, setImpact] = useState<DepartmentImpact | null>(null)
  const [impactState, setImpactState] = useState<ImpactState>('idle')

  const isOpen = Boolean(department)

  useEffect(() => {
    if (!isOpen) {
      setMode('delete')
      setTarget('')
      setSearch('')
      setImpact(null)
      setImpactState('idle')
    }
  }, [isOpen])

  // Re-fetched when the mode changes, because the two answers genuinely
  // differ: delete cascades to the subtree, merge moves only this department.
  useEffect(() => {
    if (!department) return

    let cancelled = false
    setImpactState('loading')

    organizationService
      .getDepartmentImpact(context, department.id, mode)
      .then((response) => {
        if (cancelled) return
        setImpact(response?.data ?? null)
        setImpactState('idle')
      })
      // A COUNT THAT FAILED TO LOAD IS NOT A COUNT OF ZERO. Telling someone
      // "nothing depends on this" because the request failed, immediately
      // before they delete it, is the worst possible place for that lie.
      .catch(() => {
        if (!cancelled) setImpactState('error')
      })

    return () => {
      cancelled = true
    }
  }, [department, context, mode])

  /**
   * Merge targets exclude the department itself and everything beneath it.
   *
   * The backend refuses those too, so offering one would only produce a
   * guaranteed 422. Same exclusion the parent picker performs.
   */
  const candidates = useMemo(() => {
    if (!department) return []

    const childrenOf = new Map<string, string[]>()
    for (const item of departments) {
      const parentId = item.parentId ?? 'root'
      childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), item.id])
    }

    const blocked = new Set<string>([department.id])
    const queue = [department.id]
    while (queue.length) {
      const current = queue.shift()!
      for (const childId of childrenOf.get(current) ?? []) {
        if (blocked.has(childId)) continue
        blocked.add(childId)
        queue.push(childId)
      }
    }

    const q = search.trim().toLowerCase()
    return departments
      .filter((item) => !blocked.has(item.id))
      .filter((item) => !q || item.name.toLowerCase().includes(q) || (item.code ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [department, departments, search])

  const lmsBlocked = (impact?.lms_blocking ?? 0) > 0
  const targetName = departments.find((d) => d.id === target)?.name ?? ''
  const canConfirm = mode === 'merge' ? Boolean(target) : !lmsBlocked

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSaving) onCancel() }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Remove {department?.parent ? 'sub-department' : 'department'}
          </DialogTitle>
          <DialogDescription>
            {department ? `What should happen to "${department.name}" and everything attached to it?` : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Impact first: the choice below is only meaningful once you know
            what is attached. */}
        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          {impactState === 'loading' && (
            <p className="text-muted-foreground">Checking what is attached...</p>
          )}

          {impactState === 'error' && (
            <p className="text-destructive">
              What is attached could not be checked. This is a connection problem, not a count of zero.
            </p>
          )}

          {impactState === 'idle' && impact && (
            impact.total === 0 && impact.sub_departments === 0 ? (
              <p className="font-medium text-foreground">Nothing is attached to this department.</p>
            ) : (
              <>
                <p className="font-medium text-foreground">
                  {impact.total} record{impact.total === 1 ? '' : 's'} attached
                  {impact.sub_departments > 0 && `, plus ${impact.sub_departments} sub-department${impact.sub_departments === 1 ? '' : 's'}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {impact.breakdown.filter((b) => b.count > 0).map((b) => `${b.count} ${b.label}`).join(', ')}
                </p>
              </>
            )
          )}
        </div>

        {lmsBlocked && mode === 'delete' && (
          <div className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">This department cannot be deleted.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {impact?.lms_blocking} learning record{impact?.lms_blocking === 1 ? '' : 's'} (question banks,
                chapters, content) are filed under it. Merge it into another department instead — that moves
                them across rather than stranding them.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <ModeOption
            selected={mode === 'delete'}
            disabled={isSaving}
            onSelect={() => setMode('delete')}
            title="Delete the department"
            description="Its job roles and documents are removed. Employees are unassigned — never deleted — and everything else is released rather than left pointing at a department that no longer exists."
          />
          <ModeOption
            selected={mode === 'merge'}
            disabled={isSaving}
            onSelect={() => setMode('merge')}
            title="Merge into another department"
            description="Employees, job roles, skills, competency, tasks and learning content all become the other department's. Nothing is lost."
          />
        </div>

        {mode === 'merge' && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search departments..."
                className="h-9 pl-9"
                disabled={isSaving}
              />
            </div>

            <div className="max-h-48 overflow-y-auto rounded-md border border-border">
              {candidates.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">No eligible departments to merge into.</p>
              )}
              {candidates.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={isSaving}
                  onClick={() => setTarget(item.id)}
                  className={cn(
                    'flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-muted disabled:opacity-50',
                    target === item.id && 'bg-primary/10',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{item.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[item.code, item.parent ? `under ${item.parent}` : 'top level'].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {target === item.id && <span className="shrink-0 text-xs font-medium text-primary">Selected</span>}
                </button>
              ))}
            </div>

            {target && department && (
              <p className="flex items-center gap-2 text-sm text-foreground">
                <span className="font-medium">{department.name}</span>
                <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="font-medium">{targetName}</span>
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={mode === 'delete' ? 'destructive' : 'default'}
            disabled={isSaving || !canConfirm}
            onClick={() => (mode === 'merge' ? onMerge(target) : onDelete())}
          >
            {mode === 'delete' ? <Trash2 className="size-4" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}
            {isSaving
              ? 'Working...'
              : mode === 'merge'
                ? `Merge into ${targetName || '...'}`
                : 'Delete department'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ModeOption({
  selected,
  disabled,
  onSelect,
  title,
  description,
}: {
  selected: boolean
  disabled: boolean
  onSelect: () => void
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'flex w-full gap-3 rounded-md border p-3 text-left transition-colors disabled:opacity-50',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
          selected ? 'border-primary' : 'border-input',
        )}
        aria-hidden="true"
      >
        {selected && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  )
}
