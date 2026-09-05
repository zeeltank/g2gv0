
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
