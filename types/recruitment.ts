export type LaravelId = number | string

export interface TalentListResponse<T> { message?: string; data: T[] }
export interface TalentItemResponse<T> {
  message?: string
  data: T
  status?: number | boolean
  success?: boolean
}

export interface JobPostingApi {
  id: LaravelId
  title: string
  department_id: LaravelId
  department_name?: string | null
  location: string
  employment_type: string
  experience?: string | null
  education?: string | null
  priority_level?: string | null
  positions: number
  min_salary?: string | number | null
  max_salary?: string | number | null
  start_date?: string | null
  end_date?: string | null
  deadline?: string | null
  skills?: string | null
  certifications?: string | null
  benefits?: string | null
  description?: string | null
  status: 'active' | 'inactive' | 'draft'
  created_at?: string | null
  updated_at?: string | null
  created_by?: LaravelId | null
}

export interface JobApplicationApi {
  id: LaravelId
  job_id: LaravelId
  first_name: string
  middle_name?: string | null
  last_name: string
  email: string
  mobile: string
  current_location?: string | null
  employment_type?: string | null
  experience?: string | null
  education?: string | null
  current_salary?: string | number | null
  expected_salary?: string | number | null
  skills?: string | null
  certifications?: string | null
  resume_path?: string | null
  photo?: string | null
  candidate_photo?: string | null
  profile_url?: string | null
  qualification?: string | null
  applied_date?: string | null
  status: string
  job_title?: string | null
  position?: string | null
  created_at?: string | null
  updated_at?: string | null
  created_by?: LaravelId | null
  source?: string | null
  recruiter_id?: LaravelId | null
  recruiter_name?: string | null
}

export type RecruitmentKanbanStage = 'Applied' | 'Screened' | 'Assessment' | 'Interview' | 'Offer' | 'Hired'

export interface CandidateKanbanApi extends JobApplicationApi {
  candidate_id: LaravelId
  candidate_name: string
  position_id?: LaravelId | null
  position?: string | null
  name?: string | null
  job?: { title?: string | null } | null
  job_posting?: { title?: string | null } | null
  job_title?: string | null
  department_id?: LaravelId | null
  department_name?: string | null
  recruiter_id?: LaravelId | null
  recruiter_name?: string | null
  source?: string | null
  avatar?: string | null
  stage: RecruitmentKanbanStage
  rating?: number | string | null
  screening_completed?: boolean | number
  competency_match?: number | null
  overall_fit_score?: number | null
  ranking_score?: number | null
  cultural_fit?: string | number | null
  predicted_success?: string | null
  interview_id?: LaravelId | null
  interview_date?: string | null
  interview_time?: string | null
  interview_status?: string | null
  offer_id?: LaravelId | null
  offer_status?: string | null
  offer_salary?: string | number | null
  joining_date?: string | null
}

export interface CandidateKanbanResponse {
  success: boolean
  message?: string
  data: CandidateKanbanApi[]
  stage_counts: Record<RecruitmentKanbanStage, number>
  total: number
  filters?: {
    jobs?: Array<{ id: LaravelId; label: string }>
    recruiters?: Array<{ id: LaravelId; label: string }>
    locations?: string[]
    sources?: string[]
  }
}

export interface InterviewApi {
  id: LaravelId
  job_id: LaravelId
  applicant_id: LaravelId
  round_no?: number | null
  interview_date?: string | null
  time?: string | null
  duration?: string | number | null
  location?: string | null
  interviewer_id?: LaravelId[] | string | null
  panel_id?: LaravelId | null
  panel_name?: string | null
  status: string
  title?: string | null
  candidate_name?: string | null
  first_name?: string | null
  last_name?: string | null
  additional_notes?: string | null
}

export interface TalentOfferApi {
  id: LaravelId
  application_id: LaravelId
  job_id: LaravelId
  template_id?: LaravelId | null
  candidate_name?: string | null
  position?: string | null
  candidateEmail?: string | null
  salary?: string | number | null
  start_date?: string | null
  status: string
  reportmanager?: string | LaravelId | null
  created_at?: string | null
  updated_at?: string | null
  offer_letter_url?: string | null
}

export interface RequisitionApi {
  id: LaravelId
  title?: string | null
  department_name?: string | null
  department?: string | null
  location?: string | null
  positions?: number | null
  filled?: number | null
  status?: string | null
  priority_level?: string | null
  created_by?: string | number | null
  created_at?: string | null
}

export interface RequisitionPage {
  success: boolean
  page: number
  limit: number
  total: number
  data: RequisitionApi[]
}

export interface FunnelResponse {
  success: boolean
  data: Array<{ name: string; value: number }>
}

export interface ScreeningResultApi {
  id: LaravelId
  candidate_id: LaravelId
  competency_match?: number | null
  cultural_fit?: number | null
  skill_gaps?: string[] | null
  strengths?: string[] | null
  deepseek_analysis?: Record<string, unknown> | null
}

export interface CandidateScreeningResponse {
  success: boolean
  candidateId: LaravelId
  competency_match?: number | null
  cultural_fit?: string | number | null
  predicted_success?: string | null
  summary?: string | null
  skill_gaps?: string[]
  strengths?: string[]
  recommendation?: string | null
  ranking_score?: number | null
  skill_match_details?: Array<{
    competency?: string
    matched?: boolean
    extractedSkill?: string
    confidence?: number
    proficiency?: string
  }>
  scoringPipeline?: {
    bert_parsed_resume?: {
      totalSkillsFound?: number
      yearsExperience?: number
      educationLevel?: string
      extractionScore?: number
    }
    competency_scoring?: {
      overallFitScore?: number
      rankingScore?: number
      culturalFitIndex?: number
      matchedCompetencies?: number
      totalRequired?: number
    }
    deepseek_validation?: {
      competency_match?: number
      cultural_fit?: string | number
      predicted_success?: string
      summary?: string
      skill_gaps?: string[]
      strengths?: string[]
      recommendation?: string
      reasoning?: string
    }
    match_percentage?: number
    detailed_matches?: {
      skills_match?: number
      education_match?: number
      experience_match?: number
    } | null
  }
}

export interface CandidateProfileApi {
  application: JobApplicationApi
  screening: CandidateScreeningResponse
}

export interface InterviewPanelApi {
  id: LaravelId
  panel_name: string
  target_positions?: string | null
  description?: string | null
  available_interviewers?: string | LaravelId[] | null
  status: 'available' | 'assigned' | 'inactive' | 'active'
  schedules?: Array<{
    id: LaravelId
    interview_date?: string | null
    time?: string | null
    status?: string | null
  }>
}

export interface FeedbackPayload {
  job_id: LaravelId
  candidate_id: LaravelId
  panel_id: LaravelId
  evaluation_criteria: Array<{ name: string; score: number }>
  recommendation?: string
  key_strengths?: string
  areas_of_concern?: string
  additional_comments?: string
  notes?: string
  status?: 'draft' | 'submitted' | 'approved' | 'rejected'
}

export interface InterviewerApi {
  id: LaravelId
  name?: string | null
  first_name?: string | null
  last_name?: string | null
  jobrole?: string | null
  job_role?: string | null
  skills?: string[]
}

export interface FeedbackApi extends FeedbackPayload {
  id: LaravelId
  candidate_name?: string | null
  job_title?: string | null
  panel_name?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface OfferTemplateApi {
  id: LaravelId
  title: string
  module_name?: string | null
  content?: string | null
}

export interface TeamOverviewApi {
  open_positions?: number
  total_applications?: number
  interviews_scheduled?: number
  hired_candidates?: number
  [key: string]: string | number | null | undefined
}

/**
 * The candidate's assessment, as HR sees it on the Screening tab.
 *
 * `qualified` is TRI-STATE and must stay that way: true, false, and null for
 * "not judged yet" — a paper still awaiting human marking is not a fail.
 * Collapsing null to false would show a candidate as rejected while their
 * written answers are still being marked.
 */
export interface CandidateAssessmentResultApi {
  id: number
  status: 'invited' | 'started' | 'submitted' | 'graded' | string
  title: string | null
  score: number | null
  max_score: number | null
  percent: number | null
  /** The pass mark HR set, in MARKS not percent. */
  qualification_marks: number | null
  qualified: boolean | null
  invited_at: string | null
  submitted_at: string | null
  graded_at: string | null
  expires_at: string | null
  link_used: boolean
  answers: CandidateAssessmentAnswerApi[]
}

export interface CandidateAssessmentAnswerApi {
  question_id: number
  format: string
  question: string
  answer: string | null
  /** null means nobody has marked it yet — NOT a zero. */
  score: number | null
  max_score: number
  scored_by: 'auto' | 'ai' | 'human' | string | null
  /** The model's one-sentence reason, so a recruiter overriding a mark can see it. */
  ai_feedback: string | null
}

export interface AssessmentInviteApi {
  application_id: number
  test_id: number
  url: string
  expires_at: string
  email_sent: boolean
  email_error: string | null
}

export interface AssessmentBlueprintApi {
  id: number
  department_id: number | null
  department_name: string | null
  jobrole_id: number
  jobrole: string | null
  sector: string | null
  title: string | null
  test_types: string[]
  question_count: number
  total_marks: number
  qualification_marks: number
  time_limit_minutes: number | null
  is_active: boolean
  updated_at: string | null
}

export interface AssessmentBlueprintPayload {
  id?: number
  department_id?: number | null
  jobrole_id: number
  title?: string | null
  test_types: string[]
  question_count: number
  total_marks: number
  qualification_marks: number
  time_limit_minutes?: number | null
  is_active?: boolean
}

export interface AssessmentJobRoleApi {
  id: number
  jobrole: string
  sector: string | null
  track: string | null
}

/** One row of the employee picker, from /competency/employee-options. */
export interface EmployeeOptionApi {
  id: LaravelId
  name?: string | null
  first_name?: string | null
  last_name?: string | null
  employee_no?: string | null
}
