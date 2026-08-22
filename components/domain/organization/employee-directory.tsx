'use client'

import * as React from 'react'
import { lazy, Suspense } from 'react'
import {
  Plus,
  Download,
  Upload,
  MoreHorizontal,
  User,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Target,
  RefreshCw,
  Building2,
} from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { FilterBar, type Filter } from '@/components/ui/filter-bar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  employeeDirectoryService,
  type DirectoryEmployee,
  type ReferenceData,
  type ListMeta,
} from '@/services/organization/employee-directory'
import { organizationService } from '@/services/organization'
import type { Employee } from '@/types/employee'
import { cn } from '@/lib/utils'
import { ImportEmployeesDialog } from './employee-directory-parts/import-employees-dialog'
import { BulkActionsBar } from './employee-directory-parts/bulk-actions-bar'

const LazyEmployeeDirectorySheets = lazy(() =>
  import('@/domain/organization/employee-directory-sheets').then((module) => ({
    default: module.EmployeeDirectorySheets,
  })),
)

type PulseCardData = {
  id: string
  title: string
  value: string | number
  subtitle: string
  icon: React.ElementType
}

/*
 * THERE IS NO MOCK DATA HERE ANY MORE.
 *
 * `defaultMockEmployees` used to be both the initial state and the catch
 * fallback, so a failed request rendered two invented people - John Doe and
 * Jane Smith - with no error anywhere on screen. Nobody could tell a broken
 * API from a small company. Loading now shows a loading row, failure shows the
 * failure with a Retry, and an empty result says which kind of empty it is.
 */

/** The list row, mapped from the API shape into what the table and drawer read. */
function toEmployee(row: DirectoryEmployee): Employee {
  const name = row.full_name?.trim()
    || [row.first_name, row.last_name].filter(Boolean).join(' ').trim()

  return {
    id: row.id,
    full_name: name || '(no name)',
    email: row.email ?? '',
    mobile: row.mobile ?? '',
    department_name: row.department_name ?? '',
    jobRole: row.jobrole ?? '',
    designation: row.jobrole ?? '',
    address: [row.city, row.state].filter(Boolean).join(', '),
    image: row.image?.trim() ? row.image : '',
    occupation: row.department_name ?? '',
    status: Number(row.status) === 1 ? 'Active' : 'Inactive',
    lastActivity: '',
    join_Date: row.joined_date ?? '',
    profile_name: row.profile_name ?? '',
    skills: [],
    status_code: Number(row.status),
    department_id: row.department_id,
    jobrole_id: row.jobrole_id,
    user_profile_id: row.user_profile_id,
    employee_no: row.employee_no,
  }
}

export function EmployeeDirectory() {
  const context = React.useMemo(() => getLaravelContext(), [])

  const [searchQuery, setSearchQuery] = React.useState('')
  const [departmentFilter, setDepartmentFilter] = React.useState('')
  const [jobRoleFilter, setJobRoleFilter] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('')
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [isAddSheetOpen, setIsAddSheetOpen] = React.useState(false)
  const [isImportOpen, setIsImportOpen] = React.useState(false)
  const [activeEmployee, setActiveEmployee] = React.useState<Employee | null>(null)

  const [employees, setEmployees] = React.useState<Employee[]>([])
  const [meta, setMeta] = React.useState<ListMeta | null>(null)
  const [reference, setReference] = React.useState<ReferenceData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  /**
   * Filtering happens on the server, by id.
   *
   * The old screen filtered in the browser by comparing department *names*
   * against a hardcoded list of three, so choosing a filter usually produced
   * zero rows even when the department existed.
   */
  const load = React.useCallback(
    async (options: { clearNotice?: boolean } = {}) => {
      if (options.clearNotice !== false) setNotice('')
      setLoading(true)
      setError('')
      try {
        const response = await employeeDirectoryService.list(context, {
          q: searchQuery.trim() || undefined,
          departmentId: departmentFilter || undefined,
          jobroleId: jobRoleFilter || undefined,
          status: statusFilter || undefined,
        })
        setEmployees((response?.data ?? []).map(toEmployee))
        setMeta(response?.meta ?? null)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Failed to load employees.')
        setEmployees([])
        setMeta(null)
      } finally {
        setLoading(false)
      }
    },
    [context, searchQuery, departmentFilter, jobRoleFilter, statusFilter],
  )

  React.useEffect(() => {
    const timer = setTimeout(() => void load(), searchQuery ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, searchQuery])

  // The pickers' options, loaded once. Failing to load them is not fatal to the
  // list, so it only disables the filters rather than blanking the screen.
  React.useEffect(() => {
    let alive = true
    employeeDirectoryService
      .referenceData(context)
      .then((response) => {
        if (alive) setReference(response?.data ?? null)
      })
      .catch(() => {
        if (alive) setReference(null)
      })
    return () => {
      alive = false
    }
  }, [context])

  const filters: Filter[] = React.useMemo(() => [
    {
      id: 'search',
      label: 'Search Employee',
      type: 'search',
      value: searchQuery,
      onChange: (value) => setSearchQuery(value as string),
    },
    {
      id: 'department',
      label: 'Department',
      type: 'select',
      value: departmentFilter,
      onChange: (value) => setDepartmentFilter(value as string),
      options: (reference?.departments ?? []).map((d) => ({
        id: String(d.id),
        label: d.name,
        value: String(d.id),
      })),
    },
    {
      id: 'jobrole',
      label: 'Job Role',
      type: 'select',
      value: jobRoleFilter,
      onChange: (value) => setJobRoleFilter(value as string),
      options: (reference?.job_roles ?? []).map((r) => ({
        id: String(r.id),
        label: r.name,
        value: String(r.id),
      })),
    },
    {
      id: 'status',
      label: 'Status',
      type: 'select',
      value: statusFilter,
      onChange: (value) => setStatusFilter(value as string),
      options: [
        { id: 'active', label: 'Active', value: '1' },
        { id: 'inactive', label: 'Inactive', value: '0' },
      ],
    },
  ], [searchQuery, departmentFilter, jobRoleFilter, statusFilter, reference])

  /**
   * Headline counts.
   *
   * The old "Skill Deficit" card read `employee.skills`, a key the endpoint
   * never returned, so it reported 100% for every organisation. It is replaced
   * by a count this data can actually answer: people with no job role, which is
   * what blocks competency and learning assignment downstream.
   */
  const pulseCards = React.useMemo<PulseCardData[]>(() => {
    const active = employees.filter((e) => e.status_code === 1).length
    const inactive = employees.length - active
    const missingContact = employees.filter((e) => !e.email || !e.mobile).length
    const noDepartment = employees.filter((e) => !e.department_id).length
    const noRole = employees.filter((e) => !e.jobrole_id).length

    const dash = (value: number) => (loading ? '—' : value)

    return [
      {
        id: 'active-headcount',
        title: 'Active Headcount',
        value: dash(active),
        subtitle: loading ? 'Loading...' : `${inactive} inactive · ${employees.length} shown`,
        icon: User,
      },
      {
        id: 'incomplete-contact',
        title: 'Incomplete Contact',
        value: dash(missingContact),
        subtitle: loading ? 'Loading...' : 'Missing an email or a mobile number',
        icon: ShieldAlert,
      },
      {
        id: 'no-department',
        title: 'Unassigned',
        value: dash(noDepartment),
        subtitle: loading ? 'Loading...' : 'Not in any department',
        icon: Building2,
      },
      {
        id: 'no-jobrole',
        title: 'No Job Role',
        value: dash(noRole),
        subtitle: loading ? 'Loading...' : 'Blocks competency and learning assignment',
        icon: Target,
      },
    ]
  }, [employees, loading])

  async function changeStatus(employee: Employee, next: 0 | 1) {
    const verb = next === 0 ? 'Suspend access for' : 'Restore access for'
    if (!window.confirm(`${verb} ${employee.full_name}?`)) return

    try {
      const response = await employeeDirectoryService.setStatus(context, employee.id, next)
      await load({ clearNotice: false })
      setNotice(response?.message || 'Status updated.')
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Failed to update status.')
    }
  }

  /** A CSV of exactly what is on screen, built from the rows already loaded. */
  function exportCsv(rows: Employee[]) {
    const headers = ['Employee No', 'Name', 'Email', 'Mobile', 'Department', 'Job Role', 'Status', 'Joined']
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const body = rows.map((e) =>
      [e.employee_no, e.full_name, e.email, e.mobile, e.department_name, e.jobRole, e.status, e.join_Date]
        .map(escape)
        .join(','),
    )
    const csv = [headers.map(escape).join(','), ...body].join('\r\n')

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setNotice(`Exported ${rows.length} employee${rows.length === 1 ? '' : 's'}.`)
  }

  const selectedEmployees = React.useMemo(
    () => employees.filter((e) => selectedIds.includes(String(e.id))),
    [employees, selectedIds],
  )

  const columns: Column<Employee>[] = React.useMemo(() => [
    {
      id: 'full_name',
      header: 'Employee',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          {row.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- External URLs may not work with next/image
            <img src={row.image} alt={row.full_name} className="size-10 rounded-full border border-border object-cover" />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
              <User className="size-5" />
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">{row.full_name}</span>
            <span className="text-xs text-muted-foreground">{row.email || '—'}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'department_name',
      header: 'Department',
      render: (_, row) => (
        <span className={cn('text-sm font-medium', !row.department_name && 'text-muted-foreground')}>
          {row.department_name || 'Unassigned'}
        </span>
      ),
    },
    {
      id: 'jobRole',
      header: 'Job Role',
      render: (_, row) => (
        <span className={cn('text-sm font-medium text-muted-foreground', !row.jobRole && 'italic')}>
          {row.jobRole || 'No role'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      render: (value) => {
        const status = String(value)
        const variant = status.toLowerCase() === 'active' ? 'active' : 'inactive'
        return <StatusBadge status={status} variant={variant as any} className="capitalize" />
      },
    },
    {
      id: 'id',
      header: 'Action',
      width: '16',
      render: (_, row) => (
        <div className="relative flex justify-start" onClick={(event) => event.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="absolute right-0 mt-1 w-48">
              <DropdownMenuItem onClick={() => setActiveEmployee(row)} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" /> View Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {row.status_code === 1 ? (
                <DropdownMenuItem
                  onClick={() => void changeStatus(row, 0)}
                  className="cursor-pointer text-destructive focus-visible:bg-destructive/10"
                >
                  <ShieldAlert className="mr-2 h-4 w-4" /> Suspend Access
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => void changeStatus(row, 1)} className="cursor-pointer">
                  <ShieldCheck className="mr-2 h-4 w-4" /> Restore Access
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
    // changeStatus closes over `load` and `context`, both stable for a render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  const hasFilters = Boolean(searchQuery || departmentFilter || jobRoleFilter || statusFilter)

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500 ease-out">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pulseCards.map((card, index) => {
          const Icon = card.icon
          return (
            <Card key={card.id} className="animate-in fade-in slide-in-from-bottom-3" style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">{card.subtitle}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border/50 bg-card/50 p-4 shadow-xs backdrop-blur-xl sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <User className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Total Employees</h2>
            <p className="text-xs text-muted-foreground">
              {loading ? 'Loading...' : `${employees.length} ${hasFilters ? 'matching' : 'total'} member${employees.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading} className="cursor-pointer">
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsImportOpen(true)} className="hidden cursor-pointer sm:flex">
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => exportCsv(employees)}
            disabled={loading || employees.length === 0}
            className="hidden cursor-pointer sm:flex"
          >
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <div className="mx-2 hidden h-6 w-px bg-border sm:block" />
          <Button size="sm" onClick={() => setIsAddSheetOpen(true)} className="cursor-pointer rounded-md px-5 shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Add Employee
          </Button>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {notice}
        </div>
      )}

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      {selectedEmployees.length > 0 && (
        <BulkActionsBar
          context={context}
          selected={selectedEmployees}
          departments={reference?.departments ?? []}
          onClear={() => setSelectedIds([])}
          onExport={() => exportCsv(selectedEmployees)}
          onDone={async (message) => {
            setSelectedIds([])
            await load({ clearNotice: false })
            setNotice(message)
          }}
        />
      )}

      <Card className="rounded-2xl border-border/50 bg-card/50 shadow-xs backdrop-blur-sm">
        <div className="border-b border-border/40 bg-surface-muted/30 p-4">
          <FilterBar filters={filters} onReset={() => {
            setSearchQuery('')
            setDepartmentFilter('')
            setJobRoleFilter('')
            setStatusFilter('')
          }} />
        </div>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={employees}
            isLoading={loading}
            selectable
            selectedIds={selectedIds}
            onSelectChange={setSelectedIds}
            /* By employee id, not row index - otherwise a selection made before
               a filter change silently acts on whoever lands in those slots. */
            getRowId={(row) => String(row.id)}
            onRowClick={(row) => setActiveEmployee(row)}
            emptyState={
              error ? null : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <p>{meta?.empty_reason || (hasFilters ? 'No employees match these filters.' : 'No employees yet.')}</p>
                  {meta?.empty_is_expected && (
                    <Button size="sm" className="mt-3" onClick={() => setIsAddSheetOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" /> Add the first employee
                    </Button>
                  )}
                </div>
              )
            }
            className="overflow-visible rounded-none border-0 [&_th]:bg-transparent [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_td]:py-4"
          />
        </CardContent>
      </Card>

      <ImportEmployeesDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        context={context}
        onImported={async (message) => {
          await load({ clearNotice: false })
          setNotice(message)
        }}
      />

      <Suspense fallback={null}>
        <LazyEmployeeDirectorySheets
          isAddSheetOpen={isAddSheetOpen}
          onAddSheetOpenChange={setIsAddSheetOpen}
          activeEmployee={activeEmployee}
          onCloseEmployeeSheet={() => setActiveEmployee(null)}
          referenceData={reference}
          onEmployeeChanged={async (message) => {
            await load({ clearNotice: false })
            if (message) setNotice(message)
          }}
        />
      </Suspense>
    </div>
  )
}
