'use client'

import * as React from 'react'
import { Check, CreditCard, Loader2, Pencil, Send, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { getLaravelContext } from '@/lib/laravel-context'
import { expenseService, type ExpenseClaim, type ExpenseStatus } from '@/services/hrms/expenses'

export const STATUS_LABEL: Record<ExpenseStatus, string> = {
  draft: 'Draft',
  submitted: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

const STATUS_VARIANT: Record<ExpenseStatus, 'default' | 'active' | 'inactive' | 'pending' | 'error' | 'primary'> = {
  draft: 'inactive',
  submitted: 'pending',
  approved: 'primary',
  rejected: 'error',
  paid: 'active',
  cancelled: 'inactive',
}

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  return <StatusBadge status={STATUS_LABEL[status]} variant={STATUS_VARIANT[status]} />
}

export function formatMoney(amount: number, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

/** A date-only string, shown as typed - no timezone round trip. */
export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return value
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Download rows as a CSV, built in the browser from what is on screen (as the Employee Directory does). */
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

type PromptKind = 'approve' | 'reject' | 'pay' | null

/**
 * One claim, in full, with the actions the server says the signed-in user may
 * take. Used by My Expenses and Expense Approvals, so the two can never
 * disagree about what a claim looks like or what can be done to it.
 */
export function ClaimDetailDialog({
  claimId,
  onClose,
  onChanged,
  onEdit,
}: {
  claimId: number | null
  onClose: () => void
  /** Called after anything changed, with the message to show. */
  onChanged: (message: string) => void | Promise<void>
  /** Open the claim in the editor (owner, draft/rejected). */
  onEdit?: (claim: ExpenseClaim) => void
}) {
  const context = React.useMemo(() => getLaravelContext(), [])
  const [claim, setClaim] = React.useState<ExpenseClaim | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [prompt, setPrompt] = React.useState<PromptKind>(null)
  const [note, setNote] = React.useState('')

  React.useEffect(() => {
    if (claimId === null) {
      setClaim(null)
      return
    }
    let alive = true
    setLoading(true)
    setError('')
    expenseService
      .claim(context, claimId)
      .then((response) => alive && setClaim(response?.data ?? null))
      .catch((cause) => alive && setError(cause instanceof Error ? cause.message : 'Could not load the claim.'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [claimId, context])

  async function act(action: () => Promise<{ message?: string; data?: ExpenseClaim }>) {
    setBusy(true)
    setError('')
    try {
      const response = await action()
      setPrompt(null)
      setNote('')
      if (response?.data) setClaim(response.data)
      await onChanged(response?.message || 'Done.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not go through.')
    } finally {
      setBusy(false)
    }
  }

  const can = claim?.can

  return (
    <Dialog open={claimId !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{claim ? `${claim.claim_no} · ${claim.title}` : 'Expense claim'}</DialogTitle>
          <DialogDescription>
            {claim ? `${claim.employee_name} · ${STATUS_LABEL[claim.status]}` : 'Loading…'}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
          </div>
        )}

        {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

        {claim && !loading && (
          <div className="space-y-4">
            {claim.description && <p className="text-sm text-muted-foreground">{claim.description}</p>}

            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Category</th>
                    <th className="px-3 py-2 text-left font-semibold">Details</th>
                    <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(claim.items ?? []).map((item) => (
                    <tr key={item.id} className="border-t border-border/60">
                      <td className="whitespace-nowrap px-3 py-2">{formatDate(item.expense_date)}</td>
                      <td className="px-3 py-2 font-medium">{item.category_name ?? '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {item.description || '—'}
                        {item.receipt_ref && <span className="block text-xs">Bill: {item.receipt_ref}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{formatMoney(item.amount, claim.currency)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted/30 font-semibold">
                    <td colSpan={3} className="px-3 py-2 text-right">Total</td>
                    <td className="px-3 py-2 text-right">{formatMoney(claim.total_amount, claim.currency)}</td>
                  </tr>
                  {claim.advance_adjusted > 0 && (
                    <>
                      <tr className="border-t border-border/60 text-muted-foreground">
                        <td colSpan={3} className="px-3 py-2 text-right">Less advance {claim.advance_no ?? ''}</td>
                        <td className="px-3 py-2 text-right">− {formatMoney(claim.advance_adjusted, claim.currency)}</td>
                      </tr>
                      <tr className="border-t border-border bg-muted/30 font-semibold">
                        <td colSpan={3} className="px-3 py-2 text-right">To be paid</td>
                        <td className="px-3 py-2 text-right">{formatMoney(claim.net_payable, claim.currency)}</td>
                      </tr>
                    </>
                  )}
                </tfoot>
              </table>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {claim.submitted_at && (<><dt>Submitted</dt><dd className="text-foreground">{formatDate(claim.submitted_at)}</dd></>)}
              {claim.decided_at && (<><dt>Decided</dt><dd className="text-foreground">{formatDate(claim.decided_at)}</dd></>)}
              {claim.paid_at && (<><dt>Paid</dt><dd className="text-foreground">{formatDate(claim.paid_at)}{claim.payment_reference ? ` · ${claim.payment_reference}` : ''}</dd></>)}
            </dl>

            {claim.decision_note && (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="font-medium">{claim.status === 'rejected' ? 'Reason for rejection: ' : 'Note: '}</span>
                {claim.decision_note}
              </p>
            )}

            {prompt && (
              <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                <Label>
                  {prompt === 'pay'
                    ? `Payment reference (optional) · paying ${formatMoney(claim.net_payable, claim.currency)}`
                    : prompt === 'reject' ? 'Why is it being rejected?' : 'Note (optional)'}
                </Label>
                {prompt === 'pay' ? (
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. UTR / voucher number" maxLength={100} />
                ) : (
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} />
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setPrompt(null); setNote('') }} disabled={busy}>
                    Back
                  </Button>
                  <Button
                    size="sm"
                    variant={prompt === 'reject' ? 'destructive' : 'default'}
                    disabled={busy || (prompt === 'reject' && !note.trim())}
                    onClick={() =>
                      void act(() =>
                        prompt === 'approve'
                          ? expenseService.approveClaim(context, claim.id, note.trim() || undefined)
                          : prompt === 'reject'
                            ? expenseService.rejectClaim(context, claim.id, note.trim())
                            : expenseService.payClaim(context, claim.id, note.trim() || undefined),
                      )
                    }
                  >
                    {busy ? 'Working…' : prompt === 'approve' ? 'Approve' : prompt === 'reject' ? 'Reject' : 'Mark paid'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {claim && can && !prompt && (
          <DialogFooter className="flex-wrap gap-2">
            {can.delete && (
              <Button variant="outline" className="text-destructive" disabled={busy} onClick={() => void act(async () => {
                const r = await expenseService.deleteClaim(context, claim.id)
                onClose()
                return r
              })}>
                <Trash2 className="mr-2 size-4" /> Delete
              </Button>
            )}
            {can.cancel && (
              <Button variant="outline" disabled={busy} onClick={() => void act(() => expenseService.cancelClaim(context, claim.id))}>
                <X className="mr-2 size-4" /> Cancel claim
              </Button>
            )}
            {can.edit && onEdit && (
              <Button variant="outline" disabled={busy} onClick={() => onEdit(claim)}>
                <Pencil className="mr-2 size-4" /> Edit
              </Button>
            )}
            {can.submit && (
              <Button disabled={busy} onClick={() => void act(() => expenseService.submitClaim(context, claim.id))}>
                <Send className="mr-2 size-4" /> {claim.status === 'rejected' ? 'Resubmit' : 'Submit'}
              </Button>
            )}
            {can.decide && (
              <>
                <Button variant="outline" className="text-destructive" disabled={busy} onClick={() => setPrompt('reject')}>
                  <X className="mr-2 size-4" /> Reject
                </Button>
                <Button disabled={busy} onClick={() => setPrompt('approve')}>
                  <Check className="mr-2 size-4" /> Approve
                </Button>
              </>
            )}
            {can.pay && (
              <Button disabled={busy} onClick={() => setPrompt('pay')}>
                <CreditCard className="mr-2 size-4" /> Mark paid
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
