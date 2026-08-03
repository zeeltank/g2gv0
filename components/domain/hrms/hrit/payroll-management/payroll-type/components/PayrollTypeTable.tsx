'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownAZ, ArrowUpAZ, MoreHorizontal, Search, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { DataTable, type Column } from '@/components/ui/data-table'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import type { PayrollTypeRow } from '@/services/hrms'

const PAGE_SIZE = 10

const statusFilterOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
]

const amountTypeFilterOptions = [
  { label: 'All amount types', value: 'all' },
  { label: 'Flat', value: 'Flat' },
  { label: 'Percentage', value: 'Percentage' },
]

const dayCountFilterOptions = [
  { label: 'Any day-wise count', value: 'all' },
  { label: 'Day wise: Yes', value: 'yes' },
  { label: 'Day wise: No', value: 'no' },
]

type SortKey = 'srNo' | 'kind' | 'name' | 'amountType' | 'amountOrPercentage' | 'sortOrder' | 'status'

const sortOptions: { label: string; value: SortKey }[] = [
  { label: 'Sort: Sr. No', value: 'srNo' },
  { label: 'Sort: Type', value: 'kind' },
  { label: 'Sort: Payroll Name', value: 'name' },
  { label: 'Sort: Amount Type', value: 'amountType' },
  { label: 'Sort: Amount / Percentage', value: 'amountOrPercentage' },
  { label: 'Sort: Sort Order', value: 'sortOrder' },
  { label: 'Sort: Status', value: 'status' },
]

/** Nulls sort last in both directions so unset sort orders never lead the table. */
function compareRows(a: PayrollTypeRow, b: PayrollTypeRow, key: SortKey): number {
  const left = a[key]
  const right = b[key]

  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1

  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right))
}

function amountDisplay(row: PayrollTypeRow) {
  if (row.amountOrPercentage === null) return '-'
  return row.amountType === 'Percentage' ? `${row.amountOrPercentage}%` : String(row.amountOrPercentage)
}

interface PayrollTypeTableProps {
  rows: PayrollTypeRow[]
  processing: boolean
  onEdit: (row: PayrollTypeRow) => void
  onToggleStatus: (row: PayrollTypeRow) => void
  onDelete: (row: PayrollTypeRow) => void
}

export default function PayrollTypeTable({
  rows,
  processing,
  onEdit,
  onToggleStatus,
  onDelete,
}: PayrollTypeTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [amountTypeFilter, setAmountTypeFilter] = useState('all')
  const [dayCountFilter, setDayCountFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('srNo')
  const [sortAscending, setSortAscending] = useState(true)
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    const matching = rows.filter((row) => {
      const matchesSearch =
        !term ||
        row.name.toLowerCase().includes(term) ||
        row.kind.toLowerCase().includes(term) ||
        row.amountType.toLowerCase().includes(term) ||
        String(row.amountOrPercentage ?? '').includes(term)

      const matchesStatus = statusFilter === 'all' || row.status === statusFilter
      const matchesAmountType = amountTypeFilter === 'all' || row.amountType === amountTypeFilter
      const matchesDayCount =
        dayCountFilter === 'all' || (dayCountFilter === 'yes' ? row.dayCount : !row.dayCount)

      return matchesSearch && matchesStatus && matchesAmountType && matchesDayCount
    })

    return [...matching].sort((a, b) => (sortAscending ? 1 : -1) * compareRows(a, b, sortKey))
  }, [rows, search, statusFilter, amountTypeFilter, dayCountFilter, sortKey, sortAscending])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  // Filtering down to fewer pages must not strand the view on an empty page.
  useEffect(() => {
    setPage((current) => Math.min(current, pageCount))
  }, [pageCount])

  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )

  const columns: Column<PayrollTypeRow>[] = [
    {
      id: 'srNo',
      header: 'Sr. No',
      render: (value) => <span className="text-sm text-muted-foreground">{String(value)}</span>,
    },
    {
      id: 'kind',
      header: 'Type',
      render: (_, row) => (
        <StatusBadge
          variant={row.kind === 'Earning' ? 'success' : 'warning'}
          label={row.kind}
        />
      ),
    },
    {
      id: 'name',
      header: 'Payroll Name',
      render: (value) => (
        <span className="text-sm font-medium text-foreground">{String(value) || '-'}</span>
      ),
    },
    {
      id: 'amountType',
      header: 'Amount Type',
      render: (value) => <span className="text-sm text-muted-foreground">{String(value)}</span>,
    },
    {
      id: 'amountOrPercentage',
      header: 'Amount / Percentage',
      render: (_, row) => (
        <span className="text-sm tabular-nums text-foreground">{amountDisplay(row)}</span>
      ),
    },
    {
      id: 'dayCount',
      header: 'Day Wise Count',
      render: (_, row) => (
        <StatusBadge
          variant={row.dayCount ? 'success' : 'inactive'}
          label={row.dayCount ? 'Yes' : 'No'}
        />
      ),
    },
    {
      id: 'sortOrder',
      header: 'Sort Order',
      render: (value) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {value === null ? '-' : String(value)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      render: (_, row) => <StatusBadge status={row.status} />,
    },
    {
      id: 'actions' as keyof PayrollTypeRow,
      header: 'Actions',
      render: (_, row) => (
        <div className="flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={processing}
                aria-label={`Actions for ${row.name || 'payroll type'}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onEdit(row)}>Edit Payroll Type</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleStatus(row)}>
                {row.status === 'Active' ? 'Disable' : 'Enable'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(row)} className="text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full lg:max-w-xs">
          <SearchInput
            placeholder="Search name, type or amount"
            aria-label="Search payroll types"
            icon={<Search className="size-4" />}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:items-center">
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value)
              setPage(1)
            }}
            options={statusFilterOptions}
            size="sm"
          />
          <Select
            aria-label="Filter by amount type"
            value={amountTypeFilter}
            onChange={(value) => {
              setAmountTypeFilter(value)
              setPage(1)
            }}
            options={amountTypeFilterOptions}
            size="sm"
          />
          <Select
            aria-label="Filter by day wise count"
            value={dayCountFilter}
            onChange={(value) => {
              setDayCountFilter(value)
              setPage(1)
            }}
            options={dayCountFilterOptions}
            size="sm"
          />
          <div className="flex items-center gap-1">
            <Select
              aria-label="Sort payroll types"
              value={sortKey}
              onChange={(value) => setSortKey(value as SortKey)}
              options={sortOptions}
              size="sm"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 shrink-0 p-0"
              onClick={() => setSortAscending((current) => !current)}
              aria-label={sortAscending ? 'Sort descending' : 'Sort ascending'}
            >
              {sortAscending ? (
                <ArrowUpAZ className="size-4" />
              ) : (
                <ArrowDownAZ className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <DataTable
          columns={columns}
          data={paged}
          density="compact"
          striped
          pagination={{
            page,
            pageSize: PAGE_SIZE,
            total: filtered.length,
            onPageChange: (next) => setPage(Math.min(Math.max(next, 1), pageCount)),
          }}
          emptyState={
            <EmptyState
              icon={<Wallet className="size-10" />}
              title="No payroll types match these filters"
              description="Adjust the search or filters to see more payroll components."
            />
          }
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {paged.length} of {filtered.length} payroll {filtered.length === 1 ? 'type' : 'types'}
        {filtered.length !== rows.length ? ` (filtered from ${rows.length})` : ''}.
      </p>
    </div>
  )
}
