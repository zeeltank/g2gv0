'use client'

import * as React from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Select } from '@/components/ui/select'
import { GtgPageHeader } from '@/components/shell/gtg-page-header'
import { getLaravelContext } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import {
  expenseService,
  type ExpenseCategory,
  type ExpenseClaim,
  type ExpenseStatus,
  type ExpenseSummary,
} from '@/services/hrms/expenses'
import { ClaimFormDialog } from '../claim-form-dialog'
import { ClaimDetailDialog, ExpenseStatusBadge, formatDate, formatMoney, STATUS_LABEL } from '../shared'

/**
 * My Expenses - an employee's own claims: write one, submit it, follow it to
 * payment. The server only ever returns this user's claims for this screen.
 */
export default function MyExpensesPage() {
  const context = React.useMemo(() => getLaravelContext(), [])

  const [claims, setClaims] = React.useState<ExpenseClaim[]>([])
  const [summary, setSummary] = React.useState<ExpenseSummary>({})
  const [categories, setCategories] = React.useState<ExpenseCategory[]>([])
  const [statusFilter, setStatusFilter] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const [detailId, setDetailId] = React.useState<number | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ExpenseClaim | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await expenseService.claims(context, 'mine', statusFilter as ExpenseStatus | '')
      setClaims(response?.data ?? [])
      setSummary(response?.summary ?? {})
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load your claims.')
      setClaims([])
    } finally {
      setLoading(false)
    }
  }, [context, statusFilter])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    expenseService
      .categories(context)
      .then((response) => setCategories((response?.data ?? []).filter((c) => Number(c.status) === 1)))
      .catch(() => setCategories([]))
  }, [context])

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  const sum = (...keys: ExpenseStatus[]) =>
    keys.reduce((acc, k) => ({ claims: acc.claims + (summary[k]?.claims ?? 0), amount: acc.amount + (summary[k]?.amount ?? 0) }), { claims: 0, amount: 0 })

  const tiles = [
    { label: 'Drafts', ...sum('draft') },
    { label: 'Awaiting approval', ...sum('submitted') },
    { label: 'Approved – to be paid', ...sum('approved') },
    { label: 'Paid', ...sum('paid') },
  ]

  const columns: Column<ExpenseClaim>[] = [
    {
      id: 'claim_no',
      header: 'Claim',
      render: (_, row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{row.title}</span>
          <span className="text-xs text-muted-foreground">{row.claim_no}</span>
        </div>
      ),
    },
    {
      id: 'created_at',
      header: 'Created',
      render: (_, row) => <span className="text-sm">{formatDate(row.created_at)}</span>,
    },
    {
      id: 'item_count',
      header: 'Lines',
      render: (_, row) => <span className="text-sm">{row.item_count}</span>,
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
        title="My Expenses"
        description="Claim back what you spent for work. Add the expenses, submit the claim, and follow it through approval to payment."
        actions={
          <Button onClick={openNew} className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" /> New Claim
          </Button>
        }
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
                ...(Object.keys(STATUS_LABEL) as ExpenseStatus[]).map((s) => ({ label: STATUS_LABEL[s], value: s })),
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
                  <p>{statusFilter ? 'No claims with this status.' : "You haven't made any claims yet."}</p>
                  {!statusFilter && (
                    <Button size="sm" className="mt-3" onClick={openNew}>
                      <Plus className="mr-2 h-4 w-4" /> Make your first claim
                    </Button>
                  )}
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
        onEdit={(claim) => {
          setDetailId(null)
          setEditing(claim)
          setFormOpen(true)
        }}
      />

      <ClaimFormDialog
        open={formOpen}
        claim={editing}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSaved={async (message) => {
          setNotice(message)
          await load()
        }}
      />
    </div>
  )
}
