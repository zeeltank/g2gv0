
import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const TaskWorkspace = createLazyComponent(() => import('@/domain/task/task-workspace').then((m) => ({ default: m.TaskWorkspace })))
const MyTasksView = createLazyComponent(() => import('@/domain/task/my-tasks-view').then((m) => ({ default: m.MyTasksView })))
const ProjectsListView = createLazyComponent(() => import('@/domain/task/projects-list-view').then((m) => ({ default: m.ProjectsListView })))
const DependenciesView = createLazyComponent(() => import('@/domain/task/dependencies-view').then((m) => ({ default: m.DependenciesView })))
const TaskCalendarView = createLazyComponent(() => import('@/domain/task/task-calendar-view').then((m) => ({ default: m.TaskCalendarView })))
const TmReports = createLazyComponent(() => import('@/domain/task/tm-reports').then((m) => ({ default: m.TmReports })))
const TmStatusManagement = createLazyComponent(() => import('@/domain/task/tm-status-management').then((m) => ({ default: m.TmStatusManagement })))
const TmPriorityManagement = createLazyComponent(() => import('@/domain/task/tm-priority-management').then((m) => ({ default: m.TmPriorityManagement })))
const TmPermissions = createLazyComponent(() => import('@/domain/task/tm-permissions').then((m) => ({ default: m.TmPermissions })))
const TmIntegrations = createLazyComponent(() => import('@/domain/task/tm-integrations').then((m) => ({ default: m.TmIntegrations })))
const TmAuditLogs = createLazyComponent(() => import('@/domain/task/tm-audit-logs').then((m) => ({ default: m.TmAuditLogs })))

// Ids are tblmenumaster_g2g menu-level rows (Task Management, module id 204).
// The DB has no "Administration" menu/submenus yet, so status/priority/permissions/
// integrations/audit-logs have no row to key off and fall back to Coming Soon.
export const M6_CONTENT: ContentRoute[] = [
  { menuId: '210', component: TaskWorkspace }, // Task Management Dashboard
  { menuId: '211', component: MyTasksView }, // My Tasks
  { menuId: '212', component: ProjectsListView }, // Projects & Workstreams
  { menuId: '213', component: DependenciesView }, // Dependencies & Workstreams
  { menuId: '214', component: TaskCalendarView }, // Task Calendar
  { menuId: '215', component: TmReports },
  { menuId: '217', component: TmStatusManagement },
  { menuId: '218', component: TmPriorityManagement },
  { menuId: '219', component: TmPermissions },
  { menuId: '220', component: TmIntegrations },
  { menuId: '221', component: TmAuditLogs },
]
