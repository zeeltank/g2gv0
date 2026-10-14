'use client'

/**
 * Tabular report results — redesigned per a deep design-review pass
 * (shadcn's own documented data-table pattern, uxpatterns.dev, HubSpot's own
 * report-table conventions): a real Card boundary instead of a bare table,
 * a sticky header + fixed-height scrollable body so a long result scrolls
 * inside its own box rather than the whole page, a sticky first column so
 * wide results stay orientable on a narrow screen, a real rows-per-page
 * control (not just prev/next), and an empty state that explains itself
 * instead of a bare "no rows" line.
 */

import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { ReportColumn, TabularResult } from '@/services/reports'

const PAGE_SIZE_OPTIONS = ['10', '20', '25', '30', '40', '50'].map((v) => ({ value: v, label: `${v} / page` }))

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
  const visibleColumns = columns.filter((c) => c.visible !== false)
  const lastPage = Math.max(1, Math.ceil(result.total / result.per_page))
  const firstRow = result.total === 0 ? 0 : (result.page - 1) * result.per_page + 1
  const lastRow = Math.min(result.total, result.page * result.per_page)

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

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <span className="text-xs text-muted-foreground">
          {result.total === 0 ? '0 rows' : `Rows ${firstRow}–${lastRow} of ${result.total}`}
        </span>
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

      <div className={cn('max-h-[70vh] overflow-auto transition-opacity', busy && 'pointer-events-none opacity-60')}>
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-card">
            <TableRow>
              {visibleColumns.map((col, i) => (
                <TableHead
                  key={`${col.module}.${col.field}`}
                  className={cn('bg-card', i === 0 ? 'sticky left-0 z-30 max-w-[280px]' : 'whitespace-nowrap')}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((row, i) => (
              <TableRow key={i}>
                {visibleColumns.map((col, j) => {
                  const value = String(row[`${col.module}.${col.field}`] ?? '—')

                  return (
                    <TableCell
                      key={`${col.module}.${col.field}`}
                      title={j === 0 ? value : undefined}
                      className={cn(
                        j === 0
                          ? 'sticky left-0 z-10 max-w-[280px] truncate bg-card font-medium text-foreground'
                          : 'whitespace-nowrap',
                      )}
                    >
                      {value}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
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
