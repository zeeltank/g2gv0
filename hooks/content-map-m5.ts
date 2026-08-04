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

// accessLink is the stable tblmenumaster_g2g column (HRIT Solutions, module
// id 5); submenuId is kept as a fallback.
export const M5_CONTENT: ContentRoute[] = [
  { accessLink: '/module/hrit-solutions/attendance-management/attendance-tracking', submenuId: '100', component: AttendanceDashboard }, // Attendance Tracking
  { accessLink: '/module/hrit-solutions/attendance-management/attendance-reports', submenuId: '101', component: AttendanceReportsPage }, // Attendance Reports
  { accessLink: '/module/hrit-solutions/leave-management/leave-dashboard', submenuId: '102', component: LeaveManagementDashboard }, // Leave Dashboard
  { accessLink: '/module/hrit-solutions/leave-management/leave-requests', submenuId: '103', component: LeaveRequestsPage }, // Leave Requests
  { accessLink: '/module/hrit-solutions/leave-management/leave-reports', submenuId: '104', component: LeaveReportsPage }, // Leave Reports
  { accessLink: '/module/hrit-solutions/leave-management/leave-configuration', submenuId: '165', component: LeaveConfigurationPage }, // Leave Configuration
  { accessLink: '/module/hrit-solutions/payroll-management/payroll-type', submenuId: '105', component: PayrollTypePage }, // Payroll Type
  { accessLink: '/module/hrit-solutions/payroll-management/salary-structure', submenuId: '106', component: SalaryStructurePage }, // Salary Structure
  { accessLink: '/module/hrit-solutions/payroll-management/payroll-deduction', submenuId: '108', component: PayrollDeductionPage }, // Payroll Deduction
  { accessLink: '/module/hrit-solutions/payroll-management/monthly-payroll-report', submenuId: '140', component: MonthlyPayrollPage }, // Monthly Payroll Report
  { accessLink: '/module/hrit-solutions/payroll-management/salary-certificate', submenuId: '110', component: SalaryCertificatePage }, // Salary Certificate
  { accessLink: '/module/hrit-solutions/payroll-management/form-16', submenuId: '109', component: Form16Page }, // Form 16
]
