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

// Ids are tblmenumaster_g2g rows (HRIT Solutions, module id 5).
export const M5_CONTENT: ContentRoute[] = [
  { submenuId: '100', component: AttendanceDashboard }, // Attendance Tracking
  { submenuId: '101', component: AttendanceReportsPage }, // Attendance Reports
  { submenuId: '102', component: LeaveManagementDashboard }, // Leave Dashboard
  { submenuId: '103', component: LeaveRequestsPage }, // Leave Requests
  { submenuId: '104', component: LeaveReportsPage }, // Leave Reports
  { submenuId: '165', component: LeaveConfigurationPage }, // Leave Configuration
  { submenuId: '105', component: PayrollTypePage }, // Payroll Type
  { submenuId: '106', component: SalaryStructurePage }, // Salary Structure
  { submenuId: '108', component: PayrollDeductionPage }, // Payroll Deduction
  { submenuId: '140', component: MonthlyPayrollPage }, // Monthly Payroll Report
  { submenuId: '110', component: SalaryCertificatePage }, // Salary Certificate
  { submenuId: '109', component: Form16Page }, // Form 16
]
