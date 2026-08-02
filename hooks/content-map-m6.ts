import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const TaskWorkspace = createLazyComponent(() => import('@/domain/task/task-workspace').then((m) => ({ default: m.TaskWorkspace })))
const MyTasksView = createLazyComponent(() => import('@/domain/task/my-tasks-view').then((m) => ({ default: m.MyTasksView })))
const ProjectsListView = createLazyComponent(() => import('@/domain/task/projects-list-view').then((m) => ({ default: m.ProjectsListView })))
const DependenciesView = createLazyComponent(() => import('@/domain/task/dependencies-view').then((m) => ({ default: m.DependenciesView })))
const TaskCalendarView = createLazyComponent(() => import('@/domain/task/task-calendar-view').then((m) => ({ default: m.TaskCalendarView })))
const TmStatusManagement = createLazyComponent(() => import('@/domain/task/tm-status-management').then((m) => ({ default: m.TmStatusManagement })))
const TmPriorityManagement = createLazyComponent(() => import('@/domain/task/tm-priority-management').then((m) => ({ default: m.TmPriorityManagement })))
const TmPermissions = createLazyComponent(() => import('@/domain/task/tm-permissions').then((m) => ({ default: m.TmPermissions })))
const TmIntegrations = createLazyComponent(() => import('@/domain/task/tm-integrations').then((m) => ({ default: m.TmIntegrations })))
const TmAuditLogs = createLazyComponent(() => import('@/domain/task/tm-audit-logs').then((m) => ({ default: m.TmAuditLogs })))
const TmReports = createLazyComponent(() => import('@/domain/task/tm-reports').then((m) => ({ default: m.TmReports })))

export const M6_CONTENT: ContentRoute[] = [
  { submenuId: 'tm-dashboard', component: TaskWorkspace },
  { submenuId: 'task-workspace', component: TaskWorkspace },
  { submenuId: 'tm-tasks', component: MyTasksView },
  { submenuId: 'my-tasks', component: MyTasksView },
  { submenuId: 'tm-projects', component: ProjectsListView },
  { submenuId: 'projects-list', component: ProjectsListView },
  { submenuId: 'tm-dependencies', component: DependenciesView },
  { submenuId: 'dependencies-view', component: DependenciesView },
  { submenuId: 'tm-calendar', component: TaskCalendarView },
  { submenuId: 'tm-reports', component: TmReports },
  { submenuId: 'calendar-view', component: TaskCalendarView },
  { submenuId: 'status-management', component: TmStatusManagement },
  { submenuId: 'priority-management', component: TmPriorityManagement },
  { submenuId: 'permissions', component: TmPermissions },
  { submenuId: 'integrations', component: TmIntegrations },
  { submenuId: 'audit-logs', component: TmAuditLogs },
]
