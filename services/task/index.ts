/**
 * Task Service
 * API calls for task management
 */

import { apiClient, webClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import type {
  MyTask,
  MyTaskDetailResponse,
  MyTasksQuery,
  MyTasksResponse,
  ProjectOptions,
  ProjectPayload,
  ProjectRecord,
  ProjectStatus,
  TaskPagination,
  Workstream,
  TaskStatus,
} from '@/types/task-management'

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

export interface LegacyTaskCreatePayload {
  title: string
  description: string
  assigneeIds: string[]
  observerId: string
  priority: 'High' | 'Medium' | 'Low'
  repeatDays: string
  dueDate: string
  skillIds: string[]
  skillNames: string[]
  kra: string
  kpa: string
  observationPoint: string
  attachment?: File | null
  departmentId?: string
  employeeDepartmentIds?: Record<string, string>
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

  // Task Management > My Tasks (Laravel's additive, token-scoped API)
  getMyTasks: (context: LaravelContext, query: MyTasksQuery = {}) =>
    apiClient.get<MyTasksResponse>('/task-management/my-tasks', {
      token: context.token,
      sub_institute_id: context.subInstituteId,
      syear: context.syear,
      ...(query.group ? { group: query.group } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      page: String(query.page ?? 1),
      per_page: String(query.perPage ?? 20),
    }),
  getMyTask: (context: LaravelContext, id: string) =>
    apiClient.get<MyTaskDetailResponse>(`/task-management/my-tasks/${id}`, {
      token: context.token,
      sub_institute_id: context.subInstituteId,
      syear: context.syear,
    }),
  updateMyTaskStatus: (
    context: LaravelContext,
    id: string,
    status: TaskStatus,
    remarks: string,
  ) =>
    apiClient.patch<{ status: 1; message: string; data: Pick<MyTask, 'id' | 'status' | 'remarks'> }>(
      `/task-management/my-tasks/${id}/status`,
      { token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear, status, remarks },
    ),

  getProjectOptions: (context: LaravelContext) =>
    apiClient.get<{ status: 1; message: string; data: ProjectOptions }>('/task-management/projects/options', {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),
  getProjectRecords: (context: LaravelContext, params: { search?: string; status?: ProjectStatus; page?: number } = {}) =>
    apiClient.get<{ status: 1; message: string; data: { projects: ProjectRecord[]; pagination: TaskPagination } }>(
      '/task-management/projects',
      { token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
        ...(params.search ? { search: params.search } : {}), ...(params.status ? { status: params.status } : {}),
        page: String(params.page ?? 1), per_page: '12' },
    ),
  getProjectRecord: (context: LaravelContext, id: string) =>
    apiClient.get<{ status: 1; message: string; data: ProjectRecord }>(`/task-management/projects/${id}`, {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),
  createProjectRecord: (context: LaravelContext, payload: ProjectPayload) =>
    apiClient.post<{ status: 1; message: string; data: ProjectRecord }>('/task-management/projects', {
      ...payload, token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),
  updateProjectRecord: (context: LaravelContext, id: string, payload: ProjectPayload) =>
    apiClient.put<{ status: 1; message: string; data: ProjectRecord }>(`/task-management/projects/${id}`, {
      ...payload, token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),
  archiveProjectRecord: (context: LaravelContext, id: string) =>
    apiClient.patch<{ status: 1; message: string }>(`/task-management/projects/${id}/archive`, {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),
  syncProjectMembers: (context: LaravelContext, id: string, memberIds: string[]) =>
    apiClient.put<{ status: 1; message: string; data: ProjectRecord['members'] }>(`/task-management/projects/${id}/members`, {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear, member_ids: memberIds,
    }),
  syncProjectTasks: (context: LaravelContext, id: string, taskIds: string[]) =>
    apiClient.put<{ status: 1; message: string }>(`/task-management/projects/${id}/tasks`, {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear, task_ids: taskIds,
    }),
  createWorkstream: (context: LaravelContext, projectId: string, payload: Omit<Workstream, 'id' | 'project_id'>) =>
    apiClient.post<{ status: 1; message: string; data: Workstream }>(`/task-management/projects/${projectId}/workstreams`, {
      ...payload, token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),
  updateWorkstream: (context: LaravelContext, projectId: string, workstreamId: string, payload: Omit<Workstream, 'id' | 'project_id'>) =>
    apiClient.put<{ status: 1; message: string; data: Workstream }>(`/task-management/projects/${projectId}/workstreams/${workstreamId}`, {
      ...payload, token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),
  deleteWorkstream: (context: LaravelContext, projectId: string, workstreamId: string) =>
    apiClient.delete<{ status: 1; message: string }>(`/task-management/projects/${projectId}/workstreams/${workstreamId}`, {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),
  getAssignmentDirectory: (context: LaravelContext) =>
    webClient.get<{ data?: Record<string, Array<{
      id: number | string
      jobrole: string
      department_id: number | string
      employees?: Array<{ id: number | string; first_name: string; middle_name?: string; last_name?: string }>
    }>> }>('/api/jobroles-by-department', { sub_institute_id: context.subInstituteId }),
  getAssignmentUsers: (context: LaravelContext) =>
    webClient.get<Array<{
      id: number | string
      first_name: string
      middle_name?: string
      last_name?: string
      department_id?: number | string
      allocated_standards?: number | string
    }>>('/table_data', {
      table: 'tbluser',
      'filters[status]': '1',
      'filters[sub_institute_id]': context.subInstituteId,
      token: context.token,
    }),
  getJobRoleEmployees: (context: LaravelContext, jobRoleId: string, orgType: string) =>
    webClient.get<{ searchData?: Array<{
      id: number | string
      first_name: string
      middle_name?: string
      last_name?: string
      department_id?: number | string
    }> | Record<string, {
      id: number | string
      first_name: string
      middle_name?: string
      last_name?: string
      department_id?: number | string
    }> }>('/search_data', {
      type: 'API',
      token: context.token,
      sub_institute_id: context.subInstituteId,
      org_type: orgType,
      searchType: 'jobrole_emp',
      searchWord: jobRoleId,
    }),
  getSupervisor: (context: LaravelContext, userId: string) =>
    webClient.get<{ status_code: number; message: string; data?: { id: number | string; name: string } }>(
      '/getSupervisor', { user_id: userId, sub_institute_id: context.subInstituteId },
    ),
  getUserSkills: (context: LaravelContext, userId: string) =>
    apiClient.get<{ data?: Array<{ id?: number; skill_id?: number; name?: string; skill?: string; skill_name?: string }> }>(
      `/user-skills/${userId}`, { token: context.token, sub_institute_id: context.subInstituteId, type: 'API' },
    ),
  createLegacyTask: (context: LaravelContext, payload: LegacyTaskCreatePayload) => {
    const body = new FormData()
    const allocatedTo = payload.assigneeIds.length
      ? payload.assigneeIds.map((id) => payload.employeeDepartmentIds?.[id] ? `${id}:${payload.employeeDepartmentIds[id]}` : id).join(',')
      : (payload.departmentId ?? '')
    body.append('TASK_ALLOCATED_TO', allocatedTo)
    body.append('task_title', payload.title)
    body.append('task_description', payload.description)
    body.append('skill_id', payload.skillIds.join(','))
    body.append('skills', payload.skillNames.join(','))
    body.append('manageby', payload.observerId)
    body.append('observation_point', payload.observationPoint)
    body.append('KRA', payload.kra)
    body.append('KPA', payload.kpa)
    body.append('selType', payload.priority)
    body.append('repeat_days', payload.repeatDays)
    body.append('repeat_until', payload.dueDate)
    if (payload.attachment) body.append('TASK_ATTACHMENT', payload.attachment)
    const query = new URLSearchParams({
      type: 'API',
      token: context.token,
      sub_institute_id: context.subInstituteId,
      syear: context.syear,
      user_id: context.userId,
      formType: 'multiUser',
    }).toString()
    return webClient.postForm<{
      status_code?: string | number
      message: string
      task_id?: string | number
      taskId?: string | number
      id?: string | number
      data?: { task_id?: string | number; taskId?: string | number; id?: string | number }
    }>(`/task?${query}`, body)
  },
  updateLegacyTask: (context: LaravelContext, id: string, payload: {
    title: string
    description: string
    assigneeId: string
    observerId: string
    priority: string
    dueDate: string
    status: string
  }) => {
    const body = new FormData()
    body.append('task_title', payload.title)
    body.append('task_description', payload.description)
    body.append('TASK_ALLOCATED_TO', payload.assigneeId)
    body.append('manageby', payload.observerId)
    body.append('selType', payload.priority)
    body.append('TASK_DATE', payload.dueDate)
    body.append('status', payload.status)
    const query = new URLSearchParams({
      type: 'API', token: context.token, sub_institute_id: context.subInstituteId,
      syear: context.syear, user_id: context.userId,
    }).toString()
    return webClient.putForm<{ status_code: string | number; message: string }>(`/task/${id}?${query}`, body)
  },
  deleteLegacyTask: (context: LaravelContext, id: string) =>
    webClient.delete<{ status_code: string | number; message: string }>(`/task/${id}`, {
      type: 'API', token: context.token, sub_institute_id: context.subInstituteId,
      syear: context.syear, user_id: context.userId,
    }),
  getEmployeeTaskSuggestions: (context: LaravelContext, userId: string) =>
    apiClient.get<{
      status_code: number
      message: string
      data?: Array<{
        task_id: number | string
        task_title: string
        status?: string
        first_name?: string
        last_name?: string
        user_role?: string
      }>
    }>('/get-employee-tasks', {
      user_id: userId, sub_institute_id: context.subInstituteId,
    }),
  getJobRoleTaskSuggestions: (
    context: LaravelContext,
    userId: string,
    orgType: string,
  ) =>
    webClient.get<{ jobroleTasks?: Array<{ task?: string; task_title?: string }> }>(
      `/user/add_user/${userId}/edit`,
      {
        type: 'API',
        token: context.token,
        sub_institute_id: context.subInstituteId,
        org_type: orgType,
        syear: context.syear,
      },
    ),
  uploadBulkTasks: (context: LaravelContext, file: File) => {
    const body = new FormData()
    body.append('csv_file', file)
    body.append('type', 'API')
    body.append('token', context.token)
    body.append('sub_institute_id', context.subInstituteId)
    body.append('syear', context.syear)
    body.append('user_id', context.userId)
    body.append('formType', 'BulkTask')
    return apiClient.postForm<{
      status_code: string | number
      message: string
      imported?: number
      skipped_count?: number
      skipped_details?: Array<{
        row?: number
        task_title?: string
        assigned_to?: string
        department?: string
        job_role?: string
        reason?: string
      }>
    }>('/bulk-task/import', body)
  },
  generateTaskDetails: (prompt: string) =>
    webClient.post<Array<{
      task_description?: string
      repeat_once_in_every?: string
      repeat_until_date?: string
      observation_point?: string
      kras?: string
      kpis?: string
      task_type?: 'High' | 'Medium' | 'Low'
      skill_required?: string[]
    }>>('/gemini_chat', { prompt }),
}
