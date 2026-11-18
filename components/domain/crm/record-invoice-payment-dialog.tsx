'use client'

/**
 * "Record Payment" action on an invoice's own detail page - a manual ledger
 * entry, not a payment-gateway charge (there is no gateway integration in
 * this product yet; see Docs/sales-marketing-merge/DECISIONS.md's gap-closure
 * scope tiering in hp_erp for why that's a separate, vendor-dependent
 * decision). Same dialog shape as SendEmailDialog - this phase's sibling
 * "manual record against an invoice" action.
 */

import { useMemo, useState } from 'react'
import { Loader2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'

interface Props {
  isOpen: boolean
  onClose: () => void
  onRecorded: (message: string) => void
  invoiceId: string
  currency: string | null
  balanceDue: number
}

export function RecordInvoicePaymentDialog({ isOpen, onClose, onRecorded, invoiceId, currency, balanceDue }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const [seeded, setSeeded] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [paidOn, setPaidOn] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && !seeded) {
    setSeeded(true)
    setAmount(balanceDue > 0 ? balanceDue.toFixed(2) : '')
    setMethod('')
    setReference('')
    setPaidOn('')
    setNote('')
    setError('')
  } else if (!isOpen && seeded) {
    setSeeded(false)
  }

  const submit = async () => {
    const parsed = Number(amount)
    if (!amount.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter a payment amount greater than zero.')
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = await crmService.recordInvoicePayment(context, invoiceId, {
        amount: parsed,
        method: method.trim() || undefined,
        reference: reference.trim() || undefined,
        paidOn: paidOn || undefined,
        note: note.trim() || undefined,
      })
      onRecorded(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to record this payment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="size-4" aria-hidden="true" />
            </div>
            <DialogTitle>Record Payment</DialogTitle>
          </div>
          <DialogDescription>
            A manual ledger entry for what was actually collected{currency ? ` (${currency})` : ''} - this product does not process payments itself.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label htmlFor="payment-amount">Amount *</Label>
            <Input id="payment-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-method">Method</Label>
            <Input id="payment-method" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Bank Transfer, Cheque, Cash…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-reference">Reference</Label>
            <Input id="payment-reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction / cheque number" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-date">Paid On</Label>
            <Input id="payment-date" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-note">Note</Label>
            <Textarea id="payment-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !amount.trim()}>
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />}
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
