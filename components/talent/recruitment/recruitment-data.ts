// Types and mock data for the Recruitment & ATS Center

export type CandidateStage = 'Applied' | 'Screened' | 'Assessment' | 'Interview' | 'Offer' | 'Hired' | 'Rejected'

export type RequisitionStatus = 'Open' | 'Pending Approval' | 'Approved' | 'Closed' | 'On Hold'

export type JobStatus = 'Active' | 'Draft' | 'Paused' | 'Closed'

export type InterviewStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'No Show'

export type OfferStatus = 'Draft' | 'Pending Approval' | 'Sent' | 'Accepted' | 'Declined' | 'Negotiating'

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

export interface TimelineEvent {
  id: string
  type: 'stage_change' | 'interview' | 'assessment' | 'note' | 'email'
  title: string
  description: string
  user: string
  timestamp: string
}

// Stage configuration for Kanban
export const PIPELINE_STAGES: { id: CandidateStage; label: string; color: string }[] = [
  { id: 'Applied', label: 'Applied', color: 'bg-muted-foreground/20' },
  { id: 'Screened', label: 'Screened', color: 'bg-primary/20' },
  { id: 'Assessment', label: 'Assessment', color: 'bg-warning/20' },
  { id: 'Interview', label: 'Interview', color: 'bg-primary/30' },
  { id: 'Offer', label: 'Offer', color: 'bg-success/20' },
  { id: 'Hired', label: 'Hired', color: 'bg-success/30' },
  { id: 'Rejected', label: 'Rejected', color: 'bg-destructive/20' },
]

// Mock candidates
export const mockCandidates: Candidate[] = [
  { id: 'ca1', name: 'Ananya Rao', role: 'Product Designer', jobOpening: 'Product Designer', stage: 'Interview', source: 'LinkedIn', recruiter: 'Ritika Sharma', recruiterInitials: 'RS', location: 'Bengaluru, India', experience: '4.5 Years', noticePeriod: '30 Days', expectedCtc: '₹18.0 LPA', resume: 'Ananya_Rao_Resume.pdf', appliedOn: '02 May 2025', lastUpdated: 'Today 10:30 AM', starred: false, email: 'ananya.rao@email.com', phone: '+91 98765 43210' },
  { id: 'ca2', name: 'Rohit Verma', role: 'Data Analyst', jobOpening: 'Data Analyst', stage: 'Assessment', source: 'Naukri', recruiter: 'Amit Verma', recruiterInitials: 'AV', location: 'Mumbai, India', experience: '3 Years', noticePeriod: '60 Days', expectedCtc: '₹12.0 LPA', resume: 'Rohit_Verma_Resume.pdf', appliedOn: '01 May 2025', lastUpdated: 'Today 09:15 AM', starred: false, email: 'rohit.verma@email.com', phone: '+91 98765 43211' },
  { id: 'ca3', name: 'Neha Sharma', role: 'Frontend Developer', jobOpening: 'Frontend Developer', stage: 'Screened', source: 'Employee Referral', recruiter: 'Ritika Sharma', recruiterInitials: 'RS', location: 'Delhi, India', experience: '5 Years', noticePeriod: '30 Days', expectedCtc: '₹22.0 LPA', resume: 'Neha_Sharma_Resume.pdf', appliedOn: '30 Apr 2025', lastUpdated: 'Yesterday 06:20 PM', starred: true, email: 'neha.sharma@email.com', phone: '+91 98765 43212' },
  { id: 'ca4', name: 'Karan Patel', role: 'UI/UX Designer', jobOpening: 'UI/UX Designer', stage: 'Screened', source: 'LinkedIn', recruiter: 'Ankit Soni', recruiterInitials: 'AS', location: 'Pune, India', experience: '2.5 Years', noticePeriod: '30 Days', expectedCtc: '₹10.0 LPA', resume: 'Karan_Patel_Resume.pdf', appliedOn: '29 Apr 2025', lastUpdated: 'Yesterday 05:10 PM', starred: false, email: 'karan.patel@email.com', phone: '+91 98765 43213' },
  { id: 'ca5', name: 'Pooja Desai', role: 'UX Designer', jobOpening: 'UX Designer', stage: 'Offer', source: 'Company Career Site', recruiter: 'Ritika Sharma', recruiterInitials: 'RS', location: 'Hyderabad, India', experience: '6 Years', noticePeriod: '90 Days', expectedCtc: '₹25.0 LPA', resume: 'Pooja_Desai_Resume.pdf', appliedOn: '27 Apr 2025', lastUpdated: '02 May 2025 11:05 AM', starred: false, email: 'pooja.desai@email.com', phone: '+91 98765 43214' },
  { id: 'ca6', name: 'Arjun Mehta', role: 'Frontend Developer', jobOpening: 'Frontend Developer', stage: 'Applied', source: 'Indeed', recruiter: 'Ritika Sharma', recruiterInitials: 'RS', location: 'Chennai, India', experience: '2 Years', noticePeriod: '15 Days', expectedCtc: '₹8.0 LPA', resume: 'Arjun_Mehta_Resume.pdf', appliedOn: '01 May 2025', lastUpdated: '2 days ago', starred: false, email: 'arjun.mehta@email.com', phone: '+91 98765 43215' },
  { id: 'ca7', name: 'Priya Nair', role: 'Product Designer', jobOpening: 'Product Designer', stage: 'Applied', source: 'Naukri', recruiter: 'Amit Verma', recruiterInitials: 'AV', location: 'Bengaluru, India', experience: '3 Years', noticePeriod: '30 Days', expectedCtc: '₹14.0 LPA', resume: 'Priya_Nair_Resume.pdf', appliedOn: '30 Apr 2025', lastUpdated: '3 days ago', starred: false, email: 'priya.nair@email.com', phone: '+91 98765 43216' },
  { id: 'ca8', name: 'Rahul Singh', role: 'Backend Developer', jobOpening: 'Backend Developer', stage: 'Applied', source: 'LinkedIn', recruiter: 'Ankit Soni', recruiterInitials: 'AS', location: 'Noida, India', experience: '4 Years', noticePeriod: '60 Days', expectedCtc: '₹20.0 LPA', resume: 'Rahul_Singh_Resume.pdf', appliedOn: '28 Apr 2025', lastUpdated: '3 days ago', starred: false, email: 'rahul.singh@email.com', phone: '+91 98765 43217' },
  { id: 'ca9', name: 'Siddharth Jain', role: 'Backend Developer', jobOpening: 'Backend Developer', stage: 'Interview', source: 'Employee Referral', recruiter: 'Ritika Sharma', recruiterInitials: 'RS', location: 'Bengaluru, India', experience: '5 Years', noticePeriod: '30 Days', expectedCtc: '₹24.0 LPA', resume: 'Siddharth_Jain_Resume.pdf', appliedOn: '25 Apr 2025', lastUpdated: '1 day ago', starred: false, email: 'siddharth.jain@email.com', phone: '+91 98765 43218' },
  { id: 'ca10', name: 'Aisha Khan', role: 'Product Manager', jobOpening: 'Product Manager', stage: 'Assessment', source: 'LinkedIn', recruiter: 'Amit Verma', recruiterInitials: 'AV', location: 'Mumbai, India', experience: '7 Years', noticePeriod: '90 Days', expectedCtc: '₹35.0 LPA', resume: 'Aisha_Khan_Resume.pdf', appliedOn: '24 Apr 2025', lastUpdated: '2 days ago', starred: true, email: 'aisha.khan@email.com', phone: '+91 98765 43219' },
  { id: 'ca11', name: 'Vikram Joshi', role: 'DevOps Engineer', jobOpening: 'DevOps Engineer', stage: 'Assessment', source: 'Naukri', recruiter: 'Ankit Soni', recruiterInitials: 'AS', location: 'Pune, India', experience: '4.5 Years', noticePeriod: '60 Days', expectedCtc: '₹22.0 LPA', resume: 'Vikram_Joshi_Resume.pdf', appliedOn: '22 Apr 2025', lastUpdated: '3 days ago', starred: false, email: 'vikram.joshi@email.com', phone: '+91 98765 43220' },
  { id: 'ca12', name: 'Sneha Iyer', role: 'QA Engineer', jobOpening: 'QA Engineer', stage: 'Applied', source: 'Company Career Site', recruiter: 'Ritika Sharma', recruiterInitials: 'RS', location: 'Bengaluru, India', experience: '3 Years', noticePeriod: '30 Days', expectedCtc: '₹12.0 LPA', resume: 'Sneha_Iyer_Resume.pdf', appliedOn: '20 Apr 2025', lastUpdated: '2 days ago', starred: false, email: 'sneha.iyer@email.com', phone: '+91 98765 43221' },
  { id: 'ca13', name: 'Manish Kumar', role: 'Data Engineer', jobOpening: 'Data Engineer', stage: 'Interview', source: 'LinkedIn', recruiter: 'Amit Verma', recruiterInitials: 'AV', location: 'Hyderabad, India', experience: '5 Years', noticePeriod: '60 Days', expectedCtc: '₹26.0 LPA', resume: 'Manish_Kumar_Resume.pdf', appliedOn: '18 Apr 2025', lastUpdated: '2 days ago', starred: false, email: 'manish.kumar@email.com', phone: '+91 98765 43222' },
  { id: 'ca14', name: 'Aditya Nair', role: 'Backend Developer', jobOpening: 'Backend Developer', stage: 'Offer', source: 'Employee Referral', recruiter: 'Ritika Sharma', recruiterInitials: 'RS', location: 'Chennai, India', experience: '6 Years', noticePeriod: '30 Days', expectedCtc: '₹28.0 LPA', resume: 'Aditya_Nair_Resume.pdf', appliedOn: '15 Apr 2025', lastUpdated: 'Offer Sent', starred: false, email: 'aditya.nair@email.com', phone: '+91 98765 43223' },
  { id: 'ca15', name: 'Kavya Reddy', role: 'Product Designer', jobOpening: 'Product Designer', stage: 'Hired', source: 'LinkedIn', recruiter: 'Ankit Soni', recruiterInitials: 'AS', location: 'Bengaluru, India', experience: '4 Years', noticePeriod: '30 Days', expectedCtc: '₹16.0 LPA', resume: 'Kavya_Reddy_Resume.pdf', appliedOn: '10 Apr 2025', lastUpdated: 'Joined 2 days ago', starred: false, email: 'kavya.reddy@email.com', phone: '+91 98765 43224' },
  { id: 'ca16', name: 'Saurabh Gupta', role: 'Data Analyst', jobOpening: 'Data Analyst', stage: 'Hired', source: 'Naukri', recruiter: 'Amit Verma', recruiterInitials: 'AV', location: 'Delhi, India', experience: '3 Years', noticePeriod: '30 Days', expectedCtc: '₹11.0 LPA', resume: 'Saurabh_Gupta_Resume.pdf', appliedOn: '05 Apr 2025', lastUpdated: 'Joined 5 days ago', starred: false, email: 'saurabh.gupta@email.com', phone: '+91 98765 43225' },
  { id: 'ca17', name: 'Harsh Thakur', role: 'Backend Developer', jobOpening: 'Backend Developer', stage: 'Rejected', source: 'Indeed', recruiter: 'Ritika Sharma', recruiterInitials: 'RS', location: 'Pune, India', experience: '1 Year', noticePeriod: '15 Days', expectedCtc: '₹6.0 LPA', resume: 'Harsh_Thakur_Resume.pdf', appliedOn: '01 Apr 2025', lastUpdated: 'Not a Fit', starred: false, email: 'harsh.thakur@email.com', phone: '+91 98765 43226' },
  { id: 'ca18', name: 'Meera Iqbal', role: 'QA Engineer', jobOpening: 'QA Engineer', stage: 'Rejected', source: 'Company Career Site', recruiter: 'Ankit Soni', recruiterInitials: 'AS', location: 'Mumbai, India', experience: '2 Years', noticePeriod: '30 Days', expectedCtc: '₹9.0 LPA', resume: 'Meera_Iqbal_Resume.pdf', appliedOn: '28 Mar 2025', lastUpdated: 'Not a Fit', starred: false, email: 'meera.iqbal@email.com', phone: '+91 98765 43227' },
]

// Mock timeline events
export const mockTimeline: TimelineEvent[] = [
  { id: 't1', type: 'stage_change', title: 'Stage moved to Interview', description: 'by Ritika Sharma', user: 'Ritika Sharma', timestamp: 'Today 10:30 AM' },
  { id: 't2', type: 'interview', title: 'Interview Scheduled with Panel', description: 'by Ritika Sharma', user: 'Ritika Sharma', timestamp: 'Today 10:15 AM' },
  { id: 't3', type: 'assessment', title: 'Assessment Completed', description: 'by System', user: 'System', timestamp: '01 May 2025 04:45 PM' },
  { id: 't4', type: 'stage_change', title: 'Stage moved to Assessment', description: 'by Ritika Sharma', user: 'Ritika Sharma', timestamp: '01 May 2025 04:40 PM' },
  { id: 't5', type: 'stage_change', title: 'Application Received', description: 'by System', user: 'System', timestamp: '02 May 2025 09:20 AM' },
]

// Mock requisitions
export const mockRequisitions: Requisition[] = [
  { id: 'REQ-1001', title: 'Senior Software Engineer', department: 'Engineering', location: 'Bengaluru', headcount: 3, filled: 1, status: 'Open', createdBy: 'Rahul Mehta', createdOn: '15 Apr 2025', priority: 'Critical' },
  { id: 'REQ-1002', title: 'Product Manager', department: 'Product', location: 'Mumbai', headcount: 1, filled: 0, status: 'Pending Approval', createdBy: 'Neha Joshi', createdOn: '18 Apr 2025', priority: 'High' },
  { id: 'REQ-1003', title: 'Data Analyst', department: 'Analytics', location: 'Delhi', headcount: 2, filled: 1, status: 'Open', createdBy: 'Amit Verma', createdOn: '20 Apr 2025', priority: 'Medium' },
  { id: 'REQ-1004', title: 'UX Designer', department: 'Design', location: 'Pune', headcount: 2, filled: 0, status: 'Approved', createdBy: 'Priya Nair', createdOn: '22 Apr 2025', priority: 'High' },
  { id: 'REQ-1005', title: 'DevOps Engineer', department: 'Infrastructure', location: 'Hyderabad', headcount: 1, filled: 0, status: 'Open', createdBy: 'Vikram Joshi', createdOn: '25 Apr 2025', priority: 'Critical' },
]

// Mock job openings
export const mockJobOpenings: JobOpening[] = [
  { id: 'JOB-2001', title: 'Senior Software Engineer', department: 'Engineering', location: 'Bengaluru', type: 'Both', status: 'Active', applications: 156, postedOn: '20 Apr 2025', closingDate: '20 Jun 2025' },
  { id: 'JOB-2002', title: 'Product Designer', department: 'Design', location: 'Mumbai', type: 'External', status: 'Active', applications: 89, postedOn: '22 Apr 2025', closingDate: '22 Jun 2025' },
  { id: 'JOB-2003', title: 'Data Analyst', department: 'Analytics', location: 'Delhi', type: 'Both', status: 'Active', applications: 214, postedOn: '18 Apr 2025', closingDate: '18 Jun 2025' },
  { id: 'JOB-2004', title: 'Frontend Developer', department: 'Engineering', location: 'Bengaluru', type: 'External', status: 'Active', applications: 178, postedOn: '25 Apr 2025', closingDate: '25 Jun 2025' },
  { id: 'JOB-2005', title: 'Backend Developer', department: 'Engineering', location: 'Chennai', type: 'Internal', status: 'Active', applications: 42, postedOn: '28 Apr 2025', closingDate: '28 Jun 2025' },
]

// Mock interviews  
export const mockInterviews: Interview[] = [
  { id: 'INT-3001', candidateName: 'Ananya Rao', jobTitle: 'Product Designer', interviewers: ['Rajesh Kumar', 'Priya Nair'], scheduledAt: '03 May 2025, 10:00 AM', duration: '60 min', type: 'Video', status: 'Scheduled', round: 2 },
  { id: 'INT-3002', candidateName: 'Siddharth Jain', jobTitle: 'Backend Developer', interviewers: ['Vikram Joshi', 'Amit Verma'], scheduledAt: '03 May 2025, 02:00 PM', duration: '45 min', type: 'Video', status: 'Scheduled', round: 1 },
  { id: 'INT-3003', candidateName: 'Manish Kumar', jobTitle: 'Data Engineer', interviewers: ['Aisha Khan'], scheduledAt: '04 May 2025, 11:00 AM', duration: '60 min', type: 'Phone', status: 'Scheduled', round: 1 },
  { id: 'INT-3004', candidateName: 'Rohit Verma', jobTitle: 'Data Analyst', interviewers: ['Neha Joshi', 'Rahul Mehta'], scheduledAt: '02 May 2025, 03:00 PM', duration: '45 min', type: 'Panel', status: 'Completed', round: 1 },
]

// Mock offers
export const mockOffers: Offer[] = [
  { id: 'OFR-4001', candidateName: 'Pooja Desai', jobTitle: 'UX Designer', ctc: '₹25.0 LPA', joiningDate: '01 Jun 2025', status: 'Sent', approvedBy: 'Rajesh Kumar', sentOn: '01 May 2025' },
  { id: 'OFR-4002', candidateName: 'Aditya Nair', jobTitle: 'Backend Developer', ctc: '₹28.0 LPA', joiningDate: '15 Jun 2025', status: 'Sent', approvedBy: 'Vikram Joshi', sentOn: '30 Apr 2025' },
  { id: 'OFR-4003', candidateName: 'Kavya Reddy', jobTitle: 'Product Designer', ctc: '₹16.0 LPA', joiningDate: '10 May 2025', status: 'Accepted', approvedBy: 'Priya Nair', sentOn: '20 Apr 2025' },
  { id: 'OFR-4004', candidateName: 'Saurabh Gupta', jobTitle: 'Data Analyst', ctc: '₹11.0 LPA', joiningDate: '05 May 2025', status: 'Accepted', approvedBy: 'Amit Verma', sentOn: '15 Apr 2025' },
]
