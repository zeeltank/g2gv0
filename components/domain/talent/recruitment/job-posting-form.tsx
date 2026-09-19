'use client'

import { useEffect, useState } from 'react'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { CAPABILITY_LIBRARY_ACCESS_LINK } from '@/lib/gtg-navigation'

import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  WORK_MODES,
  asOptions,
} from '@/lib/recruitment-vocabulary'
import { Textarea } from '@/components/ui/textarea'
import { readLaravelSession } from '@/lib/laravel-session'
import { recruitmentService } from '@/services/talent'
import type { JobPostingApi } from '@/types/recruitment'

interface Department { id: string; department: string }
interface JobRole { id: string; jobrole: string; department: string; description?: string }
interface JobRoleSkill { id: string; SkillName: string }
interface FormValues {
  title: string; department: string; location: string; employmentType: string; workMode: string
  experienceRequired: string; skillsRequired: string; educationRequirement: string
  certifications: string; jobDescription: string; salaryRangeMin: string
  salaryRangeMax: string; numberOfPositions: string; openingDate: string; applicationDeadline: string
  urgency: string; benefits: string; status: string
}
type Errors = Partial<Record<keyof FormValues, string>>

const emptyForm: FormValues = {
  title: '', department: '', location: '', employmentType: '', workMode: '', experienceRequired: '',
  skillsRequired: '', educationRequirement: '', certifications: '', jobDescription: '',
  salaryRangeMin: '', salaryRangeMax: '', numberOfPositions: '1', openingDate: '', applicationDeadline: '',
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
  const { resolveAccessLink } = useSidebarNavigation()
  const [form, setForm] = useState<FormValues>(emptyForm)
  const [errors, setErrors] = useState<Errors>({})
  const [message, setMessage] = useState<string | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [roles, setRoles] = useState<JobRole[]>([])
  const [roleSkills, setRoleSkills] = useState<JobRoleSkill[]>([])
  /*
   * EVERY SKILL THIS ORGANISATION HAS, not only the ones already mapped to the
   * chosen role.
   *
   * The dropdown read s_user_skill_jobrole - the skill-to-ROLE mapping - so a
   * skill added to the library but never mapped simply was not there. 116 of
   * tenant 6's 268 roles have no mapping at all, so for 43% of roles the
   * dropdown was empty and looked broken. Reported exactly that way: "I added
   * the skill for that role but it is not showing".
   */
  const [librarySkills, setLibrarySkills] = useState<JobRoleSkill[]>([])
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
        workMode: editingJob.work_mode ?? '',
        experienceRequired: editingJob.experience ?? '', skillsRequired: skills.join(', '),
        educationRequirement: editingJob.education ?? '', certifications: editingJob.certifications ?? '',
        jobDescription: editingJob.description ?? '', salaryRangeMin: String(editingJob.min_salary ?? ''),
        salaryRangeMax: String(editingJob.max_salary ?? ''), numberOfPositions: String(editingJob.positions ?? '1'),
        openingDate: editingJob.start_date ?? '',
        applicationDeadline: editingJob.deadline ?? editingJob.end_date ?? '',
        urgency: editingJob.priority_level ?? '', benefits: editingJob.benefits ?? '',
        status: editingJob.status ?? 'active',
      })
    })
  }, [editingJob])

  // The tenant's own skill library. Same table_data call the departments and
  // roles above use, so there is one way this form reads reference data.
  useEffect(() => {
    const session = readLaravelSession()
    if (!session?.APP_URL) return
    const params = new URLSearchParams({
      table: 's_users_skills',
      'filters[sub_institute_id]': String(session.sub_institute_id),
      'order_by[column]': 'title',
      'order_by[direction]': 'asc',
    })
    fetch(`${session.APP_URL}/table_data?${params}`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to fetch the skill library: ${response.status}`)
        const items = flattenResponse(await response.json())
        setLibrarySkills(
          items
            .map((item, index) => ({ id: String(item.id ?? index), SkillName: String(item.title ?? '') }))
            .filter((item) => item.SkillName),
        )
      })
      // A missing library must not block the form; the role's own skills still show.
      .catch(() => setLibrarySkills([]))
  }, [])

  useEffect(() => {
    const session = readLaravelSession()
    if (!session?.APP_URL) return
    queueMicrotask(() => setLoadingDepartments(true))
    /*
     * SCOPED TO THE ORGANISATION'S INDUSTRY, deliberately.
     *
     * An organisation sees the departments of its own industry and no others -
     * tenant 6 is Information Technology, so it gets those four and not the
     * Infocomm Technology ones sitting in the same table.
     *
     * The one thing to know when a department looks absent: `industries` is a
     * property of each ROLE, not of the department, and the same department can
     * hold roles under both labels. On tenant 6, Development has 93 roles under
     * Information Technology and 8 under Infocomm Technology; Sales and
     * Marketing is 13 and 11. A department therefore appears as soon as ONE of
     * its roles matches, while the role picker below shows only the matching
     * ones - so a role can be missing from a department that is present.
     *
     * `org_type` empty is NOT the same as unfiltered: the endpoint matches it as
     * a literal empty string and returns nothing, which is why the parameter is
     * omitted rather than sent blank.
     */
    const params = new URLSearchParams({
      table: 's_user_jobrole',
      'filters[sub_institute_id]': String(session.sub_institute_id),
      group_by: 'department',
      'order_by[column]': 'department',
      'order_by[direction]': 'asc',
    })
    if (session.org_type) params.set('filters[industries]', session.org_type)
    fetch(`${session.APP_URL}/table_data?${params}`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to fetch departments: ${response.status}`)
        const items = flattenResponse(await response.json())
        /*
         * KNOWN WRONG, DELIBERATELY UNCHANGED - see the note below.
         *
         * `item.id` is the s_user_jobrole row id, not a department id, so when a
         * role carries no department_id this sends a job-role id as the
         * posting's department_id. That is 29 of the 36 department groups on
         * tenant 6: they have a department NAME but no row in hrms_departments
         * and no department_id on the role, so no correct id exists to send.
         *
         * Sending null instead is not an option today: store() validates
         * department_id as `required|integer`, so 29 of 36 departments would
         * stop being able to create a posting at all. Fixing it properly means
         * deciding which table owns departments and reconciling the two, which
         * is a data decision, not a dropdown one. Left as it was, and reported.
         */
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
    // Same scope as the department lookup above, and omitted rather than sent
    // blank for the same reason: an empty value matches the empty string and
    // returns nothing at all.
    const params = new URLSearchParams({
      table: 's_user_jobrole',
      'filters[sub_institute_id]': String(session.sub_institute_id),
      'filters[department]': department.department,
      group_by: 'jobrole',
      'order_by[column]': 'jobrole',
      'order_by[direction]': 'asc',
    })
    if (session.org_type) params.set('filters[industries]', session.org_type)
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

  /*
   * ONLY THE JOB TITLE IS REQUIRED.
   *
   * Every other field was mandatory - department, location, employment type,
   * experience, at least one skill, education, a 50-character description, both
   * salary bounds, positions, a future deadline and a priority. Eleven gates on
   * a form whose own table allows NULL on all of them, so none of it was
   * protecting the database; it was protecting nothing and stopping HR from
   * saving a posting they had not finished writing.
   *
   * `title` stays because the column is NOT NULL with no default - MySQL
   * rejects the row - and a posting nobody can name cannot be advertised.
   *
   * What remains below are CONSISTENCY checks, not presence checks: a value
   * that is there must make sense. Nothing fires on an empty field.
   */
  function validate() {
    const next: Errors = {}

    if (!form.title) next.title = 'Job title is required'
    else {
      const title = roles.find((item) => item.id === form.title)?.jobrole ?? form.title
      if (title.length < 3) next.title = 'Job title must be at least 3 characters'
      else if (title.length > 100) next.title = 'Job title must be less than 100 characters'
    }

    if (form.jobDescription.trim() && form.jobDescription.length > 5000) {
      next.jobDescription = 'Job description must be less than 5000 characters'
    }

    if (form.salaryRangeMin.trim() && (Number.isNaN(Number(form.salaryRangeMin)) || Number(form.salaryRangeMin) < 0)) {
      next.salaryRangeMin = 'Minimum salary must be a valid number'
    }
    if (form.salaryRangeMax.trim() && (Number.isNaN(Number(form.salaryRangeMax)) || Number(form.salaryRangeMax) < 0)) {
      next.salaryRangeMax = 'Maximum salary must be a valid number'
    }
    if (form.salaryRangeMin.trim() && form.salaryRangeMax.trim()
      && Number(form.salaryRangeMin) > Number(form.salaryRangeMax)) {
      next.salaryRangeMax = 'Maximum salary must be greater than minimum salary'
    }

    if (form.numberOfPositions.trim()
      && (Number.isNaN(Number(form.numberOfPositions)) || Number(form.numberOfPositions) < 1)) {
      next.numberOfPositions = 'Number of positions must be at least 1'
    }

    // The window still has to run forwards if both ends are given.
    if (form.openingDate && form.applicationDeadline
      && new Date(`${form.openingDate}T00:00:00`) > new Date(`${form.applicationDeadline}T00:00:00`)) {
      next.openingDate = 'Applications cannot open after they close'
    }

    /*
     * A deadline already past is still refused - not because the field is
     * required, but because a posting that closed yesterday cannot be applied
     * to, and saving one silently is worse than saying so.
     */
    if (form.applicationDeadline) {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      if (new Date(`${form.applicationDeadline}T00:00:00`) < today) {
        next.applicationDeadline = 'Application deadline must be in the future'
      }
    }
    // Benefits are OPTIONAL. Plenty of openings are posted before the package is
    // settled, and blocking the whole posting on a field the backend already
    // accepts as nullable helped nobody.
    if (form.benefits.trim() && form.benefits.trim().length < 10) {
      next.benefits = 'Either leave benefits blank or write at least 10 characters'
    }
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
        employment_type: form.employmentType, work_mode: form.workMode,
        title: role?.jobrole ?? form.title,
        experience: form.experienceRequired, education: form.educationRequirement,
        priority_level: form.urgency, positions: form.numberOfPositions,
        min_salary: form.salaryRangeMin, max_salary: form.salaryRangeMax,
        // Empty string, not null: this becomes FormData, which takes no nulls.
        // The controller uses $request->filled(), so '' is stored as NULL.
        start_date: form.openingDate,
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

  /*
   * The asterisk is now a fact, not decoration. Every field rendered through
   * here used to carry one unconditionally, so Benefits looked mandatory - and
   * was, in the validator - while Certifications beside it was optional and
   * rendered without `field()` entirely just to avoid the star.
   */
  /*
   * OPTIONAL IS THE DEFAULT.
   *
   * Every field rendered through here used to carry a red asterisk, and after
   * validate() was relaxed that asterisk would have been a lie on sixteen of
   * seventeen fields. Flipping the default is one change that cannot miss a
   * call site, where editing each one could - only `title` now opts back in,
   * and it is the single field the database itself insists on.
   */
  /** The one field the column itself requires - NOT NULL, no default. */
  const fieldRequired = (key: keyof FormValues, label: string, node: React.ReactNode, full = false) =>
    field(key, label, node, full, false)

  const field = (
    key: keyof FormValues,
    label: string,
    node: React.ReactNode,
    full = false,
    optional = true,
  ) => (
    <div className={`space-y-2 ${full ? 'sm:col-span-2' : ''}`}>
      <label className="text-sm font-medium">
        {label}{' '}
        {optional
          ? <span className="font-normal text-muted-foreground">(optional)</span>
          : <span className="text-destructive">*</span>}
      </label>
      {node}
      {errors[key] && <p className="text-sm font-medium text-destructive">{errors[key]}</p>}
    </div>
  )

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      {message && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{message}</div>}
      <fieldset disabled={readOnly || saving} className="grid gap-4 sm:grid-cols-2">
        {field('department', 'Department', <Select value={form.department} onChange={(value) => change('department', value)} placeholder={loadingDepartments ? 'Loading departments...' : 'Select department'} options={departments.map((item) => ({ label: item.department, value: item.id }))} />)}
        {fieldRequired('title', 'Job Title', <Select value={form.title} onChange={(value) => change('title', value)} disabled={!form.department} placeholder={loadingRoles ? 'Loading job roles...' : 'Select job title'} options={roles.map((item) => ({ label: item.jobrole, value: item.id }))} />)}
        {/*
          * ADDS A ROLE WITHOUT DESTROYING THIS FORM.
          *
          * It used to call onClose() and push `/content/Jobrole-library` - a
          * leftover Laravel-blade path with no Next route, so it 404'd. And it
          * sits between Job Title and Location, so a user fourteen fields in
          * lost all of them to reach a broken page.
          *
          * A new tab is the honest interaction for "I need something that isn't
          * in this dropdown": the half-written posting is still here when they
          * come back. Re-picking the department reloads the role list.
          */}
        <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open(resolveAccessLink(CAPABILITY_LIBRARY_ACCESS_LINK), '_blank', 'noopener')}
          >
            Add New Job Role
          </Button>
          <span className="text-xs text-muted-foreground">
            Opens in a new tab — this posting is kept. Re-select the department to pick up a new role.
          </span>
        </div>
        {field('location', 'Location', <Input value={form.location} onChange={(e) => change('location', e.target.value)} placeholder="Enter job location" />)}
        {field('employmentType', 'Employment Type', <Select value={form.employmentType} onChange={(v) => change('employmentType', v)} placeholder="Select employment type" options={asOptions(EMPLOYMENT_TYPES)} />)}
        {/* WHERE the work happens, which the contract type does not say. Kept a
            separate field so "Remote internship" is expressible - folding it
            into Employment Type would have made one of the two unaskable. */}
        {field('workMode', 'Work Mode', <Select value={form.workMode} onChange={(v) => change('workMode', v)} placeholder="Select work mode" options={asOptions(WORK_MODES)} />, false, true)}
        {field('experienceRequired', 'Experience Required', <Select value={form.experienceRequired} onChange={(v) => change('experienceRequired', v)} placeholder="Select experience level" options={asOptions(EXPERIENCE_LEVELS)} />)}
        {field('educationRequirement', 'Education Requirement', <Select value={form.educationRequirement} onChange={(v) => change('educationRequirement', v)} placeholder="Select education level" options={asOptions(EDUCATION_LEVELS)} />)}
        {field('urgency', 'Priority Level', <Select value={form.urgency} onChange={(v) => change('urgency', v)} placeholder="Select priority" options={['High', 'Medium', 'Low'].map((v) => ({ label: v, value: v }))} />)}
        {field('numberOfPositions', 'Number of Positions', <Input type="number" min={1} value={form.numberOfPositions} onChange={(e) => change('numberOfPositions', e.target.value)} />)}
        {field('salaryRangeMin', 'Minimum Salary', <Input type="number" min={0} placeholder="e.g., 80000" value={form.salaryRangeMin} onChange={(e) => change('salaryRangeMin', e.target.value)} />)}
        {field('salaryRangeMax', 'Maximum Salary', <Input type="number" min={0} placeholder="e.g., 120000" value={form.salaryRangeMax} onChange={(e) => change('salaryRangeMax', e.target.value)} />)}
        {/* The application WINDOW. The detail sheet has rendered an "Opening
            Date" against a column that did not exist for as long as it has
            existed, so the field was permanently blank and neither form could
            offer it. Left blank the role is open as soon as it is published;
            dated in the future it stays off the public careers page until then,
            while HR still sees it here. */}
        {field('openingDate', 'Applications Open', <Input type="date" max={form.applicationDeadline || undefined} value={form.openingDate} onChange={(e) => change('openingDate', e.target.value)} />, false, true)}
        {field('applicationDeadline', 'Application Deadline', <Input type="date" min={form.openingDate || undefined} value={form.applicationDeadline} onChange={(e) => change('applicationDeadline', e.target.value)} />)}
        {editingJob && field('status', 'Status', <Select value={form.status} onChange={(v) => change('status', v)} options={[{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }, { label: 'Draft', value: 'draft' }]} />)}
        {field('skillsRequired', 'Required Skills', <div className="space-y-3">
          {!!selectedSkills.length && <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-3">{selectedSkills.map((skill) => <Badge key={skill} variant="secondary">{skill}<button type="button" aria-label={`Remove ${skill}`} onClick={() => { const next = selectedSkills.filter((item) => item !== skill); setSelectedSkills(next); setForm((current) => ({ ...current, skillsRequired: next.join(', ') })) }}><X className="ml-1 size-3" /></button></Badge>)}</div>}
          {/* The role's own skills are offered first because they are the
              likely answer, then everything else this organisation has - so a
              skill added to the library is reachable even before anyone has
              mapped it to a role. Duplicates are removed by name. */}
          <Select
            placeholder={loadingSkills ? 'Loading skills...' : 'Select a skill to add'}
            options={(() => {
              const taken = new Set(selectedSkills.map((skill) => skill.toLowerCase()))
              const seen = new Set<string>()
              const options: { label: string; value: string }[] = []

              for (const group of [roleSkills, librarySkills]) {
                for (const item of group) {
                  const key = item.SkillName.toLowerCase()
                  if (taken.has(key) || seen.has(key)) continue
                  seen.add(key)
                  options.push({ label: item.SkillName, value: item.SkillName })
                }
              }

              return options
            })()}
            onChange={(skill) => { const next = [...selectedSkills, skill]; setSelectedSkills(next); change('skillsRequired', next.join(', ')) }}
          />
          {!loadingSkills && roleSkills.length === 0 && librarySkills.length > 0 && (
            <p className="text-xs text-muted-foreground">
              This role has no skills mapped to it yet, so the list shows your organisation&rsquo;s
              whole skill library.
            </p>
          )}
        </div>, true)}
        <div className="space-y-2 sm:col-span-2"><label className="text-sm font-medium">Certifications</label><Input value={form.certifications} onChange={(e) => change('certifications', e.target.value)} placeholder="Enter required certifications" /></div>
        {field('jobDescription', 'Job Description', <div><Textarea rows={8} maxLength={5000} value={form.jobDescription} onChange={(e) => change('jobDescription', e.target.value)} placeholder="Describe responsibilities and requirements" /><p className="mt-1 text-right text-xs text-muted-foreground">{form.jobDescription.length}/5000 characters</p></div>, true)}
        {field('benefits', 'Benefits', <Textarea rows={4} value={form.benefits} onChange={(e) => change('benefits', e.target.value)} placeholder="Describe compensation and benefits, or leave blank" />, true, true)}
      </fieldset>
      <div className="flex justify-end gap-3 border-t pt-5">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        {!readOnly && <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingJob ? 'Update Job Posting' : 'Create Job Posting'}</Button>}
      </div>
    </form>
  )
}
