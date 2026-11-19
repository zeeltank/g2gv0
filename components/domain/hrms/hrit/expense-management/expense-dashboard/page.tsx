'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowUpRight, RefreshCw } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { GtgPageHeader } from '@/components/shell/gtg-page-header'
import { getLaravelContext } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import { expenseService, type ExpenseDashboard, type ExpenseStatus } from '@/services/hrms/expenses'
import { formatMoney, STATUS_LABEL } from '../shared'

const BASE = '/module/hrit-solutions/expense-management'

/** "12.5 L" / "3.2 K" - the compact rupee style the old screen's axis used. */
function compact(value: number) {
  if (value >= 10000000) return `${(value / 10000000).toFixed(1).replace(/\.0$/, '')} Cr`
  if (value >= 100000) return `${(value / 100000).toFixed(1).replace(/\.0$/, '')} L`
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')} K`
  return String(Math.round(value))
}

const tooltipStyle = { borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)' }

/**
 * Expense Dashboard: the picture and the shortcuts.
 *
 * Scoped by the server to who is looking - the whole organisation for HR,
 * admin, executive and auditor; otherwise their own claims and the ones routed
 * to them. The banner under the title says which, so nobody reads a team's
 * number as the company's.
 */
export default function ExpenseDashboardPage() {
  const context = React.useMemo(() => getLaravelContext(), [])
  const [data, setData] = React.useState<ExpenseDashboard | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await expenseService.dashboard(context)
      setData(response?.data ?? null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load the dashboard.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [context])

  React.useEffect(() => {
    void load()
  }, [load])

  const hasMonthly = data?.monthly.some((m) => m.claimed > 0 || m.paid > 0) ?? false
  const statuses = (Object.keys(STATUS_LABEL) as ExpenseStatus[]).filter((s) => s !== 'draft' && data?.by_status[s])

  const tiles = [
    { label: 'Claimed this month', value: data?.totals.this_month ?? 0 },
    { label: 'Approved – awaiting payment', value: data?.totals.awaiting_payment ?? 0 },
    { label: 'Advances not yet claimed', value: data?.totals.advances_outstanding ?? 0 },
  ]

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500 ease-out">
      <GtgPageHeader
        title="Expense Dashboard"
        description="Where expense claims and advances stand, and the quickest way to the things that need you."
        actions={
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading} className="cursor-pointer">
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} /> Refresh
          </Button>
        }
      />

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      {data && (
        <p className="text-sm text-muted-foreground">
          {data.scope === 'organization'
            ? 'Showing the whole organisation.'
            : 'Showing your own claims and the ones routed to you.'}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted-foreground">{tile.label}</p>
              <p className="mt-1 text-2xl font-bold">{loading ? '—' : formatMoney(tile.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense through the year</CardTitle>
          <CardDescription>Claimed and paid each month, over the last twelve months</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-72 animate-pulse rounded-lg bg-muted/40" />
          ) : !hasMonthly ? (
            <EmptyState title="No expense yet" description="Once claims are submitted, this chart shows how they move month by month." />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.monthly} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={10} fontSize={12} tickFormatter={compact} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value))} />
                  <Legend />
                  <Line type="monotone" dataKey="claimed" name="Claimed" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="paid" name="Paid" stroke="var(--success, #16a34a)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Your Shortcuts</h2>
        <div className="flex flex-wrap gap-3">
          <ShortcutLink href={`${BASE}/my-expenses`} label="Expense Claim" badge={data && data.shortcuts.pending_claims > 0 ? `${data.shortcuts.pending_claims} Pending` : undefined} />
          <ShortcutLink href={`${BASE}/employee-advances`} label="Employee Advance" badge={data && data.shortcuts.unclaimed_advances > 0 ? `${data.shortcuts.unclaimed_advances} Unclaimed` : undefined} />
          <ShortcutLink href={`${BASE}/expense-approvals`} label="Expense Approvals" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By category</CardTitle>
            <CardDescription>Where the money is going</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 animate-pulse rounded-lg bg-muted/40" />
            ) : !data?.top_categories.length ? (
              <EmptyState title="Nothing to show" description="Categories appear once claims are submitted." />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.top_categories} layout="vertical" margin={{ left: 8, right: 12, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} tickFormatter={compact} />
                    <YAxis type="category" dataKey="category" tickLine={false} axisLine={false} width={110} fontSize={12} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value))} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                    <Bar dataKey="amount" name="Amount" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By status</CardTitle>
            <CardDescription>Every claim that is not a draft</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 animate-pulse rounded-lg bg-muted/40" />
            ) : statuses.length === 0 ? (
              <EmptyState title="Nothing to show" description="Statuses appear once claims are submitted." />
            ) : (
              <ul className="divide-y divide-border">
                {statuses.map((status) => (
                  <li key={status} className="flex items-center justify-between py-3 text-sm">
                    <span className="font-medium">{STATUS_LABEL[status]}</span>
                    <span className="text-muted-foreground">
                      {data?.by_status[status]?.claims} claim{data?.by_status[status]?.claims === 1 ? '' : 's'} ·{' '}
                      <span className="font-semibold text-foreground">{formatMoney(data?.by_status[status]?.amount ?? 0)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ShortcutLink({ href, label, badge }: { href: string; label: string; badge?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
    >
      {label}
      <ArrowUpRight className="size-3.5 text-muted-foreground" />
      {badge && <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">{badge}</span>}
    </Link>
  )
}
