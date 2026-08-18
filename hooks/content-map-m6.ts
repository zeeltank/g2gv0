
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

// accessLink is the stable tblmenumaster_g2g column (Task Management, module
// id 204, menu-level rows); menuId is kept as a fallback.
// NOTE: ids 217-221 (status/priority/permissions/integrations/audit-logs)
// exist as rows under parent id 222 ("Administration", itself a child of 204)
// but currently share the SAME access_link as id 215
// ("/module/task-management/reports-and-analysis") — confirmed via a live DB
// query, looks like an unfinished backend slug backfill for that group.
// Assigning that link here would make .find() always resolve to whichever
// entry comes first, so these keep matching on submenuId (they're nested
// under Administration in the sidebar tree — normally via the backend's own
// parent_id nesting, with normalizeTaskManagementAdministration in
// lib/gtg-navigation.ts as a defensive fallback that makes '222' the menuId
// and each of these its own submenuId if the API ever returns them flat) —
// menuId is also set as a defensive fallback in case that nesting isn't
// applied. Swap to accessLink for these five once the backend gives each row
// its own distinct value.
export const M6_CONTENT: ContentRoute[] = [
  { accessLink: '/module/task-management/task-management-dashboard', menuId: '210', component: TaskWorkspace }, // Task Management Dashboard
  { accessLink: '/module/task-management/my-tasks', menuId: '211', component: MyTasksView }, // My Tasks
  { accessLink: '/module/task-management/projects-and-workstreams', menuId: '212', component: ProjectsListView }, // Projects & Workstreams
  { accessLink: '/module/task-management/dependencies-and-workstreams', menuId: '213', component: DependenciesView }, // Dependencies & Workstreams
  { accessLink: '/module/task-management/task-calendar', menuId: '214', component: TaskCalendarView }, // Task Calendar
  { accessLink: '/module/task-management/reports-and-analysis', menuId: '215', component: TmReports },

  {accessLink: '/module/task-management/task-status', submenuId: '217', component: TmStatusManagement }, // Status Management
  { accessLink: '/module/task-management/task-priority', submenuId: '218', component: TmPriorityManagement }, // Priority Management
  { accessLink: '/module/task-management/task-permission', submenuId: '219', component: TmPermissions }, // Permissions
  { accessLink: '/module/task-management/task-integrations', submenuId: '220', component: TmIntegrations }, // Integrations
  { accessLink: '/module/task-management/task-audit-logs', submenuId: '221', component: TmAuditLogs }, // Audit Logs
]
