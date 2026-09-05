'use client'

import { useEffect, useRef, useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { isOpenJobPosting, recruitmentService } from '@/services/talent'
import { mapProfileNameToRole, readLaravelSession } from '@/lib/laravel-session'
import { Badge } from '@/components/ui/badge'
import { Pencil } from 'lucide-react'
import { canProgressCandidate, type Candidate, type JobOpening } from './recruitment-data'
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
  preselectedCandidate?: Candidate | null
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

/**
 * The offer form's starting values, from the candidate the drawer was opened for.
 *
 * ── WHY THIS IS A SEPARATE FUNCTION ─────────────────────────────────────────
 *
 * Every value here came from a field already in memory - the drawer receives the
 * whole `candidates` and `jobs` arrays - and HR was retyping them. The interview
 * branch has seeded from `preselectedCandidate` all along; the offer branch never
 * did.
 *
 * It lives outside the component so it can be asserted against directly. The
 * behaviour worth protecting is not "some fields get filled" but the em-dash
 * guard below, which is invisible in a screenshot and wrong in the database.
 *
 * Everything it returns stays editable. `reportmanager` is deliberately NOT set:
 * `talent_job_postings` has no hiring-manager column, only `created_by` (which
 * the backend uses as the offer letter's SIGNER), and whoever raised the
 * requisition is not necessarily who the hire reports to. An empty field HR must
 * fill beats a plausible one they will not question.
 */
export function buildOfferDefaults(
  candidate: Candidate,
  jobs: JobOpening[],
  today: Date = new Date(),
): Record<string, string> {
  // The candidate's own job id when the mapper provided one (kanban does, the
  // plain list does not), else the same title match the interview branch uses.
  const matchingJob = candidate.jobId
    ?? jobs.find((job) => job.title === candidate.jobOpening)?.id

  /*
   * `expectedCtc` is the STRING '—' when the candidate stated no expectation -
   * use-recruitment.ts maps null to that em dash for display. Seeding it blindly
   * would put a dash in the salary field and post it as the offered salary.
   */
  const expected = candidate.expectedCtc
  const salary = expected && expected !== '\u2014' ? expected : ''

  return {
    application_id: candidate.id,
    job_id: matchingJob ? String(matchingJob) : '',
    salary,
    // A DEFAULT, not a claim: four weeks out is a normal notice period and HR
    // changes it. Editable precisely because it is a guess.
    start_date: new Date(today.getTime() + 28 * 86_400_000).toISOString().slice(0, 10),
  }
}

export function RecruitmentActionDrawer({ action, jobs, candidates, selectedJob, selectedInterview, selectedOffer, preselectedCandidate, onClose, onSaved, onEditJob }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const valuesRef = useRef<Record<string, string>>({})
  const [resume, setResume] = useState<File | null>(null)
  const [panels, setPanels] = useState<InterviewPanelApi[]>([])
  const [templates, setTemplates] = useState<OfferTemplateApi[]>([])
  /**
   * Employees for the Report manager picker.
   *
   * The field used to be a free-text box asking HR to type a raw numeric user id,
   * which is both hard to get right and impossible to verify on screen.
   */
  const [employees, setEmployees] = useState<{ label: string; value: string }[]>([])
  const [canEditJob, setCanEditJob] = useState(false)

  const set = (key: string, value: string) => {
    const next = { ...valuesRef.current, [key]: value }
    valuesRef.current = next
    setValues(next)
  }
  const replaceValues = (next: Record<string, string>) => {
    valuesRef.current = next
    setValues(next)
  }

  useEffect(() => {
    if (!action) return
    queueMicrotask(() => {
      /*
       * CLEAR FIRST. `values` is shared by all six drawer actions and used to be
       * reset only AFTER a successful save, so opening job-view or job-edit
       * (which stuff the whole job row into it, below) and then opening Create
       * Offer started the offer form with the JOB's start_date and benefits
       * already filled in.
       *
       * That was survivable while the offer form was blank - HR could see the
       * stray values were not theirs. It stops being survivable now that the
       * offer form legitimately pre-fills, because a wrong value inherited from
       * another form is indistinguishable from one we put there on purpose.
       */
      replaceValues({})

      if (action === 'interview' || action === 'interview-edit') void recruitmentService.getPanels().then(setPanels)
      if (action === 'interview' && preselectedCandidate) {
        const matchingJob = preselectedCandidate.jobId
          ?? jobs.find((job) => job.title === preselectedCandidate.jobOpening)?.id
        replaceValues({
          applicant_id: preselectedCandidate.id,
          job_id: matchingJob ?? '',
        })
      }

      if (action === 'offer') {
        void recruitmentService.getTemplates().then(setTemplates)
        void recruitmentService.getEmployeeOptions().then((res) => {
          setEmployees(
            (res.data ?? []).map((person) => {
              // The endpoint returns either a composed `name` or the parts.
              const name = person.name
                ?? [person.first_name, person.last_name].filter(Boolean).join(' ')
              return {
                label: person.employee_no ? `${name} (${person.employee_no})` : name,
                value: String(person.id),
              }
            }),
          )
        })

        if (preselectedCandidate) {
          replaceValues(buildOfferDefaults(preselectedCandidate, jobs))
        }
      }

      if ((action === 'job-edit' || action === 'job-view') && selectedJob) {
        replaceValues(Object.fromEntries(Object.entries(selectedJob).map(([key, value]) => [key, value == null ? '' : String(value)])))
      }
      if (action === 'interview-edit' && selectedInterview) {
        replaceValues(Object.fromEntries(Object.entries(selectedInterview).map(([key, value]) => [key, value == null ? '' : String(value)])))
      }
    })
  }, [action, jobs, preselectedCandidate, selectedInterview, selectedJob])

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
        const formValues = valuesRef.current
        const applicantId = formValues.applicant_id || preselectedCandidate?.id || ''
        const jobId = formValues.job_id
          || preselectedCandidate?.jobId
          || jobs.find((job) => job.title === preselectedCandidate?.jobOpening)?.id
          || ''
        const required = [
          ['Job', jobId],
          ['Candidate', applicantId],
          ['Date', formValues.interview_date],
          ['Time', formValues.time],
          ['Duration', formValues.duration],
          ['Location', formValues.location?.trim()],
          ['Interview panel', formValues.panel_id],
        ] as const
        const missing = required.filter(([, value]) => !value).map(([label]) => label)
        if (missing.length) {
          throw new Error(`Please select or enter: ${missing.join(', ')}.`)
        }
        const candidate = candidates.find((item) => item.id === applicantId)
        if (candidate && !canProgressCandidate(candidate)) {
          throw new Error('An interview cannot be scheduled after an offer has been sent or the candidate has been hired.')
        }
        const selectedPanel = panels.find((panel) => String(panel.id) === formValues.panel_id)
        const rawInterviewers = selectedPanel?.available_interviewers
        let interviewerIds: Array<string | number> = []
        if (Array.isArray(rawInterviewers)) interviewerIds = rawInterviewers
        else if (rawInterviewers) {
          try {
            const parsed = JSON.parse(rawInterviewers)
            interviewerIds = Array.isArray(parsed) ? parsed : []
          } catch {
            interviewerIds = rawInterviewers.split(',').map((id) => id.trim()).filter(Boolean)
          }
        }
        if (!interviewerIds.length) throw new Error('The selected interview panel has no interviewers assigned.')
        const payload = {
          applicant_id: applicantId,
          job_id: jobId,
          interview_date: formValues.interview_date,
          time: formValues.time,
          duration: formValues.duration,
          location: formValues.location,
          panel_id: formValues.panel_id,
          interviewer_id: interviewerIds,
          status: 'Scheduled',
          additional_notes: formValues.notes,
        }
        if (action === 'interview-edit' && selectedInterview) {
          await recruitmentService.updateInterview(selectedInterview.id, payload)
        } else {
          await recruitmentService.createInterview(payload)
          await recruitmentService.updateApplication(applicantId, { status: 'Interview Scheduled' })
        }
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
      replaceValues({})
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
              { label: 'Select candidate', value: '' }, ...candidates.filter(canProgressCandidate).map((candidate) => ({ label: candidate.name, value: candidate.id })),
            ]} />
            <Input type="date" value={values.interview_date ?? ''} onChange={(event) => set('interview_date', event.target.value)} />
            <Input type="time" value={values.time ?? ''} onChange={(event) => set('time', event.target.value)} />
            <Input placeholder="Duration (minutes)" value={values.duration ?? ''} onChange={(event) => set('duration', event.target.value)} />
            <Input className="sm:col-span-2" placeholder="Location or meeting link" value={values.location ?? ''} onChange={(event) => set('location', event.target.value)} />
            <Select value={values.panel_id ?? ''} onChange={(value) => set('panel_id', value)} options={[
              { label: 'Select panel', value: '' }, ...panels.filter((panel) => ['available', 'active'].includes(panel.status.toLowerCase())).map((panel) => ({ label: panel.panel_name, value: String(panel.id) })),
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
            {/* WAS a free-text "Report manager ID" box. Deliberately NOT
                pre-filled: talent_job_postings has no hiring-manager column,
                only created_by, which the backend already uses as the offer
                letter's SIGNER - and whoever raised the requisition is not
                necessarily who the hire reports to. Easier to fill, not filled
                wrongly. */}
            <Select
              value={values.reportmanager ?? ''}
              onChange={(value: string) => set('reportmanager', value)}
              options={[{ label: 'Report manager (optional)', value: '' }, ...employees]}
            />
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
