export interface AdminKPI {
  id: string
  title: string
  value: string
  linkText: string
  icon: 'git-merge' | 'file-text' | 'users' | 'plug' | 'shield-check'
}

export interface WorkflowStage {
  step: number
  label: string
}

export interface WorkflowApprover {
  id: string
  role: string
  title: string
  initials: string
  approvalType: string
  escalation: string
}

export interface Workflow {
  id: string
  name: string
  module: string
  status: 'Active' | 'Draft' | 'Inactive'
  version: string
  description: string
  createdBy: string
  lastUpdated: string
  updatedBy: string
  stages: WorkflowStage[]
  approvers: WorkflowApprover[]
}

export const mockAdminKPIs: AdminKPI[] = [
  { id: 'kpi-1', title: 'Active Workflows', value: '28', linkText: 'View all workflows', icon: 'git-merge' },
  { id: 'kpi-2', title: 'Templates', value: '56', linkText: 'View all templates', icon: 'file-text' },
  { id: 'kpi-3', title: 'User Roles', value: '18', linkText: 'View all roles', icon: 'users' },
  { id: 'kpi-4', title: 'Integrations', value: '12', linkText: 'View all integrations', icon: 'plug' },
  { id: 'kpi-5', title: 'Audit Events (30 Days)', value: '1,248', linkText: 'View audit logs', icon: 'shield-check' },
]

export const mockWorkflows: Workflow[] = [
  {
    id: 'wf-1',
    name: 'Job Requisition Approval',
    module: 'Recruitment',
    status: 'Active',
    version: '1.3',
    description: 'Workflow for raising, routing and approving job requisitions.',
    createdBy: 'Admin',
    lastUpdated: 'May 12, 2025',
    updatedBy: 'Admin',
    stages: [
      { step: 1, label: 'Requisition\nRaised' },
      { step: 2, label: 'Manager\nApproval' },
      { step: 3, label: 'HR\nReview' },
      { step: 4, label: 'Finance\nApproval' },
      { step: 5, label: 'Approved' }
    ],
    approvers: [
      { id: 'a1', role: 'Manager', title: 'Immediate Manager', initials: 'M', approvalType: 'Mandatory', escalation: 'After 2 Days' },
      { id: 'a2', role: 'HR', title: 'HR Manager', initials: 'H', approvalType: 'Mandatory', escalation: 'After 1 Day' },
      { id: 'a3', role: 'Finance', title: 'Finance Controller', initials: 'F', approvalType: 'Mandatory', escalation: 'After 1 Day' }
    ]
  },
  {
    id: 'wf-2',
    name: 'Interview Scheduling',
    module: 'Recruitment',
    status: 'Active',
    version: '2.1',
    description: 'Interview scheduling and coordination',
    createdBy: 'Admin',
    lastUpdated: 'May 08, 2025',
    updatedBy: 'HR Admin',
    stages: [],
    approvers: []
  },
  {
    id: 'wf-3',
    name: 'Offer Approval',
    module: 'Recruitment',
    status: 'Active',
    version: '1.2',
    description: 'Offer letter approval workflow',
    createdBy: 'Admin',
    lastUpdated: 'May 02, 2025',
    updatedBy: 'Admin',
    stages: [],
    approvers: []
  },
  {
    id: 'wf-4',
    name: 'Onboarding Checklist',
    module: 'Onboarding',
    status: 'Active',
    version: '1.5',
    description: 'New hire onboarding workflow',
    createdBy: 'Admin',
    lastUpdated: 'Apr 30, 2025',
    updatedBy: 'HR Admin',
    stages: [],
    approvers: []
  },
  {
    id: 'wf-5',
    name: 'Probation Confirmation',
    module: 'Onboarding',
    status: 'Active',
    version: '1.1',
    description: 'Probation tracking and confirmation',
    createdBy: 'Admin',
    lastUpdated: 'Apr 25, 2025',
    updatedBy: 'Admin',
    stages: [],
    approvers: []
  },
  {
    id: 'wf-6',
    name: 'Performance Review Cycle',
    module: 'Performance',
    status: 'Draft',
    version: '1.0',
    description: 'Performance review process workflow',
    createdBy: 'Admin',
    lastUpdated: 'May 15, 2025',
    updatedBy: 'Admin',
    stages: [],
    approvers: []
  },
  {
    id: 'wf-7',
    name: 'Exit Clearance',
    module: 'Offboarding',
    status: 'Active',
    version: '1.4',
    description: 'Employee exit clearance workflow',
    createdBy: 'Admin',
    lastUpdated: 'May 10, 2025',
    updatedBy: 'HR Admin',
    stages: [],
    approvers: []
  },
  {
    id: 'wf-8',
    name: 'Promotion Approval',
    module: 'Mobility',
    status: 'Active',
    version: '1.0',
    description: 'Promotion approval workflow',
    createdBy: 'Admin',
    lastUpdated: 'Apr 28, 2025',
    updatedBy: 'Admin',
    stages: [],
    approvers: []
  }
]
