'use client'

/**
 * Tabular report results. Card boundary, sticky header over a fixed-height
 * scrollable body, sticky+truncated first column, server-driven pagination
 * (see report-view-page.tsx) — all from the earlier design pass. This pass
 * adds real interactivity on top, via TanStack Table v9 (the shadcn/ui
 * documented pairing for exactly this — see data-table-features.ts's own
 * docblock): click a column header to sort the CURRENTLY VISIBLE page
 * client-side, hide/show columns without re-running the report, and a quick
 * text filter over the rows already on screen.
 *
 * WHY STILL A PLAIN <table>, NOT role="grid"
 *
 * Confirmed via direct research against the W3C WAI-ARIA Authoring Practices
 * Guide and a corroborating accessibility guide: role="grid" (with its own
 * roving-tabindex keyboard model) is for widgets where the user NAVIGATES OR
 * EDITS CELLS with the keyboard — a read-only report table is not that. The
 * APG's own guidance is to keep it a plain semantic <table> with <th scope>
 * headers, which is what the shadcn Table primitives already render; the
 * one accessibility addition that DOES apply to a sortable table's headers
 * is `aria-sort`, added below.
 */

import { useMemo, useState } from 'react'
import {
  type ColumnDef,
  type RowData,
  type SortingState,
  useTable,
} from '@tanstack/react-table'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown, Columns3, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { ReportColumn, TabularResult } from '@/services/reports'
import { reportTableFeatures, type ReportTableFeatures } from './data-table-features'

const PAGE_SIZE_OPTIONS = ['10', '20', '25', '30', '40', '50'].map((v) => ({ value: v, label: `${v} / page` }))

// A plain `border-r` on the sticky first column reads as a GLITCH during
// horizontal scroll, not a pinned pane: the column that just scrolled
// underneath it is now sharing that exact same boundary line, so its own
// trailing edge/text can appear to float right up against — or peek out
// from behind — the sticky column with nothing visually separating "pinned"
// from "scrolling underneath" (reported live: a drilldown dialog's sticky
// Task column let the next column's header text show right at its edge
// with no depth cue, reading as broken rendering). A drop shadow instead of
// a flat line gives the sticky column real elevation, so scrolled content
// unambiguously reads as sliding BEHIND it rather than bumping into it.
const STICKY_COLUMN_SHADOW = 'shadow-[4px_0_6px_-4px_rgba(0,0,0,0.3)]'

type RowRecord = Record<string, unknown>

export function TabularView({
  result,
  columns,
  onPageChange,
  onPerPageChange,
  busy,
}: {
  result: TabularResult
  columns: ReportColumn[]
  onPageChange?: (page: number) => void
  onPerPageChange?: (perPage: number) => void
  busy?: boolean
}) {
  const visibleColumns = useMemo(() => columns.filter((c) => c.visible !== false), [columns])
  const lastPage = Math.max(1, Math.ceil(result.total / result.per_page))
  const firstRow = result.total === 0 ? 0 : (result.page - 1) * result.per_page + 1
  const lastRow = Math.min(result.total, result.page * result.per_page)

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({})
  const [quickFilter, setQuickFilter] = useState('')

  const tanColumns = useMemo<ColumnDef<ReportTableFeatures, RowRecord>[]>(
    () => visibleColumns.map((col) => {
      const key = `${col.module}.${col.field}`

      return {
        id: key,
        // accessorFn, NOT accessorKey — a report row's own keys are flat
        // strings that happen to CONTAIN literal dots (e.g.
        // "task_management.tasks.task_title"), but TanStack Table treats a
        // dotted accessorKey as a NESTED path (row.a.b.c), not a literal
        // property name. accessorKey silently resolved every cell to
        // undefined (confirmed live: headers rendered, every body cell was
        // blank) until this fix.
        accessorFn: (row) => row[key],
        header: col.label,
        enableSorting: true,
      }
    }),
    [visibleColumns],
  )

  // Quick filter runs over the rows already on screen (this page's own
  // fetch) — a substring match across every visible column's own value, not
  // a new query. Re-running the report for a narrower search is still
  // "Edit filters" on the report view page; this is the fast, no-round-trip
  // complement to it.
  const filteredRows = useMemo(() => {
    if (quickFilter.trim() === '') return result.rows

    const needle = quickFilter.trim().toLowerCase()

    return result.rows.filter((row) =>
      visibleColumns.some((col) => String(row[`${col.module}.${col.field}`] ?? '').toLowerCase().includes(needle)),
    )
  }, [result.rows, quickFilter, visibleColumns])

  const table = useTable({
    features: reportTableFeatures,
    data: filteredRows as RowRecord[],
    columns: tanColumns,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    state: { sorting, columnVisibility },
  })

  if (result.rows.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 py-14 text-center">
        <SearchX className="size-8 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">No rows match the current filters.</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {result.latest_date
            ? `This report's own data only goes up to ${result.latest_date} — a date range outside that window will always come back empty.`
            : 'Try widening the date range or removing a condition.'}
        </p>
      </Card>
    )
  }

  const headerGroups = table.getHeaderGroups()
  const rows = table.getRowModel().rows
  const visibleLeafColumns = table.getVisibleLeafColumns()

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <span className="shrink-0 text-xs text-muted-foreground">
          {result.total === 0 ? '0 rows' : `Rows ${firstRow}–${lastRow} of ${result.total}`}
          {quickFilter.trim() !== '' && ` · ${rows.length} match${rows.length === 1 ? '' : 'es'} on this page`}
        </span>

        <div className="flex items-center gap-2">
          <Input
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            placeholder="Quick filter this page…"
            className="h-8 w-48 text-xs"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Columns3 className="mr-1.5 size-4" aria-hidden="true" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table.getAllLeafColumns().map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(checked) => column.toggleVisibility(!!checked)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {String(column.columnDef.header ?? column.id)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {onPerPageChange && (
            <Select
              value={String(result.per_page)}
              onChange={(v) => onPerPageChange(Number(v))}
              options={PAGE_SIZE_OPTIONS}
              size="sm"
              aria-label="Rows per page"
            />
          )}
        </div>
      </div>

      <div className={cn('max-h-[70vh] overflow-auto transition-opacity', busy && 'pointer-events-none opacity-60')}>
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-card">
            {headerGroups.map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header, i) => {
                  const sortDirection = header.column.getIsSorted()
                  const ariaSort = sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none'

                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={header.column.getCanSort() ? ariaSort : undefined}
                      className={cn(
                        'bg-card',
                        i === 0 ? cn('sticky left-0 z-30 max-w-[280px]', STICKY_COLUMN_SHADOW) : 'whitespace-nowrap',
                        i !== 0 && i < headerGroup.headers.length - 1 && 'border-r border-border',
                      )}
                    >
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn('inline-flex items-center gap-1', header.column.getCanSort() && 'cursor-pointer select-none hover:text-foreground')}
                          disabled={!header.column.getCanSort()}
                        >
                          <table.FlexRender header={header} />
                          {header.column.getCanSort() && (
                            sortDirection === 'asc'
                              ? <ChevronUp className="size-3.5" aria-hidden="true" />
                              : sortDirection === 'desc'
                                ? <ChevronDown className="size-3.5" aria-hidden="true" />
                                : <ChevronsUpDown className="size-3.5 opacity-40" aria-hidden="true" />
                          )}
                        </button>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={visibleLeafColumns.length} className="py-10 text-center text-sm text-muted-foreground">
                  No rows on this page match &ldquo;{quickFilter}&rdquo;.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => {
              // The same admin-assignable per-employee color Task Calendar
              // already shows on that person's task cards
              // (user_preferences.task_card_color, resolved server-side —
              // see ReportQueryExecutionService::runTabular()'s own
              // docblock for why no auto-palette fallback is reproduced
              // here). A light, legible fill rather than Task Calendar's
              // own solid card fill — a whole dense report row at full
              // saturation would fight every cell's own text for contrast.
              const rowColor = (row.original as RowRecord).__row_color as string | undefined
              const rowStyle = rowColor ? { backgroundColor: `${rowColor}26` } : undefined

              return (
                <TableRow key={row.id} style={rowStyle}>
                  {row.getVisibleCells().map((cell, j) => {
                    const value = String(cell.getValue() ?? '—')

                    return (
                      <TableCell
                        key={cell.id}
                        title={j === 0 ? value : undefined}
                        style={j === 0 ? rowStyle : undefined}
                        className={cn(
                          j === 0
                            ? cn('sticky left-0 z-10 max-w-[280px] truncate font-medium text-foreground', STICKY_COLUMN_SHADOW, !rowColor && 'bg-card')
                            : 'whitespace-nowrap',
                          j !== 0 && j < row.getVisibleCells().length - 1 && 'border-r border-border',
                        )}
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {onPageChange && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5">
          <span className="text-xs text-muted-foreground">Page {result.page} of {lastPage}</span>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" disabled={result.page <= 1 || busy} onClick={() => onPageChange(result.page - 1)}>
              <ChevronLeft className="mr-1 size-4" aria-hidden="true" />
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={result.page >= lastPage || busy} onClick={() => onPageChange(result.page + 1)}>
              Next
              <ChevronRight className="ml-1 size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
