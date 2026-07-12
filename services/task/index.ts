/**
 * Task Service
 * API calls for task management
 */

import { apiClient } from '@/services/core'

export interface Project {
  id: string
  name: string
  description?: string
  status: 'planning' | 'active' | 'completed' | 'archived'
  startDate?: string
  dueDate?: string
}

export interface Task {
  id: string
  title: string
  description?: string
  projectId: string
  status: 'todo' | 'in_progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigneeId?: string
  dueDate?: string
  dependencies: string[]
}

export const taskService = {
  // Projects
  getProjects: () => apiClient.get<Project[]>('/projects'),
  getProject: (id: string) => apiClient.get<Project>(`/projects/${id}`),
  createProject: (data: Partial<Project>) => apiClient.post<Project>('/projects', data),
  updateProject: (id: string, data: Partial<Project>) => 
    apiClient.patch<Project>(`/projects/${id}`, data),
  deleteProject: (id: string) => apiClient.delete<void>(`/projects/${id}`),

  // Tasks
  getTasks: (projectId?: string) => 
    apiClient.get<Task[]>('/tasks', projectId ? { projectId } : undefined),
  getTask: (id: string) => apiClient.get<Task>(`/tasks/${id}`),
  createTask: (data: Partial<Task>) => apiClient.post<Task>('/tasks', data),
  updateTask: (id: string, data: Partial<Task>) => 
    apiClient.patch<Task>(`/tasks/${id}`, data),
  deleteTask: (id: string) => apiClient.delete<void>(`/tasks/${id}`),
  assignTask: (taskId: string, userId: string) => 
    apiClient.post<Task>(`/tasks/${taskId}/assign`, { userId }),
}
