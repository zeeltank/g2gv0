'use client'

import * as React from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { GtgPageHeader } from '@/components/shell/gtg-page-header'
import { getLaravelContext } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import { expenseService, type AdvanceSummaryReport, type AdvanceSummaryRow } from '@/services/hrms/expenses'
import { downloadCsv, formatMoney } from '../shared'

/**
 * Advance Summary: for each employee who has had an advance, what was paid out,
 * how much claims have used, what they still hold and what is still pending.
 * HR, admin, executive and auditor only - the server refuses everyone else, and
 * says so here rather than showing an empty table that reads as "no advances".
 */
export default function AdvanceSummaryPage() {
  const context = React.useMemo(() => getLaravelContext(), [])
  const [report, setReport] = React.useState<AdvanceSummaryReport | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await expenseService.advanceSummaryReport(context)
      setReport({ data: response?.data ?? [], totals: response?.totals })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load the report.')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [context])

  React.useEffect(() => {
    void load()
  }, [load])

  const rows = report?.data ?? []
  const totals = report?.totals

  const tiles = [
    { label: 'Employees with advances', value: totals ? String(totals.employees) : '—' },
    { label: 'Paid out', value: totals ? formatMoney(totals.paid) : '—' },
    { label: 'Settled by claims', value: totals ? formatMoney(totals.claimed) : '—' },
    { label: 'Still unclaimed', value: totals ? formatMoney(totals.unclaimed) : '—' },
  ]

  const columns: Column<AdvanceSummaryRow>[] = [
    {
      id: 'employee_name',
      header: 'Employee',
      render: (_, row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{row.employee_name}</span>
          {row.department && <span className="text-xs text-muted-foreground">{row.department}</span>}
        </div>
      ),
    },
    { id: 'advances', header: 'Advances', render: (_, row) => <span className="text-sm">{row.advances}</span> },
    { id: 'paid', header: 'Paid out', render: (_, row) => <span className="text-sm">{formatMoney(row.paid)}</span> },
    { id: 'claimed', header: 'Claimed', render: (_, row) => <span className="text-sm">{formatMoney(row.claimed)}</span> },
    {
      id: 'unclaimed',
      header: 'Unclaimed',
      render: (_, row) => <span className={cn('text-sm font-semibold', row.unclaimed > 0 && 'text-warning')}>{formatMoney(row.unclaimed)}</span>,
    },
    { id: 'pending', header: 'Pending (not yet paid)', render: (_, row) => <span className="text-sm text-muted-foreground">{formatMoney(row.pending)}</span> },
  ]

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500 ease-out">
      <GtgPageHeader
        title="Advance Summary"
        description="How much advance each employee has received, how much claims have settled, and what they still hold."
        actions={
          <Button
            variant="outline"
            disabled={loading || rows.length === 0}
            className="cursor-pointer"
            onClick={() =>
              downloadCsv(
                'advance-summary',
                ['Employee', 'Department', 'Advances', 'Paid out', 'Claimed', 'Unclaimed', 'Pending'],
                rows.map((r) => [r.employee_name, r.department, r.advances, r.paid, r.claimed, r.unclaimed, r.pending]),
              )
            }
          >
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted-foreground">{tile.label}</p>
              <p className="mt-1 text-2xl font-bold">{loading ? '—' : tile.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      <Card className="rounded-2xl border-border/50 bg-card/50 shadow-xs">
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={loading}
            getRowId={(row) => String(row.employee_id)}
            emptyState={error ? null : <div className="py-6 text-center text-sm text-muted-foreground">No advances have been requested yet.</div>}
            className="overflow-visible rounded-none border-0 [&_th]:bg-transparent [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_td]:py-4"
          />
        </CardContent>
      </Card>
    </div>
  )
}
