'use client'

import * as React from 'react'
import { Columns } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Column } from '@/components/ui/data-table'

interface TableToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  totalEntries: number
  page: number
  pageSize: number
  searchValue: string
  onSearchChange: (value: string) => void
  columns: Column<any>[]
  visibleColumns: string[]
  onColumnVisibilityChange: (columnId: string) => void
}

/*
 * Two controls used to sit here, both inert.
 *
 * "Columns" was passed `onColumnVisibilityChange={() => {}}`, and its own
 * handler was broken underneath that: it looked for a column NOT already in
 * `visibleColumns`, while the caller passed EVERY column as visible - so
 * `columnId` was always undefined and the no-op was never even reached. It is
 * now a real per-column toggle.
 *
 * "Filter" was passed `onFilterClick={() => {}}`. It is GONE rather than wired,
 * because the screen it sits on already renders a full filter panel
 * (EnhancedAttendanceFilters) directly above this table. A second control that
 * duplicates a working one is the F-99 defect - the "Saved Reports" dropdown
 * removed for being a broken duplicate of the Quick Filter beside it - and the
 * fix there was deletion, not wiring.
 */
export function TableToolbar({
  totalEntries,
  page,
  pageSize,
  searchValue,
  onSearchChange,
  columns,
  visibleColumns,
  onColumnVisibilityChange,
  className,
  ...props
}: TableToolbarProps) {
  const first = totalEntries === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, totalEntries)
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      {...props}
    >
      {/* Was hardcoded "Showing 1-{pageSize}": `page` was not even a prop, so
          page 3 of a paginated table still read "Showing 1-10 of 240". */}
      <p className="text-sm text-muted-foreground">
        Showing {first}–{last} of {totalEntries} entries
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground',
                'transition-colors duration-200 hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
              )}
              aria-label="Toggle column visibility"
            >
              <Columns className="size-4" />
              Columns
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
            {columns.map((column) => {
              const id = String(column.id)
              const checked = visibleColumns.includes(id)

              return (
                <DropdownMenuCheckboxItem
                  key={id}
                  checked={checked}
                  // The last visible column stays locked: a table with no
                  // columns is a blank box the user cannot recover from.
                  disabled={checked && visibleColumns.length === 1}
                  onCheckedChange={() => onColumnVisibilityChange(id)}
                  onSelect={(event) => event.preventDefault()}
                >
                  {typeof column.header === 'string' ? column.header : id}
                </DropdownMenuCheckboxItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}