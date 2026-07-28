'use client'

import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { recruitmentService } from '@/services/talent'
import { ApiError } from '@/services/core'
import { readLaravelSession } from '@/lib/laravel-session'
import type { JobPostingApi } from '@/types/recruitment'

interface ApplicationValues {
  job_id: string
  first_name: string
  middle_name: string
  last_name: string
  email: string
  mobile: string
  current_location: string
  employment_type: string
  experience: string
  education: string
  expected_salary: string
  skills: string
  certifications: string
}
type ApplicationErrors = Partial<Record<keyof ApplicationValues | 'resume', string>>

const initialValues: ApplicationValues = {
  job_id: '', first_name: '', middle_name: '', last_name: '', email: '', mobile: '',
  current_location: '', employment_type: '', experience: '', education: '',
  expected_salary: '', skills: '', certifications: '',
}

export function CandidateApplicationForm({
  selectedJob, onClose, onSaved,
}: {
  selectedJob?: JobPostingApi | null
  onClose: () => void
  onSaved: () => Promise<void> | void
}) {
  const [values, setValues] = useState<ApplicationValues>(() => ({
    ...initialValues,
    job_id: selectedJob ? String(selectedJob.id) : '',
  }))
  const [resume, setResume] = useState<File | null>(null)
  const [jobs, setJobs] = useState<JobPostingApi[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const [errors, setErrors] = useState<ApplicationErrors>({})
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    recruitmentService.getOpenJobs()
      .then((rows) => {
        if (!cancelled) setJobs(rows)
      })
      .catch((cause) => {
        if (!cancelled) setJobsError(cause instanceof Error ? cause.message : 'Unable to load open job postings.')
      })
      .finally(() => {
        if (!cancelled) setLoadingJobs(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const session = readLaravelSession()
    if (!session) return
    const sessionFields = session as typeof session & { email?: string; phone?: string; mobile?: string }
    const nameParts = (session.user_name ?? '').trim().split(/\s+/).filter(Boolean)
    queueMicrotask(() => {
      setValues((current) => ({
        ...current,
        first_name: current.first_name || session.first_name || nameParts[0] || '',
        last_name: current.last_name || session.last_name || nameParts.slice(1).join(' '),
        email: current.email || session.user_email || sessionFields.email || '',
        mobile: current.mobile || sessionFields.phone || sessionFields.mobile || '',
      }))
    })
  }, [])

  const change = (field: keyof ApplicationValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function validate() {
    const next: ApplicationErrors = {}
    const required: Array<keyof ApplicationValues> = [
      'job_id', 'first_name', 'last_name', 'email', 'mobile', 'current_location',
      'employment_type', 'experience', 'education', 'expected_salary', 'skills',
    ]
    required.forEach((field) => {
      if (!values[field].trim()) {
        next[field] = field === 'job_id'
          ? 'Job Opening is required'
          : `${field.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())} is required`
      }
    })
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = 'Please enter a valid email address.'
    if (!resume) next.resume = 'Please upload your resume.'
    else if (!/\.(pdf|doc|docx)$/i.test(resume.name)) next.resume = 'Please upload a valid resume file (PDF, DOC, or DOCX).'
    else if (resume.size > 5 * 1024 * 1024) next.resume = 'Resume file size should be less than 5MB.'
    setErrors(next)
    return !Object.keys(next).length
  }

  async function screenApplication(applicationId: string | number, job: JobPostingApi) {
    const resumeText = [
      `Candidate Name: ${values.first_name} ${values.last_name}`,
      `Email: ${values.email}`, `Mobile: ${values.mobile}`,
      `Location: ${values.current_location}`, `Experience:\n${values.experience}`,
      `Education:\n${values.education}`, `Skills:\n${values.skills}`,
      `Certifications:\n${values.certifications || 'Not provided'}`,
    ].join('\n\n')
    const skills = (job.skills ?? '').split(',').map((skill) => skill.trim()).filter(Boolean)
    const response = await fetch('/api/screenCandidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resume: resumeText,
        jdData: {
          core_skills: skills,
          behavioral_traits: ['Problem Solving', 'Teamwork', 'Communication'],
          competency_level: Object.fromEntries(skills.map((skill) => [skill, 'Intermediate'])),
        },
        candidateEmail: values.email,
        candidateName: `${values.first_name} ${values.last_name}`,
      }),
    })
    if (!response.ok) throw new Error('Candidate screening failed')
    const result = await response.json() as Record<string, unknown>
    await recruitmentService.storeScreeningResult({
      candidate_id: applicationId,
      competency_match: Number(result.competency_match ?? 0),
      cultural_fit: result.cultural_fit ?? 'Medium',
      predicted_success: result.predicted_success ?? 'Possible',
      overall_fit_score: Number(result.competency_match ?? 0),
      ranking_score: Math.round(Number(result.competency_match ?? 0) * 0.95),
      skill_gaps: result.skill_gaps ?? [],
      strengths: result.strengths ?? [],
      skill_match_details: result.skill_match_details ?? [],
      recommendation: result.recommendation ?? 'Request Additional Info',
      deepseek_analysis: {
        summary: result.summary ?? 'Analysis completed',
        reasoning: `Candidate shows ${Number(result.competency_match ?? 0)}% competency match with ${String(result.cultural_fit ?? 'Medium')} cultural fit.`,
      },
    })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!validate() || !resume) {
      setMessage('Please fix the errors in the form before submitting.')
      return
    }
    setSubmitting(true)
    setMessage(null)
    try {
      const data = new FormData()
      Object.entries(values).forEach(([key, value]) => data.set(key, value))
      data.set('resume_path', resume)
      data.set('applied_date', new Date().toISOString().split('T')[0])
      data.set('status', 'Pending Review')
      const result = await recruitmentService.createApplication(data)
      if ((result.status === 0 || result.status === false) && !result.success) {
        throw new Error(result.message || 'Application submission failed.')
      }
      const application = result.data
      const job = jobs.find((item) => String(item.id) === values.job_id)
        ?? (selectedJob && String(selectedJob.id) === values.job_id ? selectedJob : undefined)
      if (application?.id && job) {
        void screenApplication(application.id, job).catch((cause) => console.warn('Screening failed but application was saved.', cause))
      }
      await onSaved()
      window.alert(result.message || `Application submitted successfully for ${job?.title ?? 'the selected job'}!`)
      onClose()
    } catch (cause) {
      if (cause instanceof ApiError && cause.errors) {
        const serverErrors: ApplicationErrors = {}
        Object.entries(cause.errors).forEach(([field, messages]) => {
          const key = field === 'resume_path' ? 'resume' : field
          if (key in initialValues || key === 'resume') {
            serverErrors[key as keyof ApplicationErrors] = messages[0] ?? cause.message
          }
        })
        setErrors((current) => ({ ...current, ...serverErrors }))
      }
      setMessage(`Failed to submit application. ${cause instanceof Error ? cause.message : 'Unknown error'}`)
    } finally {
      setSubmitting(false)
    }
  }

  const field = (key: keyof ApplicationValues | 'resume', label: string, node: React.ReactNode, className = '') => (
    <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-medium">{label}{key !== 'middle_name' && key !== 'certifications' ? ' *' : ''}</label>
      {node}
      {errors[key] && <p className="text-sm font-medium text-destructive">{errors[key]}</p>}
    </div>
  )

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-6">
      {message && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{message}</div>}
      {field('job_id', 'Job Opening', <div className="space-y-2">
        <Select
          value={values.job_id}
          disabled={loadingJobs || Boolean(selectedJob) || (!loadingJobs && jobs.length === 0)}
          onChange={(value) => change('job_id', value)}
          placeholder={loadingJobs ? 'Loading open job openings…' : jobs.length ? 'Select job opening' : 'No open job openings available'}
          options={jobs.map((job) => ({ label: job.title, value: String(job.id) }))}
        />
        {jobsError && <p className="text-sm text-destructive">{jobsError}</p>}
        {!loadingJobs && !jobsError && jobs.length === 0 && <p className="text-sm text-muted-foreground">No open job openings available</p>}
      </div>)}
      <div className="grid gap-4 md:grid-cols-3">
        {field('first_name', 'First Name', <Input value={values.first_name} onChange={(event) => change('first_name', event.target.value)} placeholder="John" />)}
        {field('middle_name', 'Middle Name', <Input value={values.middle_name} onChange={(event) => change('middle_name', event.target.value)} placeholder="Michael" />)}
        {field('last_name', 'Last Name', <Input value={values.last_name} onChange={(event) => change('last_name', event.target.value)} placeholder="Doe" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {field('email', 'Email', <Input type="email" value={values.email} onChange={(event) => change('email', event.target.value)} placeholder="john.doe@example.com" />)}
        {field('mobile', 'Mobile', <Input value={values.mobile} onChange={(event) => change('mobile', event.target.value)} placeholder="+1 (555) 123-4567" />)}
      </div>
      {field('current_location', 'Preferred Location', <Input value={values.current_location} onChange={(event) => change('current_location', event.target.value)} placeholder="Surat, Mumbai" />)}
      <div className="grid gap-4 md:grid-cols-2">
        {field('employment_type', 'Employment Type', <Select value={values.employment_type} onChange={(value) => change('employment_type', value)} placeholder="Select employment type" options={[{ label: 'Full Time', value: 'full-time' }, { label: 'Part Time', value: 'part-time' }, { label: 'Contract', value: 'contract' }, { label: 'Internship', value: 'internship' }]} />)}
        {field('experience', 'Experience', <Select value={values.experience} onChange={(value) => change('experience', value)} placeholder="Select experience level" options={['Entry Level (0-2 years)', 'Mid Level (3-5 years)', 'Senior Level (6-10 years)', 'Lead Level (10+ years)'].map((value) => ({ label: value, value }))} />)}
      </div>
      {field('education', 'Education', <Select value={values.education} onChange={(value) => change('education', value)} placeholder="Select education level" options={['High School Diploma', 'Associate Degree', "Bachelor's Degree", "Master's Degree", 'PhD', 'Not Required'].map((value) => ({ label: value, value }))} />)}
      {field('expected_salary', 'Expected Salary', <Input value={values.expected_salary} onChange={(event) => change('expected_salary', event.target.value)} placeholder="₹80,000 - ₹100,000" />)}
      {field('skills', 'Skills', <><Input value={values.skills} onChange={(event) => change('skills', event.target.value)} placeholder="JavaScript, React, Node.js, Python" /><p className="text-xs text-muted-foreground">List your key skills separated by commas</p></>)}
      {field('certifications', 'Certifications', <><Input value={values.certifications} onChange={(event) => change('certifications', event.target.value)} placeholder="AWS Certified, PMP, Scrum Master" /><p className="text-xs text-muted-foreground">List any relevant certifications</p></>)}
      {field('resume', 'Resume', <><div className="flex items-center gap-2"><Input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { setResume(event.target.files?.[0] ?? null); setErrors((current) => ({ ...current, resume: undefined })) }} /><Upload className="size-4" /></div><p className="text-xs text-muted-foreground">{resume ? `Selected: ${resume.name} (${(resume.size / 1024 / 1024).toFixed(2)} MB)` : 'Upload your resume (PDF, DOC, DOCX, max 5MB) *'}</p></>)}
      <div className="flex justify-center gap-4 border-t pt-5">
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit'}</Button>
      </div>
    </form>
  )
}
