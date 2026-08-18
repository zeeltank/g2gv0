'use client'

import { useState } from 'react'
import { ArrowRight, Briefcase, Building, Calendar as CalendarIcon, CheckCircle2, DollarSign, FileText, ShieldCheck, Target, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { getLaravelContext } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import type { ProjectOptions, ProjectPayload, ProjectRecord, ProjectStatus } from '@/types/task-management'
import { PriorityBadge } from './priority-badge'

interface Props {
  isOpen: boolean
  onClose: () => void
  options: ProjectOptions
  project?: ProjectRecord | null
  onSaved: (message: string) => void
}
type WizardStep = 1 | 2 | 3 | 4

const EMPTY: ProjectPayload = {
  name: '', category: '', description: '', department_id: '', sponsor_id: '', manager_id: '',
  team_size: '1-5', member_ids: [], priority: 'Medium', status: 'PLANNING',
  start_date: '', due_date: '', budget_estimate: '', client_name: '', regulatory_flags: [],
}
const complianceFlags = [
  { id: 'HIPAA', label: 'HIPAA (Healthcare)' }, { id: 'SOC2', label: 'SOC2 / ISO27001 (IT)' },
  { id: 'SEC', label: 'SEC / FINRA (Finance)' }, { id: 'GDPR', label: 'GDPR / CCPA (Data)' },
  { id: 'OSHA', label: 'OSHA (Real Estate/Const.)' }, { id: 'INTERNAL', label: 'Internal Only (No external risk)' },
]

export function CreateProjectModal({ isOpen, onClose, options, project, onSaved }: Props) {
  const [step, setStep] = useState<WizardStep>(1)
  const [form, setForm] = useState<ProjectPayload>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Seeded during render, keyed on open + which project is being edited:
  // re-opening (or switching projects) re-seeds, while the user's in-progress
  // edits are never overwritten by a re-render.
  const seedKey = isOpen ? (project?.id ?? 'new') : null
  const [lastSeedKey, setLastSeedKey] = useState<string | null>(null)

  if (seedKey !== lastSeedKey) {
    setLastSeedKey(seedKey)
    if (seedKey !== null) seedForm()
  }

  function seedForm() {
    setStep(1); setError('')
    setForm(project ? {
      name: project.name, category: project.category ?? '', description: project.description,
      department_id: project.department_id ?? '', sponsor_id: project.sponsor_id ?? '',
      manager_id: project.manager_id ?? '', team_size: project.team_size ?? '1-5',
      member_ids: project.members?.map((member) => String(member.id)) ?? [], priority: project.priority,
      status: project.status, start_date: project.start_date ?? '', due_date: project.due_date ?? '',
      budget_estimate: project.budget_estimate ?? '', client_name: project.client_name ?? '',
      regulatory_flags: project.regulatory_flags,
    } : { ...EMPTY, member_ids: [], regulatory_flags: [] })
  }

  const set = <K extends keyof ProjectPayload>(key: K, value: ProjectPayload[K]) => setForm((current) => ({ ...current, [key]: value }))
  const close = () => { setStep(1); setError(''); onClose() }
  const next = () => {
    if (step === 1 && (!form.name.trim() || !form.description.trim())) { setError('Project name and executive summary are required.'); return }
    if (step === 2 && !form.manager_id) { setError('Select a project manager before continuing.'); return }
    if (step === 3 && (!form.start_date || !form.due_date)) { setError('Start date and target end date are required.'); return }
    if (step === 3 && form.due_date < form.start_date) { setError('Target end date cannot be earlier than the start date.'); return }
    setError(''); if (step < 4) setStep((step + 1) as WizardStep)
  }
  async function submit() {
    if (!form.name.trim() || !form.description.trim() || !form.manager_id || !form.start_date || !form.due_date) {
      setError('Name, description, project manager, start date, and due date are required.'); return
    }
    setSaving(true); setError('')
    try {
      const response = project
        ? await taskService.updateProjectRecord(getLaravelContext(), project.id, form)
        : await taskService.createProjectRecord(getLaravelContext(), form)
      onSaved(response.message); close()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save project.') }
    finally { setSaving(false) }
  }

  const memberOptions = options.users.filter((user) => !form.member_ids.includes(String(user.id)))
  return <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
    <DialogContent className="flex h-[min(90vh,760px)] max-h-[90vh] flex-col overflow-hidden rounded-2xl border-primary/20 bg-card/95 p-0 shadow-2xl backdrop-blur-3xl sm:max-w-[700px]">
      <div className="shrink-0 border-b border-primary/10 bg-gradient-to-r from-primary/10 via-background to-background p-5 sm:p-6">
        <DialogHeader><DialogTitle className="flex items-center gap-2 text-2xl font-bold"><Briefcase className="size-6 text-primary" />{project ? 'Edit Project' : 'Initiate New Project'}</DialogTitle><DialogDescription>Define cross-functional parameters, governance, and scope for your initiative.</DialogDescription></DialogHeader>
        <div className="mt-6 flex items-center gap-2">{[
          { num: 1, label: 'Basics', icon: FileText }, { num: 2, label: 'Governance', icon: Users },
          { num: 3, label: 'Timeline & Scope', icon: Target }, { num: 4, label: 'Compliance', icon: ShieldCheck },
        ].map((item) => <div key={item.num} className="contents"><button type="button" onClick={() => item.num < step && setStep(item.num as WizardStep)} className={cn('flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold transition', step === item.num ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : step > item.num ? 'bg-primary/20 text-primary' : 'text-muted-foreground')}><item.icon className="size-4" /><span className="hidden md:inline">{item.label}</span></button>{item.num < 4 && <div className={cn('h-0.5 flex-1 rounded-full', step > item.num ? 'bg-primary/40' : 'bg-primary/10')} />}</div>)}</div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
        {error && <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</div>}
        <div className="min-h-[310px] animate-in fade-in slide-in-from-right-4">
          {step === 1 && <div className="space-y-5">
            <Field label="Project Name *"><Input autoFocus value={form.name} onChange={(value) => set('name', value)} placeholder="e.g., Q3 Enterprise Deployment" /></Field>
            <Field label="Domain / Category"><Select value={form.category ?? ''} onChange={(value) => set('category', value)} options={options.categories.map((value) => ({ value, label: categoryLabel(value) }))} placeholder="Select category" className="h-11 rounded-xl" /></Field>
            <Field label="Executive Summary *"><textarea value={form.description} onChange={(event) => set('description', event.target.value)} placeholder="Briefly describe the business case and core objectives..." className="h-24 w-full resize-none rounded-xl border border-input bg-background/50 p-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></Field>
          </div>}

          {step === 2 && <div className="space-y-5">
            <Field label={<><Building className="size-4" />Primary Department</>}><Select value={form.department_id ?? ''} onChange={(value) => set('department_id', value)} options={uniqueDepartments(options.departments, form.department_id ?? '').map((item) => ({ value: String(item.id), label: item.name }))} placeholder="Select department" className="h-11 rounded-xl" /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Project Manager (Lead) *"><Select value={form.manager_id} onChange={(value) => set('manager_id', value)} options={options.users.map((item) => ({ value: String(item.id), label: item.name }))} placeholder="Select manager" className="h-11 rounded-xl" /></Field><Field label="Executive Sponsor"><Select value={form.sponsor_id ?? ''} onChange={(value) => set('sponsor_id', value)} options={options.users.map((item) => ({ value: String(item.id), label: item.name }))} placeholder="Select sponsor" className="h-11 rounded-xl" /></Field></div>
            <Field label="Expected Team Size"><div className="flex flex-wrap gap-2">{['1-5','6-10','11-25','26-50','50+'].map((size) => <Button type="button" variant="ghost" key={size} onClick={() => set('team_size', size)} className={cn('rounded-xl border px-4 py-2 text-sm', form.team_size === size ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-background/50 text-muted-foreground')}>{size}</Button>)}</div></Field>
            <Field label="Assign Core Team Members"><Select value="" onChange={(value) => value && set('member_ids', [...form.member_ids, value])} options={[{ value: '', label: 'Select an employee...' }, ...memberOptions.map((user) => ({ value: String(user.id), label: user.name }))]} className="h-11 rounded-xl" />
              {!!form.member_ids.length && <div className="mt-3 flex flex-wrap gap-2">{form.member_ids.map((id) => <span key={id} className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">{options.users.find((user) => String(user.id) === id)?.name ?? id}<button type="button" onClick={() => set('member_ids', form.member_ids.filter((value) => value !== id))} className="rounded-full p-0.5 hover:bg-primary/20"><X className="size-3.5" /></button></span>)}</div>}
            </Field>
          </div>}

          {step === 3 && <div className="space-y-5">
            <Field label="Strategic Priority"><div className="grid grid-cols-3 gap-3">{(['High','Medium','Low'] as const).map((priority) => <Button type="button" variant="ghost" key={priority} onClick={() => set('priority', priority)} className={cn('rounded-xl border-2 px-4 py-3 text-sm font-bold', form.priority === priority ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-transparent bg-background/50 text-muted-foreground hover:bg-muted')}><PriorityBadge priority={priority} /></Button>)}</div></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label={<><CalendarIcon className="size-4" />Start Date *</>}><DatePicker value={form.start_date} onChange={(value) => set('start_date', typeof value === 'string' ? value : value?.toISOString().slice(0, 10) ?? '')} placeholder="Select start date" /></Field><Field label={<><CalendarIcon className="size-4" />Target End Date *</>}><DatePicker value={form.due_date} onChange={(value) => set('due_date', typeof value === 'string' ? value : value?.toISOString().slice(0, 10) ?? '')} placeholder="Select target date" /></Field></div>
            <Field label={<><DollarSign className="size-4" />Budget Estimate (Optional)</>}><Input type="number" value={form.budget_estimate ?? ''} onChange={(value) => set('budget_estimate', value)} placeholder="0.00" /></Field>
          </div>}

          {step === 4 && <div className="space-y-5">
            <Field label="External Stakeholder / Client (Optional)"><Input value={form.client_name ?? ''} onChange={(value) => set('client_name', value)} placeholder="e.g., Acme Corp or State Health Dept" /></Field>
            {project && <Field label="Project Status"><div className="flex items-center gap-3"><div className="flex-1"><Select value={form.status ?? 'PLANNING'} onChange={(value) => set('status', value as ProjectStatus)} options={options.statuses.filter((value) => value !== 'ARCHIVED').map((value) => ({ value, label: value }))} className="h-11 rounded-xl" /></div><StatusBadge status={form.status ?? 'PLANNING'} /></div></Field>}
            <Field label="Compliance & Regulatory Constraints"><div className="grid gap-3 sm:grid-cols-2">{complianceFlags.map((flag) => { const selected = form.regulatory_flags.includes(flag.id); return <button type="button" key={flag.id} onClick={() => set('regulatory_flags', selected ? form.regulatory_flags.filter((value) => value !== flag.id) : [...form.regulatory_flags, flag.id])} className={cn('flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-medium', selected ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-background/50 text-muted-foreground hover:bg-muted')}><span className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border', selected ? 'border-primary bg-primary' : 'border-muted-foreground')}>{selected && <CheckCircle2 className="size-3 text-primary-foreground" />}</span>{flag.label}</button> })}</div></Field>
            <div className="rounded-xl border border-border/50 bg-muted/50 p-4 text-sm text-muted-foreground">Project workspaces and governance settings will be provisioned using the selected domain and compliance flags.</div>
          </div>}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border/50 bg-card/95 p-4 sm:p-5"><Button variant="ghost" onClick={close} className="text-muted-foreground">Cancel</Button><div className="flex gap-2 sm:gap-3">{step > 1 && <Button variant="outline" onClick={() => { setError(''); setStep((step - 1) as WizardStep) }} className="rounded-xl px-4 sm:px-6">Back</Button>}{step < 4 ? <Button onClick={next} className="rounded-xl px-4 shadow-lg shadow-primary/20 sm:px-6">Continue<ArrowRight className="ml-2 size-4" /></Button> : <Button onClick={() => void submit()} disabled={saving} className="rounded-xl px-4 shadow-lg shadow-primary/20 sm:px-6"><CheckCircle2 className="mr-2 size-4" />{saving ? 'Saving…' : project ? 'Save Changes' : 'Finalize Project'}</Button>}</div></div>
    </DialogContent>
  </Dialog>
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 flex items-center gap-2 text-sm font-semibold">{label}</span>{children}</label>
}
function Input({ value, onChange, type = 'text', placeholder, autoFocus }: { value: string; onChange: (value: string) => void; type?: string; placeholder?: string; autoFocus?: boolean }) {
  return <input autoFocus={autoFocus} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background/50 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
}
function categoryLabel(value: string) { return value.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function uniqueDepartments(departments: ProjectOptions['departments'], selectedId: string) {
  const selected = departments.find((item) => String(item.id) === selectedId)
  const byName = new Map<string, ProjectOptions['departments'][number]>()
  for (const department of departments) {
    const key = department.name.trim().toLocaleLowerCase()
    if (!byName.has(key) || String(department.id) === selectedId) byName.set(key, department)
  }
  if (selected) byName.set(selected.name.trim().toLocaleLowerCase(), selected)
  return Array.from(byName.values())
}
