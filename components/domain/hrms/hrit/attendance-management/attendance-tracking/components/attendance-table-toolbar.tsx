'use client'

import * as React from 'react'
import { Filter, Columns } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'
import type { Column } from '@/components/ui/data-table'

interface TableToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  totalEntries: number
  pageSize: number
  searchValue: string
  onSearchChange: (value: string) => void
  columns: Column<any>[]
  visibleColumns: string[]
  onColumnVisibilityChange: (columnId: string) => void
  onFilterClick: () => void
}

export function TableToolbar({
  totalEntries,
  pageSize,
  searchValue,
  onSearchChange,
  columns,
  visibleColumns,
  onColumnVisibilityChange,
  onFilterClick,
  className,
  ...props
}: TableToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      {...props}
    >
      <p className="text-sm text-muted-foreground">
        Showing 1–{Math.min(pageSize, totalEntries)} of {totalEntries} entries
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              'h-8 w-48 rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground',
              'placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
            )}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            const columnId = columns.find((c) => !visibleColumns.includes(String(c.id)))?.id
            if (columnId) onColumnVisibilityChange(String(columnId))
          }}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground',
            'transition-colors duration-200 hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
          )}
          aria-label="Toggle column visibility"
        >
          <Columns className="size-4" />
          Columns
        </button>

        <button
          type="button"
          onClick={onFilterClick}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground',
            'transition-colors duration-200 hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
          )}
          aria-label="Open filter panel"
        >
          <Filter className="size-4" />
          Filter
        </button>
      </div>
    </div>
  )
}