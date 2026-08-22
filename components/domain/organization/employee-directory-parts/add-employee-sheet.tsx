'use client'

import { useEffect, useMemo, useState } from 'react'
import { Building2, CheckCircle2, Clock, Loader2, MapPin, User, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { RadioGroup, Radio } from '@/components/ui/radio-group'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { LaravelContext } from '@/lib/laravel-context'
import {
  employeeDirectoryService,
  type ReferenceData,
  type ScheduleEntry,
} from '@/services/organization/employee-directory'
import { AttendanceGrid, emptySchedule } from './attendance-grid'

/**
 * Create an employee.
 *
 * WHAT THIS REPLACES. The previous sheet had nineteen inputs and one piece of
 * state - the step counter. Nothing was bound, there was no <form>, and
 * "Finish Onboarding" was `onClick={() => onOpenChange(false)}`: it closed the
 * drawer and threw away everything typed. Every dropdown carried invented
 * options ('eng', 'prod', 'Alex Mercer (CTO)') that matched no row in any
 * table, and because Select was controlled-only they never even displayed a
 * selection when clicked.
 *
 * NO PASSWORD FIELD. tbluser.password is NOT NULL, so creating an employee
 * necessarily mints a credential, but the admin never chooses it: the server
 * generates one and issues a password-reset token so the person sets their
 * own. plain_password - which holds cleartext for 296 of 298 live rows - is
 * never written by this path.
 */

type FormState = {
  first_name: string
  middle_name: string
  last_name: string
  name_suffix: string
  email: string
  mobile: string
  gender: string
  birthdate: string
  department_id: string
  allocated_standards: string
  user_profile_id: string
  subject_ids: string
  employee_no: string
  joined_date: string
  address: string
  address_2: string
  city: string
  state: string
  pincode: string
  supervisor_opt: string
  bank_name: string
  branch_name: string
}

const EMPTY_FORM: FormState = {
  first_name: '', middle_name: '', last_name: '', name_suffix: '',
  email: '', mobile: '', gender: 'M', birthdate: '',
  department_id: '', allocated_standards: '', user_profile_id: '', subject_ids: '',
  employee_no: '', joined_date: '',
  address: '', address_2: '', city: '', state: '', pincode: '',
  supervisor_opt: '', bank_name: '', branch_name: '',
}

const STEPS = [
  { id: 1, title: 'Personal Details', icon: User },
  { id: 2, title: 'Employment', icon: Building2 },
  { id: 3, title: 'Address', icon: MapPin },
  { id: 4, title: 'Reporting & Bank', icon: Users },
  { id: 5, title: 'Attendance', icon: Clock },
  { id: 6, title: 'Review', icon: CheckCircle2 },
] as const

/** Which step each field lives on, so a server error can jump to it. */
const FIELD_STEP: Record<string, number> = {
  first_name: 1, middle_name: 1, last_name: 1, name_suffix: 1,
  email: 1, mobile: 1, gender: 1, birthdate: 1,
  department_id: 2, allocated_standards: 2, user_profile_id: 2, subject_ids: 2,
  employee_no: 2, joined_date: 2,
  address: 3, address_2: 3, city: 3, state: 3, pincode: 3,
  supervisor_opt: 4, bank_name: 4, branch_name: 4,
  schedule: 5,
}

export function AddEmployeeSheet({
  open,
  onOpenChange,
  context,
  referenceData,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: LaravelContext
  referenceData: ReferenceData | null
  onCreated: (message: string) => void | Promise<void>
}) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(emptySchedule())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Open on the organisation's real working week and next employee number
  // rather than a hardcoded Mon-Fri 09:00-18:00.
  useEffect(() => {
    if (!open) return
    setStep(1)
    setErrors({})
    setSubmitError('')
    setForm({ ...EMPTY_FORM, employee_no: referenceData?.next_employee_no ?? '' })
    setSchedule(
      referenceData?.default_schedule?.length ? referenceData.default_schedule : emptySchedule(),
    )
  }, [open, referenceData])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev))
  }

  /** Job roles belong to a department; offering all 2,800 would be useless. */
  const jobRoles = useMemo(() => {
    const all = referenceData?.job_roles ?? []
    if (!form.department_id) return all
    return all.filter((role) => String(role.department_id ?? '') === form.department_id)
  }, [referenceData, form.department_id])

  function validateStep(target: number): boolean {
    const next: Record<string, string> = {}

    if (target === 1) {
      if (!form.first_name.trim()) next.first_name = 'First name is required.'
      if (!form.last_name.trim()) next.last_name = 'Last name is required.'
      if (!form.email.trim()) next.email = 'Email is required.'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'That does not look like an email address.'
      if (form.birthdate && new Date(form.birthdate) >= new Date()) next.birthdate = 'Date of birth must be in the past.'
    }

    if (target === 2) {
      // user_profile_id is NOT NULL with no default - the row cannot exist
      // without it, so this is a real requirement rather than a nicety.
      if (!form.user_profile_id) next.user_profile_id = 'Choose a user profile - it decides what they can see.'
    }

    if (target === 5) {
      if (!schedule.some((entry) => entry.working)) next.schedule = 'Select at least one working day.'
    }

    setErrors((prev) => ({ ...prev, ...next }))
    return Object.keys(next).length === 0
  }

  function goNext() {
    if (!validateStep(step)) return
    setStep((current) => Math.min(STEPS.length, current + 1))
  }

  async function submit() {
    // Re-check every gated step, not just the one on screen: a field can be
    // cleared after its step was passed.
    for (const target of [1, 2, 5]) {
      if (!validateStep(target)) {
        setStep(target)
        return
      }
    }

    setIsSaving(true)
    setSubmitError('')

    try {
      const payload: Record<string, unknown> = { schedule }
      for (const [key, value] of Object.entries(form)) {
        if (String(value).trim() !== '') payload[key] = value
      }

      const response = await employeeDirectoryService.create(context, payload)
      const result = response?.data

      await onCreated(
        result?.invite_sent
          ? `${form.first_name} ${form.last_name} created. An invite was sent to ${result.email}.`
          : `${form.first_name} ${form.last_name} created, but the invite could not be sent${result?.invite_error ? `: ${result.invite_error}` : ''}. Use Resend invite from their profile.`,
      )
      onOpenChange(false)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The employee could not be created.'
      setSubmitError(message)

      // A 422 arrives as an ApiError carrying Laravel's per-field messages.
      // Map them onto the fields and land the user on the earliest step that
      // has one, rather than leaving them on Review reading a single sentence.
      const fieldErrors = (cause as any)?.errors
      if (fieldErrors && typeof fieldErrors === 'object') {
        const mapped: Record<string, string> = {}
        for (const [field, messages] of Object.entries(fieldErrors)) {
          mapped[field] = Array.isArray(messages) ? String(messages[0]) : String(messages)
        }
        setErrors(mapped)
        const earliest = Math.min(...Object.keys(mapped).map((f) => FIELD_STEP[f] ?? 6))
        if (Number.isFinite(earliest)) setStep(earliest)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const field = (key: keyof FormState, label: string, extra?: { type?: string; placeholder?: string; required?: boolean }) => (
    <div className="space-y-2">
      <Label htmlFor={`add-${key}`}>
        {label} {extra?.required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        id={`add-${key}`}
        type={extra?.type ?? 'text'}
        value={form[key]}
        placeholder={extra?.placeholder}
        onChange={(event) => set(key, event.target.value)}
        aria-invalid={Boolean(errors[key])}
        className={cn(errors[key] && 'border-destructive')}
      />
      {errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>}
    </div>
  )

  const reference = referenceData

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <div className="border-b border-border px-6 py-4">
          <SheetTitle>Add Employee</SheetTitle>
          <SheetDescription>
            Creates a login for this person. They will be emailed a link to set their own password.
          </SheetDescription>

          <ol className="mt-4 flex flex-wrap gap-1">
            {STEPS.map((entry) => (
              <li key={entry.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => entry.id < step && setStep(entry.id)}
                  disabled={entry.id > step}
                  className={cn(
                    'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                    entry.id === step && 'bg-primary text-primary-foreground',
                    entry.id < step && 'cursor-pointer text-primary hover:bg-primary/10',
                    entry.id > step && 'text-muted-foreground',
                  )}
                >
                  {entry.id}. {entry.title}
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {field('first_name', 'First Name', { placeholder: 'e.g. Sarah', required: true })}
              {field('last_name', 'Last Name', { placeholder: 'e.g. Jenkins', required: true })}
              {field('middle_name', 'Middle Name')}
              {field('name_suffix', 'Suffix', { placeholder: 'e.g. Jr.' })}
              {field('email', 'Corporate Email', { type: 'email', placeholder: 'sarah.j@company.com', required: true })}
              {field('mobile', 'Phone Number', { type: 'tel', placeholder: '+91 98765 43210' })}
              <div className="space-y-2">
                <Label>Gender</Label>
                <RadioGroup
                  className="flex h-10 flex-row items-center gap-4"
                  value={form.gender}
                  onValueChange={(value) => set('gender', value)}
                >
                  <Radio value="M" label="Male" />
                  <Radio value="F" label="Female" />
                  <Radio value="O" label="Other" />
                </RadioGroup>
              </div>
              {field('birthdate', 'Date of Birth', { type: 'date' })}
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={form.department_id}
                  onChange={(value) => {
                    set('department_id', value)
                    // The old role may not belong to the new department, and
                    // the server refuses that pairing outright.
                    set('allocated_standards', '')
                  }}
                  placeholder="Select department..."
                  options={(reference?.departments ?? []).map((d) => ({ label: d.name, value: String(d.id) }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Job Role</Label>
                <Select
                  value={form.allocated_standards}
                  onChange={(value) => set('allocated_standards', value)}
                  placeholder={form.department_id ? 'Select job role...' : 'Select a department first'}
                  options={jobRoles.map((r) => ({ label: r.name, value: String(r.id) }))}
                />
                {form.department_id && jobRoles.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    This department has no job roles yet. They are created in Capability Library.
                  </p>
                )}
                {errors.allocated_standards && <p className="text-xs text-destructive">{errors.allocated_standards}</p>}
              </div>

              <div className="space-y-2">
                <Label>User Profile <span className="text-destructive">*</span></Label>
                <Select
                  value={form.user_profile_id}
                  onChange={(value) => set('user_profile_id', value)}
                  placeholder="Select profile..."
                  options={(reference?.user_profiles ?? []).map((p) => ({ label: p.name, value: String(p.id) }))}
                />
                {errors.user_profile_id && <p className="text-xs text-destructive">{errors.user_profile_id}</p>}
              </div>

              <div className="space-y-2">
                <Label>Level of Responsibility</Label>
                <Select
                  value={form.subject_ids}
                  onChange={(value) => set('subject_ids', value)}
                  placeholder="Select level..."
                  options={(reference?.levels_of_responsibility ?? []).map((l) => ({
                    label: `Level ${l.level}${l.guiding_phrase ? ` — ${l.guiding_phrase}` : ''}`,
                    value: String(l.id),
                  }))}
                />
              </div>

              {field('employee_no', 'Employee Number')}
              {field('joined_date', 'Joined Date', { type: 'date' })}
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">{field('address', 'Street Address')}</div>
              <div className="sm:col-span-2">{field('address_2', 'Address Line 2')}</div>
              {field('city', 'City')}
              {field('state', 'State / Province')}
              {field('pincode', 'Pincode / Postal Code')}
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Reporting Manager</Label>
                <Select
                  value={form.supervisor_opt}
                  onChange={(value) => set('supervisor_opt', value)}
                  placeholder="Select manager..."
                  options={(reference?.managers ?? []).map((m) => ({
                    label: [m.first_name, m.last_name].filter(Boolean).join(' ') + (m.employee_no ? ` (${m.employee_no})` : ''),
                    value: String(m.id),
                  }))}
                />
              </div>
              {field('bank_name', 'Bank Name')}
              {field('branch_name', 'Branch')}
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Account and identity numbers are managed separately and are never shown back in the
                directory.
              </p>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <AttendanceGrid value={schedule} onChange={setSchedule} />
              {errors.schedule && <p className="text-xs text-destructive">{errors.schedule}</p>}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <ReviewBlock
                title="Personal"
                rows={[
                  ['Name', [form.first_name, form.middle_name, form.last_name, form.name_suffix].filter(Boolean).join(' ')],
                  ['Email', form.email],
                  ['Mobile', form.mobile],
                  ['Gender', form.gender === 'F' ? 'Female' : form.gender === 'O' ? 'Other' : 'Male'],
                  ['Date of birth', form.birthdate],
                ]}
              />
              <ReviewBlock
                title="Employment"
                rows={[
                  ['Department', reference?.departments.find((d) => String(d.id) === form.department_id)?.name ?? '—'],
                  ['Job role', jobRoles.find((r) => String(r.id) === form.allocated_standards)?.name ?? '—'],
                  ['User profile', reference?.user_profiles.find((p) => String(p.id) === form.user_profile_id)?.name ?? '—'],
                  ['Level of responsibility', (() => {
                    const level = reference?.levels_of_responsibility.find((l) => String(l.id) === form.subject_ids)
                    return level ? `Level ${level.level}` : '—'
                  })()],
                  ['Employee number', form.employee_no],
                  ['Joined', form.joined_date],
                ]}
              />
              <ReviewBlock
                title="Attendance"
                rows={schedule.map((entry) => [
                  entry.day.charAt(0).toUpperCase() + entry.day.slice(1),
                  entry.working ? `${entry.in_time ?? '—'} to ${entry.out_time ?? '—'}` : 'Not worked',
                ])}
              />
              <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                On create, a login is made for {form.email || 'this address'} and an email is sent so they
                can set their own password. No password is stored in readable form.
              </p>
            </div>
          )}

          {submitError && (
            <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {submitError}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 1 || isSaving}
            onClick={() => setStep((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>

          {step < STEPS.length ? (
            <Button type="button" onClick={goNext}>
              Next Step
            </Button>
          ) : (
            <Button type="button" onClick={() => void submit()} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 size-4" /> Create Employee
                </>
              )}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ReviewBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-md border border-border">
      <p className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <dl className="divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-3 py-1.5 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium text-foreground">{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
