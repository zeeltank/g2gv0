'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { getLaravelContext } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import type { ProjectOptions, ProjectPayload, ProjectRecord, ProjectStatus } from '@/types/task-management'

interface Props {
  isOpen: boolean
  onClose: () => void
  options: ProjectOptions
  project?: ProjectRecord | null
  onSaved: (message: string) => void
}

const EMPTY: ProjectPayload = {
  name: '', category: '', description: '', department_id: '', sponsor_id: '', manager_id: '',
  team_size: '1-5', member_ids: [], priority: 'Medium', status: 'PLANNING',
  start_date: '', due_date: '', budget_estimate: '', client_name: '', regulatory_flags: [],
}

export function CreateProjectModal({ isOpen, onClose, options, project, onSaved }: Props) {
  const [form, setForm] = useState<ProjectPayload>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setError('')
    setForm(project ? {
      name: project.name, category: project.category ?? '', description: project.description,
      department_id: project.department_id ?? '', sponsor_id: project.sponsor_id ?? '',
      manager_id: project.manager_id ?? '', team_size: project.team_size ?? '1-5',
      member_ids: project.members?.map((member) => member.id) ?? [], priority: project.priority,
      status: project.status, start_date: project.start_date ?? '', due_date: project.due_date ?? '',
      budget_estimate: project.budget_estimate ?? '', client_name: project.client_name ?? '',
      regulatory_flags: project.regulatory_flags,
    } : EMPTY)
  }, [isOpen, project])

  const set = <K extends keyof ProjectPayload>(key: K, value: ProjectPayload[K]) => setForm((current) => ({ ...current, [key]: value }))

  async function submit() {
    if (!form.name.trim() || !form.description.trim() || !form.manager_id || !form.start_date || !form.due_date) {
      setError('Name, description, project manager, start date, and due date are required.')
      return
    }
    setSaving(true); setError('')
    try {
      const context = getLaravelContext()
      const response = project
        ? await taskService.updateProjectRecord(context, project.id, form)
        : await taskService.createProjectRecord(context, form)
      onSaved(response.message); onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save project.')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{project ? 'Edit Project' : 'Initiate New Project'}</DialogTitle>
          <DialogDescription>Define project governance, scope, team, timeline, and compliance.</DialogDescription>
        </DialogHeader>
        {error && <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</div>}
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <Field label="Project Name *"><Input value={form.name} onChange={(value) => set('name', value)} /></Field>
          <Field label="Category"><Select value={form.category ?? ''} onChange={(value) => set('category', value)} options={options.categories.map((value) => ({ value, label: categoryLabel(value) }))} /></Field>
          <Field label="Description *" wide><textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="min-h-24 w-full rounded-lg border bg-background p-3 text-sm" /></Field>
          <Field label="Department"><Select value={form.department_id ?? ''} onChange={(value) => set('department_id', value)} options={options.departments.map((item) => ({ value: String(item.id), label: item.name }))} placeholder="Select department" /></Field>
          <Field label="Project Manager *"><Select value={form.manager_id} onChange={(value) => set('manager_id', value)} options={options.users.map((item) => ({ value: String(item.id), label: item.name }))} /></Field>
          <Field label="Sponsor"><Select value={form.sponsor_id ?? ''} onChange={(value) => set('sponsor_id', value)} options={options.users.map((item) => ({ value: String(item.id), label: item.name }))} placeholder="Select sponsor" /></Field>
          <Field label="Team Size"><Select value={form.team_size ?? '1-5'} onChange={(value) => set('team_size', value)} options={['1-5','6-10','11-25','26-50','50+'].map((value) => ({ value, label: value }))} /></Field>
          <Field label="Priority"><Select value={form.priority} onChange={(value) => set('priority', value as ProjectPayload['priority'])} options={options.priorities.map((value) => ({ value, label: value }))} /></Field>
          {project && <Field label="Status"><Select value={form.status ?? 'PLANNING'} onChange={(value) => set('status', value as ProjectStatus)} options={options.statuses.filter((value) => value !== 'ARCHIVED').map((value) => ({ value, label: value }))} /></Field>}
          <Field label="Start Date *"><Input type="date" value={form.start_date} onChange={(value) => set('start_date', value)} /></Field>
          <Field label="Due Date *"><Input type="date" value={form.due_date} onChange={(value) => set('due_date', value)} /></Field>
          <Field label="Budget Estimate"><Input type="number" value={form.budget_estimate ?? ''} onChange={(value) => set('budget_estimate', value)} /></Field>
          <Field label="Client Name"><Input value={form.client_name ?? ''} onChange={(value) => set('client_name', value)} /></Field>
          <Field label="Team Members" wide>
            <div className="grid max-h-36 grid-cols-2 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-3">
              {options.users.map((user) => <label key={user.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.member_ids.includes(String(user.id))} onChange={(e) => set('member_ids', e.target.checked ? [...form.member_ids, String(user.id)] : form.member_ids.filter((id) => id !== String(user.id)))} />{user.name}</label>)}
            </div>
          </Field>
          <Field label="Compliance Flags" wide>
            <div className="flex flex-wrap gap-3">{['SOC2','GDPR','HIPAA','ISO27001'].map((flag) => <label key={flag} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.regulatory_flags.includes(flag)} onChange={(e) => set('regulatory_flags', e.target.checked ? [...form.regulatory_flags, flag] : form.regulatory_flags.filter((value) => value !== flag))} />{flag}</label>)}</div>
          </Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : project ? 'Save Changes' : 'Create Project'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? 'sm:col-span-2' : ''}><span className="mb-1.5 block text-sm font-medium">{label}</span>{children}</label>
}
function Input({ value, onChange, type = 'text' }: { value: string; onChange: (value: string) => void; type?: string }) {
  return <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" />
}
function categoryLabel(value: string) { return value.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
