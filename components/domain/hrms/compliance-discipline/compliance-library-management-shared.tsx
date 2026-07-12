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
  assignedTo: string
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
}

export const departments = [
  { label: 'Human Resources', value: 'Human Resources', employees: ['Aarav Mehta', 'Priya Sharma', 'Neha Kapoor'] },
  { label: 'Finance', value: 'Finance', employees: ['Rohan Das', 'Meera Iyer', 'Vikram Rao'] },
  { label: 'Operations', value: 'Operations', employees: ['Karan Malhotra', 'Ananya Sen', 'Dev Patel'] },
  { label: 'Legal', value: 'Legal', employees: ['Nisha Verma', 'Arjun Khanna', 'Sara Ali'] },
  { label: 'Information Technology', value: 'Information Technology', employees: ['Kabir Sethi', 'Isha Nair', 'Rhea Thomas'] },
]

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
}

export const initialRecords: ComplianceRecord[] = [
  {
    id: 'cmp-1',
    name: 'POSH Policy Acknowledgement',
    description: 'Annual policy acknowledgement and workforce confirmation.',
    department: 'Human Resources',
    assignedTo: 'Priya Sharma',
    dueDate: '2026-07-31',
    frequency: 'Yearly',
    attachmentName: 'posh-policy.pdf',
  },
  {
    id: 'cmp-2',
    name: 'GST Filing Review',
    description: 'Monthly compliance evidence review before statutory filing.',
    department: 'Finance',
    assignedTo: 'Meera Iyer',
    dueDate: '2026-07-20',
    frequency: 'Monthly',
    attachmentName: 'gst-checklist.xlsx',
  },
  {
    id: 'cmp-3',
    name: 'Data Access Audit',
    description: 'Quarterly verification of privileged access and control owners.',
    department: 'Information Technology',
    assignedTo: 'Kabir Sethi',
    dueDate: '2026-08-15',
    frequency: 'Quarterly',
    attachmentName: 'access-audit-template.docx',
  },
]

export const departmentOptions = departments.map(({ label, value }) => ({ label, value }))
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
  onChange,
  onSubmit,
  submitLabel,
  uploadKey,
  currentAttachment,
}: {
  form: ComplianceFormState
  onChange: (next: Partial<ComplianceFormState>) => void
  onSubmit: () => void
  submitLabel: string
  uploadKey: string | number
  currentAttachment?: string
}) {
  const employeeOptions = departments
    .find((department) => department.value === form.department)
    ?.employees.map((employee) => ({ label: employee, value: employee })) ?? []

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
            placeholder="Select department"
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
            options={employeeOptions}
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
          onFileSelect={(file) => onChange({ attachmentName: file?.name ?? '' })}
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
