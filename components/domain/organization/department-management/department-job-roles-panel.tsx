'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Briefcase, ExternalLink, RefreshCw, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Department } from '@/lib/gtg-org-data'
import type { LaravelContext } from '@/lib/laravel-context'
import { organizationService, type DepartmentJobRole } from '@/services/organization'

/**
 * The job roles that belong to a department.
 *
 * This is the middle link of department -> job role -> employee, and Department
 * Management had no view of it at all: creating a department gave you somewhere
 * to put people but nothing to put them in.
 *
 * CREATION DELIBERATELY LIVES ELSEWHERE. Job roles are created in Capability
 * Library, whose form already covers levels, categories, responsibilities and
 * skills, and whose endpoint writes department_id correctly. A second create
 * form here would write the same table with fewer fields and drift from it, so
 * this panel lists, shows headcount, and links out.
 *
 * Used twice: the Job Roles tab on an existing department, and the matching
 * step of the create wizard.
 */

const JOB_ROLE_LIBRARY_LINK = '/module/capability-management/libraries/job-role-library'

export function DepartmentJobRolesPanel({
  department,
  context,
  canManage,
  /** Employees per role, so a role that nobody holds is visible as such. */
  employeeCountByRole,
}: {
  department: Department
  context: LaravelContext
  canManage: boolean
  employeeCountByRole?: Record<string, number>
}) {
  const [roles, setRoles] = useState<DepartmentJobRole[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await organizationService.getDepartmentJobRoles(context, department.id)
      setRoles(response?.data ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load job roles.')
      setRoles([])
    } finally {
      setIsLoading(false)
    }
  }, [context, department.id])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return roles
    return roles.filter(
      (role) =>
        role.jobrole?.toLowerCase().includes(q) ||
        (role.jobrole_category ?? '').toLowerCase().includes(q),
    )
  }, [roles, search])

  function openLibrary() {
    if (typeof window === 'undefined') return
    // Carries the department so the Library form opens pre-filtered, rather
    // than making the user find it again in a list of every department.
    const url = `${JOB_ROLE_LIBRARY_LINK}?department=${encodeURIComponent(department.name)}`
    window.open(url, '_blank', 'noopener')
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Briefcase className="size-4" />
          Job Roles ({roles.length})
        </h4>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => void load()} disabled={isLoading}>
            <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} aria-hidden="true" />
            Refresh
          </Button>
          {canManage && (
            <Button type="button" variant="outline" size="sm" onClick={openLibrary}>
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Create in Library
            </Button>
          )}
        </div>
      </div>

      {roles.length > 4 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search job roles..."
            className="h-9 pl-9"
          />
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading job roles...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!isLoading && !error && roles.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          <p>No job roles are defined for {department.name} yet.</p>
          <p className="mt-1">
            Job roles are created in Capability Library and assigned to a department there. Employees
            are then given one of this department&apos;s roles.
          </p>
        </div>
      )}

      {!isLoading && !error && visible.length > 0 && (
        <div className="overflow-hidden rounded-md border border-border">
          {visible.map((role) => {
            const held = employeeCountByRole?.[String(role.id)] ?? 0
            return (
              <div
                key={role.id}
                className="flex items-start gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
              >
                <Briefcase className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{role.jobrole}</p>
                  {(role.jobrole_category || role.description) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {[role.jobrole_category, role.description].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                {employeeCountByRole && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                    title={`${held} employee${held === 1 ? '' : 's'} hold this role`}
                  >
                    <Users className="size-3" aria-hidden="true" />
                    {held}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!isLoading && !error && roles.length > 0 && visible.length === 0 && (
        <p className="text-sm text-muted-foreground">No job roles match that search.</p>
      )}
    </div>
  )
}
