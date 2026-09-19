'use client'

import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, Plus, ChevronDown, Search, ListFilter, Columns3, MoreHorizontal, Check, Eye } from 'lucide-react'
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
import { cn } from '@/lib/utils'
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

/** Columns a user may hide. Employee and Status are not optional. */
const OPTIONAL_COLUMNS: { id: string; label: string }[] = [
  { id: 'employeeId', label: 'Employee ID' },
  { id: 'department', label: 'Department' },
  { id: 'leaveType', label: 'Leave Type' },
  { id: 'duration', label: 'Duration' },
  { id: 'fromDate', label: 'Start Date' },
  { id: 'toDate', label: 'End Date' },
  { id: 'approver', label: 'Approver' },
  { id: 'submittedDate', label: 'Submitted Date' },
]

const HIDDEN_COLUMNS_KEY = 'hrit.leave-requests.hidden-columns'

/**
 * Filter presets. Values match Laravel's hrms_emp_leaves.status vocabulary.
 *
 * F-184. Two of these three promised more than they did.
 *
 * "Approved This Year" applied no year filter at all - it returned approved
 * requests from all time. It now sends fromDate, which LeaveRequestFilters has
 * always supported and this screen simply never used.
 *
 * "My Pending Approvals" returned EVERYONE'S pending requests. There is no
 * "awaiting me" filter in the API - LeaveRequestFilters has search, status,
 * department, leave type, employee and a date range, and nothing that expresses
 * "requests where I am the current approver". So it is renamed to what it
 * returns rather than left claiming a scope it cannot apply. Implementing it
 * properly needs an approver filter on the endpoint, which is a backend change.
 */
const savedFilters: Array<{ label: string; filters: SavedFilter }> = [
  // F-208. "My" is back, and now means it. The server resolves "awaiting me"
  // against the approval chain - the pending step whose approver_role is the
  // caller's - which no combination of the old filters could express.
  { label: 'My Pending Approvals', filters: { status: 'pending', awaitingMe: true } },
  { label: 'Pending Approvals', filters: { status: 'pending' } },
  { label: 'Approved This Year', filters: { status: 'approved', scope: 'this-year' } },
  { label: 'Rejected Requests', filters: { status: 'rejected' } },
]

type SavedFilter = {
  status?: string
  department?: string
  /** 'this-year' narrows to 1 January of the current year onwards. */
  scope?: 'this-year'
  /** F-208. Only the requests this caller is the current approver for. */
  awaitingMe?: boolean
}

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
  // F-184. The date bound the "Approved This Year" preset needs. The API has
  // always accepted fromDate; this screen had no date state to put in it.
  const [fromDate, setFromDate] = useState('')
  // F-208. Whether the list is narrowed to what this caller must decide.
  const [awaitingMe, setAwaitingMe] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [applyLeaveOpen, setApplyLeaveOpen] = useState(() => searchParams.get('apply') === '1')

  // Per-browser display preference. Wrapped because storage throws outright in
  // some contexts (private windows, blocked site data) rather than returning null.
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(HIDDEN_COLUMNS_KEY)
      return raw ? (JSON.parse(raw) as string[]) : []
    } catch {
      return []
    }
  })

  const toggleColumn = (id: string) => {
    setHiddenColumns((prev) => {
      const next = prev.includes(id) ? prev.filter((column) => column !== id) : [...prev, id]
      try {
        window.localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify(next))
      } catch {
        // A browser that will not store it still gets the toggle for this visit.
      }
      return next
    })
  }

  // Filtering, sorting and pagination all run server side - Laravel returns one page.
  const filters = useMemo(
    () => ({
      search: searchQuery.trim() || undefined,
      status: statusFilter ? [statusFilter] : undefined,
      departmentId: departmentFilter || undefined,
      leaveTypeId: leaveTypeFilter || undefined,
      employeeId: showMine ? user?.id : undefined,
      fromDate: fromDate || undefined,
      awaitingMe: awaitingMe || undefined,
      page,
      perPage: PAGE_SIZE,
      sortBy: 'submittedDate',
      sortDir: 'desc' as const,
    }),
    [searchQuery, statusFilter, departmentFilter, leaveTypeFilter, fromDate, awaitingMe, page, showMine, user?.id],
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
    withdraw,
    cancel,
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

  const handleSavedFilterClick = (preset: SavedFilter) => {
    setStatusFilter(preset.status ?? '')
    setDepartmentFilter(preset.department ?? '')
    // F-184. The year the preset's label promises.
    setFromDate(preset.scope === 'this-year' ? `${new Date().getFullYear()}-01-01` : '')
    setAwaitingMe(Boolean(preset.awaitingMe))
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
          {/*
            F-202. This had no aria-label AND used a MoreHorizontal (menu)
            glyph for something that opens a details drawer, not a menu. Named
            for what it does, and given the eye its behaviour implies.
          */}
          <Button
            variant="ghost"
            size="sm"
            aria-label={`View ${row.employee?.name ?? 'request'} details`}
            title="View details"
            onClick={() => {
              setSelectedRequestId(Number(row.id))
              setDrawerOpen(true)
            }}
          >
            <Eye className="h-4 w-4" />
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
            {/*
              F-185. This said "Organization-wide" unconditionally, including
              when ?mine=1 had narrowed the list to the signed-in user. Three
              rows under an empty filter bar, labelled organisation-wide, reads
              as "the system lost everyone else's requests" - and "Clear All
              Filters" does not clear it, because it is URL state.
            */}
            {loading
              ? 'Loading requests...'
              : showMine
                ? `${total} ${total === 1 ? 'Request' : 'Requests'} • Yours only`
                : `${total} Requests • Organization-wide`}
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
                    // F-184. Including the date bound a preset may have set,
                    // which otherwise survived "Clear All Filters" invisibly -
                    // there is no date control on screen to show it is on.
                    setFromDate('')
                    setAwaitingMe(false)
                    resetToFirstPage()
                  }}
                >
                  Clear All Filters
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/*
              * F-112. This menu held a single inert item reading "Customize
              * Columns". It now lists the optional columns and toggles them,
              * which is what the control was pretending to be. The choice is
              * remembered per browser - it is a display preference, not tenant
              * configuration, so it does not belong in the database.
              */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Columns3 className="size-4" />
                  Columns
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                {OPTIONAL_COLUMNS.map((column) => (
                  <DropdownMenuItem
                    key={column.id}
                    onClick={(event) => {
                      event.preventDefault()
                      toggleColumn(column.id)
                    }}
                    className="gap-2"
                  >
                    <Check
                      className={cn(
                        'size-4',
                        hiddenColumns.includes(column.id) ? 'opacity-0' : 'opacity-100',
                      )}
                    />
                    {column.label}
                  </DropdownMenuItem>
                ))}
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
          // F-164. The applicant taking their own request back. Both close the
          // drawer on success so the refreshed list is what they look at next;
          // on refusal the drawer stays open and the hook's error is shown
          // above the table, carrying the server's own wording.
          onWithdraw={async (id) => {
            const result = await withdraw(id)
            if (result.ok) setDrawerOpen(false)
          }}
          onCancel={async (id, reason) => {
            const result = await cancel(id, reason)
            if (result.ok) setDrawerOpen(false)
          }}
          currentUserId={user?.id}
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
            columns={columns.filter((column) => !hiddenColumns.includes(String(column.id)))}
            data={rows}
            selectable
            /*
             * SELECT BY REQUEST ID, NOT BY ROW POSITION.
             *
             * DataTable defaults rowId to String(index) and expects callers
             * running bulk actions to pass getRowId. This one did not, so
             * `handleBulkDecision` handed row positions to `bulkDecide` and the
             * API approved or rejected whichever requests happened to hold ids
             * 0, 1, 2 — not the ones the approver had ticked. Sorting or
             * filtering the table changed which requests those were.
             *
             * Not an LMS screen, but the same shared-component defect, and the
             * consequences here are somebody's leave.
             */
            getRowId={(row) => String(row.id)}
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
