/**
 * Task Service
 * API calls for task management
 */

import { apiClient, webClient, buildApiUrl } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import type {
  MyTask,
  MyTaskDetailResponse,
  MyTaskPriority,
  MyTasksQuery,
  MyTasksResponse,
  ProjectOptions,
  ProjectPayload,
  ProjectRecord,
  ProjectStatus,
  TaskPagination,
  Workstream,
  TaskStatus,
  WorkspaceResponse,
  WorkspaceScope,
  WorkspaceTask,
  DeadlineExtension,
  TaskAuditLog,
  PermissionAbility,
  IntegrationStatus,
  TaskStatusOption,
  TaskPriorityOption,
  ProductivityRow,
  DelayReport,
  DependenciesResponse,
  DependencyType, MilestonesResponse,
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

export interface JobRoleTask {
  id: string
  task_title: string
  task_description: string
}

export interface JobRoleTaskResponse {
  status: number
  message: string
  data?: JobRoleTask[]
}

export interface TaskDescriptionResponse {
  status: number
  message: string
  data?: { task_description: string }
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
  /**
   * The `s_user_jobrole_task.id` this task was assigned FROM, when it came from
   * the job-role catalogue rather than being typed by hand.
   *
   * THIS IS WHAT CONNECTS AN ASSIGNED TASK TO ITS WRITTEN PROCEDURE. `eso` is
   * keyed on the same id, so without it the employee's task detail can never
   * find the ESO.
   *
   * The server can also derive it by matching the title text, but that only
   * works when the title is unique across job roles — measured on live, exactly
   * one match resolved 6 of 612 tenant-6 tasks, and titles shared by four roles
   * (a shared catalogue is the norm) resolve to nothing at all. The wizard knows
   * which row the user actually clicked; sending it removes the guess.
   *
   * Omitted for a hand-typed title, which legitimately has no job-role task.
   */
  jobRoleTaskId?: string
  /** Stable per submission attempt; a repeat replays instead of duplicating. */
  idempotencyKey?: string
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
  /**
   * Deadline extensions for one task. The executor requests more time from
   * the task drawer; the owner decides on the same surface. Approval moves
   * the task's due date server-side.
   */
  getDeadlineExtensions: (context: LaravelContext, taskId: string) =>
    apiClient.get<{ status: 1; message: string; data: { extensions: DeadlineExtension[] } }>(
      '/task-management/deadline-extensions',
      {
        token: context.token,
        sub_institute_id: context.subInstituteId,
        syear: context.syear,
        task_id: taskId,
      },
    ),
  requestDeadlineExtension: (context: LaravelContext, payload: { taskId: string; requestedDate: string; reason: string }) =>
    apiClient.post<{ status: 1; message: string; data: { id: string } }>('/task-management/deadline-extensions', {
      token: context.token,
      sub_institute_id: context.subInstituteId,
      syear: context.syear,
      task_id: payload.taskId,
      requested_date: payload.requestedDate,
      reason: payload.reason,
    }),
  decideDeadlineExtension: (context: LaravelContext, id: string, decision: 'approve' | 'reject', remarks = '') =>
    apiClient.patch<{ status: 1; message: string }>(`/task-management/deadline-extensions/${id}/decision`, {
      token: context.token,
      sub_institute_id: context.subInstituteId,
      syear: context.syear,
      decision,
      remarks,
    }),
  /** The audit trail, for Administration > Audit Logs. */
  getAuditLogs: (context: LaravelContext, params: { taskId?: string; event?: string; from?: string; to?: string; page?: number } = {}) =>
    apiClient.get<{ status: 1; message: string; data: { logs: TaskAuditLog[]; pagination: TaskPagination } }>(
      '/task-management/audit-logs',
      {
        token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
        ...(params.taskId ? { task_id: params.taskId } : {}),
        ...(params.event ? { event: params.event } : {}),
        ...(params.from ? { from: params.from } : {}),
        ...(params.to ? { to: params.to } : {}),
        page: String(params.page ?? 1),
      },
    ),
  /** CSV export href - a download, so it has to be a URL, not a fetch. */
  auditLogsExportUrl: (context: LaravelContext) =>
    buildApiUrl('/task-management/audit-logs/export', {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),
  /** The permission matrix exactly as the middleware enforces it. */
  getPermissionsMatrix: (context: LaravelContext) =>
    apiClient.get<{ status: 1; message: string; data: { profiles: string[]; abilities: PermissionAbility[]; note: string } }>(
      '/task-management/permissions',
      { token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear },
    ),
  /** Which integrations are configured - never their keys. */
  getIntegrations: (context: LaravelContext) =>
    apiClient.get<{ status: 1; message: string; data: { integrations: IntegrationStatus[] } }>(
      '/task-management/integrations',
      { token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear },
    ),
  /* Tenant status/priority vocabularies - Administration screens manage the
     custom entries; system rows are constants the API refuses to change. */
  getStatusOptions: (context: LaravelContext) =>
    apiClient.get<{ status: 1; message: string; data: { statuses: TaskStatusOption[]; categories: TaskStatus[] } }>(
      '/task-management/statuses',
      { token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear },
    ),
  createStatusOption: (context: LaravelContext, payload: { name: string; category: TaskStatus; color?: string; sort_order?: number }) =>
    apiClient.post<{ status: 1; message: string; data: { id: string } }>('/task-management/statuses', {
      ...payload, token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),
  updateStatusOption: (context: LaravelContext, id: string, payload: { name: string; category: TaskStatus; color?: string; sort_order?: number; active?: boolean }) =>
    apiClient.put<{ status: 1; message: string }>(`/task-management/statuses/${id}`, {
      ...payload, token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),
  deleteStatusOption: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: 1; message: string }>(`/task-management/statuses/${id}`, {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),
  getPriorityOptions: (context: LaravelContext) =>
    apiClient.get<{ status: 1; message: string; data: { priorities: TaskPriorityOption[] } }>(
      '/task-management/priorities',
      { token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear },
    ),
  createPriorityOption: (context: LaravelContext, payload: { name: string; sort_order?: number; sla_hours?: number }) =>
    apiClient.post<{ status: 1; message: string; data: { id: string } }>('/task-management/priorities', {
      ...payload, token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),
  updatePriorityOption: (context: LaravelContext, id: string, payload: { name: string; sort_order?: number; sla_hours?: number; active?: boolean }) =>
    apiClient.put<{ status: 1; message: string }>(`/task-management/priorities/${id}`, {
      ...payload, token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),
  deletePriorityOption: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: 1; message: string }>(`/task-management/priorities/${id}`, {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),

  /* Org-wide reports - the new home of the old task-analysis screen. */
  getProductivityReport: (context: LaravelContext) =>
    apiClient.get<{ status: 1; message: string; data: { rows: ProductivityRow[] } }>(
      '/task-management/reports/productivity',
      { token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear },
    ),
  getDelaysReport: (context: LaravelContext) =>
    apiClient.get<{ status: 1; message: string; data: DelayReport }>(
      '/task-management/reports/delays',
      { token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear },
    ),

  /**
   * The Task Management -> LMS hand-off: tasks rejected in review, mapped
   * through their required skills to recommended courses. The endpoint has
   * existed since the old frontend; this is its first consumer here.
   */
  getRejectedTaskLearning: (context: LaravelContext, userId?: string) =>
    apiClient.get<{ status: number; message: string; data?: unknown }>(
      '/user-rejected-tasks-courses',
      {
        token: context.token,
        sub_institute_id: context.subInstituteId,
        user_id: userId ?? context.userId,
        type: 'API',
      },
    ),
  getMyTask: (context: LaravelContext, id: string) =>
    apiClient.get<MyTaskDetailResponse>(`/task-management/my-tasks/${id}`, {
      token: context.token,
      sub_institute_id: context.subInstituteId,
      syear: context.syear,
    }),
  updateMyTaskStatus: (
    context: LaravelContext,
    id: string,
    /** A system category or a tenant's custom status label; the API resolves both. */
    status: string,
    remarks: string,
  ) =>
    apiClient.patch<{ status: 1; message: string; data: Pick<MyTask, 'id' | 'status' | 'status_label' | 'remarks'> }>(
      `/task-management/my-tasks/${id}/status`,
      { token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear, status, remarks },
    ),

  getWorkspace: (context: LaravelContext, params: {
    // `status`/`priority` are plain strings: a tenant's custom option is a
    // label, not one of the four system categories.
    scope?: WorkspaceScope; search?: string; status?: string; priority?: string
    projectId?: string; assigneeId?: string; from?: string; to?: string; page?: number; perPage?: number
  } = {}) =>
    apiClient.get<WorkspaceResponse>('/task-management/workspace', {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
      scope: params.scope ?? 'all', ...(params.search ? { search: params.search } : {}),
      ...(params.status ? { status: params.status } : {}), ...(params.priority ? { priority: params.priority } : {}),
      ...(params.projectId ? { project_id: params.projectId } : {}),
      ...(params.assigneeId ? { assignee_id: params.assigneeId } : {}),
      ...(params.from ? { from: params.from } : {}), ...(params.to ? { to: params.to } : {}),
      page: String(params.page ?? 1), per_page: String(params.perPage ?? 50),
    }),
  getWorkspaceTask: (context: LaravelContext, id: string) =>
    apiClient.get<{ status: 1; message: string; data: WorkspaceTask }>(`/task-management/workspace/${id}`, {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),
  updateWorkspaceTask: (context: LaravelContext, id: string, payload: {
    title: string; description?: string; assignee_id: string; owner_id: string
    status: TaskStatus; priority: MyTaskPriority; due_date?: string; remarks?: string
  }) => apiClient.put<{ status: 1; message: string; data: WorkspaceTask }>(`/task-management/workspace/${id}`, {
    ...payload, token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
  }),
  /**
   * Move a task's dates without touching the rest of it. Only the keys sent
   * are changed, which is what lets the Calendar reschedule by due date alone.
   */
  updateTaskSchedule: (context: LaravelContext, id: string, payload: {
    planned_start_date?: string; due_date?: string; estimated_hours?: number; remaining_hours?: number
  }) => apiClient.put<{
    status: 1; message: string
    data: { schedule: { task_id: string; planned_start_date: string | null; due_date: string | null
      estimated_hours: number | null; actual_hours: number | null; remaining_hours: number | null } }
  }>(`/task-management/workspace/${id}/schedule`, {
    ...payload, token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
  }),
  archiveWorkspaceTask: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: 1; message: string }>(`/task-management/workspace/${id}`, {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),
  decideWorkspaceTask: (context: LaravelContext, id: string, decision: 'approve' | 'reject', remarks = '') =>
    apiClient.patch<{ status: 1; message: string }>(`/task-management/workspace/${id}/approval`, {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear, decision, remarks,
    }),
  addWorkspaceComment: (context: LaravelContext, id: string, content: string) =>
    apiClient.post<{ status: 1; message: string; data: { id: string } }>(`/task-management/workspace/${id}/comments`, {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear, content,
    }),
  getWorkspaceWorkload: (context: LaravelContext) =>
    apiClient.get<{ status: 1; message: string; data: Array<{ id: string; name: string; active_tasks: number; overdue_tasks: number }> }>(
      '/task-management/workspace/workload',
      { token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear },
    ),
  getDependencies: (context: LaravelContext, params: { projectId?: string; assigneeId?: string; status?: TaskStatus } = {}) =>
    apiClient.get<DependenciesResponse>('/task-management/dependencies', {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
      ...(params.projectId ? { project_id: params.projectId } : {}),
      ...(params.assigneeId ? { assignee_id: params.assigneeId } : {}),
      ...(params.status ? { status: params.status } : {}),
    }),
  createDependency: (context: LaravelContext, payload: {
    predecessor_task_id: string; successor_task_id: string; dependency_type: DependencyType; lag_days: number; notes?: string; project_id?: string; workstream_id?: string
  }) => apiClient.post<{ status: 1; message: string; data: { id: string } }>('/task-management/dependencies', {
    ...payload, token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
  }),
  updateDependency: (context: LaravelContext, id: string, payload: {
    predecessor_task_id: string; successor_task_id: string; dependency_type: DependencyType; lag_days: number; notes?: string; project_id?: string; workstream_id?: string
  }) => apiClient.put<{ status: 1; message: string }>(`/task-management/dependencies/${id}`, {
    ...payload, token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
  }),
  deleteDependency: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: 1; message: string }>(`/task-management/dependencies/${id}`, {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),
  /**
   * Replace a saved task's attachment.
   *
   * Versioned, not overwriting: the endpoint keeps the previous file as an
   * earlier version, so an edit that swaps the attachment never destroys what
   * was there before.
   */
  /**
   * A URL for the task's attachment, at a specific version.
   *
   * The version comes from `attachment.download_version` on the task payload —
   * the download route is keyed by version, and there is no "latest" alias.
   */
  taskAttachmentDownloadUrl: (context: LaravelContext, taskId: string, version: number) =>
    buildApiUrl(`/task-management/workspace/${taskId}/attachments/${version}`, {
      token: context.token,
      sub_institute_id: String(context.subInstituteId),
      syear: String(context.syear),
      user_id: String(context.userId),
    }),

  replaceTaskAttachment: (context: LaravelContext, taskId: string, file: File) => {
    const body = new FormData()
    body.append('token', context.token)
    body.append('sub_institute_id', String(context.subInstituteId))
    body.append('syear', String(context.syear))
    body.append('user_id', String(context.userId))
    body.append('file', file)
    return apiClient.postForm<{ status: 1; message: string }>(
      `/task-management/workspace/${taskId}/attachments`, body,
    )
  },
  getWorkstreams: (context: LaravelContext, projectId: string) =>
    taskService.getProjectRecord(context, projectId).then((response) => ({
      ...response,
      data: response.data.workstreams ?? [],
    })),
  /**
   * Milestones on their own. They used to arrive only inside getDependencies,
   * so the milestone tab could not refresh without refetching the whole graph.
   */
  getMilestones: (context: LaravelContext, params: { projectId?: string } = {}) =>
    apiClient.get<MilestonesResponse>('/task-management/milestones', {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
      ...(params.projectId ? { project_id: params.projectId } : {}),
    }),
  createMilestone: (context: LaravelContext, payload: {
    project_id: string; workstream_id?: string; name: string; description?: string
    target_date: string; status: 'UPCOMING' | 'AT RISK' | 'COMPLETED'
  }) => apiClient.post<{ status: 1; message: string; data: { id: string } }>('/task-management/milestones', {
    ...payload, token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
  }),
  updateMilestone: (context: LaravelContext, id: string, payload: {
    project_id: string; workstream_id?: string; name: string; description?: string
    target_date: string; status: 'UPCOMING' | 'AT RISK' | 'COMPLETED'
  }) => apiClient.put<{ status: 1; message: string }>(`/task-management/milestones/${id}`, {
    ...payload, token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
  }),
  deleteMilestone: (context: LaravelContext, id: string) =>
    apiClient.delete<{ status: 1; message: string }>(`/task-management/milestones/${id}`, {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),

  getProjectOptions: (context: LaravelContext) =>
    apiClient.get<{ status: 1; message: string; data: ProjectOptions }>('/task-management/projects/options', {
      token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
    }),
  // `perPage` exists for callers that need the whole list at once, such as a
  // project picker, rather than the 12-per-page project board.
  getProjectRecords: (context: LaravelContext, params: { search?: string; status?: ProjectStatus; page?: number; perPage?: number } = {}) =>
    apiClient.get<{ status: 1; message: string; data: { projects: ProjectRecord[]; pagination: TaskPagination } }>(
      '/task-management/projects',
      { token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
        ...(params.search ? { search: params.search } : {}), ...(params.status ? { status: params.status } : {}),
        page: String(params.page ?? 1), per_page: String(params.perPage ?? 12) },
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
  /**
   * Link one task to a project, optionally inside a workstream.
   *
   * Unlike syncProjectTasks this leaves the project's other tasks alone, which
   * is what lets a freshly created task join a project without the caller
   * having to resend every existing task id.
   */
  attachTaskToProject: (context: LaravelContext, projectId: string, taskId: string, workstreamId?: string) =>
    apiClient.post<{ status: 1; message: string; data: { project_id: string; task_id: string; workstream_id: string | null } }>(
      `/task-management/projects/${projectId}/tasks`,
      {
        token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
        task_id: taskId, ...(workstreamId ? { workstream_id: workstreamId } : {}),
      },
    ),
  /**
   * Unlink ONE task from a project.
   *
   * `attachTaskToProject` only moves a task WITHIN a project — its server-side
   * lookup is scoped to that project, and the link table is many-to-many. So
   * attaching to a second project leaves the first link and the task belongs to
   * both, which the workspace list then hides by taking MIN(project_id).
   *
   * Detaching the old link is what turns "attach" into "move". `syncTasks`
   * could do it, but it replaces a project's ENTIRE task list, so it would
   * unlink whatever a concurrent editor just added.
   *
   * Idempotent: unlinking a task that is not linked returns 200 with removed 0.
   */
  detachTaskFromProject: (context: LaravelContext, projectId: string, taskId: string) =>
    apiClient.delete<{ status: 1; message: string; data: { project_id: string; task_id: string; removed: number } }>(
      `/task-management/projects/${projectId}/tasks/${taskId}`,
      { token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear },
    ),
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
      ? payload.assigneeIds.join(',')
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
    // The catalogue row this task came from. Sent only when there is one, because
    // insertTaskWithReference falls back to resolving it from the title when the
    // key is ABSENT - and an empty string is not absent.
    if (payload.jobRoleTaskId) body.append('jobrole_task_id', payload.jobRoleTaskId)
    // Retrying this create - a second click, a browser retry after a slow
    // response - replays the first attempt rather than duplicating the task.
    if (payload.idempotencyKey) body.append('idempotency_key', payload.idempotencyKey)
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
      /** Every row this submit created - a recurring task yields one per date. */
      task_ids?: Array<string | number>
      replayed?: boolean
      data?: { task_id?: string | number; taskId?: string | number; id?: string | number }
    }>(`/task?${query}`, body)
  },
  /**
   * Edit a task — the full assign-form field set.
   *
   * ── WHY THIS MOVED OFF THE WEB ROUTE ───────────────────────────────────
   *
   * It used to PUT the legacy web route `/task/{id}`. That path has two faults
   * an edit form cannot live with:
   *
   *   THE OBSERVER IS NEVER SAVED. `manageby` is stripped from the request and
   *   `task_allocated` is never assigned, so changing the observer did nothing.
   *
   *   EVERY EDIT STAMPS APPROVAL. It sets `approved_by` and `approved_on` on
   *   each update, so fixing a typo silently marked the task approved by
   *   whoever typed it.
   *
   * `PUT /task-management/legacy-tasks/{id}` does neither, writes the observer
   * as `task_allocated`, is tenant-scoped, permission-gated (`task.update`) and
   * audited.
   *
   * ⚠ IT IS A FULL REPLACE. Every nullable field omitted is written as NULL,
   * and an absent `owner_id` silently reassigns ownership to the caller. That
   * is safe here ONLY because the edit form renders and sends all of these —
   * do not call this with a partial payload.
   */
  updateLegacyTask: (context: LaravelContext, id: string, payload: {
    title: string
    description?: string
    assigneeId: string
    /** The observer. Stored as `task_allocated`. */
    observerId?: string
    priority?: string
    dueDate?: string
    kra?: string
    kpa?: string
    skillNames?: string
    skillIds?: string
    observationPoint?: string
  }) =>
    apiClient.put<{ status?: number | string; message: string; data?: { id: string } }>(
      `/task-management/legacy-tasks/${id}`,
      {
        token: context.token, sub_institute_id: context.subInstituteId, syear: context.syear,
        title: payload.title,
        description: payload.description ?? '',
        assignee_id: payload.assigneeId,
        ...(payload.observerId ? { owner_id: payload.observerId } : {}),
        ...(payload.priority ? { priority: payload.priority } : {}),
        ...(payload.dueDate ? { due_date: payload.dueDate } : {}),
        kra: payload.kra ?? '',
        kpa: payload.kpa ?? '',
        required_skills: payload.skillNames ?? '',
        skill_id: payload.skillIds ?? '',
        observation_point: payload.observationPoint ?? '',
      },
    ),
  deleteLegacyTask: (context: LaravelContext, id: string) =>
    webClient.delete<{ status?: string | number; status_code?: string | number; message: string }>(`/task/${id}`, {
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
      // The route requires a token now: it used to be unauthenticated, so any
      // caller could read any employee's tasks in any organisation. The tenant
      // is derived server-side from this token; sub_institute_id is still sent
      // because other callers of this endpoint pass it, but it is ignored.
      token: context.token,
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
  /**
   * The catalogue tasks defined for one job role.
   *
   * Keyed by role NAME, not id: s_user_jobrole_task.jobrole stores the role's
   * name ("Human Resources Specialists"), so matching it against the numeric
   * id the dropdown carries never found anything.
   */
  getJobRoleTasks: async (context: LaravelContext, jobRoleName: string) => {
    // Same authenticated /table_data call the rest of this service makes.
    // This used to fetch a hardcoded hp.triz.co.in with an `api_key` param:
    // /table_data accepts no such param - it wants a session or a Sanctum
    // token - so the request 401'd, and on a dev machine it was asking
    // production for the answer anyway.
    const payload = await webClient.get<unknown>('/table_data', {
      table: 's_user_jobrole_task',
      // Filtered server-side. Fetching the tenant's whole catalogue to keep a
      // handful of rows meant thousands of records over the wire per dropdown.
      'filters[jobrole]': jobRoleName,
      token: context.token,
    })

    // /table_data answers with a bare array on success and an object on
    // refusal, so anything that is not an array means "no rows for you".
    const records: Array<Record<string, unknown>> = Array.isArray(payload) ? payload : []

    const data = records
      .filter((record) => record.task != null)
      .map((record) => ({
        id: String(record.id ?? ''),
        task_title: String(record.task ?? ''),
        task_description: '',
      }))

    return {
      status: 200,
      message: 'OK',
      data,
    } as JobRoleTaskResponse
  },
  getTaskDescription: (context: LaravelContext, taskTitle: string) =>
    apiClient.get<TaskDescriptionResponse>('/jobrole-task-description', {
      token: context.token,
      sub_institute_id: context.subInstituteId,
      syear: context.syear,
      taskTitle,
    }),
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
