export type CandidateStage = 'Applied' | 'Screened' | 'Assessment' | 'Interview' | 'Offer' | 'Hired' | 'Rejected'
export type RequisitionStatus = 'Open' | 'Closed'
export type JobStatus = 'Open' | 'Closed'
export type InterviewStatus = 'Scheduled' | 'Completed' | 'Cancelled'
export type OfferStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined'

export interface Candidate {
  id: string
  name: string
  role: string
  jobOpening: string
  stage: CandidateStage
  source: string
  recruiter: string
  recruiterInitials: string
  location: string
  experience: string
  noticePeriod: string
  expectedCtc: string
  resume: string
  appliedOn: string
  lastUpdated: string
  starred: boolean
  email: string
  phone: string
  avatar?: string
  rating?: number | string
  skills?: string
  status?: string
  department?: string
}

export interface Requisition {
  id: string
  title: string
  department: string
  location: string
  headcount: number
  filled: number
  status: RequisitionStatus
  createdBy: string
  createdOn: string
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
}

export interface JobOpening {
  id: string
  title: string
  department: string
  location: string
  type: 'Internal' | 'External' | 'Both'
  status: JobStatus
  applications: number
  postedOn: string
  closingDate: string
}

export interface Interview {
  id: string
  candidateName: string
  jobTitle: string
  interviewers: string[]
  scheduledAt: string
  duration: string
  type: 'Phone' | 'Video' | 'In-Person' | 'Panel'
  status: InterviewStatus
  round: number
}

export interface Offer {
  id: string
  candidateName: string
  jobTitle: string
  ctc: string
  joiningDate: string
  status: OfferStatus
  approvedBy: string
  sentOn: string
}

export const PIPELINE_STAGES: { id: CandidateStage; label: string; color: string }[] = [
  { id: 'Applied', label: 'Applied', color: 'bg-muted-foreground/20' },
  { id: 'Screened', label: 'Screened', color: 'bg-primary/20' },
  { id: 'Assessment', label: 'Assessment', color: 'bg-warning/20' },
  { id: 'Interview', label: 'Interview', color: 'bg-primary/30' },
  { id: 'Offer', label: 'Offer', color: 'bg-success/20' },
  { id: 'Hired', label: 'Hired', color: 'bg-success/30' },
]
