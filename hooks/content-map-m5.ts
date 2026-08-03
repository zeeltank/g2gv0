import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const AttendanceDashboard = createLazyComponent(() => import('@/domain/hrms/hrit/attendance-management/attendance-tracking/page').then((m) => ({ default: m.AttendanceDashboard })))
const AttendanceReportsPage = createLazyComponent(() => import('@/domain/hrms/hrit/attendance-management/attendance-reports/page').then((m) => ({ default: m.AttendanceReportsPage })))
const LeaveManagementDashboard = createLazyComponent(() => import('@/domain/hrms/hrit/leave-management/leave-dashboard/page').then((m) => ({ default: m.default })))
const LeaveRequestsPage = createLazyComponent(() => import('@/domain/hrms/hrit/leave-management/leave-requests/page').then((m) => ({ default: m.default })))
const LeaveReportsPage = createLazyComponent(() => import('@/domain/hrms/hrit/leave-management/leave-reports/page').then((m) => ({ default: m.default })))
const LeaveConfigurationPage = createLazyComponent(() => import('@/domain/hrms/hrit/leave-management/leave-configuration/page').then((m) => ({ default: m.default })))
const PayrollTypePage = createLazyComponent(() => import('@/domain/hrms/hrit/payroll-management/payroll-type/page').then((m) => ({ default: m.default })))
const SalaryStructurePage = createLazyComponent(() => import('@/domain/hrms/hrit/payroll-management/salary-structure/page').then((m) => ({ default: m.default })))
const PayrollDeductionPage = createLazyComponent(() => import('@/domain/hrms/hrit/payroll-management/payroll-deduction/page').then((m) => ({ default: m.default })))
const MonthlyPayrollPage = createLazyComponent(() => import('@/domain/hrms/hrit/payroll-management/monthly-payroll/page').then((m) => ({ default: m.default })))
const SalaryCertificatePage = createLazyComponent(() => import('@/domain/hrms/hrit/payroll-management/salary-certificate/page').then((m) => ({ default: m.default })))
const Form16Page = createLazyComponent(() => import('@/domain/hrms/hrit/payroll-management/form-16/page').then((m) => ({ default: m.default })))

export const M5_CONTENT: ContentRoute[] = [
  { submenuId: 'attendance-tracking', component: AttendanceDashboard },
  { submenuId: 'attendance-reports', component: AttendanceReportsPage },
  { submenuId: 'leave-dashboard', component: LeaveManagementDashboard },
  { submenuId: 'leave-operations', component: LeaveManagementDashboard },
  { submenuId: 'leave-requests', component: LeaveRequestsPage },
  { submenuId: 'leave-reports', component: LeaveReportsPage },
  { submenuId: 'leave-configuration', component: LeaveConfigurationPage },
  { submenuId: 'payroll-type', component: PayrollTypePage },
  { submenuId: 'salary-structure', component: SalaryStructurePage },
  { submenuId: 'payroll-deduction', component: PayrollDeductionPage },
  { submenuId: 'monthly-payroll', component: MonthlyPayrollPage },
  { submenuId: 'payroll-processing', component: MonthlyPayrollPage },
  { submenuId: 'salary-certificate', component: SalaryCertificatePage },
  { submenuId: 'form-16', component: Form16Page },
]
