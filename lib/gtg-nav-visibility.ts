import { type Role } from '@/types/role'
import { GTG_NAVIGATION } from '@/lib/gtg-navigation'

const ALL_ROLES: Role[] = ['admin', 'hr', 'dept-head', 'employee']

/**
 * Role-based menu visibility rules per Permission Flowchart.
 * Maps each module/menu/submenu to the roles that can see it.
 */
const VISIBILITY_RULES: Record<string, Role[]> = {
  'main-dashboard': ALL_ROLES,

  // M1 — Organizational Management
  // Menus
  'org-setup': ['admin', 'hr', 'dept-head', 'employee'],
  'user-management': ['admin', 'hr', 'dept-head', 'employee'],
  'task-management': ['admin', 'hr', 'dept-head', 'employee'],
  'compliance-discipline': ['admin', 'hr', 'dept-head', 'employee'],
  
  // Submenus
  'org-profile': ['admin', 'hr', 'dept-head', 'employee'],
  'dept-management': ['admin', 'hr', 'dept-head', 'employee'],
  'employee-directory': ['admin', 'hr', 'dept-head', 'employee'],
  'role-permissions': ['admin', 'hr', 'dept-head'],
  'task-assignment': ['admin', 'hr', 'dept-head', 'employee'],
  'task-tracking': ['admin', 'hr', 'dept-head', 'employee'],
  'compliance-management': ['admin', 'hr', 'dept-head', 'employee'],
  'disciplinary-management': ['admin', 'hr', 'dept-head', 'employee'],

  // M2 — Competency Management
  // Menus
  'competency-library': ['admin', 'hr', 'dept-head', 'employee'],
  'job-role-library': ['admin', 'hr', 'dept-head', 'employee'],
  'competency-rating': ['admin', 'hr', 'dept-head', 'employee'],
  
  // Submenus
  'taxonomy-library': ['admin', 'hr', 'dept-head', 'employee'],
  'job-role-catalogue': ['admin', 'hr', 'dept-head', 'employee'],
  'employee-rating': ['admin', 'hr', 'dept-head', 'employee'],
  'cm-command-center': ALL_ROLES,
  'cm-competency-library': ALL_ROLES,
  'cm-framework-mapping': ALL_ROLES,
  'cm-assessments': ALL_ROLES,
  'cm-employee-profiles': ALL_ROLES,
  'cm-development-career': ALL_ROLES,
  'cm-certifications': ALL_ROLES,
  'cm-audit': ALL_ROLES,

  // M3 — Talent Management
  // Menus
  'talent-acquisition': ['admin', 'hr', 'dept-head', 'employee'],
  'performance-management': ['admin', 'hr', 'dept-head', 'employee'],
  'hr-template-engine': ['admin', 'hr'],
  
  // Submenus
  'recruitment-dashboard': ['admin', 'hr', 'dept-head', 'employee'],
  'job-postings': ['admin', 'hr', 'dept-head', 'employee'],
  'interview-management': ['admin', 'hr', 'dept-head', 'employee'],
  'manager-hub': ['admin', 'hr', 'dept-head', 'employee'],
  'performance-reviews': ['admin', 'hr', 'dept-head', 'employee'],
  'appraisals-succession': ['admin', 'hr', 'dept-head'],
  'document-templates': ['admin', 'hr'],
  'tm-dashboard': ALL_ROLES,
  'recruitment': ALL_ROLES,
  'onboarding': ALL_ROLES,
  'performance': ALL_ROLES,
  'compensation': ALL_ROLES,
  'mobility-succession': ALL_ROLES,
  'offboarding': ALL_ROLES,
  'administration': ALL_ROLES,

  // M4 — LMS
  // Menus
  'content-library': ['admin', 'hr', 'dept-head', 'employee'],
  'assessment-library': ['admin', 'hr', 'dept-head', 'employee'],
  
  // Submenus
  'learning-dashboard': ['admin', 'hr', 'dept-head', 'employee'],
  'course-catalogue': ['admin', 'hr', 'dept-head', 'employee'],
  'assessment-centre': ['admin', 'hr', 'dept-head', 'employee'],
  'learning': ALL_ROLES,
  'training-records': ALL_ROLES,
  'lms-administration': ALL_ROLES,
  'lms-dashboard': ALL_ROLES,
  'learning-catalog': ALL_ROLES,
  'my-learning': ALL_ROLES,
  'assignments': ALL_ROLES,
  'sessions-calendar': ALL_ROLES,
  'certifications': ALL_ROLES,
  'create-course': ALL_ROLES,
  'governance': ALL_ROLES,

  // M5 — HRIT Solutions
  // Menus
  'attendance-management': ['admin', 'hr', 'dept-head', 'employee'],
  'leave-management': ['admin', 'hr', 'dept-head', 'employee'],
  'payroll-management': ['admin', 'hr'],
  
  // Submenus
  'attendance-tracking': ['admin', 'hr', 'dept-head', 'employee'],
  'attendance-reports': ['admin', 'hr'],
  'leave-dashboard': ['admin', 'hr', 'dept-head', 'employee'],
  'leave-operations': ['admin', 'hr', 'dept-head', 'employee'],
  'leave-requests': ['admin', 'hr', 'dept-head', 'employee'],
  'leave-reports': ['admin', 'hr'],
  'leave-configuration': ['admin', 'hr'],
  'payroll-type': ['admin', 'hr'],
  'salary-structure': ['admin', 'hr'],
  'payroll-deduction': ['admin', 'hr'],
  'monthly-payroll': ['admin', 'hr'],
  'salary-certificate': ['admin', 'hr'],
  'form-16': ['admin', 'hr'],
  'payroll-processing': ['admin', 'hr'],
  'tm-tasks': ALL_ROLES,
  'tm-projects': ALL_ROLES,
  'tm-dependencies': ALL_ROLES,
  'tm-calendar': ALL_ROLES,
  'tm-admin': ALL_ROLES,
  'status-management': ALL_ROLES,
  'priority-management': ALL_ROLES,
  'permissions': ALL_ROLES,
  'integrations': ALL_ROLES,
  'audit-logs': ALL_ROLES,
}

export function isMenuVisible(menuId: string, role: Role): boolean {
  const allowed = VISIBILITY_RULES[menuId]
  if (!allowed) return false
  return allowed.includes(role)
}

export function filterNavigationByRole(role: Role) {
  return GTG_NAVIGATION.map((module) => ({
    ...module,
    menus: module.menus.flatMap((menu) => {
      if (!isMenuVisible(menu.id, role)) return []

      const submenus = menu.submenus.filter((submenu) => isMenuVisible(submenu.id, role))
      if (menu.submenus.length > 0 && submenus.length === 0) return []

      return [{ ...menu, submenus }]
    }),
  }))
}

/**
 * Determines if a user can access a specific page/view.
 * Checks visibility first, then applies access level rules.
 */
export function canAccessMenu(menuId: string, role: Role): boolean {
  return isMenuVisible(menuId, role)
}
