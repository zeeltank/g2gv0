'use client'

import * as React from 'react'
import { Banknote, Download, Loader2, RefreshCw, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { GtgPageHeader } from '@/components/shell/gtg-page-header'
import { getLaravelContext } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import { ledgerService, type LedgerRow, type LedgerStatement, type LedgerSummary } from '@/services/hrms/ledger'
import { downloadCsv, formatDate, formatMoney } from '../../expense-management/shared'

/** "12,000.00 Cr" - credit means the company owes the employee, debit means they hold money. */
function balanceText(value: number) {
  if (Math.abs(value) < 0.005) return formatMoney(0)
  return `${formatMoney(Math.abs(value))} ${value > 0 ? 'Cr' : 'Dr'}`
}

function sentence(value: number) {
  if (Math.abs(value) < 0.005) return 'Nothing is owed either way.'
  return value > 0
    ? `The company owes the employee ${formatMoney(value)}.`
    : `The employee holds ${formatMoney(-value)} (an advance not yet claimed) and owes it back.`
}

function today() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Employee Ledger: one account per employee - salary earned and paid,
 * advances, expense claims - with a running balance and who owes whom.
 *
 * The list is every employee for HR and administrators; anyone else gets only
 * their own row, and their statement opens straight away. What each person may
 * see is decided by the server; this screen just shows what it is sent.
 */
export default function EmployeeLedgerPage() {
  const context = React.useMemo(() => getLaravelContext(), [])

  const [summary, setSummary] = React.useState<LedgerSummary | null>(null)
  const [search, setSearch] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const [selected, setSelected] = React.useState<LedgerRow | null>(null)
  const [statement, setStatement] = React.useState<LedgerStatement | null>(null)
  const [stmtLoading, setStmtLoading] = React.useState(false)
  const [stmtError, setStmtError] = React.useState('')
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')

  const [payOpen, setPayOpen] = React.useState(false)
  const [payMonth, setPayMonth] = React.useState('')
  const [payAmount, setPayAmount] = React.useState('')
  const [payDate, setPayDate] = React.useState(today())
  const [payRef, setPayRef] = React.useState('')
  const [payNote, setPayNote] = React.useState('')
  const [payError, setPayError] = React.useState('')
  const [paying, setPaying] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await ledgerService.summary(context)
      setSummary({ scope: response.scope, data: response.data ?? [], totals: response.totals })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load the ledger.')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [context])

  React.useEffect(() => {
    void load()
  }, [load])

  // Somebody who can only see themselves has nothing to choose: open it for them.
  React.useEffect(() => {
    if (summary?.scope === 'own' && summary.data.length === 1 && !selected) setSelected(summary.data[0])
  }, [summary, selected])

  const loadStatement = React.useCallback(
    async (employeeId: number, range: { from?: string; to?: string }) => {
      setStmtLoading(true)
      setStmtError('')
      try {
        const response = await ledgerService.statement(context, employeeId, range)
        setStatement(response?.data ?? null)
      } catch (cause) {
        setStmtError(cause instanceof Error ? cause.message : 'Could not load the statement.')
        setStatement(null)
      } finally {
        setStmtLoading(false)
      }
    },
    [context],
  )

  React.useEffect(() => {
    if (!selected) {
      setStatement(null)
      return
    }
    setFrom('')
    setTo('')
    void loadStatement(selected.employee_id, {})
  }, [selected, loadStatement])

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = summary?.data ?? []
    return q
      ? list.filter((r) => [r.employee_name, r.department, r.employee_no].some((v) => (v ?? '').toLowerCase().includes(q)))
      : list
  }, [summary, search])

  const totals = summary?.totals

  function openPayment() {
    const open = statement?.salary_months.filter((m) => m.due > 0.004) ?? []
    // Oldest month still owing first: that is the one HR normally means.
    const first = open[0]
    setPayMonth(first ? `${first.month}|${first.year}` : '')
    setPayAmount(first ? String(first.due) : '')
    setPayDate(today())
    setPayRef('')
    setPayNote('')
    setPayError('')
    setPayOpen(true)
  }

  async function submitPayment(event: React.FormEvent) {
    event.preventDefault()
    setPayError('')
    if (!statement || !payMonth) return setPayError('Choose the month this pays.')
    if (!(Number(payAmount) > 0)) return setPayError('Enter an amount more than zero.')
    const [month, year] = payMonth.split('|')

    setPaying(true)
    try {
      const response = await ledgerService.recordSalaryPayment(context, {
        employee_id: statement.employee.id,
        month,
        year: Number(year),
        amount: Number(payAmount),
        paid_on: payDate,
        payment_reference: payRef.trim() || undefined,
        note: payNote.trim() || undefined,
      })
      setPayOpen(false)
      setNotice(response?.message || 'Salary payment recorded.')
      await Promise.all([loadStatement(statement.employee.id, { from, to }), load()])
    } catch (cause) {
      setPayError(cause instanceof Error ? cause.message : 'Could not record the payment.')
    } finally {
      setPaying(false)
    }
  }

  async function reverse(paymentId: number) {
    if (!statement || !window.confirm('Reverse this salary payment? It will be removed from the ledger.')) return
    try {
      const response = await ledgerService.reverseSalaryPayment(context, paymentId)
      setNotice(response?.message || 'Payment reversed.')
      await Promise.all([loadStatement(statement.employee.id, { from, to }), load()])
    } catch (cause) {
      setStmtError(cause instanceof Error ? cause.message : 'Could not reverse the payment.')
    }
  }

  const columns: Column<LedgerRow>[] = [
    {
      id: 'employee_name',
      header: 'Employee',
      render: (_, row) => (
        <div className="flex flex-col">
          <span className={cn('font-semibold', row.active ? 'text-foreground' : 'text-muted-foreground')}>
            {row.employee_name}
            {!row.active && <span className="ml-2 text-xs font-normal">(inactive)</span>}
          </span>
          {row.department && <span className="text-xs text-muted-foreground">{row.department}</span>}
        </div>
      ),
    },
    { id: 'latest_salary', header: 'Latest net salary', render: (_, row) => <span className="text-sm">{row.latest_salary > 0 ? formatMoney(row.latest_salary) : '—'}</span> },
    {
      id: 'salary_due',
      header: 'Salary due',
      render: (_, row) => <span className={cn('text-sm', row.salary_due > 0 && 'font-semibold')}>{formatMoney(row.salary_due)}</span>,
    },
    {
      id: 'advance_unclaimed',
      header: 'Advance unclaimed',
      render: (_, row) => <span className={cn('text-sm', row.advance_unclaimed > 0 && 'font-semibold text-warning')}>{formatMoney(row.advance_unclaimed)}</span>,
    },
    { id: 'expense_due', header: 'Expense to pay', render: (_, row) => <span className="text-sm">{formatMoney(row.expense_due)}</span> },
    {
      id: 'net_balance',
      header: 'Net balance',
      render: (_, row) => (
        <span className={cn('text-sm font-semibold', row.net_balance < 0 && 'text-warning')}>{balanceText(row.net_balance)}</span>
      ),
    },
  ]

  const tiles = [
    { label: 'Salary due to employees', value: totals?.salary_due ?? 0 },
    { label: 'Expenses to be paid', value: totals?.expense_due ?? 0 },
    { label: 'Advances not yet claimed', value: totals?.advance_unclaimed ?? 0 },
    { label: 'Net balance', value: totals?.net_balance ?? 0, balance: true },
  ]

  const s = statement?.summary

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500 ease-out">
      <GtgPageHeader
        title="Employee Ledger"
        description="Each employee's account: salary earned and paid, advances and expense claims, with what is still owed either way."
      />

      {summary?.scope === 'all' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile) => (
            <Card key={tile.label}>
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground">{tile.label}</p>
                <p className="mt-1 text-2xl font-bold">{loading ? '—' : tile.balance ? balanceText(tile.value) : formatMoney(tile.value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
          <div className="w-64">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee or department…" />
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading} className="cursor-pointer">
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={loading}
            getRowId={(row) => String(row.employee_id)}
            onRowClick={(row) => setSelected(row)}
            emptyState={error ? null : <div className="py-6 text-center text-sm text-muted-foreground">{search ? 'No employee matches your search.' : 'No employees to show.'}</div>}
            className="overflow-visible rounded-none border-0 [&_th]:bg-transparent [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_td]:py-4"
          />
        </CardContent>
      </Card>

      {/* One employee's statement */}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected ? `${selected.employee_name} – Ledger` : 'Ledger'}</DialogTitle>
            <DialogDescription>
              {statement ? `${statement.employee.department ?? 'No department'}${statement.employee.employee_no ? ` · ${statement.employee.employee_no}` : ''}` : 'Loading…'}
            </DialogDescription>
          </DialogHeader>

          {stmtError && <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{stmtError}</p>}

          {stmtLoading && !statement && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
            </div>
          )}

          {statement && s && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Figure title="Salary" rows={[['Earned', s.salary_earned], ['Paid', s.salary_paid], ['Still due', s.salary_due, true]]} />
                <Figure title="Advance" rows={[['Paid out', s.advance_paid], ['Settled by claims', s.advance_settled], ['Unclaimed', s.advance_unclaimed, true]]} />
                <Figure title="Expenses" rows={[['Approved', s.expense_approved], ['Paid', s.expense_paid], ['Still to pay', s.expense_due, true]]} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Net balance</p>
                  <p className="text-xl font-bold">{balanceText(s.net_balance)}</p>
                </div>
                <p className="max-w-md text-sm text-muted-foreground">{sentence(s.net_balance)}</p>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">From</Label>
                    <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">To</Label>
                    <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
                  </div>
                  <Button variant="outline" size="sm" disabled={stmtLoading} onClick={() => void loadStatement(statement.employee.id, { from, to })}>
                    {stmtLoading ? <Loader2 className="size-3.5 animate-spin" /> : 'Apply'}
                  </Button>
                  {(from || to) && (
                    <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo(''); void loadStatement(statement.employee.id, {}) }}>
                      Clear
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadCsv(
                        `ledger-${statement.employee.name.replace(/\s+/g, '-').toLowerCase()}`,
                        ['Date', 'Particulars', 'Reference', 'Debit', 'Credit', 'Balance (Cr+/Dr-)'],
                        statement.lines.map((l) => [l.date, l.particulars, l.reference, l.debit || '', l.credit || '', l.balance]),
                      )
                    }
                  >
                    <Download className="mr-2 size-4" /> Export
                  </Button>
                  {statement.can.record_payment && (
                    <Button size="sm" onClick={openPayment} disabled={!statement.salary_months.some((m) => m.due > 0.004)}>
                      <Banknote className="mr-2 size-4" /> Record salary payment
                    </Button>
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Date</th>
                      <th className="px-3 py-2 text-left font-semibold">Particulars</th>
                      <th className="px-3 py-2 text-right font-semibold">Debit</th>
                      <th className="px-3 py-2 text-right font-semibold">Credit</th>
                      <th className="px-3 py-2 text-right font-semibold">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {from && (
                      <tr className="border-t border-border/60 bg-muted/20 text-muted-foreground">
                        <td className="px-3 py-2" colSpan={4}>Opening balance</td>
                        <td className="px-3 py-2 text-right">{balanceText(statement.opening_balance)}</td>
                      </tr>
                    )}
                    {statement.lines.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No entries{from || to ? ' in this period' : ' yet'}.</td></tr>
                    )}
                    {statement.lines.map((line, index) => (
                      <tr key={index} className="border-t border-border/60">
                        <td className="whitespace-nowrap px-3 py-2 align-top">{formatDate(line.date)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              {line.particulars}
                              {line.reference && <span className="block text-xs text-muted-foreground">{line.reference}</span>}
                            </div>
                            {line.payment_id && statement.can.reverse_payment && (
                              <button
                                type="button"
                                onClick={() => void reverse(line.payment_id as number)}
                                className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                                aria-label="Reverse this payment"
                                title="Reverse this payment"
                              >
                                <Undo2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right align-top">{line.debit ? formatMoney(line.debit) : ''}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right align-top">{line.credit ? formatMoney(line.credit) : ''}</td>
                        <td className={cn('whitespace-nowrap px-3 py-2 text-right align-top font-medium', line.balance < 0 && 'text-warning')}>{balanceText(line.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/30 font-semibold">
                      <td colSpan={4} className="px-3 py-2 text-right">{from || to ? 'Closing balance for the period' : 'Closing balance'}</td>
                      <td className="px-3 py-2 text-right">{balanceText(statement.closing_balance)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">Cr: the company owes the employee. Dr: the employee holds money (an advance not yet claimed).</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record a salary payment */}
      <Dialog open={payOpen} onOpenChange={(open) => !paying && setPayOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record salary payment</DialogTitle>
            <DialogDescription>{statement?.employee.name} · money already paid out for a processed month.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPayment} className="space-y-4">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select
                value={payMonth}
                onChange={(value) => {
                  setPayMonth(value)
                  const m = statement?.salary_months.find((x) => `${x.month}|${x.year}` === value)
                  if (m) setPayAmount(String(m.due))
                }}
                placeholder="Choose a month"
                options={(statement?.salary_months ?? [])
                  .filter((m) => m.due > 0.004)
                  .map((m) => ({ label: `${m.label} · ${formatMoney(m.due)} due`, value: `${m.month}|${m.year}` }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input type="number" min={0} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Paid on</Label>
                <Input type="date" max={today()} value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="e.g. UTR / voucher number" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Optional, e.g. part payment" maxLength={255} />
            </div>
            {payError && <p className="text-sm text-destructive">{payError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayOpen(false)} disabled={paying}>Cancel</Button>
              <Button type="submit" disabled={paying}>{paying ? 'Saving…' : 'Record payment'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** A small block of three figures, the last one being the amount still outstanding. */
function Figure({ title, rows }: { title: string; rows: [string, number, boolean?][] }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <dl className="space-y-1 text-sm">
        {rows.map(([label, value, strong]) => (
          <div key={label} className={cn('flex justify-between', strong && 'border-t border-border/60 pt-1 font-semibold')}>
            <dt className={strong ? '' : 'text-muted-foreground'}>{label}</dt>
            <dd>{formatMoney(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
