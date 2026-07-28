'use client'

import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { isOpenJobPosting, recruitmentService } from '@/services/talent'
import { mapProfileNameToRole, readLaravelSession } from '@/lib/laravel-session'
import { Badge } from '@/components/ui/badge'
import { Pencil } from 'lucide-react'
import type { Candidate, JobOpening } from './recruitment-data'
import type { InterviewApi, InterviewPanelApi, JobPostingApi, OfferTemplateApi, TalentOfferApi } from '@/types/recruitment'
import { JobPostingForm } from './job-posting-form'
import { CandidateApplicationForm } from './candidate-application-form'

export type RecruitmentAction = 'job' | 'job-edit' | 'job-view' | 'candidate' | 'interview' | 'interview-edit' | 'offer' | 'offer-view'

interface Props {
  action: RecruitmentAction | null
  jobs: JobOpening[]
  candidates: Candidate[]
  selectedJob?: JobPostingApi | null
  selectedInterview?: InterviewApi | null
  selectedOffer?: TalentOfferApi | null
  onClose: () => void
  onSaved: () => Promise<void> | void
  onEditJob?: () => void
}

function DetailField({ label, value }: { label: string; value?: string | number | null }) {
  return <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="whitespace-pre-wrap text-sm font-medium text-foreground">{value == null || value === '' ? '—' : String(value)}</p></div>
}

function JobOpeningDetails({ job, canEdit, onEdit }: { job: JobPostingApi; canEdit: boolean; onEdit?: () => void }) {
  const status = isOpenJobPosting(job) ? 'Open' : 'Closed'
  const closingDate = job.deadline ?? job.end_date
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-muted/20 p-4">
      <div><h3 className="text-lg font-bold">{job.title}</h3><p className="mt-1 text-sm text-muted-foreground">{job.department_name ?? `Department ${job.department_id}`} · {job.location}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={status === 'Open' ? 'default' : 'secondary'}>{status}</Badge>
        <Badge variant="outline">{job.employment_type}</Badge>
        {job.priority_level && <Badge variant="outline">{job.priority_level} priority</Badge>}
        {canEdit && onEdit && <Button size="sm" onClick={onEdit}><Pencil className="size-4" />Edit</Button>}
      </div>
    </div>
    <section className="rounded-xl border p-4"><h4 className="mb-4 font-semibold">Job Information</h4><div className="grid gap-5 sm:grid-cols-2"><DetailField label="Department" value={job.department_name ?? job.department_id} /><DetailField label="Location" value={job.location} /><DetailField label="Employment Type" value={job.employment_type} /><DetailField label="Number of Positions" value={job.positions} /><DetailField label="Experience" value={job.experience} /><DetailField label="Education" value={job.education} /></div></section>
    <section className="rounded-xl border p-4"><h4 className="mb-4 font-semibold">Requirements</h4><div className="grid gap-5 sm:grid-cols-2"><DetailField label="Skills" value={job.skills} /><DetailField label="Certifications" value={job.certifications} /><div className="sm:col-span-2"><DetailField label="Job Description" value={job.description} /></div></div></section>
    <section className="rounded-xl border p-4"><h4 className="mb-4 font-semibold">Salary & Benefits</h4><div className="grid gap-5 sm:grid-cols-2"><DetailField label="Minimum Salary" value={job.min_salary} /><DetailField label="Maximum Salary" value={job.max_salary} /><div className="sm:col-span-2"><DetailField label="Benefits" value={job.benefits} /></div></div></section>
    <section className="rounded-xl border p-4"><h4 className="mb-4 font-semibold">Application Details</h4><div className="grid gap-5 sm:grid-cols-2"><DetailField label="Opening Date" value={job.start_date} /><DetailField label="Closing Date" value={closingDate} /><DetailField label="Created On" value={job.created_at} /><DetailField label="Last Updated" value={job.updated_at} /></div></section>
  </div>
}

export function RecruitmentActionDrawer({ action, jobs, candidates, selectedJob, selectedInterview, selectedOffer, onClose, onSaved, onEditJob }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [resume, setResume] = useState<File | null>(null)
  const [panels, setPanels] = useState<InterviewPanelApi[]>([])
  const [templates, setTemplates] = useState<OfferTemplateApi[]>([])
  const [canEditJob, setCanEditJob] = useState(false)

  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    if (!action) return
    queueMicrotask(() => {
      if (action === 'interview' || action === 'interview-edit') void recruitmentService.getPanels().then(setPanels)
      if (action === 'offer') void recruitmentService.getTemplates().then(setTemplates)
      if ((action === 'job-edit' || action === 'job-view') && selectedJob) {
        setValues(Object.fromEntries(Object.entries(selectedJob).map(([key, value]) => [key, value == null ? '' : String(value)])))
      }
      if (action === 'interview-edit' && selectedInterview) {
        setValues(Object.fromEntries(Object.entries(selectedInterview).map(([key, value]) => [key, value == null ? '' : String(value)])))
      }
    })
  }, [action, selectedInterview, selectedJob])

  useEffect(() => {
    const role = mapProfileNameToRole(readLaravelSession()?.user_profile_name)
    queueMicrotask(() => setCanEditJob(role === 'admin' || role === 'hr'))
  }, [])

  async function submit() {
    if (!action) return
    setSaving(true)
    setError(null)
    try {
      if (action === 'job' || action === 'job-edit') {
        if (!values.title?.trim() || !values.department_id || !values.location?.trim() || !values.employment_type || Number(values.positions) < 1) {
          throw new Error('Title, department, location, employment type, and at least one position are required.')
        }
        const payload = {
          title: values.title?.trim(),
          department_id: Number(values.department_id),
          location: values.location?.trim(),
          employment_type: values.employment_type,
          positions: Number(values.positions),
          experience: values.experience || null,
          education: values.education || null,
          priority_level: values.priority_level || null,
          min_salary: values.min_salary || null,
          max_salary: values.max_salary || null,
          start_date: values.start_date || null,
          end_date: values.end_date || null,
          skills: values.skills || null,
          certifications: values.certifications || null,
          benefits: values.benefits || null,
          description: values.description || null,
          status: 'active',
        } as const
        if (action === 'job-edit' && selectedJob) await recruitmentService.updateJob(selectedJob.id, payload)
        else await recruitmentService.createJob(payload)
      } else if (action === 'candidate') {
        if (!resume) throw new Error('A PDF, DOC, or DOCX resume is required.')
        if (!values.job_id || !values.first_name?.trim() || !values.last_name?.trim() || !values.email?.trim() || !values.mobile?.trim()) {
          throw new Error('Job, first name, last name, email, and mobile are required.')
        }
        if (resume.size > 5 * 1024 * 1024) throw new Error('Resume size cannot exceed 5 MB.')
        if (!/\.(pdf|doc|docx)$/i.test(resume.name)) throw new Error('Resume must be a PDF, DOC, or DOCX file.')
        const data = new FormData()
        Object.entries(values).forEach(([key, value]) => data.set(key, value))
        data.set('resume_path', resume)
        data.set('status', 'Pending Review')
        await recruitmentService.createApplication(data)
      } else if (action === 'interview' || action === 'interview-edit') {
        if (!values.job_id || !values.applicant_id || !values.interview_date || !values.time) {
          throw new Error('Job, candidate, interview date, and time are required.')
        }
        const payload = {
          applicant_id: values.applicant_id,
          job_id: values.job_id,
          round_no: Number(values.round_no || 1),
          interview_date: values.interview_date,
          time: values.time,
          duration: values.duration,
          location: values.location,
          panel_id: values.panel_id || null,
          status: 'Scheduled',
          additional_notes: values.notes,
        }
        if (action === 'interview-edit' && selectedInterview) await recruitmentService.updateInterview(selectedInterview.id, payload)
        else await recruitmentService.createInterview(payload)
      } else {
        if (!values.application_id || !values.job_id || !values.salary || !values.start_date) {
          throw new Error('Candidate, job, salary, and joining date are required.')
        }
        const candidate = candidates.find((item) => item.id === values.application_id)
        const job = jobs.find((item) => item.id === values.job_id)
        await recruitmentService.createOffer({
          application_id: values.application_id,
          job_id: values.job_id,
          position: job?.title ?? '',
          candidateEmail: candidate?.email ?? '',
          salary: values.salary,
          start_date: values.start_date,
          template_id: values.template_id || null,
          reportmanager: values.reportmanager,
          punchintime: values.punchintime,
          punchouttime: values.punchouttime,
          offerDetails: { responsibilities: values.responsibilities, benefits: values.benefits },
          notes: values.notes,
          status: 'draft',
        })
      }
      await onSaved()
      onClose()
      setValues({})
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The operation could not be completed.')
    } finally {
      setSaving(false)
    }
  }

  const title = action === 'job' ? 'Create New Job Posting' : action === 'job-edit' ? `Edit Job Posting${selectedJob?.title ? `: ${selectedJob.title}` : ''}` : action === 'job-view' ? 'Job opening details' : action === 'candidate' ? `Candidate Apply${selectedJob?.title ? `: ${selectedJob.title}` : ''}` : action === 'interview' ? 'Schedule interview' : action === 'interview-edit' ? 'Reschedule interview' : action === 'offer-view' ? 'Offer details' : 'Create offer'
  const readOnly = action === 'job-view' || action === 'offer-view'

  return (
    <Sheet open={Boolean(action)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-2xl">
        <SheetHeader className="border-b p-6 pr-12">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Fields and status values follow the Laravel recruitment contract.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6">

        {(action === 'job' || action === 'job-edit') && (
          <JobPostingForm editingJob={selectedJob} onClose={onClose} onSaved={onSaved} />
        )}
        {action === 'job-view' && selectedJob && <JobOpeningDetails job={selectedJob} canEdit={canEditJob} onEdit={onEditJob} />}

        {action === 'candidate' && <CandidateApplicationForm selectedJob={selectedJob} onClose={onClose} onSaved={onSaved} />}

        {(action === 'interview' || action === 'interview-edit') && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select value={values.job_id ?? ''} onChange={(value) => set('job_id', value)} options={[
              { label: 'Select job', value: '' }, ...jobs.map((job) => ({ label: job.title, value: job.id })),
            ]} />
            <Select value={values.applicant_id ?? ''} onChange={(value) => set('applicant_id', value)} options={[
              { label: 'Select candidate', value: '' }, ...candidates.filter((candidate) => candidate.stage !== 'Rejected').map((candidate) => ({ label: candidate.name, value: candidate.id })),
            ]} />
            <Input type="date" value={values.interview_date ?? ''} onChange={(event) => set('interview_date', event.target.value)} />
            <Input type="time" value={values.time ?? ''} onChange={(event) => set('time', event.target.value)} />
            <Input type="number" min={1} placeholder="Round" value={values.round_no ?? '1'} onChange={(event) => set('round_no', event.target.value)} />
            <Input placeholder="Duration (minutes)" value={values.duration ?? ''} onChange={(event) => set('duration', event.target.value)} />
            <Input className="sm:col-span-2" placeholder="Location or meeting link" value={values.location ?? ''} onChange={(event) => set('location', event.target.value)} />
            <Select value={values.panel_id ?? ''} onChange={(value) => set('panel_id', value)} options={[
              { label: 'Select panel', value: '' }, ...panels.filter((panel) => ['available', 'active'].includes(panel.status)).map((panel) => ({ label: panel.panel_name, value: String(panel.id) })),
            ]} />
            <Textarea className="sm:col-span-2" placeholder="Notes" value={values.notes ?? ''} onChange={(event) => set('notes', event.target.value)} />
          </div>
        )}

        {action === 'offer' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select value={values.application_id ?? ''} onChange={(value) => set('application_id', value)} options={[
              { label: 'Select candidate', value: '' }, ...candidates.filter((candidate) => candidate.stage !== 'Rejected').map((candidate) => ({ label: candidate.name, value: candidate.id })),
            ]} />
            <Select value={values.job_id ?? ''} onChange={(value) => set('job_id', value)} options={[
              { label: 'Select job', value: '' }, ...jobs.map((job) => ({ label: job.title, value: job.id })),
            ]} />
            <Input placeholder="Salary / CTC" value={values.salary ?? ''} onChange={(event) => set('salary', event.target.value)} />
            <Input type="date" value={values.start_date ?? ''} onChange={(event) => set('start_date', event.target.value)} />
            <Select value={values.template_id ?? ''} onChange={(value) => set('template_id', value)} options={[
              { label: 'Select template', value: '' }, ...templates.map((template) => ({ label: template.title, value: String(template.id) })),
            ]} />
            <Input placeholder="Report manager ID" value={values.reportmanager ?? ''} onChange={(event) => set('reportmanager', event.target.value)} />
            <Input type="time" aria-label="Work start time" value={values.punchintime ?? ''} onChange={(event) => set('punchintime', event.target.value)} />
            <Input type="time" aria-label="Work end time" value={values.punchouttime ?? ''} onChange={(event) => set('punchouttime', event.target.value)} />
            <Textarea className="sm:col-span-2" placeholder="Responsibilities" value={values.responsibilities ?? ''} onChange={(event) => set('responsibilities', event.target.value)} />
            <Textarea className="sm:col-span-2" placeholder="Benefits" value={values.benefits ?? ''} onChange={(event) => set('benefits', event.target.value)} />
            <Textarea className="sm:col-span-2" placeholder="Offer notes" value={values.notes ?? ''} onChange={(event) => set('notes', event.target.value)} />
          </div>
        )}

        {action === 'offer-view' && selectedOffer && (
          <div className="space-y-3">
            {[
              ['Offer ID', selectedOffer.id], ['Application ID', selectedOffer.application_id],
              ['Job ID', selectedOffer.job_id], ['Position', selectedOffer.position],
              ['Candidate email', selectedOffer.candidateEmail], ['Salary', selectedOffer.salary],
              ['Joining date', selectedOffer.start_date], ['Report manager', selectedOffer.reportmanager],
              ['Status', selectedOffer.status],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between gap-4 border-b py-2">
                <span className="text-sm font-medium text-muted-foreground">{label}</span>
                <span className="text-sm font-semibold text-right">{value == null ? '—' : String(value)}</span>
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={() => window.open(recruitmentService.offerLetterUrl(selectedOffer.id), '_blank', 'noopener,noreferrer')}>Open offer letter</Button>
          </div>
        )}

        {error && <p className="mt-4 text-sm font-medium text-destructive">{error}</p>}
        </div>
        {!['job', 'job-edit', 'job-view', 'candidate'].includes(action ?? '') && <SheetFooter className="border-t p-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {!readOnly && <Button disabled={saving} onClick={() => void submit()}>{saving ? 'Saving…' : title}</Button>}
        </SheetFooter>}
      </SheetContent>
    </Sheet>
  )
}
