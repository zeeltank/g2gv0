'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import type { ReportColumn, TabularResult } from '@/services/reports'

export function TabularView({
  result,
  columns,
  onPageChange,
}: {
  result: TabularResult
  columns: ReportColumn[]
  onPageChange?: (page: number) => void
}) {
  const visibleColumns = columns.filter((c) => c.visible !== false)
  const lastPage = Math.max(1, Math.ceil(result.total / result.per_page))

  if (result.rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No rows match the current filters.</p>
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((col) => (
                <TableHead key={`${col.module}.${col.field}`}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((row, i) => (
              <TableRow key={i}>
                {visibleColumns.map((col) => (
                  <TableCell key={`${col.module}.${col.field}`}>
                    {String(row[`${col.module}.${col.field}`] ?? '—')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{result.total} row{result.total === 1 ? '' : 's'}</span>
        {onPageChange && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={result.page <= 1} onClick={() => onPageChange(result.page - 1)}>
              Previous
            </Button>
            <span>Page {result.page} of {lastPage}</span>
            <Button variant="outline" size="sm" disabled={result.page >= lastPage} onClick={() => onPageChange(result.page + 1)}>
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
