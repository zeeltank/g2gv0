import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const TaskWorkspace = createLazyComponent(() => import('@/domain/task/task-workspace').then((m) => ({ default: m.TaskWorkspace })))
const MyTasksView = createLazyComponent(() => import('@/domain/task/my-tasks-view').then((m) => ({ default: m.MyTasksView })))
const ProjectsListView = createLazyComponent(() => import('@/domain/task/projects-list-view').then((m) => ({ default: m.ProjectsListView })))
const DependenciesView = createLazyComponent(() => import('@/domain/task/dependencies-view').then((m) => ({ default: m.DependenciesView })))
const TaskCalendarView = createLazyComponent(() => import('@/domain/task/task-calendar-view').then((m) => ({ default: m.TaskCalendarView })))

// Ids are tblmenumaster_g2g menu-level rows (Task Management, module id 204).
// The DB has no "Administration" menu/submenus yet, so status/priority/permissions/
// integrations/audit-logs have no row to key off and fall back to Coming Soon.
export const M6_CONTENT: ContentRoute[] = [
  { menuId: '210', component: TaskWorkspace }, // Task Management Dashboard
  { menuId: '211', component: MyTasksView }, // My Tasks
  { menuId: '212', component: ProjectsListView }, // Projects & Workstreams
  { menuId: '213', component: DependenciesView }, // Dependencies & Workstreams
  { menuId: '214', component: TaskCalendarView }, // Task Calendar
]
