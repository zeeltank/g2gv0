'use client'

import * as React from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { GtgPageHeader } from '@/components/shell/gtg-page-header'
import { getLaravelContext } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import { expenseService, type UnpaidClaimRow, type UnpaidClaimsReport } from '@/services/hrms/expenses'
import { ClaimDetailDialog, downloadCsv, formatDate, formatMoney } from '../shared'

const BUCKETS = [
  { key: '0-7', label: '0–7 days' },
  { key: '8-30', label: '8–30 days' },
  { key: '31-60', label: '31–60 days' },
  { key: '60+', label: 'Over 60 days' },
]

/**
 * Unpaid Expense Claims: approved, not yet paid, longest-waiting first, with
 * how long each has waited. HR, admin, executive and auditor only. Opening a
 * row shows the claim, and HR can mark it paid from there - the same dialog
 * the Approvals screen uses - after which it drops off this list.
 */
export default function UnpaidExpenseClaimsPage() {
  const context = React.useMemo(() => getLaravelContext(), [])
  const [report, setReport] = React.useState<UnpaidClaimsReport | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')
  const [detailId, setDetailId] = React.useState<number | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await expenseService.unpaidClaimsReport(context)
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

  const columns: Column<UnpaidClaimRow>[] = [
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
    {
      id: 'claim_no',
      header: 'Claim',
      render: (_, row) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{row.title}</span>
          <span className="text-xs text-muted-foreground">{row.claim_no}</span>
        </div>
      ),
    },
    { id: 'approved_at', header: 'Approved', render: (_, row) => <span className="text-sm">{formatDate(row.approved_at)}</span> },
    {
      id: 'days_waiting',
      header: 'Waiting',
      render: (_, row) => (
        <span className={cn('text-sm font-medium', row.days_waiting > 30 && 'text-destructive', row.days_waiting > 7 && row.days_waiting <= 30 && 'text-warning')}>
          {row.days_waiting} day{row.days_waiting === 1 ? '' : 's'}
        </span>
      ),
    },
    { id: 'total_amount', header: 'Claim total', render: (_, row) => <span className="text-sm">{formatMoney(row.total_amount, row.currency)}</span> },
    {
      id: 'net_payable',
      header: 'To be paid',
      render: (_, row) => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{formatMoney(row.net_payable, row.currency)}</span>
          {row.advance_adjusted > 0 && <span className="text-xs text-muted-foreground">after {formatMoney(row.advance_adjusted, row.currency)} advance</span>}
        </div>
      ),
    },
  ]

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500 ease-out">
      <GtgPageHeader
        title="Unpaid Expense Claims"
        description="Claims that have been approved but not yet paid, oldest first."
        actions={
          <Button
            variant="outline"
            disabled={loading || rows.length === 0}
            className="cursor-pointer"
            onClick={() =>
              downloadCsv(
                'unpaid-expense-claims',
                ['Claim No', 'Employee', 'Department', 'Title', 'Approved', 'Days waiting', 'Claim total', 'Advance adjusted', 'To be paid'],
                rows.map((r) => [r.claim_no, r.employee_name, r.department, r.title, r.approved_at?.slice(0, 10), r.days_waiting, r.total_amount, r.advance_adjusted, r.net_payable]),
              )
            }
          >
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-muted-foreground">Total to be paid</p>
            <p className="mt-1 text-2xl font-bold">{loading ? '—' : formatMoney(totals?.net_payable ?? 0)}</p>
            <p className="text-xs text-muted-foreground">{loading ? 'Loading…' : `${totals?.claims ?? 0} claim${totals?.claims === 1 ? '' : 's'}`}</p>
          </CardContent>
        </Card>
        {BUCKETS.map((bucket) => (
          <Card key={bucket.key}>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted-foreground">{bucket.label}</p>
              <p className="mt-1 text-xl font-bold">{loading ? '—' : formatMoney(totals?.aging?.[bucket.key] ?? 0)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {notice && <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div>}

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
            getRowId={(row) => String(row.id)}
            onRowClick={(row) => setDetailId(row.id)}
            emptyState={error ? null : <div className="py-6 text-center text-sm text-muted-foreground">Nothing is waiting to be paid.</div>}
            className="overflow-visible rounded-none border-0 [&_th]:bg-transparent [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_td]:py-4"
          />
        </CardContent>
      </Card>

      <ClaimDetailDialog
        claimId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={async (message) => {
          setNotice(message)
          await load()
        }}
      />
    </div>
  )
}
