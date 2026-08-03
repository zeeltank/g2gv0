export interface OffboardingCase {
  id: number
  sub_institute_id: number
  employee_id: number
  department_id: number | null
  designation: string | null
  manager_id: number | null
  owner_id: number | null
  case_code: string
  exit_type: 'resignation' | 'termination' | 'retirement' | 'absconding' | 'death'
  exit_reason: string | null
  resignation_date: string | null
  last_working_day: string | null
  notice_period_days: number | null
  status: 'resignation-submitted' | 'notice-period' | 'clearance' | 'exit-interview' | 'awaiting-fnf' | 'closed'
  fnf_status: 'pending' | 'in-progress' | 'settled' | 'hold'
  notes: string | null
  created_at: string
  updated_at: string

  // Joined relations presented by controller
  employee_name?: string
  employee_code?: string
  employee_initials?: string
  department_name?: string
  manager_name?: string
  owner_name?: string
}

export interface OffboardingClearance {
  id: number
  case_id: number
  sub_institute_id: number
  clearance_type: 'manager' | 'it' | 'finance' | 'admin' | 'hr' | 'other'
  title: string
  description: string | null
  status: 'pending' | 'in-progress' | 'cleared' | 'waived'
  due_date: string | null
  cleared_by: number | null
  cleared_at: string | null
  remarks: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ExitInterview {
  id: number
  case_id: number
  sub_institute_id: number
  interviewer_id: number | null
  interview_date: string | null
  status: 'scheduled' | 'completed' | 'skipped'
  feedback_rating: number | null
  reason_for_leaving: string | null
  positive_aspects: string | null
  areas_for_improvement: string | null
  would_recommend: boolean | null
  rehire_eligibility: boolean | null
  comments: string | null
  created_at: string
  updated_at: string
}

export interface OffboardingCaseDetails extends OffboardingCase {
  clearances: OffboardingClearance[]
  exit_interview: ExitInterview | null
}

export interface OffboardingSummary {
  total_exits: number
  resignations: number
  notice_period: number
  clearance_pending: number
  exit_interviews: number
  closed: number
}

export interface OffboardingCasesResponse {
  data: OffboardingCase[]
  meta: {
    pagination: {
      page: number
      per_page: number
      total: number
      last_page: number
    }
    summary: OffboardingSummary
  }
}
