import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const AttendanceDashboard = createLazyComponent(() => import('@/components/hrit/attendance-management/attendance-tracking/page').then((m) => ({ default: m.AttendanceDashboard })))
const AttendanceReportsPage = createLazyComponent(() => import('@/components/hrit/attendance-management/attendance-reports/page').then((m) => ({ default: m.AttendanceReportsPage })))
const LeaveManagementDashboard = createLazyComponent(() => import('@/components/hrit/leave-management/leave-dashboard/page').then((m) => ({ default: m.default })))
const LeaveRequestsPage = createLazyComponent(() => import('@/components/hrit/leave-management/leave-requests/page').then((m) => ({ default: m.default })))
const LeaveReportsPage = createLazyComponent(() => import('@/components/hrit/leave-management/leave-reports/page').then((m) => ({ default: m.default })))
const LeaveConfigurationPage = createLazyComponent(() => import('@/components/hrit/leave-management/leave-configuration/page').then((m) => ({ default: m.default })))

export const M5_CONTENT: ContentRoute[] = [
  { submenuId: 'attendance-tracking', component: AttendanceDashboard },
  { submenuId: 'attendance-reports', component: AttendanceReportsPage },
  { submenuId: 'leave-dashboard', component: LeaveManagementDashboard },
  { submenuId: 'leave-operations', component: LeaveManagementDashboard },
  { submenuId: 'leave-requests', component: LeaveRequestsPage },
  { submenuId: 'leave-reports', component: LeaveReportsPage },
  { submenuId: 'leave-configuration', component: LeaveConfigurationPage },
]
