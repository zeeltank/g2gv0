'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, ExternalLink, Search, UserMinus, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Department } from '@/lib/gtg-org-data'
import type { LaravelContext } from '@/lib/laravel-context'
import { organizationService, type LaravelDepartmentEmployee, type DepartmentJobRole } from '@/services/organization'
import { SelectInput } from '../components'

/**
 * Staffing a department: transfer people in, pull in employees who have no
 * department, remove people, or go and create a new employee.
 *
 * There was previously no way to put anybody in a department from this screen
 * at all. Creating one produced an empty shell, and the only route in the whole
 * application that deliberately moved an employee between departments was the
 * mobility module - one person at a time, and it insisted on a job role that a
 * plain department move does not have.
 *
 * Used twice: as step 3 of the create wizard, and as the Employees section of
 * the details panel, so existing departments get the same tools as new ones.
 */

type Source = 'transfer' | 'unassigned'

function fullName(employee: LaravelDepartmentEmployee) {
  return (
    employee.name ||
    employee.employee_name ||
    employee.full_name ||
    [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ') ||
    `Employee #${employee.id}`
  )
}

export function DepartmentEmployeesPanel({
  department,
  departments,
  context,
  canManage,
  onChanged,
}: {
  department: Department
  /** Every department in the tenant, for the "transfer from" selector. */
  departments: Department[]
  context: LaravelContext
  canManage: boolean
  /** Fired after any successful move, so the caller can reload headcounts. */
  onChanged?: () => void
}) {
  const [source, setSource] = useState<Source>('transfer')
  const [sourceDepartmentId, setSourceDepartmentId] = useState('')
  // The role the moved employees take in THIS department. Optional, because a
  // department may not have its roles defined yet.
  const [jobRoleId, setJobRoleId] = useState('')
  const [jobRoles, setJobRoles] = useState<DepartmentJobRole[]>([])
  const [candidates, setCandidates] = useState<LaravelDepartmentEmployee[]>([])
  const [current, setCurrent] = useState<LaravelDepartmentEmployee[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  /** Everything except this department - you cannot transfer from yourself. */
  const transferSources = useMemo(
    () => departments.filter((d) => d.id !== department.id).sort((a, b) => a.name.localeCompare(b.name)),
    [departments, department.id],
  )

  const loadCurrent = useCallback(async () => {
    try {
      const response = await organizationService.getDepartmentCandidates(context, {
        departmentId: department.id,
      })
      setCurrent(response?.data ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load current employees.')
    }
  }, [context, department.id])

  const loadCandidates = useCallback(async () => {
    setIsLoading(true)
    setError('')
    setSelected(new Set())
    try {
      const response = await organizationService.getDepartmentCandidates(
        context,
        source === 'unassigned'
          ? { unassigned: true }
          : sourceDepartmentId
            ? { departmentId: sourceDepartmentId }
            : { departmentId: '-1' }, // nothing selected yet -> deliberately empty
      )
      setCandidates(sourceDepartmentId || source === 'unassigned' ? response?.data ?? [] : [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load employees.')
      setCandidates([])
    } finally {
      setIsLoading(false)
    }
  }, [context, source, sourceDepartmentId])

  useEffect(() => {
    void loadCurrent()
  }, [loadCurrent])

  // This department's own roles - the only ones an employee moving here may
  // hold, which is why the backend refuses a role from anywhere else.
  useEffect(() => {
    let cancelled = false
    organizationService
      .getDepartmentJobRoles(context, department.id)
      .then((response) => {
        if (!cancelled) setJobRoles(response?.data ?? [])
      })
      .catch(() => {
        if (!cancelled) setJobRoles([])
      })
    return () => {
      cancelled = true
    }
  }, [context, department.id])

  useEffect(() => {
    void loadCandidates()
  }, [loadCandidates])

  const visibleCandidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter(
      (employee) =>
        fullName(employee).toLowerCase().includes(q) ||
        String(employee.employee_no ?? '').toLowerCase().includes(q),
    )
  }, [candidates, search])

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function run(action: () => Promise<{ applied?: number; refused?: number; message?: string }>) {
    setIsSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await action()
      // The endpoint reports per employee, so say what actually happened
      // rather than assuming the whole batch went through.
      const applied = result?.applied ?? 0
      const refused = result?.refused ?? 0
      setNotice(refused > 0 ? `${applied} moved, ${refused} skipped.` : result?.message || `${applied} employee(s) moved.`)
      setSelected(new Set())
      await Promise.all([loadCurrent(), loadCandidates()])
      onChanged?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to update employees.')
    } finally {
      setIsSaving(false)
    }
  }

  const addSelected = () =>
    run(() =>
      organizationService.assignDepartmentEmployees(context, department.id, Array.from(selected), {
        remarks: source === 'unassigned' ? 'Assigned from unassigned pool' : 'Department transfer',
        // A job role belongs to exactly one department, so moving someone
        // without giving them a role of THIS department leaves them holding one
        // from the department they just left. When no role is chosen the
        // backend clears a stale one and says so per employee.
        ...(jobRoleId ? { jobrole_id: jobRoleId } : {}),
      }),
    )

  const removeEmployee = (id: string) =>
    run(() => organizationService.unassignDepartmentEmployees(context, department.id, [id]))

  /**
   * Creating a brand-new employee belongs to the Employee Directory, which
   * owns the whole joining process. Sending the user there beats a second,
   * partial employee form living inside department setup.
   */
  function goToEmployeeDirectory() {
    if (typeof window === 'undefined') return
    window.open('/organization/employees', '_blank', 'noopener')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Users className="size-4" />
          Employees ({current.length})
        </h4>
        {canManage && (
          <Button type="button" variant="outline" size="sm" onClick={goToEmployeeDirectory}>
            <ExternalLink className="size-3.5" aria-hidden="true" />
            Add new employee
          </Button>
        )}
      </div>

      {notice && <p className="text-xs text-success">{notice}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {current.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-md border border-border">
          {current.map((employee) => (
            <div
              key={employee.id}
              className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0"
            >
              <span className="min-w-0 flex-1 truncate">
                {fullName(employee)}
                {employee.employee_no && (
                  <span className="ml-2 text-xs text-muted-foreground">{employee.employee_no}</span>
                )}
              </span>
              {canManage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => void removeEmployee(String(employee.id))}
                >
                  <UserMinus className="size-3.5" aria-hidden="true" />
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <SelectInput
              value={source}
              onChange={(value) => {
                setSource(value as Source)
                setSelected(new Set())
              }}
              className="h-9 w-full sm:w-56"
              options={[
                { value: 'transfer', label: 'Transfer from a department' },
                { value: 'unassigned', label: 'Employees with no department' },
              ]}
            />
            {source === 'transfer' && (
              <SelectInput
                value={sourceDepartmentId}
                onChange={setSourceDepartmentId}
                className="h-9 w-full sm:w-64"
                options={[
                  { value: '', label: 'Select a department...' },
                  ...transferSources.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            )}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employees..."
              className="h-9 pl-9"
            />
          </div>

          <div className="max-h-56 min-h-24 overflow-y-auto rounded-md border border-border">
            {isLoading && <p className="p-3 text-sm text-muted-foreground">Loading employees...</p>}
            {!isLoading && source === 'transfer' && !sourceDepartmentId && (
              <p className="p-3 text-sm text-muted-foreground">
                Choose a department to transfer employees from.
              </p>
            )}
            {!isLoading && visibleCandidates.length === 0 && (source !== 'transfer' || sourceDepartmentId) && (
              <p className="p-3 text-sm text-muted-foreground">
                {source === 'unassigned'
                  ? 'Every employee is already assigned to a department.'
                  : 'That department has no employees to transfer.'}
              </p>
            )}
            {!isLoading &&
              visibleCandidates.map((employee) => {
                const id = String(employee.id)
                const isSelected = selected.has(id)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(id)}
                    className={cn(
                      'flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-muted',
                      isSelected && 'bg-primary/10',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded border',
                        isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                      )}
                      aria-hidden="true"
                    >
                      {isSelected && '✓'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{fullName(employee)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[employee.employee_no, employee.department_name].filter(Boolean).join(' · ') ||
                          'No department'}
                      </span>
                    </span>
                  </button>
                )
              })}
          </div>

          {jobRoles.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Job role in this department{' '}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <SelectInput
                value={jobRoleId}
                onChange={setJobRoleId}
                className="h-9"
                options={[
                  { value: '', label: 'Keep or clear their current role' },
                  ...jobRoles.map((role) => ({ value: String(role.id), label: role.jobrole })),
                ]}
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            <Button
              type="button"
              size="sm"
              disabled={isSaving || selected.size === 0}
              onClick={() => void addSelected()}
            >
              {source === 'unassigned' ? (
                <UserPlus className="size-3.5" aria-hidden="true" />
              ) : (
                <ArrowRightLeft className="size-3.5" aria-hidden="true" />
              )}
              {source === 'unassigned' ? 'Assign to department' : 'Transfer to this department'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
