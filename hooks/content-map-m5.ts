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
// F-130. The employee's own view of themselves - the audit's Part D gap.
//
// This comment used to say My HR was "not in tblmenumaster_g2g yet" and
// "reachable by URL and from the leave screens". BOTH halves were wrong, and
// stayed wrong after the fix: no component links to it, and the F-153 migration
// added row 305 (status=1, parent 5, can_view for every profile on both hosts -
// 108/108 and 42/42). It has been in the sidebar since. A re-audit read this
// comment, reported the screen as unreachable, and was checked against the
// database rather than believed.
const MyHrPage = createLazyComponent(() => import('@/domain/hrms/hrit/my-hr/page').then((m) => ({ default: m.default })))
// F-166. Bank-wise Payment Advice - a finished, gated endpoint with no caller.
const PayrollBankReportPage = createLazyComponent(() => import('@/domain/hrms/hrit/payroll-management/payroll-bank-report/page').then((m) => ({ default: m.default })))
// F-169. Employee Payroll History - likewise finished, likewise uncalled.
const PayrollHistoryPage = createLazyComponent(() => import('@/domain/hrms/hrit/payroll-management/payroll-history/page').then((m) => ({ default: m.default })))
// F-171. Monthly Attendance Report - the most complete attendance endpoint in
// the module, and the only one that resolves a weekend from an absence per day.
const MonthlyAttendanceReportPage = createLazyComponent(() => import('@/domain/hrms/hrit/attendance-management/monthly-attendance-report/page').then((m) => ({ default: m.default })))
// F-172. Payroll Register - the only screen that puts the day counts next to
// the pay, so "why is this person's pay low" is answered in one row.
const PayrollRegisterPage = createLazyComponent(() => import('@/domain/hrms/hrit/payroll-management/payroll-register/page').then((m) => ({ default: m.default })))
// Salary Structure Report - impossible before F-160 fixed its tenant resolution.
const SalaryStructureReportPage = createLazyComponent(() => import('@/domain/hrms/hrit/payroll-management/salary-structure-report/page').then((m) => ({ default: m.default })))

// accessLink is the stable tblmenumaster_g2g column (HRIT Solutions, module
// id 5); submenuId is kept as a fallback.
export const M5_CONTENT: ContentRoute[] = [
  { accessLink: '/module/hrit-solutions/attendance-management/attendance-tracking', submenuId: '100', component: AttendanceDashboard }, // Attendance Tracking
  { accessLink: '/module/hrit-solutions/attendance-management/attendance-reports', submenuId: '101', component: AttendanceReportsPage }, // Attendance Reports
  { accessLink: '/module/hrit-solutions/attendance-management/monthly-attendance-report', submenuId: '309', component: MonthlyAttendanceReportPage }, // Monthly Attendance Report (F-171)
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
  { accessLink: '/module/hrit-solutions/payroll-management/payroll-bank-report', submenuId: '307', component: PayrollBankReportPage }, // Bank-wise Payment Advice (F-166)
  { accessLink: '/module/hrit-solutions/payroll-management/payroll-history', submenuId: '308', component: PayrollHistoryPage }, // Employee Payroll History (F-169)
  { accessLink: '/module/hrit-solutions/payroll-management/payroll-register', submenuId: '310', component: PayrollRegisterPage }, // Payroll Register (F-172)
  { accessLink: '/module/hrit-solutions/payroll-management/salary-structure-report', submenuId: '311', component: SalaryStructureReportPage }, // Salary Structure Report
  { accessLink: '/module/hrit-solutions/my-hr', component: MyHrPage }, // My HR (F-130) - every role, own data only
]
