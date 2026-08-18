'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { organizationService } from '@/services/organization'
import type { LaravelPayrollEmployee } from '@/services/hrms'

export function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** The Laravel context is rebuilt per call - it reads live storage, not React state. */
export function useLaravelContext() {
  const { user } = useAuth()
  return useCallback(() => getLaravelContext(user), [user])
}

export interface PayrollOption {
  value: string
  label: string
}

/** employeeDetails() returns "-" for blank name parts, which must not be rendered. */
export function payrollEmployeeLabel(employee: LaravelPayrollEmployee): string {
  const name = [employee.first_name, employee.middle_name, employee.last_name]
    .map((part) => (part ?? '').trim())
    .filter((part) => part && part !== '-')
    .join(' ')
  return name || employee.employee_no || `Employee ${employee.id}`
}

/** Reads `employee_salary_data` / `payrollHead` JSON columns into a numeric map. */
export function parseSalaryDataJson(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, number | string>
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, Number(value) || 0]))
  } catch {
    return {}
  }
}

/**
 * Departments for the payroll filters. Reads /api/departments-management - the
 * same route the department and disciplinary screens use - rather than the
 * unscoped HrmsDepartment list some payroll controllers return.
 */
export function usePayrollDepartments() {
  const resolveContext = useLaravelContext()
  const { isLoading: authLoading } = useAuth()
  const [departments, setDepartments] = useState<PayrollOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    let cancelled = false

    const load = async () => {
      const context = resolveContext()
      if (!isLaravelContextReady(context)) {
        setLoading(false)
        return
      }

      try {
        const response = await organizationService.getDepartmentsManagement(context)
        const all = [
          ...(response.main_departments ?? []),
          ...Object.values(response.sub_departments ?? {}).flat(),
        ]
        if (!cancelled) {
          setDepartments(all.map((item) => ({ value: String(item.id), label: item.department })))
        }
      } catch {
        if (!cancelled) setDepartments([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [authLoading, resolveContext])

  return { departments, loading }
}

/** Employees of one department, for the Form 16 and Salary Certificate pickers. */
export function useDepartmentEmployees(departmentId: string) {
  const resolveContext = useLaravelContext()
  const [employees, setEmployees] = useState<PayrollOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!departmentId) {
      setEmployees([])
      return
    }

    let cancelled = false
    setLoading(true)

    const load = async () => {
      const context = resolveContext()
      if (!isLaravelContextReady(context)) {
        setLoading(false)
        return
      }

      try {
        const rows = await organizationService.getEmployeesByDepartment(context, departmentId)
        if (cancelled) return
        setEmployees(
          (Array.isArray(rows) ? rows : []).map((row) => ({
            value: String(row.id),
            label: payrollEmployeeLabel(row as LaravelPayrollEmployee),
          })),
        )
      } catch {
        if (!cancelled) setEmployees([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [departmentId, resolveContext])

  return { employees, loading }
}
