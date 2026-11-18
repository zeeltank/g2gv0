'use client'

/**
 * Shared "who can a lead/contact/organization/campaign be assigned to"
 * employee list - reuses Task Management's existing `/table_data?table=
 * tbluser` endpoint (taskService.getAssignmentUsers) rather than adding a
 * second, near-identical CRM-specific one.
 */

import { useEffect, useState } from 'react'
import { taskService } from '@/services/task'
import type { LaravelContext } from '@/lib/laravel-context'

export interface AssignableEmployee {
  id: string
  name: string
}

function fullName(row: { first_name: string; middle_name?: string; last_name?: string }): string {
  return [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ').trim()
}

export function useAssignableEmployees(context: LaravelContext, enabled: boolean): AssignableEmployee[] {
  const [employees, setEmployees] = useState<AssignableEmployee[]>([])

  useEffect(() => {
    if (!enabled || !context.token) return

    let active = true

    taskService.getAssignmentUsers(context)
      .then((rows) => {
        if (!active) return
        setEmployees(rows.map((row) => ({ id: String(row.id), name: fullName(row) || `User #${row.id}` })))
      })
      .catch(() => { /* the form still works with a blank picker */ })

    return () => { active = false }
  }, [context, enabled])

  return employees
}

export function employeeName(employees: AssignableEmployee[], id?: string | null): string {
  if (!id) return 'Unassigned'
  return employees.find((employee) => employee.id === id)?.name ?? `User #${id}`
}

export function initialsFor(name?: string | null): string {
  return (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}
