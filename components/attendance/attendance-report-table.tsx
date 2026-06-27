'use client'

import * as React from 'react'
import { EnterpriseDataTable, type Column } from '@/components/data/enterprise-data-table'
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

      <EnterpriseDataTable
        columns={columns}
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