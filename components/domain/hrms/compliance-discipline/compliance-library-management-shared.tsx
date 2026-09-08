'use client'

import type { ReactNode } from 'react'
import { Paperclip, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { FileUpload } from '@/components/ui/file-upload'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export type Frequency = 'One-Time' | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' | 'Custom'

export type ComplianceRecord = {
  id: string
  name: string
  description: string
  department: string
  /**
   * The assignee's NAME, for the table and the export.
   *
   * Kept apart from `assignedToId` deliberately. One field used to serve
   * both jobs: the row carried a name, the form's Select carried ids, so
   * opening a record for edit seeded the Select with a value matching none
   * of its options - and saving then posted that NAME into
   * master_compliance.assigned_to, an unsignedBigInteger.
   */
  assignedTo: string
  /** The assignee's user id - what the form binds to and what is saved. */
  assignedToId: string
  dueDate: string
  frequency: Frequency
  customDate?: string
  attachmentName?: string
}

export type ComplianceFormState = {
  name: string
  description: string
  department: string
  assignedTo: string
  dueDate: string
  frequency: Frequency | ''
  customDate: string
  attachmentName: string
  attachmentFile?: File
}

/*
 * ── THE FIVE INVENTED DEPARTMENTS ARE GONE ──────────────────────────────────
 *
 * `departments` used to be five fabricated business units — Human Resources,
 * Finance, Operations, Legal, Information Technology — each carrying three
 * fabricated employee names. It was not a fallback: it was the ONLY source for
 * this screen's Department picker, so every compliance record on every tenant
 * was filed against a department that did not exist in that organisation, and
 * the assignee list offered fifteen people who work nowhere.
 *
 * Departments and employees now arrive as props from the screen, which reads
 * them from the tenant's own `hrms_departments` and user list — the same shape
 * the sibling Disciplinary screen has always used.
 */

export const frequencyOptions: Frequency[] = ['One-Time', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly', 'Custom']

export const initialForm: ComplianceFormState = {
  name: '',
  description: '',
  department: '',
  assignedTo: '',
  dueDate: '',
  frequency: '',
  customDate: '',
  attachmentName: '',
  attachmentFile: undefined,
}

export const frequencySelectOptions = frequencyOptions.map((frequency) => ({ label: frequency, value: frequency }))
export const pageSizeOptions = [5, 10, 15].map((size) => ({ label: `${size} / page`, value: String(size) }))

export function toIsoDate(value?: Date | string) {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  return format(date, 'yyyy-MM-dd')
}

export function displayDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return format(date, 'dd MMM yyyy')
}

export function createCsv(records: ComplianceRecord[]) {
  const headers = ['Sr No.', 'Name', 'Description', 'Department', 'Assigned To', 'Due Date', 'Frequency', 'Attachment']
  const rows = records.map((record, index) => [
    String(index + 1),
    record.name,
    record.description,
    record.department,
    record.assignedTo,
    displayDate(record.dueDate),
    record.frequency,
    record.attachmentName || 'No attachment',
  ])
  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
}

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label required={required}>{label}</Label>
      {children}
    </div>
  )
}

export function ComplianceForm({
  form,
  departmentOptions,
  employeeOptions,
  onChange,
  onSubmit,
  submitLabel,
  uploadKey,
  currentAttachment,
}: {
  form: ComplianceFormState
  /** The tenant's own departments. Empty is a real answer, not a reason to invent. */
  departmentOptions: { label: string; value: string }[]
  employeeOptions?: { label: string; value: string }[]
  onChange: (next: Partial<ComplianceFormState>) => void
  onSubmit: () => void
  submitLabel: string
  uploadKey: string | number
  currentAttachment?: string
}) {
  const resolvedEmployeeOptions = employeeOptions ?? []

  const handleDepartmentChange = (department: string) => {
    onChange({ department, assignedTo: '' })
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Compliance Name" required>
          <Input
            aria-label="Compliance Name"
            placeholder="Enter compliance name"
            value={form.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </Field>

        <Field label="Department">
          <Select
            value={form.department}
            onChange={handleDepartmentChange}
            options={departmentOptions}
            placeholder={
              departmentOptions.length === 0
                ? 'No departments yet — add them under Department Management'
                : 'Select department'
            }
            disabled={departmentOptions.length === 0}
          />
        </Field>

        <div className="lg:col-span-2">
          <Field label="Description" required>
            <Textarea
              aria-label="Description"
              placeholder="Summarize compliance requirement, controls, and evidence needed"
              value={form.description}
              onChange={(event) => onChange({ description: event.target.value })}
            />
          </Field>
        </div>

        <Field label="Assigned Employee">
          <Select
            value={form.assignedTo}
            onChange={(assignedTo) => onChange({ assignedTo })}
            options={resolvedEmployeeOptions}
            placeholder={form.department ? 'Select employee' : 'Select department first'}
          />
        </Field>

        <Field label="Due Date">
          <DatePicker
            value={form.dueDate}
            onChange={(date) => onChange({ dueDate: toIsoDate(date) })}
            placeholder="Select due date"
          />
        </Field>

        <Field label="Frequency">
          <Select
            value={form.frequency}
            onChange={(frequency) => onChange({ frequency: frequency as Frequency, customDate: frequency === 'Custom' ? form.customDate : '' })}
            options={frequencySelectOptions}
            placeholder="Select frequency"
          />
        </Field>

        {form.frequency === 'Custom' && (
          <Field label="Custom Date">
            <DatePicker
              value={form.customDate}
              onChange={(date) => onChange({ customDate: toIsoDate(date) })}
              placeholder="Select custom date"
            />
          </Field>
        )}
      </div>

      <div className="grid gap-3">
        <FileUpload
          key={uploadKey}
          label="Attachment Upload"
          hint="PDF, DOCX, XLSX, PNG up to 10MB"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          onFileSelect={(file) => onChange({ attachmentName: file?.name ?? '', attachmentFile: file ?? undefined })}
        />
        {currentAttachment && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-sm text-primary">
            <Paperclip className="size-4" />
            <span className="truncate">Current attachment: {currentAttachment}</span>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="button" className="w-full gap-2 sm:w-auto" onClick={onSubmit}>
          <Plus className="size-4" />
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}

export function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-12 w-full animate-pulse rounded bg-muted/40" />
      ))}
    </div>
  )
}
