import type { ComponentType } from 'react'
import type { ActiveNav } from '@/hooks/use-navigation'

// Content component imports - lazy loaded for better code splitting
const OrganizationInformation = () => import('@/components/org/organization-information').then(m => ({ default: m.OrganizationInformation }))
const DepartmentList = () => import('@/components/org/department-list').then(m => ({ default: m.DepartmentList }))
const DepartmentHierarchy = () => import('@/components/org/department-hierarchy').then(m => ({ default: m.DepartmentHierarchy }))
const EmployeeDirectory = () => import('@/components/org/employee-directory').then(m => ({ default: m.EmployeeDirectory }))
const RolePermissions = () => import('@/components/org/role-permissions').then(m => ({ default: m.RolePermissions }))
const ComplianceLibraryManagement = () => import('@/components/compliance-discipline/compliance-library-management').then(m => ({ default: m.ComplianceLibraryManagement }))
const DisciplinaryManagement = () => import('@/components/compliance-discipline/disciplinary-management').then(m => ({ default: m.DisciplinaryManagement }))

const CmCommandCenter = () => import('@/components/competency/cm-command-center').then(m => ({ default: m.CmCommandCenter }))
const CmCompetencyLibrary = () => import('@/components/competency/cm-competency-library').then(m => ({ default: m.CmCompetencyLibrary }))
const CmFrameworkMapping = () => import('@/components/competency/cm-framework-mapping').then(m => ({ default: m.CmFrameworkMapping }))
const CmAssessmentWorkspace = () => import('@/components/competency/cm-assessment-workspace').then(m => ({ default: m.CmAssessmentWorkspace }))
const CmEmployeeProfiles = () => import('@/components/competency/cm-employee-profiles').then(m => ({ default: m.CmEmployeeProfiles }))
const CmDevelopmentCareer = () => import('@/components/competency/cm-development-career').then(m => ({ default: m.CmDevelopmentCareer }))
const CmCertifications = () => import('@/components/competency/cm-certifications').then(m => ({ default: m.CmCertifications }))
const CmAudit = () => import('@/components/competency/cm-audit').then(m => ({ default: m.CmAudit }))

const AttendanceDashboard = () => import('@/components/attendance/attendance-dashboard').then(m => ({ default: m.AttendanceDashboard }))
const AttendanceReportsPage = () => import('@/components/attendance/attendance-reports-page').then(m => ({ default: m.AttendanceReportsPage }))
const LeaveManagementDashboard = () => import('@/components/leave-management').then(m => ({ default: m.LeaveManagementDashboard }))
const LeaveRequestsPage = () => import('@/components/leave-management').then(m => ({ default: m.LeaveRequestsPage }))
const LeaveReportsPage = () => import('@/components/leave-management').then(m => ({ default: m.LeaveReportsPage }))
const LeaveConfigurationPage = () => import('@/components/leave-management').then(m => ({ default: m.LeaveConfigurationPage }))

const TaskWorkspace = () => import('@/components/task/task-workspace').then(m => ({ default: m.TaskWorkspace }))
const MyTasksView = () => import('@/components/task/my-tasks-view').then(m => ({ default: m.MyTasksView }))
const ProjectsListView = () => import('@/components/task/projects-list-view').then(m => ({ default: m.ProjectsListView }))
const DependenciesView = () => import('@/components/task/dependencies-view').then(m => ({ default: m.DependenciesView }))
const TaskCalendarView = () => import('@/components/task/task-calendar-view').then(m => ({ default: m.TaskCalendarView }))
const TmStatusManagement = () => import('@/components/task/tm-status-management').then(m => ({ default: m.TmStatusManagement }))
const TmPriorityManagement = () => import('@/components/task/tm-priority-management').then(m => ({ default: m.TmPriorityManagement }))
const TmPermissions = () => import('@/components/task/tm-permissions').then(m => ({ default: m.TmPermissions }))
const TmIntegrations = () => import('@/components/task/tm-integrations').then(m => ({ default: m.TmIntegrations }))
const TmAuditLogs = () => import('@/components/task/tm-audit-logs').then(m => ({ default: m.TmAuditLogs }))

const LmsDashboard = () => import('@/components/lms/dashboard').then(m => ({ default: m.LmsDashboard }))
const LearningCatalog = () => import('@/components/lms/catalog').then(m => ({ default: m.LearningCatalog }))
const CreateCoursePage = () => import('@/components/lms/course-builder/create-course-page').then(m => ({ default: m.CreateCoursePage }))
const LearningAssignments = () => import('@/components/lms/assignments').then(m => ({ default: m.LearningAssignments }))
const LearningDeliveryWorkspace = () => import('@/components/lms/delivery').then(m => ({ default: m.LearningDeliveryWorkspace }))
const SessionsCalendar = () => import('@/components/lms/sessions').then(m => ({ default: m.SessionsCalendar }))
const CertificationsRecords = () => import('@/components/lms/records').then(m => ({ default: m.CertificationsRecords }))
const LmsGovernance = () => import('@/components/lms/governance').then(m => ({ default: m.LmsGovernance }))

const TalentDashboard = () => import('@/components/talent/dashboard').then(m => ({ default: m.TalentDashboard }))
const RecruitmentCenter = () => import('@/components/talent/recruitment').then(m => ({ default: m.RecruitmentCenter }))
const OnboardingCenter = () => import('@/components/talent/onboarding').then(m => ({ default: m.OnboardingCenter }))
const PerformanceCenter = () => import('@/components/talent/performance').then(m => ({ default: m.PerformanceCenter }))
const MobilityCenter = () => import('@/components/talent/mobility-succession').then(m => ({ default: m.MobilityCenter }))
const OffboardingCenter = () => import('@/components/talent/offboarding').then(m => ({ default: m.OffboardingCenter }))
const AdminCenter = () => import('@/components/talent/administration').then(m => ({ default: m.AdminCenter }))

export type LazyComponent = () => Promise<{ default: ComponentType<any> }>

export interface ContentRoute {
  submenuId?: string
  menuId?: string
  component: LazyComponent
  title?: string
  description?: string
}

// M1 — Organizational Management
export const M1_CONTENT: ContentRoute[] = [
  { submenuId: 'org-profile', component: OrganizationInformation },
  { submenuId: 'dept-management', component: DepartmentList },
  { submenuId: 'hierarchy', component: DepartmentHierarchy },
  { submenuId: 'employee-directory', component: EmployeeDirectory },
  { submenuId: 'role-permissions', component: RolePermissions },
  { submenuId: 'compliance-management', component: ComplianceLibraryManagement },
  { submenuId: 'disciplinary-management', component: DisciplinaryManagement },
]

// M2 — Competency Management
export const M2_CONTENT: ContentRoute[] = [
  { submenuId: 'cm-command-center', component: CmCommandCenter },
  { submenuId: 'cm-competency-library', component: CmCompetencyLibrary },
  { submenuId: 'cm-framework-mapping', component: CmFrameworkMapping },
  { submenuId: 'cm-assessments', component: CmAssessmentWorkspace },
  { submenuId: 'cm-employee-profiles', component: CmEmployeeProfiles },
  { submenuId: 'cm-development-career', component: CmDevelopmentCareer },
  { submenuId: 'cm-certifications', component: CmCertifications },
  { submenuId: 'cm-audit', component: CmAudit },
]

// M3 — Talent Management
export const M3_CONTENT: ContentRoute[] = [
  { menuId: 'tm-dashboard', component: TalentDashboard },
  { menuId: 'recruitment', component: RecruitmentCenter },
  { menuId: 'onboarding', component: OnboardingCenter },
  { menuId: 'performance', component: PerformanceCenter },
  { menuId: 'mobility-succession', component: MobilityCenter },
  { menuId: 'offboarding', component: OffboardingCenter },
  { menuId: 'administration', component: AdminCenter },
]

// M4 — LMS
export const M4_CONTENT: ContentRoute[] = [
  { submenuId: 'lms-dashboard', component: LmsDashboard },
  { submenuId: 'learning-catalog', component: LearningCatalog },
  { submenuId: 'my-learning', component: LearningDeliveryWorkspace },
  { submenuId: 'create-course', component: CreateCoursePage },
  { submenuId: 'assignments', component: LearningAssignments },
  { submenuId: 'sessions-calendar', component: SessionsCalendar },
  { submenuId: 'certifications', component: CertificationsRecords },
  { submenuId: 'governance', component: LmsGovernance },
]

// M5 — HRIT Solutions (Attendance & Leave)
export const M5_CONTENT: ContentRoute[] = [
  { submenuId: 'attendance-tracking', component: AttendanceDashboard },
  { submenuId: 'attendance-reports', component: AttendanceReportsPage },
  { submenuId: 'leave-dashboard', component: LeaveManagementDashboard },
  { submenuId: 'leave-operations', component: LeaveManagementDashboard },
  { submenuId: 'leave-requests', component: LeaveRequestsPage },
  { submenuId: 'leave-reports', component: LeaveReportsPage },
  { submenuId: 'leave-configuration', component: LeaveConfigurationPage },
]

// M6 — Task Management
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

export const MODULE_CONTENT_MAP: Record<string, ContentRoute[]> = {
  m1: M1_CONTENT,
  m2: M2_CONTENT,
  m3: M3_CONTENT,
  m4: M4_CONTENT,
  m5: M5_CONTENT,
  m6: M6_CONTENT,
}

// Look up content component by active navigation
export function getContentRoute(active: ActiveNav): ContentRoute | undefined {
  const routes = MODULE_CONTENT_MAP[active.moduleId]
  if (!routes) return undefined
  
  // First try to match by submenuId
  let match = routes.find(r => r.submenuId === active.submenuId)
  // Then try menuId for modules that use it (like M3)
  if (!match) {
    match = routes.find(r => r.menuId === active.menuId)
  }
  return match
}

// Coming soon placeholders
export const COMING_SOON_CONTENT: Record<string, { title: string; description: string }> = {
  'compensation': {
    title: 'Compensation',
    description: 'Manage salaries, bonuses, and equity grants. Coming soon.',
  },
  'payroll-processing': {
    title: 'Payroll Processing',
    description: 'Run payroll cycles, manage salary components, and generate payslips. Coming soon.',
  },
}
