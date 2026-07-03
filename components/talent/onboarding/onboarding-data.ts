export interface OnboardingKPI {
  id: string
  title: string
  value: string | number
  subtext?: string
  icon?: string
}

export interface PreboardingTask {
  id: string
  title: string
  category: string
  dueDate: string
  owner: {
    name: string
    avatar?: string
    initials: string
  }
  status: 'Pending' | 'Completed' | 'Sent' | 'In Progress'
}

export interface JourneyStep {
  id: string
  title: string
  date?: string
  status: 'Completed' | 'In Progress' | 'Pending'
  description?: string
}

export interface IntegrationTask {
  id: string
  title: string
  description: string
  status: 'Not Started' | 'In Progress' | 'Completed'
  icon: 'it' | 'learning' | 'payroll' | 'benefits' | 'compliance'
}

export interface OnboardingDocument {
  id: string
  title: string
  fileName: string
  status: 'Sent' | 'Pending' | 'Completed'
}

export interface KeyContact {
  id: string
  role: string
  name: string
  email: string
}

export const mockOnboardingKPIs: OnboardingKPI[] = [
  { id: 'k1', title: 'Preboarding Pending', value: 24, icon: 'users' },
  { id: 'k2', title: 'Active Onboarding', value: 38, icon: 'user-check' },
  { id: 'k3', title: 'First Day This Week', value: 12, icon: 'calendar' },
  { id: 'k4', title: 'Onboarding Completion', value: '68%', icon: 'check-circle' },
  { id: 'k5', title: 'Probation Due', value: 16, icon: 'shield' },
]

export const mockPreboardingTasks: PreboardingTask[] = [
  { id: 't1', title: 'Upload Identity Proof', category: 'Documents', dueDate: '15 May 2025', owner: { name: 'Riya Kapoor', initials: 'RK' }, status: 'Pending' },
  { id: 't2', title: 'Upload Address Proof', category: 'Documents', dueDate: '15 May 2025', owner: { name: 'Riya Kapoor', initials: 'RK' }, status: 'Pending' },
  { id: 't3', title: 'Bank Details', category: 'Compliance', dueDate: '16 May 2025', owner: { name: 'Riya Kapoor', initials: 'RK' }, status: 'Pending' },
  { id: 't4', title: 'Employment Agreement', category: 'Documents', dueDate: '16 May 2025', owner: { name: 'HR Team', initials: 'HR' }, status: 'Sent' },
  { id: 't5', title: 'Background Verification Consent', category: 'Compliance', dueDate: '16 May 2025', owner: { name: 'Riya Kapoor', initials: 'RK' }, status: 'Pending' },
  { id: 't6', title: 'IT Asset Preference', category: 'IT', dueDate: '17 May 2025', owner: { name: 'IT Team', initials: 'IT' }, status: 'Pending' },
  { id: 't7', title: 'Emergency Contact Details', category: 'Personal', dueDate: '17 May 2025', owner: { name: 'Riya Kapoor', initials: 'RK' }, status: 'Completed' },
]

export const mockJourneySteps: JourneyStep[] = [
  { id: 's1', title: 'Offer Accepted', date: '02 May 2025', status: 'Completed' },
  { id: 's2', title: 'Preboarding', description: '02 May - 15 May 2025', status: 'In Progress' },
  { id: 's3', title: 'First Day', description: '16 May 2025', status: 'Pending' },
  { id: 's4', title: 'Orientation & Training', description: '17 May - 30 May 2025', status: 'Pending' },
  { id: 's5', title: 'Team Integration', description: '01 Jun - 30 Jun 2025', status: 'Pending' },
  { id: 's6', title: 'Probation Period', description: '01 Jun - 15 Aug 2025', status: 'Pending' },
  { id: 's7', title: 'Confirmation', description: 'After 15 Aug 2025', status: 'Pending' },
]

export const mockIntegrations: IntegrationTask[] = [
  { id: 'i1', title: 'IT Provisioning', description: 'Laptop, Access, Accounts', status: 'In Progress', icon: 'it' },
  { id: 'i2', title: 'Learning & Training', description: 'Mandatory Courses', status: 'Not Started', icon: 'learning' },
  { id: 'i3', title: 'Payroll Setup', description: 'Bank, PF, Tax', status: 'In Progress', icon: 'payroll' },
  { id: 'i4', title: 'Benefits Enrollment', description: 'Insurance, Others', status: 'Not Started', icon: 'benefits' },
  { id: 'i5', title: 'Compliance', description: 'Statutory & Policies', status: 'In Progress', icon: 'compliance' },
]

export const mockDocuments: OnboardingDocument[] = [
  { id: 'd1', title: 'Offer Letter', fileName: 'Offer Letter.pdf', status: 'Sent' },
  { id: 'd2', title: 'ID Proof', fileName: 'ID Proof.pdf', status: 'Pending' },
  { id: 'd3', title: 'Address Proof', fileName: 'Address Proof.pdf', status: 'Pending' },
  { id: 'd4', title: 'Passport Photo', fileName: 'Passport Photo.jpg', status: 'Pending' },
  { id: 'd5', title: 'Employment Agreement', fileName: 'Employment Agreement.pdf', status: 'Pending' },
]

export const mockKeyContacts: KeyContact[] = [
  { id: 'c1', role: 'HR Onboarding Team', name: 'HR Onboarding Team', email: 'onboarding@company.com' },
  { id: 'c2', role: 'IT Helpdesk', name: 'IT Helpdesk', email: 'it.helpdesk@company.com' },
  { id: 'c3', role: 'Reporting Manager', name: 'Arun Sharma', email: 'arun.sharma@company.com' },
]

export const mockOnboardingProfile = {
  id: 'OHB-2025-0456',
  name: 'Riya Kapoor',
  avatarInitials: 'RK',
  status: 'Preboarding',
  role: 'Software Engineer',
  department: 'Engineering',
  location: 'Bangalore',
  dateOfJoin: '16 May 2025'
}
