/**
 * The task detail panel moved to ./task-detail/ (a right-hand side panel with
 * the description and properties on the first screen, the status in the header
 * and the comment box pinned below). This file keeps the old import path, so
 * the screens that open it - My Tasks, the Dashboard, the Calendar and the
 * Project view - did not have to change.
 */
export { MyTaskDetailsDrawer } from './task-detail/task-detail-panel'
