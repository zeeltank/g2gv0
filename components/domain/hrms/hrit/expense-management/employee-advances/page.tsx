'use client'

import * as React from 'react'
import { Check, CreditCard, Loader2, Plus, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { GtgPageHeader } from '@/components/shell/gtg-page-header'
import { getLaravelContext } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import { expenseService, type AdvanceStatus, type AdvanceSummary, type ExpenseAdvance } from '@/services/hrms/expenses'
import { formatDate, formatMoney } from '../shared'

const LABEL: Record<AdvanceStatus, string> = {
  requested: 'Pending approval',
  approved: 'Approved – to be paid',
  rejected: 'Rejected',
  paid: 'Paid',
  claimed: 'Fully claimed',
  cancelled: 'Cancelled',
}

const VARIANT: Record<AdvanceStatus, 'inactive' | 'pending' | 'primary' | 'error' | 'active'> = {
  requested: 'pending',
  approved: 'primary',
  rejected: 'error',
  paid: 'active',
  claimed: 'inactive',
  cancelled: 'inactive',
}

type Tab = 'mine' | 'approvals'
type Prompt = 'approve' | 'reject' | 'pay' | null

function today() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Employee Advances: ask for money before you spend it, and follow it.
 *
 * "My advances" is your own. "To decide" is what the server routes to you -
 * your team's for a manager, everyone's for HR and admin (empty for anybody
 * else). The server also decides which actions each advance offers; this
 * screen only shows the buttons it is told are allowed. A paid advance is
 * settled by choosing it on an expense claim.
 */
export default function EmployeeAdvancesPage() {
  const context = React.useMemo(() => getLaravelContext(), [])

  const [tab, setTab] = React.useState<Tab>('mine')
  const [statusFilter, setStatusFilter] = React.useState('')
  const [advances, setAdvances] = React.useState<ExpenseAdvance[]>([])
  const [summary, setSummary] = React.useState<AdvanceSummary>({})
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const [detail, setDetail] = React.useState<ExpenseAdvance | null>(null)
  const [prompt, setPrompt] = React.useState<Prompt>(null)
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [actionError, setActionError] = React.useState('')

  const [formOpen, setFormOpen] = React.useState(false)
  const [purpose, setPurpose] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [neededBy, setNeededBy] = React.useState('')
  const [formNote, setFormNote] = React.useState('')
  const [formError, setFormError] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await expenseService.advances(context, tab, statusFilter as AdvanceStatus | '')
      setAdvances(response?.data ?? [])
      setSummary(response?.summary ?? {})
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load advances.')
      setAdvances([])
    } finally {
      setLoading(false)
    }
  }, [context, tab, statusFilter])

  React.useEffect(() => {
    void load()
  }, [load])

  function openForm() {
    setPurpose('')
    setAmount('')
    setNeededBy('')
    setFormNote('')
    setFormError('')
    setFormOpen(true)
  }

  async function submitForm(event: React.FormEvent) {
    event.preventDefault()
    setFormError('')
    if (!purpose.trim()) return setFormError('Say what the advance is for.')
    if (!(Number(amount) > 0)) return setFormError('Enter an amount more than zero.')

    setSaving(true)
    try {
      const response = await expenseService.createAdvance(context, {
        purpose: purpose.trim(),
        advance_amount: Number(amount),
        needed_by: neededBy || undefined,
        note: formNote.trim() || undefined,
      })
      setFormOpen(false)
      setTab('mine')
      setNotice(response?.message || 'Advance requested.')
      await load()
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not request the advance.')
    } finally {
      setSaving(false)
    }
  }

  async function act(action: () => Promise<{ message?: string; data?: ExpenseAdvance }>) {
    setBusy(true)
    setActionError('')
    try {
      const response = await action()
      setPrompt(null)
      setNote('')
      if (response?.data) setDetail(response.data)
      setNotice(response?.message || 'Done.')
      await load()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'That did not go through.')
    } finally {
      setBusy(false)
    }
  }

  const get = (key: AdvanceStatus) => summary[key] ?? { advances: 0, amount: 0, claimed: 0 }
  const paidTotal = get('paid').amount + get('claimed').amount
  const claimedTotal = get('paid').claimed + get('claimed').claimed

  const tiles = [
    { label: 'Pending approval', value: get('requested').amount, sub: `${get('requested').advances} advance${get('requested').advances === 1 ? '' : 's'}` },
    { label: 'Approved – to be paid', value: get('approved').amount, sub: `${get('approved').advances} advance${get('approved').advances === 1 ? '' : 's'}` },
    { label: 'Paid out', value: paidTotal, sub: 'Total advanced' },
    { label: 'Unclaimed', value: Math.max(paidTotal - claimedTotal, 0), sub: 'Paid, not yet settled by claims' },
  ]

  const employeeColumn: Column<ExpenseAdvance> = {
    id: 'employee_name',
    header: 'Employee',
    render: (_, row) => <span className="font-semibold">{row.employee_name}</span>,
  }

  const columns: Column<ExpenseAdvance>[] = [
    ...(tab === 'approvals' ? [employeeColumn] : []),
    {
      id: 'advance_no',
      header: 'Advance',
      render: (_, row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{row.purpose}</span>
          <span className="text-xs text-muted-foreground">{row.advance_no}</span>
        </div>
      ),
    },
    { id: 'created_at', header: 'Requested', render: (_, row) => <span className="text-sm">{formatDate(row.requested_at ?? row.created_at)}</span> },
    { id: 'advance_amount', header: 'Amount', render: (_, row) => <span className="text-sm font-medium">{formatMoney(row.advance_amount, row.currency)}</span> },
    {
      id: 'unclaimed_amount',
      header: 'Unclaimed',
      render: (_, row) => (
        <span className="text-sm">{['paid', 'claimed'].includes(row.status) ? formatMoney(row.unclaimed_amount, row.currency) : '—'}</span>
      ),
    },
    { id: 'status', header: 'Status', render: (_, row) => <StatusBadge status={LABEL[row.status]} variant={VARIANT[row.status]} /> },
  ]

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500 ease-out">
      <GtgPageHeader
        title="Employee Advances"
        description="Ask for money before a trip or purchase. Once it is paid, settle it by choosing it on an expense claim."
        actions={
          <Button onClick={openForm} className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" /> New Advance
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted-foreground">{tile.label}</p>
              <p className="mt-1 text-2xl font-bold">{loading ? '—' : formatMoney(tile.value)}</p>
              <p className="text-xs text-muted-foreground">{loading ? 'Loading…' : tile.sub}</p>
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
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-sm">
            {([['mine', 'My advances'], ['approvals', 'To decide']] as const).map(([key, text]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  'cursor-pointer rounded-md px-3 py-1.5 font-medium transition-colors',
                  tab === key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {text}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-52">
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="All statuses"
                size="sm"
                options={[{ label: 'All statuses', value: '' }, ...(Object.keys(LABEL) as AdvanceStatus[]).map((s) => ({ label: LABEL[s], value: s }))]}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading} className="cursor-pointer">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={advances}
            isLoading={loading}
            getRowId={(row) => String(row.id)}
            onRowClick={(row) => {
              setActionError('')
              setPrompt(null)
              setNote('')
              setDetail(row)
            }}
            emptyState={
              error ? null : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {tab === 'approvals' ? 'No advances are waiting on you.' : "You haven't asked for an advance yet."}
                </div>
              )
            }
            className="overflow-visible rounded-none border-0 [&_th]:bg-transparent [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_td]:py-4"
          />
        </CardContent>
      </Card>

      {/* New advance */}
      <Dialog open={formOpen} onOpenChange={(open) => !saving && setFormOpen(open)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New advance</DialogTitle>
            <DialogDescription>Your reporting manager (or HR) approves it, then HR pays it out.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-4">
            <div className="space-y-2">
              <Label>What is it for?</Label>
              <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Delhi client visit, 24–26 Nov" maxLength={255} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Needed by</Label>
                <Input type="date" min={today()} value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formNote} onChange={(e) => setFormNote(e.target.value)} rows={2} placeholder="Optional" maxLength={2000} />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Requesting…' : 'Request advance'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* One advance */}
      <Dialog open={detail !== null} onOpenChange={(open) => !open && !busy && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail ? `${detail.advance_no} · ${detail.purpose}` : 'Advance'}</DialogTitle>
            <DialogDescription>{detail ? `${detail.employee_name} · ${LABEL[detail.status]}` : ''}</DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="text-right font-semibold">{formatMoney(detail.advance_amount, detail.currency)}</dd>
                {['paid', 'claimed'].includes(detail.status) && (
                  <>
                    <dt className="text-muted-foreground">Settled by claims</dt>
                    <dd className="text-right">{formatMoney(detail.claimed_amount, detail.currency)}</dd>
                    <dt className="text-muted-foreground">Still unclaimed</dt>
                    <dd className="text-right font-semibold">{formatMoney(detail.unclaimed_amount, detail.currency)}</dd>
                  </>
                )}
                {detail.needed_by && (<><dt className="text-muted-foreground">Needed by</dt><dd className="text-right">{formatDate(detail.needed_by)}</dd></>)}
                {detail.requested_at && (<><dt className="text-muted-foreground">Requested</dt><dd className="text-right">{formatDate(detail.requested_at)}</dd></>)}
                {detail.decided_at && (<><dt className="text-muted-foreground">Decided</dt><dd className="text-right">{formatDate(detail.decided_at)}</dd></>)}
                {detail.paid_at && (
                  <>
                    <dt className="text-muted-foreground">Paid</dt>
                    <dd className="text-right">{formatDate(detail.paid_at)}{detail.payment_reference ? ` · ${detail.payment_reference}` : ''}</dd>
                  </>
                )}
              </dl>

              {detail.note && <p className="text-sm text-muted-foreground">{detail.note}</p>}
              {detail.decision_note && (
                <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <span className="font-medium">{detail.status === 'rejected' ? 'Reason for rejection: ' : 'Note: '}</span>
                  {detail.decision_note}
                </p>
              )}

              {prompt && (
                <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                  <Label>{prompt === 'pay' ? 'Payment reference (optional)' : prompt === 'reject' ? 'Why is it being rejected?' : 'Note (optional)'}</Label>
                  {prompt === 'pay' ? (
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. UTR / voucher number" maxLength={100} />
                  ) : (
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} />
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setPrompt(null); setNote('') }} disabled={busy}>Back</Button>
                    <Button
                      size="sm"
                      variant={prompt === 'reject' ? 'destructive' : 'default'}
                      disabled={busy || (prompt === 'reject' && !note.trim())}
                      onClick={() =>
                        void act(() =>
                          prompt === 'approve'
                            ? expenseService.approveAdvance(context, detail.id, note.trim() || undefined)
                            : prompt === 'reject'
                              ? expenseService.rejectAdvance(context, detail.id, note.trim())
                              : expenseService.payAdvance(context, detail.id, note.trim() || undefined),
                        )
                      }
                    >
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : prompt === 'approve' ? 'Approve' : prompt === 'reject' ? 'Reject' : 'Mark paid'}
                    </Button>
                  </div>
                </div>
              )}

              {actionError && <p className="text-sm text-destructive">{actionError}</p>}
            </div>
          )}

          {detail && !prompt && (detail.can.cancel || detail.can.decide || detail.can.pay) && (
            <DialogFooter className="flex-wrap gap-2">
              {detail.can.cancel && (
                <Button variant="outline" disabled={busy} onClick={() => void act(() => expenseService.cancelAdvance(context, detail.id))}>
                  <X className="mr-2 size-4" /> Cancel request
                </Button>
              )}
              {detail.can.decide && (
                <>
                  <Button variant="outline" className="text-destructive" disabled={busy} onClick={() => setPrompt('reject')}>
                    <X className="mr-2 size-4" /> Reject
                  </Button>
                  <Button disabled={busy} onClick={() => setPrompt('approve')}>
                    <Check className="mr-2 size-4" /> Approve
                  </Button>
                </>
              )}
              {detail.can.pay && (
                <Button disabled={busy} onClick={() => setPrompt('pay')}>
                  <CreditCard className="mr-2 size-4" /> Mark paid
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
