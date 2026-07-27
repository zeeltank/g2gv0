'use client'

import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, Plus, ChevronDown, Search, ListFilter, Columns3, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Select } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/ui/status-badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { DataTable, type Column } from '@/components/ui/data-table'
import type { LeaveRequest, LeaveRequestStatus } from '@/types/leave-dashboard'
import type { LeaveApplyPayload, LeaveStatus } from '@/services/hrms'
import { formatDateShort } from '@/lib/leave-management-data'
import { useLeaveOptions, useLeaveRequests, useLeaveRequestDetail } from '@/hooks/use-leave'
import { useAuth } from '@/hooks/use-auth'
import { mapLeaveRequest } from '@/domain/hrms/hrit/leave-management/services/leave-mappers'

const LeaveRequestDetailsDrawer = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-requests/components/LeaveRequestDetailsDrawer').then((m) => ({
    default: m.LeaveRequestDetailsDrawer,
  })),
)

const ApplyLeaveDrawer = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-requests/components/LeaveApplyDrawer').then((m) => ({
    default: m.ApplyLeaveDrawer,
  })),
)

const PAGE_SIZE = 10

/** Filter presets. Values match Laravel's hrms_emp_leaves.status vocabulary. */
const savedFilters = [
  { label: 'My Pending Approvals', filters: { status: 'pending' } },
  { label: 'Approved This Year', filters: { status: 'approved' } },
  { label: 'Rejected Requests', filters: { status: 'rejected' } },
]

const statusLabelMap: Record<LeaveRequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  'sent-back': 'Sent Back',
  cancelled: 'Cancelled',
  approved_lwp: 'Approved LWP',
}

function toCsvValue(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export default function LeaveRequestsPage() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const showMine = searchParams.get('mine') === '1'
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') ?? '')
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [applyLeaveOpen, setApplyLeaveOpen] = useState(() => searchParams.get('apply') === '1')

  // Filtering, sorting and pagination all run server side - Laravel returns one page.
  const filters = useMemo(
    () => ({
      search: searchQuery.trim() || undefined,
      status: statusFilter ? [statusFilter] : undefined,
      departmentId: departmentFilter || undefined,
      leaveTypeId: leaveTypeFilter || undefined,
      employeeId: showMine ? user?.id : undefined,
      page,
      perPage: PAGE_SIZE,
      sortBy: 'submittedDate',
      sortDir: 'desc' as const,
    }),
    [searchQuery, statusFilter, departmentFilter, leaveTypeFilter, page, showMine, user?.id],
  )

  const {
    loading,
    processing,
    error,
    actionMessage,
    requests,
    total,
    applyLeave,
    decide,
    bulkDecide,
    retry,
    clearMessages,
  } = useLeaveRequests(filters)

  const { options } = useLeaveOptions()
  const { detail, loading: detailLoading } = useLeaveRequestDetail(drawerOpen ? selectedRequestId : null)

  const rows = useMemo(() => requests.map(mapLeaveRequest), [requests])

  const statusOptions = useMemo(
    () => (options?.statuses ?? []).map((status) => ({ value: status.value, label: status.label })),
    [options],
  )
  const departmentOptions = useMemo(
    () => (options?.departments ?? []).map((department) => ({ value: department.value, label: department.label })),
    [options],
  )
  const leaveTypeOptions = useMemo(
    () => (options?.leave_types ?? []).map((type) => ({ value: type.value, label: type.label })),
    [options],
  )

  const selectedRequest = useMemo<LeaveRequest | null>(() => {
    if (detail) return mapLeaveRequest(detail)
    return rows.find((row) => row.id === String(selectedRequestId)) ?? null
  }, [detail, rows, selectedRequestId])

  const showingStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const showingEnd = Math.min(page * PAGE_SIZE, total)

  const resetToFirstPage = () => {
    setPage(1)
    setSelectedIds([])
  }

  const handleSavedFilterClick = (preset: Record<string, string | undefined>) => {
    setStatusFilter(preset.status ?? '')
    setDepartmentFilter(preset.department ?? '')
    resetToFirstPage()
  }

  const handleApplySubmit = useCallback(
    async (payload: LeaveApplyPayload) => {
      const result = await applyLeave(payload)
      if (result.ok) resetToFirstPage()
      return result
    },
    [applyLeave],
  )

  const handleDecision = useCallback(
    async (id: number, status: LeaveStatus, remarks?: { hrRemarks?: string }) => {
      const result = await decide(id, status, remarks)
      if (result.ok && status !== 'pending') setDrawerOpen(false)
    },
    [decide],
  )

  const handleBulkDecision = useCallback(
    async (status: LeaveStatus) => {
      if (selectedIds.length === 0) return
      const result = await bulkDecide(selectedIds, status)
      if (result.ok) setSelectedIds([])
    },
    [bulkDecide, selectedIds],
  )

  /** Exports the page currently loaded from the API, not a client-side mock. */
  const handleExport = () => {
    const header = [
      'Request ID',
      'Employee',
      'Employee ID',
      'Department',
      'Leave Type',
      'Duration',
      'Start Date',
      'End Date',
      'Status',
      'Approver',
      'Submitted Date',
      'Reason',
    ]

    const csv = [
      header.join(','),
      ...requests.map((row) =>
        [
          row.id,
          row.employee_name,
          row.employee_no ?? row.employee_id,
          row.department,
          row.leave_type,
          row.duration,
          row.from_date,
          row.to_date,
          statusLabelMap[(row.status === 'sent_back' ? 'sent-back' : row.status) as LeaveRequestStatus] ?? row.status,
          row.approver,
          row.submitted_date,
          row.reason,
        ]
          .map(toCsvValue)
          .join(','),
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `leave-requests-page-${page}.csv`
    link.click()
    URL.revokeObjectURL(url)
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
                .map((part) => part[0])
                .join('')
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-foreground truncate">{row.employee.name}</span>
        </div>
      ),
    },
    {
      id: 'employeeId',
      header: 'Employee ID',
      render: (value) => <span className="text-sm text-muted-foreground">{String(value)}</span>,
    },
    {
      id: 'department',
      header: 'Department',
      render: (value) => <span className="text-sm text-muted-foreground">{String(value)}</span>,
    },
    {
      id: 'leaveType',
      header: 'Leave Type',
      render: (value) => <span className="text-sm text-muted-foreground">{String(value)}</span>,
    },
    {
      id: 'duration',
      header: 'Duration',
      render: (value) => <span className="text-sm text-muted-foreground">{String(value)}</span>,
    },
    {
      id: 'fromDate',
      header: 'Start Date',
      render: (value) => (
        <span className="text-sm text-muted-foreground">{value ? formatDateShort(String(value)) : '—'}</span>
      ),
    },
    {
      id: 'toDate',
      header: 'End Date',
      render: (value) => (
        <span className="text-sm text-muted-foreground">{value ? formatDateShort(String(value)) : '—'}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      render: (_, row) => <StatusBadge status={row.status} label={statusLabelMap[row.status] ?? row.status} />,
    },
    {
      id: 'approver',
      header: 'Approver',
      render: (value) => <span className="text-sm text-muted-foreground">{(value as string) || '—'}</span>,
    },
    {
      id: 'submittedDate',
      header: 'Submitted Date',
      render: (value) => (
        <span className="text-sm text-muted-foreground">{value ? formatDateShort(String(value)) : '—'}</span>
      ),
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
              setSelectedRequestId(Number(row.id))
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Leave Requests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading requests...' : `${total} Requests • Organization-wide`}
          </p>
        </div>
        <Button onClick={() => setApplyLeaveOpen(true)} className="h-9 px-4 gap-2 rounded-lg font-semibold">
          <Plus className="size-4" />
          Apply Leave
        </Button>
      </div>

      {actionMessage && (
        <Alert>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{actionMessage}</span>
            <Button variant="ghost" size="sm" onClick={clearMessages}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {error && !loading && rows.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Action Toolbar */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-sm">
            <SearchInput
              placeholder="Search by employee name, employee ID, or request ID..."
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                resetToFirstPage()
              }}
              icon={<Search className="size-4" />}
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Select
              className="min-w-[160px]"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value)
                resetToFirstPage()
              }}
              placeholder="Status"
              options={statusOptions}
            />

            <Select
              className="min-w-[170px]"
              value={departmentFilter}
              onChange={(value) => {
                setDepartmentFilter(value)
                resetToFirstPage()
              }}
              placeholder="Department"
              options={departmentOptions}
            />

            <Select
              className="min-w-[170px]"
              value={leaveTypeFilter}
              onChange={(value) => {
                setLeaveTypeFilter(value)
                resetToFirstPage()
              }}
              placeholder="Leave Type"
              options={leaveTypeOptions}
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
                {savedFilters.map((preset) => (
                  <DropdownMenuItem key={preset.label} onClick={() => handleSavedFilterClick(preset.filters)}>
                    {preset.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem
                  onClick={() => {
                    setStatusFilter('')
                    setDepartmentFilter('')
                    setLeaveTypeFilter('')
                    setSearchQuery('')
                    resetToFirstPage()
                  }}
                >
                  Clear All Filters
                </DropdownMenuItem>
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

            <Button variant="outline" className="gap-2" onClick={handleExport} disabled={requests.length === 0}>
              <Download className="size-4" />
              Export
            </Button>

            {selectedIds.length > 0 && (
              <>
                <Button disabled={processing} onClick={() => handleBulkDecision('approved')}>
                  Bulk Approve
                </Button>
                <Button variant="destructive" disabled={processing} onClick={() => handleBulkDecision('rejected')}>
                  Bulk Reject
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <LeaveRequestDetailsDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          request={selectedRequest}
          detail={detail}
          loading={detailLoading}
          processing={processing}
          onDecision={handleDecision}
        />
        <ApplyLeaveDrawer
          open={applyLeaveOpen}
          onOpenChange={setApplyLeaveOpen}
          processing={processing}
          onSubmit={handleApplySubmit}
        />
      </Suspense>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : error && rows.length === 0 ? (
        <ErrorState title="Unable to load leave requests" description={error} retry={retry} />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <DataTable
            columns={columns}
            data={rows}
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
              page,
              pageSize: PAGE_SIZE,
              total,
              onPageChange: (nextPage) => {
                setPage(nextPage)
                setSelectedIds([])
              },
            }}
          />
          {total > 0 && (
            <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              Showing {showingStart}-{showingEnd} of {total}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
