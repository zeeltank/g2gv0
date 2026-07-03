'use client'

import { useMemo, useState } from 'react'
import { Download, Plus, ChevronDown, Search, ListFilter, Columns3, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { DataTable, type Column } from '@/components/ui/data-table'
import { LeaveRequestDetailsDrawer } from '@/components/leave-managemnt/LeaveRequestDetailsDrawer'
import { ApplyLeaveDrawer } from '@/components/leave-managemnt/LeaveApplyDrawer'
import type { LeaveRequest, LeaveRequestStatus } from '@/types/Leavedashboard'
import { recentLeaveRequests as allLeaveRequests } from '@/lib/Leavemanagment-data'
import { formatDateShort } from '@/lib/Leavemanagment-data'

const leaveStatusOptions = [
  { label: 'All Statuses', value: '' },
  { label: 'Approved', value: 'approved' },
  { label: 'Pending', value: 'pending' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Sent Back', value: 'sent-back' },
  { label: 'Cancelled', value: 'cancelled' },
]

const leaveTypeOptions = [
  { label: 'All Leave Types', value: '' },
  { label: 'Casual Leave', value: 'Casual Leave' },
  { label: 'Sick Leave', value: 'Sick Leave' },
  { label: 'Earned Leave', value: 'Earned Leave' },
  { label: 'Work From Home', value: 'Work From Home' },
  { label: 'Maternity Leave', value: 'Maternity Leave' },
  { label: 'Paternity Leave', value: 'Paternity Leave' },
]

const departmentOptions = [
  { label: 'All Departments', value: '' },
  { label: 'Engineering', value: 'Engineering' },
  { label: 'HR', value: 'HR' },
  { label: 'Sales', value: 'Sales' },
  { label: 'Finance', value: 'Finance' },
  { label: 'Marketing', value: 'Marketing' },
]

const savedFilters = [
  { label: 'My Pending Approvals', filters: { status: 'pending' } },
  { label: 'Engineering – This Month', filters: { department: 'Engineering' } },
  { label: 'Rejected Requests', filters: { status: 'rejected' } },
]

const statusBadgeVariantMap: Record<LeaveRequestStatus, 'success' | 'warning' | 'destructive' | 'navy' | 'muted'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
  'sent-back': 'navy',
  cancelled: 'muted',
}

const statusLabelMap: Record<LeaveRequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  'sent-back': 'Sent Back',
  cancelled: 'Cancelled',
}

export default function LeaveRequestsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 8
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [applyLeaveOpen, setApplyLeaveOpen] = useState(false)

  const filteredData = useMemo(() => {
    return allLeaveRequests.filter((request) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matches =
          request.employee.name.toLowerCase().includes(q) ||
          request.employeeId.toLowerCase().includes(q) ||
          request.id.toLowerCase().includes(q)
        if (!matches) return false
      }
      if (statusFilter && request.status !== statusFilter) return false
      if (leaveTypeFilter && request.leaveType !== leaveTypeFilter) return false
      if (departmentFilter && request.department !== departmentFilter) return false
      return true
    })
  }, [searchQuery, statusFilter, leaveTypeFilter, departmentFilter])

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredData.slice(start, start + pageSize)
  }, [filteredData, safePage, pageSize])

  const displayedPageSize = paginatedData.length
  const showingStart = filteredData.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const showingEnd = Math.min(safePage * pageSize, filteredData.length)

  const handleBulkApprove = () => {
    alert(`Bulk approve selected ${selectedIds.length} request(s)`)
  }

  const handleBulkReject = () => {
    alert(`Bulk reject selected ${selectedIds.length} request(s)`)
  }

  const handleApplyLeave = () => {
    setApplyLeaveOpen(true)
  }

  const handleSavedFilterClick = (filters: Record<string, string | undefined>) => {
    if (filters.status) setStatusFilter(filters.status)
    if (filters.department) setDepartmentFilter(filters.department)
    setPage(1)
  }

  const columns: Column<LeaveRequest>[] = [
    {
      id: 'employee',
      header: 'Employee',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {row.employee.name
                .split(' ')
                .map((p) => p[0])
                .join('')}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-foreground truncate">{row.employee.name}</span>
        </div>
      ),
    },
    {
      id: 'employeeId',
      header: 'Employee ID',
      render: (value) => (
        <span className="text-sm text-muted-foreground">{String(value)}</span>
      ),
    },
    {
      id: 'department',
      header: 'Department',
      render: (value) => (
        <span className="text-sm text-muted-foreground">{String(value)}</span>
      ),
    },
    {
      id: 'leaveType',
      header: 'Leave Type',
      render: (value) => (
        <span className="text-sm text-muted-foreground">{String(value)}</span>
      ),
    },
    {
      id: 'duration',
      header: 'Duration',
      render: (value) => (
        <span className="text-sm text-muted-foreground">{String(value)}</span>
      ),
    },
    {
      id: 'fromDate',
      header: 'Start Date',
      render: (value) => (
        <span className="text-sm text-muted-foreground">{formatDateShort(String(value))}</span>
      ),
    },
    {
      id: 'toDate',
      header: 'End Date',
      render: (value) => (
        <span className="text-sm text-muted-foreground">{formatDateShort(String(value))}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      render: (_, row) => (
        <Badge variant={statusBadgeVariantMap[row.status]}>
          {statusLabelMap[row.status]}
        </Badge>
      ),
    },
    {
      id: 'approver',
      header: 'Approver',
      render: (value) => {
        const text = (value as string | undefined) || '—'
        return <span className="text-sm text-muted-foreground">{text}</span>
      },
    },
    {
      id: 'submittedDate',
      header: 'Submitted Date',
      render: (value) => {
        const text = value ? formatDateShort(value as string) : '—'
        return <span className="text-sm text-muted-foreground">{text}</span>
      },
    },
    {
      id: 'actions' as keyof LeaveRequest,
      header: 'Actions',
      render: (_, row) => (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedRequest(row)
              setDrawerOpen(true)
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Leave Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {allLeaveRequests.length} Requests • Organization-wide
          </p>
        </div>
        <Button
          onClick={handleApplyLeave}
          className="h-9 px-4 gap-2 rounded-lg font-semibold"
        >
          <Plus className="size-4" />
          Apply Leave
        </Button>
      </div>

      {/* Action Toolbar */}
<div className="rounded-xl border border-border bg-card p-4">
  <div className="flex items-center gap-3">
    {/* Search */}
    <div className="flex-1 max-w-sm">
      <SearchInput
        placeholder="Search by employee name, employee ID, or request ID..."
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value)
          setPage(1)
        }}
        icon={<Search className="size-4" />}
      />
    </div>

    {/* Filters */}
    <div className="flex items-center gap-2 ml-auto">
      <Select
        className="min-w-[160px]"
        value={statusFilter}
        onChange={(val) => {
          setStatusFilter(val)
          setPage(1)
        }}
        placeholder="Status"
        options={leaveStatusOptions.slice(1)}
      />

      <Select
        className="min-w-[170px]"
        value={departmentFilter}
        onChange={(val) => {
          setDepartmentFilter(val)
          setPage(1)
        }}
        placeholder="Department"
        options={departmentOptions.slice(1)}
      />

      <Select
        className="min-w-[170px]"
        value={leaveTypeFilter}
        onChange={(val) => {
          setLeaveTypeFilter(val)
          setPage(1)
        }}
        placeholder="Leave Type"
        options={leaveTypeOptions.slice(1)}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <ListFilter className="size-4" />
            Saved Filters
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          {savedFilters.map((sf) => (
            <DropdownMenuItem
              key={sf.label}
              onClick={() => handleSavedFilterClick(sf.filters)}
            >
              {sf.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Columns3 className="size-4" />
            Columns
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuItem>Customize Columns</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="outline" className="gap-2">
        <Download className="size-4" />
        Export
      </Button>

            {selectedIds.length > 0 && (
              <>
                <Button onClick={handleBulkApprove}>Bulk Approve</Button>
                <Button variant="destructive" onClick={handleBulkReject}>
                  Bulk Reject
                </Button>
              </>
            )}
    </div>
  </div>
      </div>

      <LeaveRequestDetailsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        request={selectedRequest}
      />
      <ApplyLeaveDrawer
        open={applyLeaveOpen}
        onOpenChange={setApplyLeaveOpen}
      />
      <div className="rounded-xl border border-border bg-card">
        <DataTable
          columns={columns}
          data={paginatedData}
          selectable
          selectedIds={selectedIds}
          onSelectChange={setSelectedIds}
          density="compact"
          striped
          emptyState={
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="size-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-foreground">No leave requests found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters.</p>
            </div>
          }
          pagination={{
            page: safePage,
            pageSize,
            total: filteredData.length,
            onPageChange: (p) => setPage(p),
          }}
        />
      </div>
    </div>
  )
}
