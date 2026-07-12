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
  UserPlus,
  Target,
} from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { FilterBar, type Filter } from '@/components/ui/filter-bar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import type { Employee } from '@/types/employee'

const LazyEmployeeDirectorySheets = lazy(() =>
  import('@/components/org/employee-directory-sheets').then((module) => ({
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

const defaultMockEmployees: Employee[] = [
  {
    id: 1,
    full_name: 'John Doe',
    email: 'john.doe@example.com',
    mobile: '+1 (555) 123-4567',
    department_name: 'Engineering',
    jobRole: 'Senior Developer',
    designation: 'Senior Developer',
    address: 'New York',
    image: '',
    occupation: 'Engineering',
    status: 'Active',
    lastActivity: 'Unknown',
    join_Date: '2023-01-15',
    profile_name: 'Admin',
    skills: [],
  },
  {
    id: 2,
    full_name: 'Jane Smith',
    email: 'jane.smith@example.com',
    mobile: '+1 (555) 987-6543',
    department_name: 'Human Resources',
    jobRole: 'HR Manager',
    designation: 'HR Manager',
    address: 'San Francisco',
    image: '',
    occupation: 'HR',
    status: 'Active',
    lastActivity: 'Unknown',
    join_Date: '2022-11-01',
    profile_name: 'HR Admin',
    skills: [],
  },
]

function hasStoredEmployeeSession() {
  if (typeof window === 'undefined') return false
  return Boolean(window.localStorage.getItem('userData'))
}

export function EmployeeDirectory() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [departmentFilter, setDepartmentFilter] = React.useState('')
  const [jobRoleFilter, setJobRoleFilter] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('')
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [isAddSheetOpen, setIsAddSheetOpen] = React.useState(false)
  const [activeEmployee, setActiveEmployee] = React.useState<Employee | null>(null)
  const [employeesData, setEmployeesData] = React.useState<Employee[]>(defaultMockEmployees)
  const [loading, setLoading] = React.useState(hasStoredEmployeeSession)

  React.useEffect(() => {
    if (!hasStoredEmployeeSession()) return

    let isMounted = true

    const fetchEmployees = async () => {
      try {
        const userDataStr = localStorage.getItem('userData')
        if (!userDataStr) {
          if (isMounted) setLoading(false)
          return
        }

        const sessionData = JSON.parse(userDataStr)
        const { APP_URL, token, sub_institute_id, org_type, user_id, user_profile_name, syear } = sessionData
        const apiUrl = `${APP_URL}/user/add_user?type=API&token=${token}&sub_institute_id=${sub_institute_id || 1}&org_type=${encodeURIComponent(org_type || 'Financial Services')}&user_id=${user_id}&user_profile_name=${encodeURIComponent(user_profile_name || 'Admin')}&syear=${syear || '2025'}`

        const response = await fetch(apiUrl)
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

        const data = await response.json()
        if (!isMounted) return

        const raw = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : data ? [data] : []
        const transformed = raw.map((item: any) => ({
          id: item.id || 0,
          full_name: item.full_name || 'N/A',
          email: item.email || 'N/A',
          mobile: item.mobile || 'N/A',
          department_name: item.department_name || 'N/A',
          jobRole: item.jobrole || 'N/A',
          designation: item.designation || 'N/A',
          address: item.address || 'N/A',
          image: item.image?.trim() ? item.image : '',
          occupation: item.occupation || 'N/A',
          status: item.status || 'Active',
          lastActivity: item.last_activity || 'Unknown',
          join_Date: item.join_date || 'Unknown',
          profile_name: item.profile_name || 'Unknown',
          skills: item.skills || [],
        }))

        setEmployeesData(transformed)
      } catch (err) {
        console.error('Failed to fetch employees via API:', err)
        if (isMounted) setEmployeesData(defaultMockEmployees)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchEmployees()
    return () => {
      isMounted = false
    }
  }, [])

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
      options: [
        { id: '1', label: 'Engineering', value: 'Engineering' },
        { id: '2', label: 'Human Resources', value: 'Human Resources' },
        { id: '3', label: 'Marketing', value: 'Marketing' },
      ],
    },
    {
      id: 'jobrole',
      label: 'Job Role',
      type: 'select',
      value: jobRoleFilter,
      onChange: (value) => setJobRoleFilter(value as string),
      options: [
        { id: '1', label: 'Senior Developer', value: 'Senior Developer' },
        { id: '2', label: 'HR Manager', value: 'HR Manager' },
        { id: '3', label: 'Content Strategist', value: 'Content Strategist' },
      ],
    },
    {
      id: 'status',
      label: 'Status',
      type: 'select',
      value: statusFilter,
      onChange: (value) => setStatusFilter(value as string),
      options: [
        { id: 'active', label: 'Active', value: 'active' },
        { id: 'inactive', label: 'Inactive', value: 'inactive' },
      ],
    },
  ], [searchQuery, departmentFilter, jobRoleFilter, statusFilter])

  const filteredData = React.useMemo(() => {
    return employeesData.filter((employee) => {
      const matchSearch =
        employee.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchQuery.toLowerCase())
      const matchDept = departmentFilter ? employee.department_name === departmentFilter : true
      const matchRole = jobRoleFilter ? employee.jobRole === jobRoleFilter : true
      const matchStatus = statusFilter ? employee.status.toLowerCase() === statusFilter.toLowerCase() : true
      return matchSearch && matchDept && matchRole && matchStatus
    })
  }, [employeesData, searchQuery, departmentFilter, jobRoleFilter, statusFilter])

  const pulseCards = React.useMemo<PulseCardData[]>(() => {
    const totalActive = employeesData.filter((employee) => employee.status?.toLowerCase() === 'active').length
    const totalInactive = employeesData.filter((employee) => employee.status?.toLowerCase() !== 'active').length
    const complianceAtRisk = employeesData.filter((employee) => !employee.email || employee.email === 'N/A' || !employee.mobile || employee.mobile === 'N/A' || !employee.department_name || employee.department_name === 'N/A').length
    const pendingOnboarding = employeesData.filter((employee) => !employee.jobRole || employee.jobRole === 'N/A' || !employee.designation || employee.designation === 'N/A').length
    const skillDeficit = employeesData.filter((employee) => !employee.skills || employee.skills.length === 0 || !employee.profile_name || employee.profile_name === 'Unknown').length

    return [
      { id: 'active-headcount', title: 'Active Headcount', value: loading ? '—' : totalActive, subtitle: loading ? 'Calculating...' : `${totalInactive} inactive · ${employeesData.length} total workforce`, icon: User },
      { id: 'compliance-risk', title: 'Compliance At Risk', value: loading ? '—' : complianceAtRisk, subtitle: loading ? 'Scanning...' : `${complianceAtRisk} employee${complianceAtRisk !== 1 ? 's' : ''} missing critical profile data`, icon: ShieldAlert },
      { id: 'pending-onboarding', title: 'Pending Onboarding', value: loading ? '—' : pendingOnboarding, subtitle: loading ? 'Checking...' : `${pendingOnboarding} employee${pendingOnboarding !== 1 ? 's' : ''} awaiting role assignment`, icon: UserPlus },
      { id: 'skill-deficit', title: 'Skill Deficit', value: loading ? '—' : employeesData.length > 0 ? `${Math.round((skillDeficit / employeesData.length) * 100)}%` : '0%', subtitle: loading ? 'Analyzing...' : `${skillDeficit} of ${employeesData.length} employees lack competency mapping`, icon: Target },
    ]
  }, [employeesData, loading])

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
            <span className="text-xs text-muted-foreground">{row.email}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'department_name',
      header: 'Department',
      render: (_, row) => <span className="text-sm font-medium">{row.department_name}</span>,
    },
    {
      id: 'jobRole',
      header: 'Job Role',
      render: (_, row) => <span className="text-sm font-medium text-muted-foreground">{row.jobRole}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      render: (value) => {
        const status = String(value)
        const variant = status.toLowerCase() === 'active' ? 'active' : status.toLowerCase() === 'inactive' ? 'inactive' : 'default'
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
              <DropdownMenuItem className="cursor-pointer text-destructive focus-visible:bg-destructive/10">
                <ShieldAlert className="mr-2 h-4 w-4" /> Suspend Access
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], [])

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
            <p className="text-xs text-muted-foreground">{loading ? 'Loading...' : `${filteredData.length} total members`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="hidden cursor-pointer sm:flex">
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button variant="ghost" size="sm" className="hidden cursor-pointer sm:flex">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <div className="mx-2 hidden h-6 w-px bg-border sm:block" />
          <Button size="sm" onClick={() => setIsAddSheetOpen(true)} className="cursor-pointer rounded-md px-5 shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Add Employee
          </Button>
        </div>
      </div>

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
            data={filteredData}
            isLoading={loading}
            selectable
            selectedIds={selectedIds}
            onSelectChange={setSelectedIds}
            onRowClick={(row) => setActiveEmployee(row)}
            className="overflow-visible rounded-none border-0 [&_th]:bg-transparent [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_td]:py-4"
          />
        </CardContent>
      </Card>

      <Suspense fallback={null}>
        <LazyEmployeeDirectorySheets
          isAddSheetOpen={isAddSheetOpen}
          onAddSheetOpenChange={setIsAddSheetOpen}
          activeEmployee={activeEmployee}
          onCloseEmployeeSheet={() => setActiveEmployee(null)}
        />
      </Suspense>
    </div>
  )
}
