'use client'

import * as React from 'react'
import { Plus } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FileUpload } from '@/components/ui/file-upload'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { useLeaveOptions } from '@/hooks/use-leave'
import { toDateInput } from '@/domain/hrms/hrit/leave-management/services/leave-mappers'
import type { LeaveApplyPayload } from '@/services/hrms'

interface ApplyLeaveDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  processing?: boolean
  onSubmit?: (payload: LeaveApplyPayload) => Promise<{ ok: boolean; message: string }>
}

interface FormErrors {
  employee?: string
  leaveType?: string
  fromDate?: string
  toDate?: string
  slot?: string
  reason?: string
}

interface FormData {
  employee: string
  leaveType: string
  fromDate: Date | undefined
  toDate: Date | undefined
  isHalfDay: boolean
  slot: string
  reason: string
  attachment: File | null
  emergencyContact: string
}

/** Laravel validates slot against these two values when day_type is half. */
const slotOptions = [
  { label: 'First Half', value: 'first_half' },
  { label: 'Second Half', value: 'second_half' },
]

const emptyForm: FormData = {
  employee: '',
  leaveType: '',
  fromDate: undefined,
  toDate: undefined,
  isHalfDay: false,
  slot: 'first_half',
  reason: '',
  attachment: null,
  emergencyContact: '',
}

/** DatePicker can emit a Date or a date string; normalise to a Date. */
function asDate(value?: Date | string): Date | undefined {
  if (!value) return undefined
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function calculateDuration(fromDate: Date | undefined, toDate: Date | undefined, isHalfDay: boolean): string {
  if (isHalfDay) return 'Half Day'
  if (!fromDate || !toDate) return '—'
  const diffTime = toDate.getTime() - fromDate.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  if (diffDays <= 0) return '—'
  return `${diffDays} day${diffDays > 1 ? 's' : ''}`
}

export function ApplyLeaveDrawer({ open, onOpenChange, processing = false, onSubmit }: ApplyLeaveDrawerProps) {
  const { options, loading: optionsLoading, error: optionsError } = useLeaveOptions()

  const [formData, setFormData] = React.useState<FormData>(emptyForm)
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [touched, setTouched] = React.useState<Record<string, boolean>>({})
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const employeeOptions = React.useMemo(
    () => (options?.employees ?? []).map((employee) => ({ value: employee.value, label: employee.label })),
    [options],
  )

  const leaveTypeOptions = React.useMemo(
    () => (options?.leave_types ?? []).map((type) => ({ value: type.value, label: type.label })),
    [options],
  )

  const selectedEmployee = React.useMemo(
    () => (options?.employees ?? []).find((employee) => employee.value === formData.employee),
    [options, formData.employee],
  )

  const duration = React.useMemo(
    () => calculateDuration(formData.fromDate, formData.toDate, formData.isHalfDay),
    [formData.fromDate, formData.toDate, formData.isHalfDay],
  )

  const updateField = (field: keyof FormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    setSubmitError(null)
  }

  const validateField = (field: keyof FormData, data: FormData = formData): string | undefined => {
    switch (field) {
      case 'leaveType':
        return data.leaveType ? undefined : 'Leave type is required'
      case 'fromDate':
        return data.fromDate ? undefined : 'Start date is required'
      case 'toDate': {
        if (data.isHalfDay) return undefined
        if (!data.toDate) return 'End date is required'
        if (data.fromDate && data.toDate < data.fromDate) return 'End date cannot be before start date'
        return undefined
      }
      case 'slot':
        return !data.isHalfDay || data.slot ? undefined : 'Select which half of the day'
      case 'reason':
        return data.reason.trim().length >= 3 ? undefined : 'Reason must be at least 3 characters'
      default:
        return undefined
    }
  }

  const handleBlur = (field: keyof FormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    const error = validateField(field)
    if (error) setErrors((prev) => ({ ...prev, [field]: error }))
  }

  const validateAll = (): boolean => {
    const nextErrors: FormErrors = {}
    let valid = true

    ;(['leaveType', 'fromDate', 'toDate', 'slot', 'reason'] as const).forEach((field) => {
      const error = validateField(field)
      if (error) {
        nextErrors[field] = error
        valid = false
      }
    })

    setErrors(nextErrors)
    setTouched({ leaveType: true, fromDate: true, toDate: true, slot: true, reason: true })
    return valid
  }

  const resetForm = () => {
    setFormData(emptyForm)
    setErrors({})
    setTouched({})
    setSubmitError(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitError(null)

    if (!validateAll() || !onSubmit) return

    setSubmitting(true)

    try {
      const result = await onSubmit({
        leaveTypeId: formData.leaveType,
        dayType: formData.isHalfDay ? 'half' : 'full',
        fromDate: toDateInput(formData.fromDate as Date),
        toDate: formData.toDate ? toDateInput(formData.toDate) : undefined,
        slot: formData.isHalfDay ? formData.slot : undefined,
        comment: formData.reason.trim(),
        employeeId: formData.employee || undefined,
        departmentId: selectedEmployee?.department_id ?? undefined,
      })

      if (!result.ok) {
        setSubmitError(result.message)
        return
      }

      resetForm()
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    resetForm()
    onOpenChange(false)
  }

  const busy = submitting || processing

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col gap-0 border-l border-border/80">
        <SheetHeader className="shrink-0 p-6 pb-0 space-y-0 text-left">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
            <Plus className="size-5" />
            Apply Leave
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            {(submitError || optionsError) && (
              <Alert variant="destructive">
                <AlertDescription>{submitError ?? optionsError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select
                  value={formData.employee}
                  onChange={(value) => updateField('employee', value)}
                  options={employeeOptions}
                  placeholder={optionsLoading ? 'Loading employees...' : 'Apply for myself'}
                />
              </div>

              <div className="space-y-2">
                <Label required>Leave Type</Label>
                <Select
                  value={formData.leaveType}
                  onChange={(value) => updateField('leaveType', value)}
                  options={leaveTypeOptions}
                  placeholder={optionsLoading ? 'Loading leave types...' : 'Select leave type'}
                  className={cn(touched.leaveType && errors.leaveType && 'border-destructive')}
                />
                {touched.leaveType && errors.leaveType && (
                  <p className="text-xs text-destructive">{errors.leaveType}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label required htmlFor="fromDate">Start Date</Label>
                <DatePicker
                  id="fromDate"
                  value={formData.fromDate}
                  onChange={(date) => updateField('fromDate', asDate(date))}
                  placeholder="Pick start date"
                  className={cn(touched.fromDate && errors.fromDate && 'border-destructive')}
                />
                {touched.fromDate && errors.fromDate && (
                  <p className="text-xs text-destructive">{errors.fromDate}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label required={!formData.isHalfDay} htmlFor="toDate">End Date</Label>
                <DatePicker
                  id="toDate"
                  value={formData.isHalfDay ? formData.fromDate : formData.toDate}
                  onChange={(date) => updateField('toDate', asDate(date))}
                  placeholder="Pick end date"
                  // A half day is always a single day, so the end date is the
                  // start date and editing it would have no effect.
                  disabled={formData.isHalfDay}
                  className={cn(touched.toDate && errors.toDate && 'border-destructive')}
                />
                {touched.toDate && errors.toDate && (
                  <p className="text-xs text-destructive">{errors.toDate}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duration</Label>
                <Input id="duration" value={duration} readOnly className="bg-muted/50" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="halfDay">Half Day</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="halfDay"
                    checked={formData.isHalfDay}
                    onCheckedChange={(checked) => updateField('isHalfDay', checked as boolean)}
                  />
                  <span className="text-sm text-muted-foreground">Apply as half day</span>
                </div>
              </div>
            </div>

            {formData.isHalfDay && (
              <div className="space-y-2">
                <Label required>Half Day Slot</Label>
                <Select
                  value={formData.slot}
                  onChange={(value) => updateField('slot', value)}
                  options={slotOptions}
                  placeholder="Select slot"
                  className={cn(touched.slot && errors.slot && 'border-destructive')}
                />
                {touched.slot && errors.slot && <p className="text-xs text-destructive">{errors.slot}</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label required htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Please provide a reason for your leave..."
                value={formData.reason}
                onChange={(event) => updateField('reason', event.target.value)}
                onBlur={() => handleBlur('reason')}
                className={cn(touched.reason && errors.reason && 'border-destructive')}
                rows={3}
                maxLength={255}
              />
              {touched.reason && errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="attachment">Attachment</Label>
              <FileUpload
                id="attachment"
                onFileSelect={(file) => updateField('attachment', file)}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                hint="Not stored in the ERP yet - hrms_emp_leaves has no attachment column."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergencyContact">Emergency Contact</Label>
              <Input
                id="emergencyContact"
                placeholder="Enter emergency contact number"
                value={formData.emergencyContact}
                onChange={(event) => updateField('emergencyContact', event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Not stored in the ERP yet - hrms_emp_leaves has no emergency contact column.
              </p>
            </div>
          </div>

          <SheetFooter className="shrink-0 mt-6 flex flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={busy || optionsLoading}>
              {busy ? 'Submitting...' : 'Submit Request'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
