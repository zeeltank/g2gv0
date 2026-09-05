import { ALL_ROLES, HR_ADMIN_ROLES, type Role } from '@/types/role'

/**
 * Role-based menu visibility, keyed on `role_key`.
 *
 * Rewritten in HRIT Sprint 1 (F-104). This file used to speak the frontend's
 * old four-role vocabulary — 'admin' | 'hr' | 'dept-head' | 'employee' — which
 * was derived by substring-matching a profile's display name. Two consequences
 * showed up in the audit's role walk: every Reporting Manager was silently
 * promoted to Department Head, and `executive`, `auditor` and `recruiter` fell
 * through to `employee` because they matched none of the substrings.
 *
 * The nine role_keys are now named directly. The three groups below are the
 * only vocabulary the rules use, so a change lands in one place.
 *
 * These MIRROR the server-side gates deliberately — `App\Support\RoleKey`
 * and `hrms_leave_role_permissions`. This file decides what is *shown*; it is
 * not a control. Hiding a screen is not access control, which is exactly how
 * payroll ended up reachable by everyone (F-91). The API enforces.
 */

/** Every role. Self-service screens everyone has a legitimate use for. */
const EVERYONE: Role[] = ALL_ROLES

/** Payroll and configuration: the people who administer HR. */
const HR_ADMIN: Role[] = HR_ADMIN_ROLES

/**
 * Reporting. HR_ADMIN plus the two read-only oversight roles.
 *
 * `auditor` and `executive` exist to read the organisation and change nothing;
 * before this change the menu showed them neither, because they were being
 * treated as ordinary employees.
 */
const REPORTING: Role[] = ['administrator', 'hr_manager', 'hr_executive', 'executive', 'auditor']

const VISIBILITY_RULES: Record<string, Role[]> = {
  'main-dashboard': EVERYONE,

  // M1 — Organizational Management
  // Menus
  'org-setup': EVERYONE,
  'user-management': EVERYONE,
  'task-management': EVERYONE,
  'compliance-discipline': EVERYONE,
  
  // Submenus
  'org-profile': EVERYONE,
  'dept-management': EVERYONE,
  'employee-directory': EVERYONE,
  'role-permissions': ['administrator', 'hr_manager', 'hr_executive', 'department_head', 'reporting_manager'],
  'task-assignment': EVERYONE,
  'task-tracking': EVERYONE,
  'compliance-management': EVERYONE,
  'disciplinary-management': EVERYONE,

  // M2 — Competency Management
  // Menus
  'competency-library': EVERYONE,
  'job-role-library': EVERYONE,
  'competency-rating': EVERYONE,
  
  // Submenus
  'taxonomy-library': EVERYONE,
  'job-role-catalogue': EVERYONE,
  'employee-rating': EVERYONE,
  'cm-command-center': EVERYONE,
  'cm-competency-library': EVERYONE,
  'cm-libraries-taxonomy': EVERYONE,
  'cm-skill-taxonomy': EVERYONE,
  'cm-taxonomy-ontology': EVERYONE,
  'cm-framework-mapping': EVERYONE,
  'cm-assessments': EVERYONE,
  'cm-employee-profiles': EVERYONE,
  'cm-development-career': EVERYONE,
  'cm-certifications': EVERYONE,
  'cm-audit': REPORTING,

  // M7 — Agentic AI
  'ag-agent-dashboard': EVERYONE,
  'ag-agent-library': EVERYONE,
  'ag-create-agent': HR_ADMIN,
  'ag-run-log': EVERYONE,
  'ag-analytics': EVERYONE,
  'ag-multi-agent': HR_ADMIN,
  'ag-reflection': HR_ADMIN,

  // M3 — Talent Management
  // Menus
  'talent-acquisition': EVERYONE,
  'performance-management': EVERYONE,
  'hr-template-engine': HR_ADMIN,
  
  // Submenus
  'recruitment-dashboard': EVERYONE,
  'job-postings': EVERYONE,
  'interview-management': EVERYONE,
  'manager-hub': EVERYONE,
  'performance-reviews': EVERYONE,
  'appraisals-succession': ['administrator', 'hr_manager', 'hr_executive', 'department_head', 'reporting_manager'],
  'document-templates': HR_ADMIN,
  'tm-dashboard': EVERYONE,
  'recruitment': EVERYONE,
  'onboarding': EVERYONE,
  'performance': EVERYONE,
  'compensation': EVERYONE,
  'mobility-succession': EVERYONE,
  'offboarding': EVERYONE,
  'administration': EVERYONE,

  // M4 — LMS
  // Menus
  'content-library': EVERYONE,
  'assessment-library': EVERYONE,
  
  // Submenus
  'learning-dashboard': EVERYONE,
  'course-catalogue': EVERYONE,
  'assessment-centre': EVERYONE,
  'learning': EVERYONE,
  'training-records': EVERYONE,
  'lms-administration': EVERYONE,
  'lms-dashboard': EVERYONE,
  'learning-catalog': EVERYONE,
  'my-learning': EVERYONE,
  'assignments': EVERYONE,
  'sessions-calendar': EVERYONE,
  'certifications': EVERYONE,
  'create-course': EVERYONE,
  'governance': EVERYONE,

  // M5 — HRIT Solutions
  // Menus
  'attendance-management': EVERYONE,
  'leave-management': EVERYONE,
  'payroll-management': HR_ADMIN,
  
  // Submenus
  'attendance-tracking': EVERYONE,
  'attendance-reports': REPORTING,
  'leave-dashboard': EVERYONE,
  'leave-operations': EVERYONE,
  'leave-requests': EVERYONE,
  /*
   * F-130. My HR is EVERYONE by design, and it is the one entry where that
   * needs saying: the endpoints behind it take no employee id at all, so
   * "everyone" means "everyone sees exactly their own". Gating it by role
   * would be the wrong tool - the question is not which roles may read a
   * payslip, it is that each person may read one.
   */
  'my-hr': EVERYONE,
  'leave-reports': REPORTING,
  'leave-configuration': HR_ADMIN,
  'payroll-type': HR_ADMIN,
  'salary-structure': HR_ADMIN,
  'payroll-deduction': HR_ADMIN,
  'monthly-payroll': HR_ADMIN,
  'salary-certificate': HR_ADMIN,
  'form-16': HR_ADMIN,
  'payroll-processing': HR_ADMIN,
  'tm-tasks': EVERYONE,
  'tm-projects': EVERYONE,
  'tm-dependencies': EVERYONE,
  'tm-calendar': EVERYONE,
  'tm-reports': REPORTING,
  'tm-admin': EVERYONE,
  'status-management': EVERYONE,
  'priority-management': EVERYONE,
  'permissions': EVERYONE,
  'integrations': EVERYONE,
  'audit-logs': REPORTING,
}

export function isMenuVisible(menuId: string, role: Role): boolean {
  const allowed = VISIBILITY_RULES[menuId]
  if (!allowed) return false
  return allowed.includes(role)
}

/**
 * Determines if a user can access a specific page/view.
 * Checks visibility first, then applies access level rules.
 */
export function canAccessMenu(menuId: string, role: Role): boolean {
  return isMenuVisible(menuId, role)
}
