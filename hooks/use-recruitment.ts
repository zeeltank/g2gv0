'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isOpenJobPosting, recruitmentService } from '@/services/talent'
import type { Candidate, Interview, JobOpening, Offer, Requisition } from '@/components/domain/talent/recruitment/recruitment-data'
import type { CandidateKanbanApi, JobApplicationApi, JobPostingApi, TalentOfferApi } from '@/types/recruitment'
import type { TeamOverviewApi } from '@/types/recruitment'

function uniqueById<T extends { id: string | number }>(rows: T[]) {
  return Array.from(new Map(rows.map((row) => [String(row.id), row])).values())
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(date)
}

function candidateStage(status: string, screeningCompleted = false): Candidate['stage'] {
  const value = (status ?? '').trim().toLowerCase()
  if (value.includes('reject')) return 'Rejected'
  if (value.includes('hire') || value === 'completed') return 'Hired'
  if (value.includes('offer')) return 'Offer'
  if (value.includes('interview')) return 'Interview'
  if (value.includes('assessment')) return 'Assessment'
  if (value.includes('shortlist') || value.includes('under review')) return 'Screened'
  if (screeningCompleted) return 'Screened'
  return 'Applied'
}

function normalizeKanbanStage(application: CandidateKanbanApi): Candidate['stage'] {
  const stage = String(application.stage ?? '').trim().toLowerCase()
  const normalized: Record<string, Candidate['stage']> = {
    applied: 'Applied',
    application: 'Applied',
    screened: 'Screened',
    screening: 'Screened',
    shortlisted: 'Screened',
    assessment: 'Assessment',
    interview: 'Interview',
    interviewed: 'Interview',
    offer: 'Offer',
    offered: 'Offer',
    hired: 'Hired',
  }

  return normalized[stage] ?? candidateStage(
    application.status ?? '',
    Boolean(application.screening_completed),
  )
}

function mapCandidate(application: JobApplicationApi, jobs: Map<string, JobPostingApi>, screeningCompleted = false): Candidate {
  const job = jobs.get(String(application.job_id))
  return {
    id: String(application.id),
    name: [application.first_name, application.middle_name, application.last_name].filter(Boolean).join(' '),
    role: application.job_title ?? application.position ?? job?.title ?? 'Unassigned role',
    jobOpening: job?.title ?? application.job_title ?? 'Unassigned role',
    stage: candidateStage(application.status, screeningCompleted),
    source: 'Career Portal',
    recruiter: 'Recruitment Team',
    recruiterInitials: 'RT',
    location: application.current_location ?? '—',
    experience: application.experience ?? '—',
    noticePeriod: '—',
    expectedCtc: application.expected_salary ? String(application.expected_salary) : '—',
    resume: application.resume_path ?? '',
    appliedOn: formatDate(application.applied_date ?? application.created_at),
    lastUpdated: formatDate(application.updated_at ?? application.created_at),
    starred: false,
    email: application.email,
    phone: application.mobile,
  }
}

function mapKanbanCandidate(application: CandidateKanbanApi): Candidate {
  const recruiter = application.recruiter_name?.trim() || '—'
  const candidateName =
    [application.first_name, application.middle_name, application.last_name].filter(Boolean).join(' ').trim()
    || application.name?.trim()
    || application.candidate_name?.replace(/\s+\S+@\S+\.\S+$/, '').trim()
    || 'N/A'
  const jobTitle =
    application.job_title?.trim()
    || application.position?.trim()
    || application.job?.title?.trim()
    || application.job_posting?.title?.trim()
    || 'N/A'
  const appliedOn = application.applied_date || application.created_at
    ? formatDate(application.applied_date ?? application.created_at)
    : '-'

  return {
    id: String(application.candidate_id ?? application.id),
    jobId: application.job_id == null ? (application.position_id == null ? undefined : String(application.position_id)) : String(application.job_id),
    name: candidateName,
    role: jobTitle,
    jobOpening: jobTitle,
    stage: normalizeKanbanStage(application),
    source: application.source ?? '—',
    recruiter,
    recruiterInitials: recruiter === '—' ? '—' : recruiter.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    location: application.current_location ?? '—',
    experience: application.experience ?? '—',
    noticePeriod: '—',
    expectedCtc: application.expected_salary == null ? '—' : String(application.expected_salary),
    resume: application.resume_path ?? '',
    appliedOn,
    lastUpdated: formatDate(application.updated_at ?? application.created_at),
    starred: false,
    email: application.email,
    phone: application.mobile,
    avatar: application.avatar ?? application.candidate_photo ?? application.photo ?? undefined,
    rating: application.rating ?? undefined,
    skills: application.skills ?? undefined,
    status: application.status,
    department: application.department_name ?? undefined,
  }
}

function mapJob(job: JobPostingApi, counts: Map<string, number>): JobOpening {
  return {
    id: String(job.id),
    title: job.title,
    department: job.department_name ?? String(job.department_id),
    location: job.location,
    type: 'External',
    status: isOpenJobPosting(job) ? 'Open' : 'Closed',
    applications: counts.get(String(job.id)) ?? 0,
    postedOn: formatDate(job.created_at),
    closingDate: formatDate(job.deadline ?? job.end_date),
  }
}

function mapOffer(offer: TalentOfferApi, candidates: Map<string, Candidate>, jobs: Map<string, JobPostingApi>): Offer {
  const status = offer.status.toLowerCase()
  return {
    id: String(offer.id),
    candidateName: offer.candidate_name ?? candidates.get(String(offer.application_id))?.name ?? 'Candidate',
    jobTitle: offer.position ?? jobs.get(String(offer.job_id))?.title ?? 'Position',
    ctc: offer.salary ? String(offer.salary) : '—',
    joiningDate: formatDate(offer.start_date),
    status: status === 'accepted' ? 'Accepted' : status === 'rejected' ? 'Declined' : status === 'sent' ? 'Sent' : 'Draft',
    approvedBy: offer.reportmanager ? String(offer.reportmanager) : '—',
    sentOn: formatDate(offer.created_at),
  }
}

export function useRecruitment() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['recruitment'],
    queryFn: async () => {
      const [jobRows, kanbanResult, applicationRows, recruiterRows, interviewRows, offerRows, requisitionPage, teamResult, pendingFeedback, funnelResult] = await Promise.all([
        recruitmentService.getJobs(), recruitmentService.getCandidateKanban(),
        recruitmentService.getApplications(),
        recruitmentService.getInterviewers().catch(() => []),
        recruitmentService.getInterviews(), recruitmentService.getOffers(),
        recruitmentService.getRequisitions(1, 50),
        recruitmentService.getTeamOverview(),
        recruitmentService.getPendingFeedback(),
        recruitmentService.getFunnel(),
      ])
      const uniqueJobRows = uniqueById(jobRows)
      const uniqueInterviewRows = uniqueById(interviewRows)
      const uniqueOfferRows = uniqueById(offerRows)
      const uniqueRequisitionRows = uniqueById(requisitionPage.data ?? [])
      const jobsById = new Map(uniqueJobRows.map((job) => [String(job.id), job]))
      const applicationsById = new Map(applicationRows.map((application) => [String(application.id), application]))
      const recruitersById = new Map(recruiterRows.map((recruiter) => [
        String(recruiter.id),
        recruiter.name?.trim()
          || [recruiter.first_name, recruiter.last_name].filter(Boolean).join(' ').trim()
          || String(recruiter.id),
      ]))
      const candidateRows = Array.from(
        new Map(
          (kanbanResult.data ?? []).map((candidate) => [
            String(candidate.candidate_id ?? candidate.id),
            (() => {
              const application = applicationsById.get(String(candidate.candidate_id ?? candidate.id))
              const jobId = application?.job_id ?? candidate.job_id ?? candidate.position_id
              const job = jobId == null ? undefined : jobsById.get(String(jobId))
              const recruiterId = application?.recruiter_id
                ?? candidate.recruiter_id
                ?? job?.created_by
                ?? application?.created_by
              return {
                ...application,
                ...candidate,
                job_id: jobId,
                job_title: candidate.job_title ?? candidate.position ?? job?.title,
                current_location: candidate.current_location ?? application?.current_location ?? job?.location,
                source: candidate.source ?? application?.source,
                recruiter_id: recruiterId,
                recruiter_name: candidate.recruiter_name
                  ?? application?.recruiter_name
                  ?? (recruiterId == null ? null : recruitersById.get(String(recruiterId))),
              } as CandidateKanbanApi
            })(),
          ]),
        ).values(),
      )
      const candidateRowIds = new Set(candidateRows.map((candidate) => String(candidate.candidate_id ?? candidate.id)))
      applicationRows.forEach((application) => {
        if (candidateRowIds.has(String(application.id))) return
        const job = jobsById.get(String(application.job_id))
        const recruiterId = application.recruiter_id ?? job?.created_by ?? application.created_by
        candidateRows.push({
          ...application,
          candidate_id: application.id,
          candidate_name: [application.first_name, application.middle_name, application.last_name].filter(Boolean).join(' '),
          job_title: job?.title,
          stage: candidateStage(application.status),
          recruiter_id: recruiterId,
          recruiter_name: application.recruiter_name
            ?? (recruiterId == null ? null : recruitersById.get(String(recruiterId))),
        } as CandidateKanbanApi)
      })
      const counts = new Map<string, number>()
      candidateRows.forEach((row) => {
        const jobId = row.job_id ?? row.position_id
        if (jobId == null) return
        counts.set(String(jobId), (counts.get(String(jobId)) ?? 0) + 1)
      })
      const sentOfferCandidateIds = new Set(
        uniqueOfferRows
          .filter((offer) => offer.status?.trim().toLowerCase() === 'sent')
          .map((offer) => String(offer.application_id)),
      )
      const mappedCandidates = candidateRows.map(mapKanbanCandidate).map((candidate) =>
        sentOfferCandidateIds.has(candidate.id)
          ? { ...candidate, stage: 'Offer' as const, status: 'Offer Sent' }
          : candidate
      )
      const candidatesById = new Map(mappedCandidates.map((row) => [row.id, row]))
      const stageCounts = mappedCandidates.reduce<Record<'Applied' | 'Screened' | 'Assessment' | 'Interview' | 'Offer' | 'Hired', number>>(
        (totals, candidate) => {
          if (candidate.stage !== 'Rejected') totals[candidate.stage] += 1
          return totals
        },
        { Applied: 0, Screened: 0, Assessment: 0, Interview: 0, Offer: 0, Hired: 0 },
      )

      return {
        candidates: mappedCandidates,
        jobRecords: uniqueJobRows,
        jobs: uniqueJobRows.map((job) => mapJob(job, counts)),
        interviews: uniqueInterviewRows.map((row) => ({
        id: String(row.id),
        candidateName: row.candidate_name ?? ([row.first_name, row.last_name].filter(Boolean).join(' ') || 'Candidate'),
        jobTitle: row.title ?? jobsById.get(String(row.job_id))?.title ?? 'Position',
        interviewers: Array.isArray(row.interviewer_id) ? row.interviewer_id.map(String) : [],
        scheduledAt: [formatDate(row.interview_date), row.time].filter(Boolean).join(', '),
        duration: row.duration ? String(row.duration) : '—',
        type: row.panel_id ? 'Panel' : 'Video',
        status: row.status.toLowerCase() === 'completed' ? 'Completed' : row.status.toLowerCase() === 'cancelled' ? 'Cancelled' : 'Scheduled',
        // round: row.round_no ?? 1,
        })),
        interviewRecords: uniqueInterviewRows,
        offers: uniqueOfferRows.map((row) => mapOffer(row, candidatesById, jobsById)),
        offerRecords: uniqueOfferRows,
        requisitions: uniqueRequisitionRows.map((row) => ({
        id: String(row.id), title: row.title ?? 'Untitled requisition',
        department: row.department_name ?? row.department ?? '—', location: row.location ?? '—',
        headcount: row.positions ?? 0, filled: row.filled ?? 0,
        status: row.status?.toLowerCase() === 'active' ? 'Open' : 'Closed',
        createdBy: row.created_by ? String(row.created_by) : '—', createdOn: formatDate(row.created_at),
        priority: row.priority_level?.toLowerCase() === 'critical' ? 'Critical' : row.priority_level?.toLowerCase() === 'high' ? 'High' : row.priority_level?.toLowerCase() === 'low' ? 'Low' : 'Medium',
        })),
        teamOverview: teamResult.data,
        pendingFeedbackCount: pendingFeedback.length,
        funnel: funnelResult.data ?? [],
        stageCounts,
      }
    },
  })

  const empty = {
    candidates: [] as Candidate[],
    jobs: [] as JobOpening[],
    jobRecords: [] as JobPostingApi[],
    interviews: [] as Interview[],
    interviewRecords: [] as import('@/types/recruitment').InterviewApi[],
    offers: [] as Offer[],
    offerRecords: [] as TalentOfferApi[],
    requisitions: [] as Requisition[],
    teamOverview: null as TeamOverviewApi | null,
    pendingFeedbackCount: 0,
    funnel: [] as Array<{ name: string; value: number }>,
    stageCounts: { Applied: 0, Screened: 0, Assessment: 0, Interview: 0, Offer: 0, Hired: 0 },
  }

  const moveCandidate = async (candidateId: string, stage: Candidate['stage']) => {
    const previous = queryClient.getQueryData<typeof query.data>(['recruitment'])
    queryClient.setQueryData<typeof query.data>(['recruitment'], (current) => current ? {
      ...current,
      candidates: current.candidates.map((candidate) =>
        candidate.id === candidateId ? { ...candidate, stage } : candidate
      ),
    } : current)

    try {
      await recruitmentService.moveCandidate(candidateId, stage)
      await queryClient.invalidateQueries({ queryKey: ['recruitment'] })
    } catch (cause) {
      queryClient.setQueryData(['recruitment'], previous)
      throw cause
    }
  }

  return {
    ...(query.data ?? empty),
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['recruitment'] }),
    moveCandidate,
  }
}

export function useCandidateScreeningResult(candidateId: string | null) {
  return useQuery({
    queryKey: [`candidate-screening-result-${candidateId}`],
    queryFn: () => recruitmentService.getCandidateProfile(candidateId!),
    enabled: Boolean(candidateId),
  })
}
