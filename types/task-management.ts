export type TaskStatus = 'PENDING' | 'IN-PROGRESS' | 'ON HOLD' | 'COMPLETED'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface TaskComment {
  id: string
  author: string
  content: string
  timestamp: string
}

export interface TaskAttachment {
  id: string
  name: string
  url: string
  type: string
}

export interface Task {
  id: string
  title: string
  description: string
  project: string
  department: string
  assignee: string
  owner: string
  status: 'draft' | 'in_progress' | 'review' | 'completed' | 'blocked'
  priority: TaskPriority
  dueDate: string
  completionPercentage: number
  comments: TaskComment[]
  attachments: TaskAttachment[]
}

export type MyTaskGroup = 'all' | 'today' | 'upcoming' | 'recent' | 'subordinates'
export type MyTaskPriority = 'High' | 'Medium' | 'Low'

export interface MyTaskAttachment {
  name: string
  type: string | null
  size: string | null
}

export interface MyTask {
  id: string
  title: string
  description: string
  assignee: string
  assignee_id: string | null
  owner: string
  owner_id: string | null
  department: string
  status: TaskStatus
  priority: MyTaskPriority | null
  task_type: string | null
  due_date: string | null
  remarks: string | null
  created_at: string | null
  updated_at: string | null
  observation_point?: string | null
  attachment?: MyTaskAttachment | null
}

export interface MyTaskSummary {
  due_today: number
  on_hold: number
  in_progress: number
  completed_this_month: number
}

export interface TaskPagination {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface MyTasksQuery {
  group?: MyTaskGroup
  search?: string
  status?: TaskStatus
  priority?: MyTaskPriority
  page?: number
  perPage?: number
}

export interface MyTasksResponse {
  status: 1
  message: string
  data: {
    tasks: MyTask[]
    summary: MyTaskSummary
    pagination: TaskPagination
    filters: {
      statuses: TaskStatus[]
      priorities: MyTaskPriority[]
    }
  }
}

export interface MyTaskDetailResponse {
  status: 1
  message: string
  data: MyTask
}

export type ProjectStatus = 'PLANNING' | 'IN PROGRESS' | 'AT RISK' | 'COMPLETED' | 'ARCHIVED'
export type ProjectPriority = 'High' | 'Medium' | 'Low'

export interface ProjectMember { id: string; name: string; role: string }
export interface Workstream {
  id: string
  project_id: string
  name: string
  description: string | null
  owner_id: string | null
  owner_name?: string | null
  status: ProjectStatus
  start_date: string | null
  due_date: string | null
  sort_order: number
}
export interface ProjectRecord {
  id: string; code: string; name: string; category: string | null; description: string
  department_id: string | null; department: string | null; sponsor_id: string | null; sponsor: string | null
  manager_id: string | null; manager: string | null; team_size: string | null; priority: ProjectPriority
  status: ProjectStatus; start_date: string | null; due_date: string | null; budget_estimate: string | null
  client_name: string | null; regulatory_flags: string[]; members_count: number; tasks_total: number
  tasks_completed: number; progress: number; archived_at: string | null
  members?: ProjectMember[]; workstreams?: Workstream[]; task_ids?: string[]
}
export interface ProjectPayload {
  name: string; category?: string; description: string; department_id?: string; sponsor_id?: string
  manager_id: string; team_size?: string; member_ids: string[]; priority: ProjectPriority; status?: ProjectStatus
  start_date: string; due_date: string; budget_estimate?: string; client_name?: string; regulatory_flags: string[]
}
export interface ProjectOptions {
  users: Array<{ id: string; name: string }>
  departments: Array<{ id: string; name: string }>
  tasks: Array<{ id: string; title: string; status: string | null; department_id: string | null }>
  categories: string[]; statuses: ProjectStatus[]; priorities: ProjectPriority[]
}

export type WorkspaceScope = 'all' | 'mine' | 'created' | 'team' | 'department' | 'archived'

export interface WorkspaceTask {
  id: string
  title: string
  description: string
  project_id: string | null
  project: string
  department: string
  assignee_id: string | null
  assignee: string
  owner_id: string | null
  owner: string
  status: TaskStatus
  priority: MyTaskPriority | null
  due_date: string | null
  remarks: string | null
  approved: boolean
  approved_on: string | null
  created_at: string | null
  updated_at: string | null
  attachment: MyTaskAttachment | null
  comments?: Array<{ id: string; author: string; content: string; created_at: string }>
}

export interface WorkspaceResponse {
  status: 1
  message: string
  data: {
    tasks: WorkspaceTask[]
    summary: { active: number; pending_review: number; blocked_overdue: number; completed_this_month: number }
    pagination: TaskPagination
    filters: {
      statuses: TaskStatus[]
      priorities: MyTaskPriority[]
      users: Array<{ id: string; name: string }>
    }
  }
}

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'
export interface DependencyTaskRef { id: string; title: string; status: string; due_date: string | null }
export interface TaskDependency {
  id: string
  type: DependencyType
  lag_days: number
  notes: string | null
  project_id: string | null
  project: string
  assignee_id: string | null
  assignee: string
  predecessor: DependencyTaskRef
  successor: DependencyTaskRef
  blocking: boolean
}
export interface DependencyNode {
  id: string; title: string; status: string; priority: string | null; due_date: string | null
  project: string; assignee: string; at_risk: boolean
}
export interface TaskMilestone {
  id: string; project_id: string; workstream_id: string | null; name: string; description: string | null
  target_date: string; status: 'UPCOMING' | 'AT RISK' | 'COMPLETED'; project_name: string; workstream_name: string | null
}
export interface DependenciesResponse {
  status: 1
  message: string
  data: {
    dependencies: TaskDependency[]
    tasks: DependencyNode[]
    milestones: TaskMilestone[]
    summary: { total: number; blocking: number; at_risk: number; on_track: number; milestones: number; critical_path: number }
    options: {
      types: DependencyType[]
      projects: Array<{ id: string; name: string }>
      tasks: Array<{ id: string; title: string; status: string; due_date: string | null }>
      users: Array<{ id: string; name: string }>
    }
  }
}
