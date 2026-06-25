export type TaskStatus = 'draft' | 'in_progress' | 'review' | 'completed' | 'blocked'
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
  status: TaskStatus
  priority: TaskPriority
  dueDate: string
  completionPercentage: number
  comments: TaskComment[]
  attachments: TaskAttachment[]
}
