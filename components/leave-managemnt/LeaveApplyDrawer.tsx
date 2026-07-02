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
import type { LeaveType } from '@/types/Leavedashboard'
import { currentUser } from '@/lib/Leavemanagment-data'

interface ApplyLeaveDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface FormErrors {
  employee?: string
  leaveType?: string
  fromDate?: string
  toDate?: string
  reason?: string
}

interface FormData {
  employee: string
  leaveType: LeaveType | ''
  fromDate: Date | undefined
  toDate: Date | undefined
  isHalfDay: boolean
  reason: string
  attachment: File | null
  emergencyContact: string
}

const leaveTypeOptions = [
  { label: 'Select leave type', value: '' },
  { label: 'Casual Leave', value: 'Casual Leave' },
  { label: 'Sick Leave', value: 'Sick Leave' },
  { label: 'Earned Leave', value: 'Earned Leave' },
  { label: 'Work From Home', value: 'Work From Home' },
  { label: 'Maternity Leave', value: 'Maternity Leave' },
  { label: 'Paternity Leave', value: 'Paternity Leave' },
]

const employeeOptions = [
  { label: currentUser.name, value: currentUser.id },
  { label: 'Rahul Kumar', value: 'emp-002' },
  { label: 'Sneha Patel', value: 'emp-003' },
  { label: 'Amit Singh', value: 'emp-004' },
  { label: 'Neha Gupta', value: 'emp-005' },
  { label: 'Vikram Reddy', value: 'emp-006' },
]

function calculateDuration(fromDate: Date | undefined, toDate: Date | undefined, isHalfDay: boolean): string {
  if (isHalfDay) return 'Half Day'
  if (!fromDate || !toDate) return '—'
  const diffTime = toDate.getTime() - fromDate.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  if (diffDays <= 0) return '—'
  return `${diffDays} day${diffDays > 1 ? 's' : ''}`
}

export function ApplyLeaveDrawer({ open, onOpenChange }: ApplyLeaveDrawerProps) {
  const [formData, setFormData] = React.useState<FormData>({
    employee: currentUser.id,
    leaveType: '',
    fromDate: undefined,
    toDate: undefined,
    isHalfDay: false,
    reason: '',
    attachment: null,
    emergencyContact: '',
  })

  const [errors, setErrors] = React.useState<FormErrors>({})
  const [touched, setTouched] = React.useState<Record<string, boolean>>({})
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const duration = React.useMemo(
    () => calculateDuration(formData.fromDate, formData.toDate, formData.isHalfDay),
    [formData.fromDate, formData.toDate, formData.isHalfDay],
  )

  const updateField = (field: keyof FormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    setSubmitError(null)
  }

  const handleBlur = (field: keyof FormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    const error = validateField(field)
    if (error) setErrors((prev) => ({ ...prev, [field]: error }))
  }

  const validateField = (field: keyof FormData): string | undefined => {
    switch (field) {
      case 'employee':
        return formData.employee ? undefined : 'Employee is required'
      case 'leaveType':
        return formData.leaveType ? undefined : 'Leave type is required'
      case 'fromDate':
        return formData.fromDate ? undefined : 'Start date is required'
      case 'toDate': {
        if (!formData.toDate) return 'End date is required'
        if (formData.fromDate && formData.toDate < formData.fromDate) {
          return 'End date cannot be before start date'
        }
        return undefined
      }
      case 'reason':
        return formData.reason.trim().length >= 3 ? undefined : 'Reason must be at least 3 characters'
      default:
        return undefined
    }
  }

  const validateAll = (): boolean => {
    const newErrors: FormErrors = {}
    let valid = true

    ;(['employee', 'leaveType', 'fromDate', 'toDate', 'reason'] as const).forEach((field) => {
      const error = validateField(field)
      if (error) {
        newErrors[field] = error
        valid = false
      }
    })

    setErrors(newErrors)
    setTouched({
      employee: true,
      leaveType: true,
      fromDate: true,
      toDate: true,
      reason: true,
    })
    return valid
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (!validateAll()) return

    const payload = {
      employee: formData.employee,
      leaveType: formData.leaveType,
      fromDate: formData.fromDate?.toISOString().split('T')[0],
      toDate: formData.toDate?.toISOString().split('T')[0],
      isHalfDay: formData.isHalfDay,
      duration,
      reason: formData.reason.trim(),
      attachment: formData.attachment?.name || null,
      emergencyContact: formData.emergencyContact.trim(),
    }

    console.log('Submitting leave request:', payload)
    alert('Leave request submitted successfully!')
    setFormData({
      employee: currentUser.id,
      leaveType: '',
      fromDate: undefined,
      toDate: undefined,
      isHalfDay: false,
      reason: '',
      attachment: null,
      emergencyContact: '',
    })
    setErrors({})
    setTouched({})
    onOpenChange(false)
  }

  const handleCancel = () => {
    setFormData({
      employee: currentUser.id,
      leaveType: '',
      fromDate: undefined,
      toDate: undefined,
      isHalfDay: false,
      reason: '',
      attachment: null,
      emergencyContact: '',
    })
    setErrors({})
    setTouched({})
    setSubmitError(null)
    onOpenChange(false)
  }

  const handleFileSelect = (file: File | null) => {
    updateField('attachment', file)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col h-full overflow-hidden">
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
            <Plus className="size-5" />
            Apply Leave
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto mt-6 space-y-6">
            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label required>Employee</Label>
              <Select
                value={formData.employee}
                onChange={(val) => updateField('employee', val)}
                options={employeeOptions}
                placeholder="Select employee"
                className={cn(touched.employee && errors.employee && 'border-destructive')}
              />
              {touched.employee && errors.employee && (
                <p className="text-xs text-destructive">{errors.employee}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label required>Leave Type</Label>
              <Select
                value={formData.leaveType}
                onChange={(val) => updateField('leaveType', val as LeaveType)}
                options={leaveTypeOptions}
                placeholder="Select leave type"
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
                  value={formData.fromDate}
                  onChange={(date) => updateField('fromDate', date)}
                  placeholder="Pick start date"
                />
                {touched.fromDate && errors.fromDate && (
                  <p className="text-xs text-destructive">{errors.fromDate}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label required htmlFor="toDate">End Date</Label>
                <DatePicker
                  value={formData.toDate}
                  onChange={(date) => updateField('toDate', date)}
                  placeholder="Pick end date"
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

            <div className="space-y-2">
              <Label required htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Please provide a reason for your leave..."
                value={formData.reason}
                onChange={(e) => updateField('reason', e.target.value)}
                onBlur={() => handleBlur('reason')}
                className={cn(touched.reason && errors.reason && 'border-destructive')}
                rows={3}
              />
              {touched.reason && errors.reason && (
                <p className="text-xs text-destructive">{errors.reason}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="attachment">Attachment</Label>
              <FileUpload
                id="attachment"
                onFileSelect={handleFileSelect}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                hint="PDF, DOC, or image up to 10MB"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergencyContact">Emergency Contact</Label>
              <Input
                id="emergencyContact"
                placeholder="Enter emergency contact number"
                value={formData.emergencyContact}
                onChange={(e) => updateField('emergencyContact', e.target.value)}
              />
            </div>
          </div>

          <SheetFooter className="shrink-0 mt-6 flex flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              Submit Request
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
