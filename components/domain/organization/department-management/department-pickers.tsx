'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
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
import { organizationService, type LaravelDepartmentEmployee } from '@/services/organization'

/**
 * The two pickers behind "Assign / Change HOD" and "Change Parent".
 *
 * Both controls existed in the UI already - the HOD one as an icon button and a
 * menu item, the parent one as a text link in the details panel - and neither
 * had a click handler or anything to open. There was also nowhere for them to
 * write: head_user_id had a single writer in an unrelated controller and was
 * set on zero of 1,274 live departments.
 */

function fullName(employee: LaravelDepartmentEmployee) {
  return (
    employee.name ||
    employee.employee_name ||
    employee.full_name ||
    [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ') ||
    `Employee #${employee.id}`
  )
}

export function HodPickerDialog({
  department,
  context,
  isSaving,
  onCancel,
  onSelect,
}: {
  department: Department | null
  context: LaravelContext
  isSaving: boolean
  onCancel: () => void
  /** `null` clears the current head. */
  onSelect: (employeeId: string | null) => void
}) {
  const [search, setSearch] = useState('')
  const [employees, setEmployees] = useState<LaravelDepartmentEmployee[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const isOpen = Boolean(department)

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    setIsLoading(true)
    setError('')

    organizationService
      .getDepartmentCandidates(context, {})
      .then((response) => {
        if (!cancelled) setEmployees(response?.data ?? [])
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Failed to load employees.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, context])

  // Filtered here rather than re-querying per keystroke: the endpoint caps at
  // 500 rows, so the whole candidate list is already in memory.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((employee) =>
      fullName(employee).toLowerCase().includes(q) ||
      String(employee.employee_no ?? '').toLowerCase().includes(q),
    )
  }, [employees, search])

  useEffect(() => {
    if (!isOpen) setSearch('')
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSaving) onCancel() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {department?.hod ? 'Change head of department' : 'Assign head of department'}
          </DialogTitle>
          <DialogDescription>
            {department ? `Select the employee who leads "${department.name}".` : ''}
          </DialogDescription>
        </DialogHeader>

        {department?.hod && (
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <span>
              Current: <span className="font-medium text-foreground">{department.hod}</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSaving}
              onClick={() => onSelect(null)}
            >
              <X className="size-3.5" aria-hidden="true" />
              Clear
            </Button>
          </div>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or employee number..."
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-72 min-h-32 overflow-y-auto rounded-md border border-border">
          {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading employees...</p>}
          {!isLoading && error && <p className="p-4 text-sm text-destructive">{error}</p>}
          {!isLoading && !error && visible.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              {employees.length === 0 ? 'No employees found in this organisation.' : 'No employees match that search.'}
            </p>
          )}
          {!isLoading && !error && visible.map((employee) => {
            const isCurrent = String(employee.id) === String(department?.hodId ?? '')
            return (
              <button
                key={employee.id}
                type="button"
                disabled={isSaving}
                onClick={() => onSelect(String(employee.id))}
                className={cn(
                  'flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-muted disabled:opacity-50',
                  isCurrent && 'bg-primary/10',
                )}
              >
                <UserPlus className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{fullName(employee)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[employee.employee_no, employee.department_name].filter(Boolean).join(' · ') || 'No department'}
                  </span>
                </span>
                {isCurrent && <span className="shrink-0 text-xs font-medium text-primary">Current</span>}
              </button>
            )
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ParentPickerDialog({
  department,
  departments,
  isSaving,
  onCancel,
  onSelect,
}: {
  department: Department | null
  departments: Department[]
  isSaving: boolean
  onCancel: () => void
  onSelect: (parentId: string) => void
}) {
  const [search, setSearch] = useState('')
  const isOpen = Boolean(department)

  useEffect(() => {
    if (!isOpen) setSearch('')
  }, [isOpen])

  /**
   * Candidates exclude the department itself and everything beneath it.
   *
   * The backend rejects those moves too (a department cannot be its own
   * ancestor without detaching the branch into a cycle), but offering a choice
   * that is guaranteed to fail is a worse experience than not offering it.
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSaving) onCancel() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Change parent department</DialogTitle>
          <DialogDescription>
            {department ? `Choose where "${department.name}" sits in the hierarchy.` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          Current parent:{' '}
          <span className="font-medium text-foreground">{department?.parent ?? 'None (root department)'}</span>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search departments..."
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-72 min-h-32 overflow-y-auto rounded-md border border-border">
          <button
            type="button"
            disabled={isSaving || !department?.parentId}
            onClick={() => onSelect('0')}
            className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            Move to top level (no parent)
          </button>
          {candidates.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No eligible parent departments.</p>
          )}
          {candidates.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={isSaving || item.id === department?.parentId}
              onClick={() => onSelect(item.id)}
              className={cn(
                'flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-muted disabled:opacity-50',
                item.id === department?.parentId && 'bg-primary/10',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{item.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[item.code, item.parent ? `under ${item.parent}` : 'root department'].filter(Boolean).join(' · ')}
                </span>
              </span>
              {item.id === department?.parentId && (
                <span className="shrink-0 text-xs font-medium text-primary">Current</span>
              )}
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
