'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { PivotResult } from '@/services/reports'

/**
 * Row labels as a sticky first column, column labels as the header row,
 * row/column totals as a highlighted final row/column — v1 supports
 * exactly one row dimension and one column dimension, matching vtiger's
 * own pivot (see ReportQueryExecutionService::runPivot).
 */
export function PivotView({ result, onCellClick }: { result: PivotResult; onCellClick?: (rowLabel: string, columnLabel: string) => void }) {
  if (result.row_labels.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No data for the current filters.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-card">&nbsp;</TableHead>
            {result.column_labels.map((label) => (
              <TableHead key={label} className="text-right">{label}</TableHead>
            ))}
            <TableHead className="text-right font-semibold">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.row_labels.map((rowLabel, r) => (
            <TableRow key={rowLabel}>
              <TableCell className="sticky left-0 bg-card font-medium text-foreground">{rowLabel}</TableCell>
              {result.matrix[r].map((value, c) => (
                <TableCell
                  key={result.column_labels[c]}
                  className={cn('text-right', onCellClick && value > 0 && 'cursor-pointer hover:bg-surface-muted')}
                  onClick={onCellClick && value > 0 ? () => onCellClick(rowLabel, result.column_labels[c]) : undefined}
                >
                  {value}
                </TableCell>
              ))}
              <TableCell className="text-right font-semibold">{result.row_totals[r]}</TableCell>
            </TableRow>
          ))}
          <TableRow className={cn('border-t-2 border-border')}>
            <TableCell className="sticky left-0 bg-card font-semibold">Total</TableCell>
            {result.column_totals.map((value, c) => (
              <TableCell key={result.column_labels[c]} className="text-right font-semibold">{value}</TableCell>
            ))}
            <TableCell className="text-right font-semibold">
              {result.column_totals.reduce((sum, v) => sum + v, 0)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
