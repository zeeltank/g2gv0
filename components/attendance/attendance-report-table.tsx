'use client'

import * as React from 'react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { TableToolbar } from './attendance-table-toolbar'
import { AttendancePagination } from './attendance-pagination'
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
  filtersApplied?: boolean
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
  filtersApplied,
  className,
  ...props
}: AttendanceReportTableProps<T>) {
  const visibleColumns = columns.map((c) => String(c.id))

  return (
    <div
      className={cn('rounded-lg border border-border bg-card', className)}
      {...props}
    >
      <TableToolbar
        totalEntries={total}
        pageSize={pageSize}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        columns={columns}
        visibleColumns={visibleColumns}
        onColumnVisibilityChange={() => {}}
        onFilterClick={() => {}}
      />

      <DataTable
        columns={columns}
        data={isLoading ? [] : data}
        isLoading={isLoading}
        density="compact"
        striped
        emptyState={
          <EmptyState
            icon={<FileText className="size-8" />}
            title={filtersApplied ? 'No records found' : 'No records found'}
            description={filtersApplied ? 'No attendance records found for the selected criteria.' : 'No attendance records match your current filters.'}
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