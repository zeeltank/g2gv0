'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  payrollTypeToPayload,
  type PayrollAmountType,
  type PayrollTypeKind,
  type PayrollTypePayload,
  type PayrollTypeRow,
  type PayrollTypeStatus,
} from '@/services/hrms'

const kindOptions = [
  { label: 'Earning', value: 'Earning' },
  { label: 'Deduction', value: 'Deduction' },
]

const amountTypeOptions = [
  { label: 'Flat', value: 'Flat' },
  { label: 'Percentage', value: 'Percentage' },
]

const statusOptions = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
]

interface PayrollTypeFormState {
  kind: '' | PayrollTypeKind
  name: string
  amountType: PayrollAmountType
  amountOrPercentage: string
  status: PayrollTypeStatus
  sortOrder: string
  dayCount: boolean
}

const emptyForm: PayrollTypeFormState = {
  kind: '',
  name: '',
  amountType: 'Flat',
  amountOrPercentage: '',
  status: 'Active',
  sortOrder: '',
  dayCount: false,
}

function amountLabel(amountType: PayrollAmountType) {
  return amountType === 'Percentage' ? 'Percentage (%)' : 'Amount'
}

interface PayrollTypeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: PayrollTypeRow | null
  processing: boolean
  onSave: (payload: PayrollTypePayload) => Promise<{ ok: boolean; message: string }>
}

export default function PayrollTypeDialog({
  open,
  onOpenChange,
  editing,
  processing,
  onSave,
}: PayrollTypeDialogProps) {
  const [form, setForm] = useState<PayrollTypeFormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    setFormError(null)

    if (!editing) {
      setForm(emptyForm)
      return
    }

    const payload = payrollTypeToPayload(editing)
    setForm({
      kind: payload.kind,
      name: payload.name,
      amountType: payload.amountType,
      amountOrPercentage: payload.amountOrPercentage,
      status: payload.status,
      sortOrder: payload.sortOrder ?? '',
      dayCount: payload.dayCount,
    })
  }, [editing, open])

  const close = () => {
    onOpenChange(false)
    setForm(emptyForm)
    setFormError(null)
  }

  /**
   * Laravel only enforces payroll_name, but payrollStore writes every column
   * verbatim - blank or out-of-range values would land in the payslip
   * calculation, so the rest is validated here exactly as the legacy screen did.
   */
  const validate = (): string | null => {
    if (!form.kind) return 'Type is required'
    if (!form.name.trim()) return 'Payroll name is required'
    if (!form.amountType) return 'Amount type is required'

    const raw = form.amountOrPercentage.trim()
    if (!raw) {
      return form.amountType === 'Percentage' ? 'Percentage is required' : 'Amount is required'
    }

    const amount = Number(raw)
    if (!Number.isFinite(amount)) return `${amountLabel(form.amountType)} must be a number`
    if (amount < 0) return `${amountLabel(form.amountType)} cannot be negative`
    if (form.amountType === 'Percentage' && amount > 100) {
      return 'Percentage must be between 0 and 100'
    }

    if (form.sortOrder.trim()) {
      const sortOrder = Number(form.sortOrder)
      if (!Number.isInteger(sortOrder) || sortOrder < 0) {
        return 'Sort order must be a positive whole number'
      }
    }

    return null
  }

  const handleSave = async () => {
    const validationError = validate()
    if (validationError) {
      setFormError(validationError)
      return
    }

    setFormError(null)

    const result = await onSave({
      id: editing?.id,
      kind: form.kind as PayrollTypeKind,
      name: form.name.trim(),
      amountType: form.amountType,
      amountOrPercentage: form.amountOrPercentage.trim(),
      status: form.status,
      dayCount: form.dayCount,
      sortOrder: form.sortOrder.trim(),
    })

    if (result.ok) {
      close()
    } else {
      setFormError(result.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Payroll Type' : 'Add Payroll Type'}</DialogTitle>
          <DialogDescription>
            Payroll types define the earning and deduction components used to build salary
            structures and monthly payroll.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="payrollKind" required>
                Type
              </Label>
              <Select
                id="payrollKind"
                value={form.kind}
                onChange={(value) => setForm((prev) => ({ ...prev, kind: value as PayrollTypeKind }))}
                options={kindOptions}
                placeholder="Select type"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="payrollName" required>
                Payroll Name
              </Label>
              <Input
                id="payrollName"
                placeholder="e.g. Basic, HRA, Provident Fund"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="payrollAmountType" required>
                Amount Type
              </Label>
              <Select
                id="payrollAmountType"
                value={form.amountType}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, amountType: value as PayrollAmountType }))
                }
                options={amountTypeOptions}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="payrollAmount" required>
                {amountLabel(form.amountType)}
              </Label>
              <Input
                id="payrollAmount"
                type="number"
                min="0"
                {...(form.amountType === 'Percentage' ? { max: '100' } : {})}
                placeholder={
                  form.amountType === 'Percentage' ? 'Enter percentage' : 'Enter flat amount'
                }
                value={form.amountOrPercentage}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, amountOrPercentage: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="payrollStatus">Status</Label>
              <Select
                id="payrollStatus"
                value={form.status}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, status: value as PayrollTypeStatus }))
                }
                options={statusOptions}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="payrollSortOrder">Sort Order</Label>
              <Input
                id="payrollSortOrder"
                type="number"
                min="0"
                placeholder="Position on the payslip"
                value={form.sortOrder}
                onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="min-w-0 pr-4">
              <Label htmlFor="payrollDayCount">Day Wise Count</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Pro-rate this component by the number of days attended in the month.
              </p>
            </div>
            <Switch
              id="payrollDayCount"
              checked={form.dayCount}
              onChange={(event) => setForm((prev) => ({ ...prev, dayCount: event.target.checked }))}
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="outline" className="w-full sm:w-auto" onClick={close} disabled={processing}>
            Cancel
          </Button>
          <Button className="w-full sm:w-auto" onClick={handleSave} disabled={processing}>
            {processing ? 'Saving...' : editing ? 'Update Payroll Type' : 'Add Payroll Type'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
