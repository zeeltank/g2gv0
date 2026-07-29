'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { readLaravelSession } from '@/lib/laravel-session'
import { recruitmentService } from '@/services/talent'
import type { JobPostingApi } from '@/types/recruitment'

interface Department { id: string; department: string }
interface JobRole { id: string; jobrole: string; department: string; description?: string }
interface JobRoleSkill { id: string; SkillName: string }
interface FormValues {
  title: string; department: string; location: string; employmentType: string
  experienceRequired: string; skillsRequired: string; educationRequirement: string
  certifications: string; jobDescription: string; salaryRangeMin: string
  salaryRangeMax: string; numberOfPositions: string; applicationDeadline: string
  urgency: string; benefits: string; status: string
}
type Errors = Partial<Record<keyof FormValues, string>>

const emptyForm: FormValues = {
  title: '', department: '', location: '', employmentType: '', experienceRequired: '',
  skillsRequired: '', educationRequirement: '', certifications: '', jobDescription: '',
  salaryRangeMin: '', salaryRangeMax: '', numberOfPositions: '1', applicationDeadline: '',
  urgency: '', benefits: '', status: 'active',
}

function flattenResponse(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flat().filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
}

export function JobPostingForm({
  editingJob, readOnly, onClose, onSaved,
}: {
  editingJob?: JobPostingApi | null
  readOnly?: boolean
  onClose: () => void
  onSaved: () => Promise<void> | void
}) {
  const router = useRouter()
  const [form, setForm] = useState<FormValues>(emptyForm)
  const [errors, setErrors] = useState<Errors>({})
  const [message, setMessage] = useState<string | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [roles, setRoles] = useState<JobRole[]>([])
  const [roleSkills, setRoleSkills] = useState<JobRoleSkill[]>([])
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [loadingDepartments, setLoadingDepartments] = useState(false)
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [loadingSkills, setLoadingSkills] = useState(false)
  const [saving, setSaving] = useState(false)

  const change = (field: keyof FormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    if (field === 'department' || field === 'title') {
      setSelectedSkills([])
      setForm((current) => ({ ...current, [field]: value, skillsRequired: '' }))
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      if (!editingJob) {
        setForm(emptyForm)
        setSelectedSkills([])
        return
      }
      const skills = (editingJob.skills ?? '').split(',').map((item) => item.trim()).filter(Boolean)
      setSelectedSkills(skills)
      setForm({
        title: editingJob.title ?? '', department: String(editingJob.department_id ?? ''),
        location: editingJob.location ?? '', employmentType: editingJob.employment_type ?? '',
        experienceRequired: editingJob.experience ?? '', skillsRequired: skills.join(', '),
        educationRequirement: editingJob.education ?? '', certifications: editingJob.certifications ?? '',
        jobDescription: editingJob.description ?? '', salaryRangeMin: String(editingJob.min_salary ?? ''),
        salaryRangeMax: String(editingJob.max_salary ?? ''), numberOfPositions: String(editingJob.positions ?? '1'),
        applicationDeadline: editingJob.deadline ?? editingJob.end_date ?? '',
        urgency: editingJob.priority_level ?? '', benefits: editingJob.benefits ?? '',
        status: editingJob.status ?? 'active',
      })
    })
  }, [editingJob])

  useEffect(() => {
    const session = readLaravelSession()
    if (!session?.APP_URL) return
    queueMicrotask(() => setLoadingDepartments(true))
    const params = new URLSearchParams({
      table: 's_user_jobrole',
      'filters[sub_institute_id]': String(session.sub_institute_id),
      'filters[industries]': session.org_type ?? '',
      group_by: 'department',
      'order_by[column]': 'department',
      'order_by[direction]': 'asc',
    })
    fetch(`${session.APP_URL}/table_data?${params}`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to fetch departments: ${response.status}`)
        const items = flattenResponse(await response.json())
        setDepartments(items.map((item, index) => ({
          id: String(item.department_id ?? item.id ?? index + 1),
          department: String(item.department ?? ''),
        })).filter((item) => item.department))
      })
      .catch((cause) => setMessage(cause instanceof Error ? cause.message : 'Failed to fetch departments.'))
      .finally(() => setLoadingDepartments(false))
  }, [])

  useEffect(() => {
    const session = readLaravelSession()
    const department = departments.find((item) => item.id === form.department)
    if (!session?.APP_URL || !department) return
    queueMicrotask(() => setLoadingRoles(true))
    const params = new URLSearchParams({
      table: 's_user_jobrole',
      'filters[sub_institute_id]': String(session.sub_institute_id),
      'filters[industries]': session.org_type ?? '',
      'filters[department]': department.department,
      group_by: 'jobrole',
      'order_by[column]': 'jobrole',
      'order_by[direction]': 'asc',
    })
    fetch(`${session.APP_URL}/table_data?${params}`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to fetch job roles: ${response.status}`)
        const items = flattenResponse(await response.json())
        const next = items.map((item, index) => ({
          id: String(item.id ?? index + 1), jobrole: String(item.jobrole ?? ''),
          department: String(item.department ?? department.department),
          description: String(item.description ?? ''),
        })).filter((item) => item.jobrole)
        setRoles(next)
        if (editingJob) {
          const match = next.find((item) => item.jobrole === editingJob.title)
          if (match) setForm((current) => ({ ...current, title: match.id }))
        }
      })
      .catch((cause) => setMessage(cause instanceof Error ? cause.message : 'Failed to fetch job roles.'))
      .finally(() => setLoadingRoles(false))
  }, [departments, editingJob, form.department])

  useEffect(() => {
    const session = readLaravelSession()
    const role = roles.find((item) => item.id === form.title)
    if (!session?.APP_URL || !role) return
    queueMicrotask(() => {
      if (!editingJob && role.description) setForm((current) => ({ ...current, jobDescription: role.description ?? '' }))
      setLoadingSkills(true)
    })
    const params = new URLSearchParams({
      type: 'API', token: session.token, sub_institute_id: String(session.sub_institute_id),
      org_type: session.org_type ?? '', jobrole: role.jobrole, formType: 'skills',
    })
    fetch(`${session.APP_URL}/jobrole_library/create?${params}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to fetch job role skills: ${response.status}`)
        const data = await response.json() as { userskillData?: Array<Record<string, unknown>> }
        const next = (data.userskillData ?? []).map((item, index) => {
          const raw = item.skillTitle
          const name = raw && typeof raw === 'object'
            ? String((raw as Record<string, unknown>).title ?? (raw as Record<string, unknown>).name ?? '')
            : String(raw ?? '')
          return { id: String(item.id ?? index), SkillName: name }
        }).filter((item) => item.SkillName)
        setRoleSkills(next)
        if (!editingJob && next.length) {
          const names = next.map((item) => item.SkillName)
          setSelectedSkills(names)
          setForm((current) => ({ ...current, skillsRequired: names.join(', ') }))
        }
      })
      .catch((cause) => setMessage(cause instanceof Error ? cause.message : 'Failed to fetch skills.'))
      .finally(() => setLoadingSkills(false))
  }, [editingJob, form.title, roles])

  function validate() {
    const next: Errors = {}
    if (!form.title) next.title = 'Job title is required'
    else {
      const title = roles.find((item) => item.id === form.title)?.jobrole ?? form.title
      if (title.length < 3) next.title = 'Job title must be at least 3 characters'
      else if (title.length > 100) next.title = 'Job title must be less than 100 characters'
    }
    if (!form.department) next.department = 'Department is required'
    if (!form.location.trim()) next.location = 'Location is required'
    if (!form.employmentType) next.employmentType = 'Employment type is required'
    if (!form.experienceRequired) next.experienceRequired = 'Experience requirement is required'
    if (!selectedSkills.length) next.skillsRequired = 'At least one skill is required'
    if (!form.educationRequirement) next.educationRequirement = 'Education requirement is required'
    if (!form.jobDescription.trim()) next.jobDescription = 'Job description is required'
    else if (form.jobDescription.length < 50) next.jobDescription = 'Job description must be at least 50 characters'
    else if (form.jobDescription.length > 5000) next.jobDescription = 'Job description must be less than 5000 characters'
    if (!form.salaryRangeMin.trim()) next.salaryRangeMin = 'Minimum salary is required'
    else if (Number.isNaN(Number(form.salaryRangeMin)) || Number(form.salaryRangeMin) < 0) next.salaryRangeMin = 'Minimum salary must be a valid number'
    if (!form.salaryRangeMax.trim()) next.salaryRangeMax = 'Maximum salary is required'
    else if (Number.isNaN(Number(form.salaryRangeMax)) || Number(form.salaryRangeMax) < 0) next.salaryRangeMax = 'Maximum salary must be a valid number'
    else if (Number(form.salaryRangeMin) > Number(form.salaryRangeMax)) next.salaryRangeMax = 'Maximum salary must be greater than minimum salary'
    if (!form.numberOfPositions.trim()) next.numberOfPositions = 'Number of positions is required'
    else if (Number.isNaN(Number(form.numberOfPositions)) || Number(form.numberOfPositions) < 1) next.numberOfPositions = 'Number of positions must be at least 1'
    if (!form.applicationDeadline) next.applicationDeadline = 'Application deadline is required'
    else {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      if (new Date(`${form.applicationDeadline}T00:00:00`) < today) next.applicationDeadline = 'Application deadline must be in the future'
    }
    if (!form.urgency) next.urgency = 'Priority level is required'
    if (!form.benefits.trim()) next.benefits = 'Benefits are required'
    else if (form.benefits.length < 10) next.benefits = 'Benefits must be at least 10 characters'
    setErrors(next)
    return !Object.keys(next).length
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!validate()) {
      setMessage('Please fix the errors in the form before submitting.')
      return
    }
    const session = readLaravelSession()
    if (!session) {
      setMessage('Session data not found. Please log in again.')
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const analysis = await recruitmentService.analyzeJobDescription(form.jobDescription)
      const data = new FormData()
      const role = roles.find((item) => item.id === form.title)
      Object.entries({
        department_id: form.department, user_id: String(session.user_id), location: form.location,
        employment_type: form.employmentType, title: role?.jobrole ?? form.title,
        experience: form.experienceRequired, education: form.educationRequirement,
        priority_level: form.urgency, positions: form.numberOfPositions,
        min_salary: form.salaryRangeMin, max_salary: form.salaryRangeMax,
        deadline: form.applicationDeadline, skills: selectedSkills.join(', '),
        certifications: form.certifications, benefits: form.benefits,
        description: form.jobDescription, status: form.status,
      }).forEach(([key, value]) => data.set(key, value))
      const result = editingJob
        ? await recruitmentService.updateJobForm(editingJob.id, data)
        : await recruitmentService.createJobForm(data)
      if (!editingJob) void recruitmentService.sendJobPostingWebhook(form, result.data, analysis)
      await onSaved()
      onClose()
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : `Failed to ${editingJob ? 'update' : 'create'} job posting`
      setMessage(raw.includes('No talent records found for this department')
        ? "Department validation failed. The selected department doesn't have any talent records. Please contact support."
        : raw)
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof FormValues, label: string, node: React.ReactNode, full = false) => (
    <div className={`space-y-2 ${full ? 'sm:col-span-2' : ''}`}>
      <label className="text-sm font-medium">{label} <span className="text-destructive">*</span></label>
      {node}
      {errors[key] && <p className="text-sm font-medium text-destructive">{errors[key]}</p>}
    </div>
  )

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      {message && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{message}</div>}
      <fieldset disabled={readOnly || saving} className="grid gap-4 sm:grid-cols-2">
        {field('department', 'Department', <Select value={form.department} onChange={(value) => change('department', value)} placeholder={loadingDepartments ? 'Loading departments...' : 'Select department'} options={departments.map((item) => ({ label: item.department, value: item.id }))} />)}
        {field('title', 'Job Title', <Select value={form.title} onChange={(value) => change('title', value)} disabled={!form.department} placeholder={loadingRoles ? 'Loading job roles...' : 'Select job title'} options={roles.map((item) => ({ label: item.jobrole, value: item.id }))} />)}
        <div className="sm:col-span-2"><Button type="button" variant="outline" size="sm" onClick={() => { onClose(); router.push('/content/Jobrole-library') }}>Add New Job Role</Button></div>
        {field('location', 'Location', <Input value={form.location} onChange={(e) => change('location', e.target.value)} placeholder="Enter job location" />)}
        {field('employmentType', 'Employment Type', <Select value={form.employmentType} onChange={(v) => change('employmentType', v)} placeholder="Select employment type" options={['Full-Time', 'Part-Time', 'Contract', 'Temporary', 'Internship'].map((v) => ({ label: v, value: v }))} />)}
        {field('experienceRequired', 'Experience Required', <Select value={form.experienceRequired} onChange={(v) => change('experienceRequired', v)} placeholder="Select experience level" options={['Entry Level (0-2 years)', 'Mid Level (3-5 years)', 'Senior Level (6-10 years)', 'Lead Level (10+ years)'].map((v) => ({ label: v, value: v }))} />)}
        {field('educationRequirement', 'Education Requirement', <Select value={form.educationRequirement} onChange={(v) => change('educationRequirement', v)} placeholder="Select education level" options={['High School Diploma', 'Associate Degree', "Bachelor's Degree", "Master's Degree", 'PhD', 'Not Required'].map((v) => ({ label: v, value: v }))} />)}
        {field('urgency', 'Priority Level', <Select value={form.urgency} onChange={(v) => change('urgency', v)} placeholder="Select priority" options={['High', 'Medium', 'Low'].map((v) => ({ label: v, value: v }))} />)}
        {field('numberOfPositions', 'Number of Positions', <Input type="number" min={1} value={form.numberOfPositions} onChange={(e) => change('numberOfPositions', e.target.value)} />)}
        {field('salaryRangeMin', 'Minimum Salary', <Input type="number" min={0} placeholder="e.g., 80000" value={form.salaryRangeMin} onChange={(e) => change('salaryRangeMin', e.target.value)} />)}
        {field('salaryRangeMax', 'Maximum Salary', <Input type="number" min={0} placeholder="e.g., 120000" value={form.salaryRangeMax} onChange={(e) => change('salaryRangeMax', e.target.value)} />)}
        {field('applicationDeadline', 'Application Deadline', <Input type="date" value={form.applicationDeadline} onChange={(e) => change('applicationDeadline', e.target.value)} />)}
        {editingJob && field('status', 'Status', <Select value={form.status} onChange={(v) => change('status', v)} options={[{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }, { label: 'Draft', value: 'draft' }]} />)}
        {field('skillsRequired', 'Required Skills', <div className="space-y-3">
          {!!selectedSkills.length && <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-3">{selectedSkills.map((skill) => <Badge key={skill} variant="secondary">{skill}<button type="button" aria-label={`Remove ${skill}`} onClick={() => { const next = selectedSkills.filter((item) => item !== skill); setSelectedSkills(next); setForm((current) => ({ ...current, skillsRequired: next.join(', ') })) }}><X className="ml-1 size-3" /></button></Badge>)}</div>}
          <Select placeholder={loadingSkills ? 'Loading skills...' : 'Select a skill to add'} options={roleSkills.filter((item) => !selectedSkills.includes(item.SkillName)).map((item) => ({ label: item.SkillName, value: item.SkillName }))} onChange={(skill) => { const next = [...selectedSkills, skill]; setSelectedSkills(next); change('skillsRequired', next.join(', ')) }} />
        </div>, true)}
        <div className="space-y-2 sm:col-span-2"><label className="text-sm font-medium">Certifications</label><Input value={form.certifications} onChange={(e) => change('certifications', e.target.value)} placeholder="Enter required certifications" /></div>
        {field('jobDescription', 'Job Description', <div><Textarea rows={8} maxLength={5000} value={form.jobDescription} onChange={(e) => change('jobDescription', e.target.value)} placeholder="Describe responsibilities and requirements" /><p className="mt-1 text-right text-xs text-muted-foreground">{form.jobDescription.length}/5000 characters</p></div>, true)}
        {field('benefits', 'Benefits', <Textarea rows={4} value={form.benefits} onChange={(e) => change('benefits', e.target.value)} placeholder="Describe compensation and benefits" />, true)}
      </fieldset>
      <div className="flex justify-end gap-3 border-t pt-5">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        {!readOnly && <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingJob ? 'Update Job Posting' : 'Create Job Posting'}</Button>}
      </div>
    </form>
  )
}
