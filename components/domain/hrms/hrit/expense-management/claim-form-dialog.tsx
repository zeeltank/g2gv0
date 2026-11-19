'use client'

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getLaravelContext } from '@/lib/laravel-context'
import { expenseService, type ExpenseAdvance, type ExpenseCategory, type ExpenseClaim } from '@/services/hrms/expenses'
import { formatMoney } from './shared'

type Line = {
  category_id: string
  expense_date: string
  description: string
  amount: string
  receipt_ref: string
}

function today() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const blankLine = (): Line => ({ category_id: '', expense_date: today(), description: '', amount: '', receipt_ref: '' })

/**
 * New claim, or edit a draft / rejected one. "Save draft" keeps it private to
 * the employee; "Submit" files it for approval in the same request, and the
 * server re-checks everything either way (limits, receipts, categories).
 */
export function ClaimFormDialog({
  open,
  claim,
  categories,
  onClose,
  onSaved,
}: {
  open: boolean
  /** The claim being edited, with its items; null for a new one. */
  claim: ExpenseClaim | null
  /** Active categories. */
  categories: ExpenseCategory[]
  onClose: () => void
  onSaved: (message: string) => void | Promise<void>
}) {
  const context = React.useMemo(() => getLaravelContext(), [])
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [lines, setLines] = React.useState<Line[]>([blankLine()])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')
  // The employee's own paid advances with something left, and the one chosen.
  const [advances, setAdvances] = React.useState<ExpenseAdvance[]>([])
  const [advanceId, setAdvanceId] = React.useState('')
  const [advanceAmount, setAdvanceAmount] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setError('')
    setAdvanceId(claim?.advance_id ? String(claim.advance_id) : '')
    setAdvanceAmount(claim?.advance_id ? String(claim.advance_adjusted) : '')
    expenseService
      .openAdvances(context)
      .then((response) => setAdvances(response?.data ?? []))
      .catch(() => setAdvances([]))
    if (claim) {
      setTitle(claim.title)
      setDescription(claim.description ?? '')
      setLines(
        claim.items?.length
          ? claim.items.map((i) => ({
              category_id: String(i.category_id),
              expense_date: i.expense_date.slice(0, 10),
              description: i.description ?? '',
              amount: String(i.amount),
              receipt_ref: i.receipt_ref ?? '',
            }))
          : [blankLine()],
      )
    } else {
      setTitle('')
      setDescription('')
      setLines([blankLine()])
    }
  }, [open, claim, context])

  const categoryById = React.useMemo(() => new Map(categories.map((c) => [String(c.id), c])), [categories])

  // A category already on this claim may since have been set Inactive; keep it
  // selectable here so editing the claim does not silently blank that line.
  const options = React.useMemo(() => {
    const list = categories.map((c) => ({ label: c.name, value: String(c.id) }))
    for (const item of claim?.items ?? []) {
      if (!list.some((o) => o.value === String(item.category_id))) {
        list.push({ label: `${item.category_name ?? 'Category'} (inactive)`, value: String(item.category_id) })
      }
    }
    return list
  }, [categories, claim])

  const total = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)

  // The advance already on this claim may not be in the "open" list any more,
  // so it is kept selectable rather than silently dropped on save.
  const advanceOptions = React.useMemo(() => {
    const list = advances.map((a) => ({
      label: `${a.advance_no} · ${a.purpose} · ${formatMoney(a.unclaimed_amount)} left`,
      value: String(a.id),
    }))
    if (claim?.advance_id && !list.some((o) => o.value === String(claim.advance_id))) {
      list.push({ label: `${claim.advance_no ?? 'Advance'} (current)`, value: String(claim.advance_id) })
    }
    return [{ label: 'No advance', value: '' }, ...list]
  }, [advances, claim])

  const chosenAdvance = advances.find((a) => String(a.id) === advanceId)
  const advanceToUse = advanceId
    ? advanceAmount
      ? Number(advanceAmount)
      : Math.min(chosenAdvance?.unclaimed_amount ?? total, total)
    : 0

  const update = (index: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))

  async function save(submit: boolean) {
    setError('')
    if (!title.trim()) return setError('Give the claim a title.')

    const filled = lines.filter((l) => l.category_id || l.amount || l.description || l.receipt_ref)
    if (submit && filled.length === 0) return setError('Add at least one expense line.')

    for (const [i, l] of filled.entries()) {
      const n = i + 1
      if (!l.category_id) return setError(`Line ${n}: pick a category.`)
      if (!(Number(l.amount) > 0)) return setError(`Line ${n}: enter an amount more than zero.`)
      if (!l.expense_date) return setError(`Line ${n}: pick the date.`)
      const category = categoryById.get(l.category_id)
      if (category?.max_amount != null && Number(l.amount) > category.max_amount) {
        return setError(`Line ${n}: ${category.name} is limited to ${formatMoney(category.max_amount)} per expense.`)
      }
      if (submit && category?.requires_receipt && !l.receipt_ref.trim()) {
        return setError(`Line ${n}: ${category.name} needs a bill / receipt reference.`)
      }
    }

    if (advanceId) {
      if (!(advanceToUse > 0)) return setError('Enter how much of the advance to use.')
      if (advanceToUse > total) return setError('The advance used cannot be more than the claim total.')
      if (chosenAdvance && advanceToUse > chosenAdvance.unclaimed_amount) {
        return setError(`Only ${formatMoney(chosenAdvance.unclaimed_amount)} is left on that advance.`)
      }
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      submit,
      ...(advanceId ? { advance_id: Number(advanceId), advance_amount: advanceToUse } : {}),
      items: filled.map((l) => ({
        category_id: Number(l.category_id),
        expense_date: l.expense_date,
        description: l.description.trim() || undefined,
        amount: Number(l.amount),
        receipt_ref: l.receipt_ref.trim() || undefined,
      })),
    }

    setSaving(true)
    try {
      const response = claim
        ? await expenseService.updateClaim(context, claim.id, payload)
        : await expenseService.createClaim(context, payload)
      onClose()
      await onSaved(response?.message || 'Saved.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the claim.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{claim ? `Edit ${claim.claim_no}` : 'New expense claim'}</DialogTitle>
          <DialogDescription>
            Add each expense as a line. Save it as a draft to finish later, or submit it for approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Client visit – Ahmedabad, 12 Nov" maxLength={150} />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional" maxLength={2000} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Expense lines</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((p) => [...p, blankLine()])}>
                <Plus className="mr-1 size-4" /> Add line
              </Button>
            </div>

            {lines.map((line, index) => {
              const category = categoryById.get(line.category_id)
              return (
                <div key={index} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Category</Label>
                      <Select
                        value={line.category_id}
                        onChange={(value) => update(index, { category_id: value })}
                        options={options}
                        placeholder="Select category"
                        size="sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Date</Label>
                      <Input type="date" max={today()} value={line.expense_date} onChange={(e) => update(index, { expense_date: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Amount (₹)</Label>
                      <Input type="number" min={0} step="0.01" value={line.amount} onChange={(e) => update(index, { amount: e.target.value })} placeholder="0.00" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <Input value={line.description} onChange={(e) => update(index, { description: e.target.value })} placeholder="What was it for?" maxLength={255} />
                    <Input
                      value={line.receipt_ref}
                      onChange={(e) => update(index, { receipt_ref: e.target.value })}
                      placeholder={category?.requires_receipt ? 'Bill / receipt no. (required)' : 'Bill / receipt no.'}
                      maxLength={150}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLines((p) => (p.length === 1 ? [blankLine()] : p.filter((_, i) => i !== index)))}
                      aria-label={`Remove line ${index + 1}`}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                  {category?.max_amount != null && (
                    <p className="text-xs text-muted-foreground">Limit for {category.name}: {formatMoney(category.max_amount)} per expense.</p>
                  )}
                </div>
              )
            })}

            {advanceOptions.length > 1 && (
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 sm:grid-cols-[2fr_1fr]">
                <div className="space-y-1">
                  <Label className="text-xs">Settle against an advance</Label>
                  <Select
                    value={advanceId}
                    onChange={(value) => {
                      setAdvanceId(value)
                      setAdvanceAmount('')
                    }}
                    options={advanceOptions}
                    placeholder="No advance"
                    size="sm"
                  />
                </div>
                {advanceId && (
                  <div className="space-y-1">
                    <Label className="text-xs">Amount to use (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={advanceAmount}
                      onChange={(e) => setAdvanceAmount(e.target.value)}
                      placeholder={`Up to ${formatMoney(Math.min(chosenAdvance?.unclaimed_amount ?? total, total))}`}
                    />
                  </div>
                )}
              </div>
            )}

            <p className="text-right text-sm font-semibold">Total: {formatMoney(total)}</p>
            {advanceId && (
              <p className="text-right text-xs text-muted-foreground">
                To be paid after the advance: {formatMoney(Math.max(total - advanceToUse, 0))}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="outline" onClick={() => void save(false)} disabled={saving}>
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
          <Button onClick={() => void save(true)} disabled={saving}>Submit for approval</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
