'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const tableVariants = cva('w-full', {
  variants: {
    density: {
      compact: '[&_td]:p-2 [&_th]:p-2',
      normal: '[&_td]:p-3 [&_th]:p-3',
      comfortable: '[&_td]:p-4 [&_th]:p-4',
    },
    striped: {
      true: '[&_tbody_tr:nth-child(odd)]:bg-surface-muted',
      false: '',
    },
  },
  defaultVariants: {
    density: 'normal',
    striped: true,
  },
})

interface Column<T> {
  id: keyof T
  header: string
  render?: (value: T[keyof T], row: T) => React.ReactNode
  sortable?: boolean
  width?: string
}

interface EnterpriseDataTableProps<T extends Record<string, any>>
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof tableVariants> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  selectable?: boolean
  selectedIds?: string[]
  onSelectChange?: (ids: string[]) => void
  onRowClick?: (row: T) => void
  emptyState?: React.ReactNode
  pagination?: {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
  }
}

const EnterpriseDataTable = React.forwardRef<
  HTMLDivElement,
  EnterpriseDataTableProps<any>
>(
  (
    {
      columns,
      data,
      isLoading,
      selectable,
      selectedIds = [],
      onSelectChange,
      onRowClick,
      emptyState,
      density,
      striped,
      pagination,
      className,
      ...props
    },
    ref,
  ) => {
    const handleSelectAll = () => {
      const allIds = data.map((row, i) => String(i))
      onSelectChange?.(selectedIds.length === data.length ? [] : allIds)
    }

    const handleSelectRow = (index: number) => {
      const id = String(index)
      const newSelected = selectedIds.includes(id)
        ? selectedIds.filter((s) => s !== id)
        : [...selectedIds, id]
      onSelectChange?.(newSelected)
    }

    return (
      <div ref={ref} className={cn('rounded-lg border border-border', className)} {...props}>
        <Table className={tableVariants({ density, striped })}>
          <TableHeader className="bg-surface-muted">
            <TableRow>
              {selectable && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.length === data.length && data.length > 0}
                    indeterminate={selectedIds.length > 0 && selectedIds.length < data.length}
                    onChange={handleSelectAll}
                  />
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead
                  key={String(column.id)}
                  className={cn(
                    'font-semibold',
                    column.width && `w-${column.width}`,
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="text-center py-8"
                >
                  <p className="text-muted-foreground">Loading...</p>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="text-center py-8"
                >
                  {emptyState || <p className="text-muted-foreground">No data available</p>}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => (
                <TableRow
                  key={index}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    onRowClick && 'cursor-pointer hover:bg-surface-muted',
                  )}
                >
                  {selectable && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(String(index))}
                        onChange={() => handleSelectRow(index)}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell key={String(column.id)}>
                      {column.render
                        ? column.render(row[column.id], row)
                        : String(row[column.id])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {pagination && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {Math.ceil(pagination.total / pagination.pageSize)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  },
)
EnterpriseDataTable.displayName = 'EnterpriseDataTable'

export { EnterpriseDataTable, type EnterpriseDataTableProps, type Column }
