'use client'

import * as React from 'react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
// import { TableToolbar } from '../../attendance-tracking/components/attendance-table-toolbar'
import { TableToolbar } from '@/domain/hrms/hrit/attendance-management/attendance-tracking/components/attendance-table-toolbar'
import { AttendancePagination } from '@/domain/hrms/hrit/attendance-management/attendance-reports/components/AttendancePagination'
import { EmptyState } from '@/components/ui/empty-state'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AttendanceReportTableProps<T extends Record<string, any>> extends React.HTMLAttributes<HTMLDivElement> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  searchValue: string
  onSearchChange: (value: string) => void
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function AttendanceReportTable<T extends Record<string, any>>({
   columns,
  data,
  isLoading,
  searchValue,
  onSearchChange,
  page,
  pageSize,
  total,
  onPageChange,
  className,
  ...props
}: AttendanceReportTableProps<T>) {
  /*
   * Column visibility is real state now.
   *
   * `visibleColumns` used to be recomputed as "every column" on each render and
   * handed to a no-op, so the Columns control could not have worked even if it
   * had been wired. Hidden ids are tracked rather than visible ones, so a column
   * added to `columns` later shows up by default instead of silently vanishing.
   */
  const [hiddenColumns, setHiddenColumns] = React.useState<string[]>([])

  const visibleColumns = React.useMemo(
    () => columns.map((c) => String(c.id)).filter((id) => !hiddenColumns.includes(id)),
    [columns, hiddenColumns],
  )

  const shownColumns = React.useMemo(
    () => columns.filter((c) => !hiddenColumns.includes(String(c.id))),
    [columns, hiddenColumns],
  )

  const toggleColumn = React.useCallback((columnId: string) => {
    setHiddenColumns((current) =>
      current.includes(columnId)
        ? current.filter((id) => id !== columnId)
        : [...current, columnId],
    )
  }, [])

  return (
    <div
      className={cn('rounded-lg border border-border bg-card', className)}
      {...props}
    >
      <TableToolbar
        totalEntries={total}
        page={page}
        pageSize={pageSize}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        columns={columns}
        visibleColumns={visibleColumns}
        onColumnVisibilityChange={toggleColumn}
      />

      <DataTable
        columns={shownColumns}
        data={isLoading ? [] : data}
        isLoading={isLoading}
        density="compact"
        striped
        emptyState={
          <EmptyState
            icon={<FileText className="size-8" />}
            title="No records found"
            description="No attendance records match your current filters."
          />
        }
      />

      <AttendancePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
      />
    </div>
  )
}