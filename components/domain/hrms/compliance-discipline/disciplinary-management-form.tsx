'use client'

import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export type MisconductType =
  | 'Late Arrival'
  | 'Absenteeism'
  | 'Misbehavior'
  | 'Violation of Policy'
  | 'Others'

export type ActionTaken =
  | 'Warning'
  | 'Suspension'
  | 'Termination'
  | 'Counseling'
  | 'Others'

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

const misconductTypes: MisconductType[] = ['Late Arrival', 'Absenteeism', 'Misbehavior', 'Violation of Policy', 'Others']

const actionTakenOptions: ActionTaken[] = ['Warning', 'Suspension', 'Termination', 'Counseling', 'Others']

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
  departmentOptions,
  employeeOptions,
  witnessOptions,
  isEmployeeLoading,
  onDepartmentChange,
}: {
  form: IncidentFormState
  onChange: (next: Partial<IncidentFormState>) => void
  onSubmit: () => void
  submitLabel: string
  submitIcon?: ReactNode
  departmentOptions?: Option[]
  employeeOptions?: Option[]
  witnessOptions?: Option[]
  isEmployeeLoading?: boolean
  onDepartmentChange?: (department: string) => void
}) {
  const handleDepartmentChange = (department: string) => {
    if (onDepartmentChange) {
      onDepartmentChange(department)
    } else {
      onChange({ department, employee: '' })
    }
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Department" required>
          <Select
            value={form.department}
            onChange={handleDepartmentChange}
            options={departmentOptions ?? []}
            placeholder="Select department"
          />
        </Field>

        <Field label="Employee" required>
          <Select
            value={form.employee}
            onChange={(employee) => onChange({ employee })}
            options={employeeOptions ?? []}
            placeholder={
              !form.department
                ? 'Select department first'
                : isEmployeeLoading
                  ? 'Loading employees...'
                  : 'Select employee'
            }
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
            options={witnessOptions ?? []}
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
