'use client'

import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export type MisconductType =
  | 'Attendance Issue'
  | 'Policy Violation'
  | 'Harassment'
  | 'Misuse of Assets'
  | 'Safety Violation'
  | 'Insubordination'

export type ActionTaken =
  | 'Verbal Warning'
  | 'Written Warning'
  | 'Suspension'
  | 'Training Assigned'
  | 'Final Warning'
  | 'Escalated to HR'

export type IncidentFormState = {
  department: string
  employee: string
  incidentDateTime: string
  location: string
  misconductType: MisconductType | ''
  description: string
  witness: string
  actionTaken: ActionTaken | ''
  remarks: string
}

type Option = {
  label: string
  value: string
}

const departments = [
  {
    label: 'Human Resources',
    value: 'Human Resources',
    employees: ['Aarav Mehta', 'Priya Sharma', 'Neha Kapoor'],
  },
  {
    label: 'Finance',
    value: 'Finance',
    employees: ['Rohan Das', 'Meera Iyer', 'Vikram Rao'],
  },
  {
    label: 'Operations',
    value: 'Operations',
    employees: ['Karan Malhotra', 'Ananya Sen', 'Dev Patel'],
  },
  {
    label: 'Legal',
    value: 'Legal',
    employees: ['Nisha Verma', 'Arjun Khanna', 'Sara Ali'],
  },
  {
    label: 'Information Technology',
    value: 'Information Technology',
    employees: ['Kabir Sethi', 'Isha Nair', 'Rhea Thomas'],
  },
]

const misconductTypes: MisconductType[] = [
  'Attendance Issue',
  'Policy Violation',
  'Harassment',
  'Misuse of Assets',
  'Safety Violation',
  'Insubordination',
]

const actionTakenOptions: ActionTaken[] = [
  'Verbal Warning',
  'Written Warning',
  'Suspension',
  'Training Assigned',
  'Final Warning',
  'Escalated to HR',
]

const departmentOptions = departments.map(({ label, value }) => ({ label, value }))
const misconductOptions = misconductTypes.map((type) => ({ label: type, value: type }))
const actionOptions = actionTakenOptions.map((action) => ({ label: action, value: action }))

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label required={required}>{label}</Label>
      {children}
    </div>
  )
}

export function IncidentForm({
  form,
  onChange,
  onSubmit,
  submitLabel,
  submitIcon,
}: {
  form: IncidentFormState
  onChange: (next: Partial<IncidentFormState>) => void
  onSubmit: () => void
  submitLabel: string
  submitIcon?: ReactNode
}) {
  const employeeOptions = departments
    .find((department) => department.value === form.department)
    ?.employees.map((employee) => ({ label: employee, value: employee })) ?? []

  const witnessOptions = departments
    .flatMap((department) => department.employees)
    .filter((employee) => employee !== form.employee)
    .map((employee) => ({ label: employee, value: employee }))

  const handleDepartmentChange = (department: string) => {
    onChange({ department, employee: '' })
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Department" required>
          <Select
            value={form.department}
            onChange={handleDepartmentChange}
            options={departmentOptions}
            placeholder="Select department"
          />
        </Field>

        <Field label="Employee" required>
          <Select
            value={form.employee}
            onChange={(employee) => onChange({ employee })}
            options={employeeOptions}
            placeholder={form.department ? 'Select employee' : 'Select department first'}
          />
        </Field>

        <Field label="Incident Date & Time" required>
          <Input
            aria-label="Incident Date and Time"
            type="datetime-local"
            value={form.incidentDateTime}
            onChange={(event) => onChange({ incidentDateTime: event.target.value })}
          />
        </Field>

        <Field label="Location" required>
          <Input
            aria-label="Location"
            placeholder="Enter incident location"
            value={form.location}
            onChange={(event) => onChange({ location: event.target.value })}
          />
        </Field>

        <Field label="Type of Misconduct" required>
          <Select
            value={form.misconductType}
            onChange={(misconductType) => onChange({ misconductType: misconductType as MisconductType })}
            options={misconductOptions}
            placeholder="Select misconduct type"
          />
        </Field>

        <Field label="Witness">
          <Select
            value={form.witness}
            onChange={(witness) => onChange({ witness })}
            options={witnessOptions}
            placeholder="Select witness"
          />
        </Field>

        <div className="md:col-span-2 xl:col-span-3">
          <Field label="Description of Incident" required>
            <Textarea
              aria-label="Description of Incident"
              placeholder="Record the incident details, context, and immediate observations"
              value={form.description}
              onChange={(event) => onChange({ description: event.target.value })}
            />
          </Field>
        </div>

        <Field label="Action Taken" required>
          <Select
            value={form.actionTaken}
            onChange={(actionTaken) => onChange({ actionTaken: actionTaken as ActionTaken })}
            options={actionOptions}
            placeholder="Select action taken"
          />
        </Field>

        <div className="md:col-span-2">
          <Field label="Remarks">
            <Textarea
              aria-label="Remarks"
              placeholder="Add optional notes, follow-up expectations, or closure remarks"
              value={form.remarks}
              onChange={(event) => onChange({ remarks: event.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" className="w-full gap-2 sm:w-auto" onClick={onSubmit}>
          {submitIcon ?? <Plus className="size-4" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
