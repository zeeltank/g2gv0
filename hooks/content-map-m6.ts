import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const TaskWorkspace = createLazyComponent(() => import('@/components/task/task-workspace').then((m) => ({ default: m.TaskWorkspace })))
const MyTasksView = createLazyComponent(() => import('@/components/task/my-tasks-view').then((m) => ({ default: m.MyTasksView })))
const ProjectsListView = createLazyComponent(() => import('@/components/task/projects-list-view').then((m) => ({ default: m.ProjectsListView })))
const DependenciesView = createLazyComponent(() => import('@/components/task/dependencies-view').then((m) => ({ default: m.DependenciesView })))
const TaskCalendarView = createLazyComponent(() => import('@/components/task/task-calendar-view').then((m) => ({ default: m.TaskCalendarView })))
const TmStatusManagement = createLazyComponent(() => import('@/components/task/tm-status-management').then((m) => ({ default: m.TmStatusManagement })))
const TmPriorityManagement = createLazyComponent(() => import('@/components/task/tm-priority-management').then((m) => ({ default: m.TmPriorityManagement })))
const TmPermissions = createLazyComponent(() => import('@/components/task/tm-permissions').then((m) => ({ default: m.TmPermissions })))
const TmIntegrations = createLazyComponent(() => import('@/components/task/tm-integrations').then((m) => ({ default: m.TmIntegrations })))
const TmAuditLogs = createLazyComponent(() => import('@/components/task/tm-audit-logs').then((m) => ({ default: m.TmAuditLogs })))

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
  { submenuId: 'calendar-view', component: TaskCalendarView },
  { submenuId: 'status-management', component: TmStatusManagement },
  { submenuId: 'priority-management', component: TmPriorityManagement },
  { submenuId: 'permissions', component: TmPermissions },
  { submenuId: 'integrations', component: TmIntegrations },
  { submenuId: 'audit-logs', component: TmAuditLogs },
]
