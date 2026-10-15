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
 *
 * DRAG TO REORDER / RESIZE
 *
 * Reported live as missing: drag a header to reorder columns (plain HTML5
 * drag-and-drop — native `draggable`, no new dependency), drag a header's
 * right edge to resize it Excel-style (TanStack's own columnResizing +
 * columnSizing features, data-table-features.ts). Both are left fully
 * UNCONTROLLED (no React state mirrors them) — `table.setColumnOrder()`/the
 * resize handler already mutate TanStack's own internal state and this
 * component re-renders off that the same way it always has for every other
 * uncontrolled table concern (page index, etc.), so there is nothing to wire
 * up beyond calling them. Whichever column ends up first is automatically
 * the sticky/pinned one (`i === 0`/`j === 0` below keys off RENDER position,
 * not a fixed field) — this is also how "make Assignee the pinned column"
 * is satisfied: drag it to the front.
 */

import { useMemo, useState } from 'react'
import type { DragEvent } from 'react'
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

// Two distinct real bugs on the sticky first column, both reported live
// against the exact same symptom ("scrolled columns go under the task
// column"/"the two columns' texts mix together when I scroll"):
//
// 1. A plain `border-r` reads as a GLITCH, not a pinned pane: a column that
//    scrolls underneath (completely normal sticky behavior) shares that same
//    boundary line, so its own trailing text can appear to float right up
//    against the sticky column with no depth cue separating "pinned" from
//    "scrolling underneath". Fixed with a drop shadow instead of a flat line.
// 2. On fast/continuous scrolling (confirmed by its absence in every
//    instant-jump scrollLeft test, only showing up on a real trackpad/wheel
//    gesture) a `position: sticky` table cell with no GPU layer of its own
//    can repaint one frame stale relative to the column sliding underneath
//    it — briefly showing BOTH texts overlapping mid-scroll before the
//    correct opaque frame catches up. `will-change: transform` promotes the
//    sticky cell to its own compositor layer up front, the standard fix
//    data-grid libraries (AG Grid, MUI DataGrid) use for exactly this.
const STICKY_COLUMN_SHADOW = 'shadow-[4px_0_6px_-4px_rgba(0,0,0,0.3)] will-change-transform'

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
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null)
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null)

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
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
    defaultColumn: { size: 220, minSize: 80, maxSize: 640 },
  })

  // Drag a header anywhere onto another header to move it there — native
  // HTML5 DnD, not a library: `columnOrder` is read fresh from the table's
  // own state (NOT re-derived from `tanColumns`/`visibleColumns`, which
  // never change order themselves) so a drag always starts from whatever
  // order the table is ACTUALLY showing right now, including the result of
  // an earlier drag or a natural (never-yet-reordered) default.
  function onHeaderDragStart(e: DragEvent, columnId: string) {
    setDraggedColumnId(columnId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onHeaderDragOver(e: DragEvent, columnId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (columnId !== dragOverColumnId) setDragOverColumnId(columnId)
  }

  function onHeaderDrop(e: DragEvent, targetColumnId: string) {
    e.preventDefault()
    setDragOverColumnId(null)
    if (!draggedColumnId || draggedColumnId === targetColumnId) {
      setDraggedColumnId(null)
      return
    }

    // table.getState() is gone in TanStack Table v9 — table.atoms.<slice>.get()
    // reads one resolved state slice directly (data-table-features.ts's own
    // migration note applies here too).
    const liveOrder = table.atoms.columnOrder.get()
    const currentOrder = liveOrder.length > 0 ? liveOrder : table.getAllLeafColumns().map((c) => c.id)
    const next = currentOrder.filter((id: string) => id !== draggedColumnId)
    next.splice(next.indexOf(targetColumnId), 0, draggedColumnId)
    table.setColumnOrder(next)
    setDraggedColumnId(null)
  }

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
        <Table style={{ width: table.getTotalSize(), tableLayout: 'fixed' }}>
          <TableHeader className="sticky top-0 z-20 bg-card">
            {headerGroups.map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header, i) => {
                  const sortDirection = header.column.getIsSorted()
                  const ariaSort = sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none'
                  const isDragging = draggedColumnId === header.column.id
                  const isDragOver = dragOverColumnId === header.column.id && draggedColumnId !== header.column.id

                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={header.column.getCanSort() ? ariaSort : undefined}
                      draggable
                      onDragStart={(e) => onHeaderDragStart(e, header.column.id)}
                      onDragOver={(e) => onHeaderDragOver(e, header.column.id)}
                      onDragLeave={() => setDragOverColumnId((cur) => (cur === header.column.id ? null : cur))}
                      onDrop={(e) => onHeaderDrop(e, header.column.id)}
                      onDragEnd={() => { setDraggedColumnId(null); setDragOverColumnId(null) }}
                      style={{ width: header.getSize() }}
                      className={cn(
                        'relative cursor-grab select-none active:cursor-grabbing',
                        'bg-card',
                        i === 0 ? cn('sticky left-0 z-30', STICKY_COLUMN_SHADOW) : 'whitespace-nowrap',
                        i !== 0 && i < headerGroup.headers.length - 1 && 'border-r border-border',
                        isDragging && 'opacity-40',
                        isDragOver && 'bg-primary/10',
                      )}
                    >
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn('inline-flex max-w-full items-center gap-1 truncate', header.column.getCanSort() && 'cursor-pointer hover:text-foreground')}
                          disabled={!header.column.getCanSort()}
                        >
                          <table.FlexRender header={header} />
                          {header.column.getCanSort() && (
                            sortDirection === 'asc'
                              ? <ChevronUp className="size-3.5 shrink-0" aria-hidden="true" />
                              : sortDirection === 'desc'
                                ? <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
                                : <ChevronsUpDown className="size-3.5 shrink-0 opacity-40" aria-hidden="true" />
                          )}
                        </button>
                      )}

                      {header.column.getCanResize() && (
                        <div
                          draggable={false}
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            'absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize touch-none select-none',
                            header.column.getIsResizing() ? 'bg-primary' : 'hover:bg-primary/40',
                          )}
                        />
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
                        style={{ width: cell.column.getSize(), ...(j === 0 ? rowStyle : undefined) }}
                        className={cn(
                          j === 0
                            ? cn('sticky left-0 z-10 truncate font-medium text-foreground', STICKY_COLUMN_SHADOW, !rowColor && 'bg-card')
                            : 'overflow-hidden text-ellipsis whitespace-nowrap',
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
