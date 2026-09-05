import { apiClient } from '@/services/core'
import { buildApiUrl } from '@/services/core/api-client'
import { getLaravelContext, withLaravelParams } from '@/lib/laravel-context'
import type {
  CandidateKanbanResponse, CandidateProfileApi, CandidateScreeningResponse, FeedbackApi, FeedbackPayload, FunnelResponse, InterviewApi, InterviewerApi, InterviewPanelApi,
  JobApplicationApi, JobPostingApi, LaravelId, RequisitionPage,
  OfferTemplateApi, ScreeningResultApi, TalentItemResponse, TalentListResponse, TalentOfferApi,
  TeamOverviewApi,
  AssessmentBlueprintApi, AssessmentBlueprintPayload, AssessmentInviteApi, AssessmentJobRoleApi,
  CandidateAssessmentResultApi, EmployeeOptionApi,
} from '@/types/recruitment'

function contextParams(extra?: Record<string, string>) {
  const context = getLaravelContext()
  if (!context.token || !context.subInstituteId) {
    throw new Error('Your Laravel session is unavailable. Please sign in again.')
  }
  return withLaravelParams(context, extra)
}

function bearerHeaders() {
  const { token } = getLaravelContext()
  if (!token) throw new Error('Your Laravel session is unavailable. Please sign in again.')
  return { Authorization: `Bearer ${token}` }
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Job availability is derived from its closing date, not its stored status. */
export function isOpenJobPosting(job: JobPostingApi) {
  if (job.status?.toLowerCase() !== 'active') return false
  const closingDate = job.deadline ?? job.end_date
  if (!closingDate) return true

  const closingDateKey = closingDate.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(closingDateKey)
    ? localDateKey(new Date()) <= closingDateKey
    : new Date() <= new Date(closingDate)
}

export const recruitmentService = {
  async getJobs() {
    return (await apiClient.get<TalentListResponse<JobPostingApi>>('/job-postings', contextParams())).data ?? []
  },
  async getOpenJobs() {
    return (await this.getJobs()).filter(isOpenJobPosting)
  },
  createJob(data: Omit<JobPostingApi, 'id'>) {
    return apiClient.post<TalentItemResponse<JobPostingApi>>('/job-postings', { ...data, ...contextParams() })
  },
  updateJob(id: LaravelId, data: Partial<JobPostingApi>) {
    return apiClient.put<TalentItemResponse<JobPostingApi>>(`/job-postings/${id}`, { ...data, ...contextParams() })
  },
  createJobForm(data: FormData) {
    const params = contextParams()
    Object.entries(params).forEach(([key, value]) => data.set(key, value))
    const context = getLaravelContext()
    data.set('created_by', String(context.userId ?? '1'))
    data.set('updated_at', '')
    data.set('skip_updated_at', 'true')
    return apiClient.postForm<TalentItemResponse<JobPostingApi>>('/job-postings', data)
  },
  updateJobForm(id: LaravelId, data: FormData) {
    const params = contextParams()
    Object.entries(params).forEach(([key, value]) => data.set(key, value))
    const context = getLaravelContext()
    data.set('updated_by', String(context.userId ?? '1'))
    return apiClient.putForm<TalentItemResponse<JobPostingApi>>(`/job-postings/${id}`, data)
  },
  analyzeJobDescription(jd: string) {
    const context = getLaravelContext()
    return apiClient.post<Record<string, unknown>>('/gemini/analyze-jd', {
      jd, sub_institute_id: context.subInstituteId,
    })
  },
  async sendJobPostingWebhook(
    form: object,
    job: JobPostingApi,
    analysis: Record<string, unknown>,
  ) {
    try {
      const params = new URLSearchParams(Object.entries(form).map(([key, value]) => [key, String(value)]))
      params.set('jobPostingId', String(job?.id ?? ''))
      params.set('jobPostingCreatedAt', job?.created_at ?? '')
      params.set('jdAnalysis', JSON.stringify(analysis ?? {}))
      params.set('timestamp', new Date().toISOString())
      await fetch(`https://n8n.triz.co.in/ff441ace-87f3-4cb5-9d26-838653929aa7?${params}`, { method: 'GET' })
    } catch (cause) {
      console.error('Job posting webhook failed:', cause)
    }
  },
  deleteJob(id: LaravelId) {
    return apiClient.delete<{ message: string }>(`/job-postings/${id}`, contextParams())
  },
  async getApplications() {
    return (await apiClient.get<TalentListResponse<JobApplicationApi>>('/job-applications', contextParams())).data ?? []
  },
  getCandidateKanban(filters?: Record<string, string>) {
    return apiClient.get<CandidateKanbanResponse>('/candidate', contextParams(filters))
  },
  getApplication(id: LaravelId) {
    return apiClient.get<TalentItemResponse<JobApplicationApi>>(`/job-applications/${id}`, contextParams())
  },
  createApplication(data: FormData) {
    const params = contextParams()
    Object.entries(params).forEach(([key, value]) => data.set(key, value))
    return apiClient.postForm<TalentItemResponse<JobApplicationApi>>(('/job-applications'), data)
  },
  updateApplication(id: LaravelId, data: Partial<JobApplicationApi>) {
    return apiClient.put<TalentItemResponse<JobApplicationApi>>(`/job-applications/${id}`, { ...data, ...contextParams() })
  },
  moveCandidate(id: LaravelId, stage: string) {
    const statusByStage: Record<string, string> = {
      Applied: 'Pending Review',
      Screened: 'Shortlisted',
      Assessment: 'Assessment',
      Interview: 'Interview Scheduled',
      Offer: 'Offered',
      Hired: 'Hired',
      Rejected: 'Rejected',
    }
    return this.updateApplication(id, { status: statusByStage[stage] ?? stage })
  },
  async getInterviews() {
    return (await apiClient.get<{ data?: InterviewApi[] }>('/interview-details', contextParams())).data ?? []
  },
  createInterview(data: Partial<InterviewApi>) {
    return apiClient.post<TalentItemResponse<InterviewApi>>('/interview-schedules', { ...data, ...contextParams() })
  },
  updateInterview(id: LaravelId, data: Partial<InterviewApi>) {
    return apiClient.put<TalentItemResponse<InterviewApi>>(`/interview-schedules/${id}`, { ...data, ...contextParams() })
  },
  async getOffers() {
    const result = await apiClient.get<TalentListResponse<TalentOfferApi> | TalentOfferApi[]>('/offers', contextParams())
    return Array.isArray(result) ? result : result.data ?? []
  },
  createOffer(data: Record<string, unknown>) {
    return apiClient.post<TalentItemResponse<TalentOfferApi>>('/talent-offers', { ...data, ...contextParams() })
  },
  rejectOffer(id: LaravelId) {
    return apiClient.post<TalentItemResponse<TalentOfferApi>>(`/talent-offers/${id}/reject`, contextParams())
  },
  /**
   * The other half of the decision, and the point the hire becomes a person.
   *
   * The backend records the acceptance, creates the tbluser row from the
   * application and links the two, so nobody retypes the candidate into the
   * Employee Directory. Idempotent: accepting twice returns the same employee.
   */
  acceptOffer(id: LaravelId) {
    return apiClient.post<TalentItemResponse<TalentOfferApi> & { data?: { employee_id?: number; created?: boolean } }>(
      `/talent-offers/${id}/accept`,
      contextParams(),
    )
  },
  offerLetterUrl(id: LaravelId) {
    return buildApiUrl(`/talent-offer-letter/${id}`, contextParams())
  },
  /**
   * Mint (or re-issue) the link a candidate uses to accept or decline, with no
   * login. Returns the URL whether or not the email went out — outbound mail is
   * gated per organisation, so the recruiter can always paste it themselves.
   *
   * Re-issuing invalidates the previous link.
   */
  candidateLink(id: LaravelId) {
    return apiClient.post<{
      status: number
      message: string
      data: { url: string; expires_at: string; email_sent: boolean; email_error: string | null }
    }>(`/talent-offers/${id}/candidate-link`, contextParams())
  },
  getScreeningResult(candidateId: LaravelId) {
    return apiClient.get<CandidateScreeningResponse>(`/talent-screening-results/candidate/${candidateId}`, contextParams())
  },
  async getCandidateProfile(candidateId: LaravelId): Promise<CandidateProfileApi> {
    const [screening, applications] = await Promise.all([
      this.getScreeningResult(candidateId),
      this.getApplications(),
    ])
    const application = applications.find((item) => String(item.id) === String(candidateId))
    if (!application) {
      const error = new Error('Candidate application not found')
      Object.assign(error, { status: 404 })
      throw error
    }
    return { screening, application }
  },
  storeScreeningResult(data: Record<string, unknown>) {
    return apiClient.post<TalentItemResponse<ScreeningResultApi>>('/talent-screening-results', {
      ...data, ...contextParams(),
    })
  },
  async getPanels() {
    return (await apiClient.get<{ status: boolean; data: InterviewPanelApi[] }>('/interview-panel/list', contextParams())).data ?? []
  },
  async getInterviewers() {
    return (await apiClient.get<{ status: boolean; data: InterviewerApi[] }>('/interview-panel/users', contextParams())).data ?? []
  },
  createPanel(data: Omit<InterviewPanelApi, 'id'>) {
    return apiClient.post<TalentItemResponse<InterviewPanelApi>>('/interview-panel/store', { ...data, ...contextParams() })
  },
  updatePanel(id: LaravelId, data: Partial<InterviewPanelApi>) {
    return apiClient.put<TalentItemResponse<InterviewPanelApi>>(`/interview-panel/update/${id}`, { ...data, ...contextParams() })
  },
  deletePanel(id: LaravelId) {
    return apiClient.delete<{ message: string }>(`/interview-panel/delete/${id}`, contextParams())
  },
  createFeedback(data: FeedbackPayload) {
    return apiClient.post<{ status: boolean; message: string }>('/evaluation', { ...data, ...contextParams() })
  },
  async getFeedback() {
    return (await apiClient.get<{ status: boolean; data?: FeedbackApi[] }>('/feedback', contextParams())).data ?? []
  },
  getCandidateFeedback(candidateId: LaravelId) {
    return apiClient.get<{ status: boolean; data?: FeedbackApi }>(`/feedback/${candidateId}`, contextParams())
  },
  updateFeedback(id: LaravelId, data: FeedbackPayload) {
    return apiClient.put<{ status: boolean; message: string }>(`/feedback/${id}`, {
      ...data, ...contextParams(),
    })
  },
  deleteFeedback(id: LaravelId) {
    return apiClient.delete<{ status: boolean; message: string }>(`/feedback/${id}`, contextParams())
  },
  async getPendingFeedback() {
    try {
      const result = await apiClient.get<{ status: boolean; count: number; data?: FeedbackApi[] }>('/pending-feedback', contextParams())
      return result.data ?? []
    } catch (cause) {
      if (cause instanceof Error && 'status' in cause && cause.status === 404) return []
      throw cause
    }
  },
  recordDecision(interviewId: LaravelId, decision: 'hired' | 'rejected', notes?: string) {
    return apiClient.post<{ status: boolean; message: string }>(`/interviews/${interviewId}/decision`, {
      decision, notes, ...contextParams(),
    })
  },
  getRequisitions(page = 1, limit = 10) {
    const params = contextParams()
    return apiClient.post<RequisitionPage>('/talent-acquisition/requisitions', {
      ...params, page, limit, sortBy: 'age', order: 'desc',
    }, { headers: bearerHeaders() })
  },
  getFunnel() {
    const params = contextParams()
    return apiClient.post<FunnelResponse>('/talent-acquisition/funnel', params, { headers: bearerHeaders() })
  },
  async getTemplates() {
    const result = await apiClient.get<TalentListResponse<OfferTemplateApi> | OfferTemplateApi[]>('/talent-templates', contextParams())
    return Array.isArray(result) ? result : result.data ?? []
  },
  async getTeamOverview() {
    const result = await apiClient.get<{ data: TeamOverviewApi; recent_team_updates?: string[] }>('/talent/team-overview', contextParams())
    return result
  },

  /**
   * The candidate's assessment result, for the Screening tab.
   *
   * Returns null when they have not been invited — a normal state, not an
   * error, so the caller renders an invite prompt rather than a failure.
   */
  async getAssessment(applicationId: LaravelId) {
    const result = await apiClient.get<{ status: number; data: CandidateAssessmentResultApi | null }>(
      `/talent/applications/${applicationId}/assessment`,
      contextParams(),
    )
    return result.data ?? null
  },

  /**
   * Generate a paper for this candidate, mint their link and email it.
   *
   * Slow by nature — the model writes the questions before this returns — so
   * callers must show progress rather than assume it is instant.
   */
  async inviteAssessment(applicationId: LaravelId, blueprintId?: number) {
    return apiClient.post<{ status: number; message: string; data: AssessmentInviteApi }>(
      `/talent/applications/${applicationId}/assessment/invite`,
      { ...contextParams(), ...(blueprintId ? { blueprint_id: blueprintId } : {}) },
    )
  },

  async getAssessmentBlueprints() {
    return apiClient.get<{ status: number; data: AssessmentBlueprintApi[]; test_types: Record<string, string> }>(
      '/talent/assessment/blueprints',
      contextParams(),
    )
  },

  async saveAssessmentBlueprint(payload: AssessmentBlueprintPayload) {
    return apiClient.post<{ status: number; message: string; data: { id: number } }>(
      '/talent/assessment/blueprints',
      { ...payload, ...contextParams() },
    )
  },

  async deleteAssessmentBlueprint(id: number) {
    return apiClient.delete<{ status: number; message: string }>(
      `/talent/assessment/blueprints/${id}`,
      contextParams(),
    )
  },

  /**
   * Employees for a person-picker, tenant-scoped by the caller's token.
   *
   * Reuses the existing /competency/employee-options rather than adding a
   * recruitment-specific list: it already returns id, name and employee_no for
   * this organisation, capped at 500 and searchable. A second endpoint doing the
   * same thing is how two lists end up disagreeing about who works here.
   */
  async getEmployeeOptions(search?: string) {
    return apiClient.get<{ status: number; data: EmployeeOptionApi[] }>(
      '/competency/employee-options',
      contextParams(search ? { search } : undefined),
    )
  },

  /** The global job-role catalogue: 3,347 roles across 44 sectors. */
  async getAssessmentJobRoles(params?: { sector?: string; q?: string }) {
    return apiClient.get<{ status: number; data: AssessmentJobRoleApi[]; sectors: string[] }>(
      '/talent/assessment/jobroles',
      contextParams(params as Record<string, string> | undefined),
    )
  },
}
