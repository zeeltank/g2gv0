'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { SelectInput } from '../components'
import type { Department } from '@/lib/gtg-org-data'
import type { LaravelContext } from '@/lib/laravel-context'
import { organizationService, type LaravelDepartmentEmployee } from '@/services/organization'

/**
 * Edit an existing department's name, code, description, parent, status and
 * head - everything the form on a department's full-page detail view and
 * the department list both need to open identically.
 *
 * Extracted out of department-list.tsx (which held this as inline Dialog
 * JSX plus seven pieces of its own state) so the new full-page detail view
 * can open the same editor directly, rather than bouncing back to the list
 * for it - the same reason HodPickerDialog/ParentPickerDialog already live
 * in their own file instead of inline.
 */
export function EditDepartmentDialog({
  department,
  departments,
  context,
  onCancel,
  onSaved,
}: {
  /** Non-null means the dialog is open, editing this department. */
  department: Department | null
  /** Every department in the tenant, for the parent picker and cycle-exclusion. */
  departments: Department[]
  context: LaravelContext
  onCancel: () => void
  onSaved: (message: string) => void
}) {
  const isOpen = Boolean(department)

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [parentInput, setParentInput] = useState('')
  const [statusInput, setStatusInput] = useState<'1' | '0'>('1')
  const [headInput, setHeadInput] = useState('')
  const [headCandidates, setHeadCandidates] = useState<LaravelDepartmentEmployee[]>([])

  // Seeded from the row every time a different department opens, so an edit
  // round-trips instead of showing the previous department's draft.
  useEffect(() => {
    if (!department) return
    setName(department.name)
    setCode(department.code ?? '')
    setDescription(department.description ?? '')
    setParentInput(department.parentId ?? '')
    setStatusInput(department.status === 'Active' ? '1' : '0')
    setHeadInput(department.hodId ?? '')
    setError('')
  }, [department])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    void organizationService
      .getDepartmentCandidates(context, {})
      .then((response) => {
        if (!cancelled) setHeadCandidates(response?.data ?? [])
      })
      .catch(() => {
        if (!cancelled) setHeadCandidates([])
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  /**
   * Valid parents: excludes the department itself and everything beneath
   * it. The backend rejects those moves anyway ("Cannot move a department
   * beneath one of its own sub-departments"), so offering them would only
   * produce a guaranteed 422.
   */
  const parentCandidates = useMemo(() => {
    if (!department) return []

    const childrenOf = new Map<string, string[]>()
    for (const item of departments) {
      const key = item.parentId ?? 'root'
      childrenOf.set(key, [...(childrenOf.get(key) ?? []), item.id])
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

    return departments
      .filter((item) => !blocked.has(item.id))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [department, departments])

  const headCandidateOptions = useMemo(
    () =>
      headCandidates.map((employee) => ({
        value: String(employee.id),
        label: [employee.name, employee.employee_no].filter(Boolean).join(' · ') || `Employee #${employee.id}`,
      })),
    [headCandidates],
  )

  function close() {
    if (isSaving) return
    onCancel()
  }

  async function save() {
    if (!department) return

    const nextName = name.trim()
    if (!nextName) {
      setError('Department name is required.')
      return
    }

    const nextCode = code.trim()
    const nextDescription = description.trim()
    const nextStatus = Number(statusInput)

    // Compares every field the form shows - comparing the name alone would
    // make editing only the code look like a no-op and close without saving.
    const unchanged =
      nextName === department.name &&
      nextCode === (department.code ?? '') &&
      nextDescription === (department.description ?? '') &&
      parentInput === (department.parentId ?? '') &&
      nextStatus === (department.status === 'Active' ? 1 : 0) &&
      headInput === (department.hodId ?? '')

    if (unchanged) {
      close()
      return
    }

    setIsSaving(true)
    setError('')
    try {
      // The head lives on its own endpoint (it validates the employee
      // against the tenant), so a head change is a second call rather than
      // a field on update. Done first: if it is refused, nothing else has
      // been written.
      if (headInput !== (department.hodId ?? '')) {
        await organizationService.setDepartmentHead(context, department.id, headInput || null)
      }

      await organizationService.updateDepartment(context, department.id, {
        department: nextName,
        code: nextCode,
        description: nextDescription,
        status: nextStatus,
        ...(parentInput !== (department.parentId ?? '') ? { parent_id: Number(parentInput) || 0 } : {}),
      })

      onSaved(`${department.parent ? 'Sub-department' : 'Department'} updated successfully.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save department.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="rounded-lg">
        <DialogHeader>
          <DialogTitle>Edit {department?.parent ? 'Sub-Department' : 'Department'}</DialogTitle>
          <DialogDescription>
            {department?.parent
              ? `Parent department: ${department.parent}`
              : 'Update this department’s name, code and description.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="edit-department-name" className="text-sm font-medium text-foreground">
              Department Name
            </label>
            <Input
              id="edit-department-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void save()
              }}
              placeholder="Enter department name"
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-department-code" className="text-sm font-medium text-foreground">
              Code <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="edit-department-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void save()
              }}
              placeholder="e.g. HR, ENG-QA"
              maxLength={50}
              disabled={isSaving}
            />
          </div>

          <div className="grid gap-4 @md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="edit-department-parent" className="text-sm font-medium text-foreground">
                Parent Department
              </label>
              <SelectInput
                id="edit-department-parent"
                value={parentInput}
                onChange={setParentInput}
                className="h-10"
                options={[
                  { value: '', label: 'None (top level)' },
                  ...parentCandidates.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-department-status" className="text-sm font-medium text-foreground">
                Status
              </label>
              <SelectInput
                id="edit-department-status"
                value={statusInput}
                onChange={(value) => setStatusInput(value === '0' ? '0' : '1')}
                className="h-10"
                options={[
                  { value: '1', label: 'Active' },
                  { value: '0', label: 'Inactive' },
                ]}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-department-head" className="text-sm font-medium text-foreground">
              Head of Department <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <SelectInput
              id="edit-department-head"
              value={headInput}
              onChange={setHeadInput}
              className="h-10"
              options={[{ value: '', label: 'Unassigned' }, ...headCandidateOptions]}
            />
            {department?.hod && !headInput && (
              <p className="text-xs text-muted-foreground">Saving will clear the current head ({department.hod}).</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-department-description" className="text-sm font-medium text-foreground">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="edit-department-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this department is responsible for"
              rows={3}
              disabled={isSaving}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
