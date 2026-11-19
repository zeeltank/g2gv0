'use client'

import * as React from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Select } from '@/components/ui/select'
import { GtgPageHeader } from '@/components/shell/gtg-page-header'
import { getLaravelContext } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import { expenseService, type ExpenseClaim, type ExpenseStatus, type ExpenseSummary } from '@/services/hrms/expenses'
import { ClaimDetailDialog, ExpenseStatusBadge, formatDate, formatMoney, STATUS_LABEL } from '../shared'

/**
 * Expense Approvals - the claims waiting on this person.
 *
 * A manager sees the claims routed to them; HR and admin see everyone's, and
 * are the only ones who can mark an approved claim paid. Executives and
 * auditors can read. What each person may DO to a claim is decided by the
 * server and arrives as flags on the claim, so this screen does not guess.
 * Drafts never appear here.
 */
export default function ExpenseApprovalsPage() {
  const context = React.useMemo(() => getLaravelContext(), [])

  const [claims, setClaims] = React.useState<ExpenseClaim[]>([])
  const [summary, setSummary] = React.useState<ExpenseSummary>({})
  // Open on the queue that needs a decision, which is why people come here.
  const [statusFilter, setStatusFilter] = React.useState<string>('submitted')
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')
  const [detailId, setDetailId] = React.useState<number | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await expenseService.claims(context, 'approvals', statusFilter as ExpenseStatus | '')
      setClaims(response?.data ?? [])
      setSummary(response?.summary ?? {})
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load claims.')
      setClaims([])
    } finally {
      setLoading(false)
    }
  }, [context, statusFilter])

  React.useEffect(() => {
    void load()
  }, [load])

  const tiles = [
    { label: 'Awaiting decision', ...(summary.submitted ?? { claims: 0, amount: 0 }) },
    { label: 'Approved – to be paid', ...(summary.approved ?? { claims: 0, amount: 0 }) },
    { label: 'Paid', ...(summary.paid ?? { claims: 0, amount: 0 }) },
    { label: 'Rejected', ...(summary.rejected ?? { claims: 0, amount: 0 }) },
  ]

  const columns: Column<ExpenseClaim>[] = [
    {
      id: 'employee_name',
      header: 'Employee',
      render: (_, row) => <span className="font-semibold text-foreground">{row.employee_name}</span>,
    },
    {
      id: 'claim_no',
      header: 'Claim',
      render: (_, row) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{row.title}</span>
          <span className="text-xs text-muted-foreground">{row.claim_no} · {row.item_count} line{row.item_count === 1 ? '' : 's'}</span>
        </div>
      ),
    },
    {
      id: 'submitted_at',
      header: 'Submitted',
      render: (_, row) => <span className="text-sm">{formatDate(row.submitted_at)}</span>,
    },
    {
      id: 'total_amount',
      header: 'Amount',
      render: (_, row) => <span className="text-sm font-medium">{formatMoney(row.total_amount, row.currency)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      render: (_, row) => <ExpenseStatusBadge status={row.status} />,
    },
  ]

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500 ease-out">
      <GtgPageHeader
        title="Expense Approvals"
        description="Review expense claims, approve or reject them, and mark approved claims as paid."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted-foreground">{tile.label}</p>
              <p className="mt-1 text-2xl font-bold">{loading ? '—' : formatMoney(tile.amount)}</p>
              <p className="text-xs text-muted-foreground">{loading ? 'Loading…' : `${tile.claims} claim${tile.claims === 1 ? '' : 's'}`}</p>
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 p-4">
          <div className="w-56">
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="All statuses"
              size="sm"
              options={[
                { label: 'All statuses', value: '' },
                ...(Object.keys(STATUS_LABEL) as ExpenseStatus[])
                  .filter((s) => s !== 'draft')
                  .map((s) => ({ label: STATUS_LABEL[s], value: s })),
              ]}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading} className="cursor-pointer">
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={claims}
            isLoading={loading}
            getRowId={(row) => String(row.id)}
            onRowClick={(row) => setDetailId(row.id)}
            emptyState={
              error ? null : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {statusFilter === 'submitted' ? 'Nothing is waiting for your decision.' : 'No claims to show.'}
                </div>
              )
            }
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
