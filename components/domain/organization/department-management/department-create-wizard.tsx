'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Department } from '@/lib/gtg-org-data'
import type { LaravelContext } from '@/lib/laravel-context'
import { organizationService } from '@/services/organization'
import { SelectInput } from '../components'
import { DepartmentEmployeesPanel } from './department-employees-panel'
import { DepartmentJobRolesPanel } from './department-job-roles-panel'
import { SopsTab } from './sops-tab'
import { PoliciesTab } from './policies-tab'
import { RulesTab } from './rules-tab'

/**
 * Creating a department, properly.
 *
 * The old create dialog asked for a name (later a name, code and description)
 * and stopped there - which left a department with no head, no staff, and no
 * documents, and no obvious route to add any of them. This walks the whole
 * setup.
 *
 * SAVED AS YOU GO. Step 1 creates the department immediately, and every later
 * step writes against that real id. The alternative - hold everything in
 * memory and submit at the end - cannot work here: SOPs, policies, rules and
 * employee assignments all need a department_id to attach to, so they would
 * each need a second, "pending" code path that only exists inside this wizard.
 *
 * A department created here starts INACTIVE and is activated by Finish. So an
 * abandoned wizard leaves a visible, resumable draft rather than either a
 * half-built department pretending to be finished, or a silent orphan. There
 * is no third status to add: hrms_departments.status is an int with two states,
 * and the Status filter (which only started working in this same round of work)
 * is what makes these findable.
 */

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5

/*
 * Job Roles sits BEFORE Employees, deliberately.
 *
 * An employee's place in a department is expressed through a job role
 * (department -> job role -> employee), and a role belongs to exactly one
 * department. Assigning people before any role exists is how somebody ends up
 * in a department holding a role that belongs to a different one.
 */
const STEPS = [
  { title: 'Basics', hint: 'Name, code and where it sits' },
  { title: 'Head', hint: 'Who leads this department' },
  { title: 'Job Roles', hint: 'The roles this department is made of' },
  { title: 'Employees', hint: 'Transfer or assign people' },
  { title: 'Documents', hint: 'SOPs, policies and rules' },
  { title: 'Review', hint: 'Confirm and activate' },
]

export function DepartmentCreateWizard({
  open,
  context,
  departments,
  initialParent,
  onCancel,
  onCreated,
  onFinished,
}: {
  open: boolean
  context: LaravelContext
  departments: Department[]
  /** Pre-selected parent when launched from "Add sub-department". */
  initialParent?: Department | null
  onCancel: () => void
  /** Fired after step 1, so the list picks up the new (inactive) department. */
  onCreated?: () => void
  onFinished: () => void
}) {
  const [step, setStep] = useState<WizardStep>(0)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState(initialParent?.id ?? '')
  const [created, setCreated] = useState<Department | null>(null)
  const [headName, setHeadName] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setStep(0)
    setName('')
    setCode('')
    setDescription('')
    setParentId(initialParent?.id ?? '')
    setCreated(null)
    setHeadName(null)
    setError('')
  }

  function cancel() {
    if (isSaving) return
    reset()
    onCancel()
  }

  /** Step 1 -> creates the real record, inactive. */
  async function createDepartment() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Department name is required.')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      const response = await organizationService.createDepartment(context, {
        department: trimmed,
        parent_id: parentId || undefined,
        code: code.trim(),
        description: description.trim(),
      })

      const newId = response?.data?.id
      if (!newId) throw new Error('The department was created but no id came back.')

      // Deliberately inactive until Finish.
      await organizationService.updateDepartment(context, String(newId), { status: 0 })

      const parent = departments.find((d) => d.id === parentId) ?? null
      setCreated({
        id: String(newId),
        name: trimmed,
        code: code.trim() || null,
        description: description.trim() || null,
        parentId: parentId || null,
        parent: parent?.name ?? null,
        hod: null,
        hodId: null,
        employees: 0,
        status: 'Inactive',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      })

      onCreated?.()
      setStep(1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create department.')
    } finally {
      setIsSaving(false)
    }
  }

  /** Final step -> activate. */
  async function finish() {
    if (!created) return
    setIsSaving(true)
    setError('')
    try {
      await organizationService.updateDepartment(context, created.id, { status: 1 })
      reset()
      onFinished()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to activate department.')
    } finally {
      setIsSaving(false)
    }
  }

  async function assignHead(employeeId: string, employeeName: string) {
    if (!created) return
    setIsSaving(true)
    setError('')
    try {
      await organizationService.setDepartmentHead(context, created.id, employeeId)
      setHeadName(employeeName)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to assign head of department.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) cancel() }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialParent ? `Add sub-department under ${initialParent.name}` : 'Create department'}
          </DialogTitle>
          <DialogDescription>{STEPS[step].hint}</DialogDescription>
        </DialogHeader>

        {/* Step rail. Completed steps are ticked; the rest are inert - you
            cannot skip ahead to a step that needs a department that does not
            exist yet. */}
        <ol className="flex flex-wrap items-center gap-1 text-xs">
          {STEPS.map((entry, index) => (
            <li key={entry.title} className="flex items-center gap-1">
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full text-[10px] font-semibold',
                  index < step && 'bg-success text-success-foreground',
                  index === step && 'bg-primary text-primary-foreground',
                  index > step && 'bg-muted text-muted-foreground',
                )}
              >
                {index < step ? <Check className="size-3" /> : index + 1}
              </span>
              <span className={cn(index === step ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                {entry.title}
              </span>
              {index < STEPS.length - 1 && <ChevronRight className="size-3 text-muted-foreground" />}
            </li>
          ))}
        </ol>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="min-h-[280px] py-2">
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="wizard-name" className="text-sm font-medium text-foreground">
                  Department name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="wizard-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Quality Assurance"
                  disabled={isSaving}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="wizard-code" className="text-sm font-medium text-foreground">
                  Code <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Input
                  id="wizard-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="e.g. ENG-QA"
                  maxLength={50}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="wizard-parent" className="text-sm font-medium text-foreground">
                  Parent department
                </label>
                {/* The old dialog had no parent selector at all - a parent
                    could only be set by launching "Add sub-department" from an
                    existing row. */}
                <SelectInput
                  id="wizard-parent"
                  value={parentId}
                  onChange={setParentId}
                  options={[
                    { value: '', label: 'None (top level)' },
                    ...departments
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((d) => ({ value: d.id, label: d.name })),
                  ]}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="wizard-description" className="text-sm font-medium text-foreground">
                  Description <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  id="wizard-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  disabled={isSaving}
                  placeholder="What this department is responsible for"
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          )}

          {step === 1 && created && (
            <HeadStep
              context={context}
              headName={headName}
              isSaving={isSaving}
              onAssign={assignHead}
            />
          )}

          {step === 2 && created && (
            <DepartmentJobRolesPanel
              department={created}
              context={context}
              canManage
            />
          )}

          {step === 3 && created && (
            <DepartmentEmployeesPanel
              department={created}
              departments={departments}
              context={context}
              canManage
              onChanged={onCreated}
            />
          )}

          {step === 4 && created && (
            <DocumentsStep department={created} context={context} />
          )}

          {step === 5 && created && (
            <dl className="space-y-3 text-sm">
              <ReviewRow label="Name" value={created.name} />
              <ReviewRow label="Code" value={created.code || '—'} />
              <ReviewRow label="Parent" value={created.parent ?? 'None (top level)'} />
              <ReviewRow label="Head of department" value={headName ?? 'Unassigned'} />
              <ReviewRow label="Description" value={created.description || '—'} />
              <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                This department is currently <strong>Inactive</strong>. Finishing will activate it and
                make it available across the application.
              </p>
            </dl>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={cancel} disabled={isSaving}>
            {created ? 'Finish later' : 'Cancel'}
          </Button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((s) => (s - 1) as WizardStep)}
                disabled={isSaving}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Back
              </Button>
            )}

            {step === 0 && (
              <Button type="button" onClick={() => void createDepartment()} disabled={isSaving || !name.trim()}>
                {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Save &amp; continue
              </Button>
            )}

            {step > 0 && step < 5 && (
              <Button type="button" onClick={() => setStep((s) => (s + 1) as WizardStep)} disabled={isSaving}>
                Next
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            )}

            {step === 5 && (
              <Button type="button" onClick={() => void finish()} disabled={isSaving}>
                {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Finish &amp; activate
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}

function HeadStep({
  context,
  headName,
  isSaving,
  onAssign,
}: {
  context: LaravelContext
  headName: string | null
  isSaving: boolean
  onAssign: (employeeId: string, employeeName: string) => void
}) {
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; sub: string }>>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    organizationService
      .getDepartmentCandidates(context, {})
      .then((response) => {
        if (cancelled) return
        setEmployees(
          (response?.data ?? []).map((employee) => ({
            id: String(employee.id),
            name:
              employee.name ||
              [employee.first_name, employee.last_name].filter(Boolean).join(' ') ||
              `Employee #${employee.id}`,
            sub: [employee.employee_no, employee.department_name].filter(Boolean).join(' · '),
          })),
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [context])

  const visible = employees.filter(
    (employee) =>
      !search.trim() ||
      employee.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      employee.sub.toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {headName ? (
          <>Head of department: <span className="font-medium text-foreground">{headName}</span></>
        ) : (
          'Optional — you can assign a head later from the department details panel.'
        )}
      </p>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search employees..."
        className="h-9"
      />
      <div className="max-h-56 overflow-y-auto rounded-md border border-border">
        {isLoading && <p className="p-3 text-sm text-muted-foreground">Loading employees...</p>}
        {!isLoading && visible.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">No employees found.</p>
        )}
        {visible.map((employee) => (
          <button
            key={employee.id}
            type="button"
            disabled={isSaving}
            onClick={() => onAssign(employee.id, employee.name)}
            className="flex w-full flex-col items-start border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-muted disabled:opacity-50"
          >
            <span className="font-medium text-foreground">{employee.name}</span>
            <span className="text-xs text-muted-foreground">{employee.sub || 'No department'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Step 4 reuses the very same tab components the details panel uses, so a
 * document added during setup and one added later go through identical code.
 */
function DocumentsStep({ department, context }: { department: Department; context: LaravelContext }) {
  const [tab, setTab] = useState<'sops' | 'policies' | 'rules'>('sops')

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-md bg-muted p-1">
        {(['sops', 'policies', 'rules'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              tab === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {key}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Optional — these can also be added at any time from the department details panel.
      </p>
      <div className="rounded-md border border-border">
        {tab === 'sops' && <SopsTab department={department} context={context} canManage />}
        {tab === 'policies' && <PoliciesTab department={department} context={context} canManage />}
        {tab === 'rules' && <RulesTab department={department} context={context} canManage />}
      </div>
    </div>
  )
}
