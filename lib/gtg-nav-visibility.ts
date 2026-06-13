import { type Role } from '@/lib/gtg-roles'
import { GTG_NAVIGATION } from '@/lib/gtg-navigation'

/**
 * Role-based menu visibility rules per Permission Flowchart.
 * Maps each module/menu/submenu to the roles that can see it.
 */
const VISIBILITY_RULES: Record<string, Role[]> = {
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
  'role-responsibility': ['admin', 'hr', 'dept-head'],
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

  // M4 — LMS
  // Menus
  'content-library': ['admin', 'hr', 'dept-head', 'employee'],
  'assessment-library': ['admin', 'hr', 'dept-head', 'employee'],
  
  // Submenus
  'learning-dashboard': ['admin', 'hr', 'dept-head', 'employee'],
  'course-catalogue': ['admin', 'hr', 'dept-head', 'employee'],
  'assessment-centre': ['admin', 'hr', 'dept-head', 'employee'],

  // M5 — HRIT Solutions
  // Menus
  'attendance-management': ['admin', 'hr', 'dept-head', 'employee'],
  'leave-management': ['admin', 'hr', 'dept-head', 'employee'],
  'payroll-management': ['admin', 'hr'],
  
  // Submenus
  'attendance-tracking': ['admin', 'hr', 'dept-head', 'employee'],
  'attendance-reports': ['admin', 'hr'],
  'leave-operations': ['admin', 'hr', 'dept-head', 'employee'],
  'payroll-processing': ['admin', 'hr'],
}

export function isMenuVisible(menuId: string, role: Role): boolean {
  const allowed = VISIBILITY_RULES[menuId]
  if (!allowed) return false
  return allowed.includes(role)
}

export function filterNavigationByRole(role: Role) {
  return GTG_NAVIGATION.map((module) => ({
    ...module,
    menus: module.menus
      .filter((menu) => isMenuVisible(menu.id, role))
      .map((menu) => ({
        ...menu,
        submenus: menu.submenus.filter((submenu) => isMenuVisible(submenu.id, role)),
      }))
      .filter((menu) => menu.submenus.length > 0),
  }))
}

/**
 * Determines if a user can access a specific page/view.
 * Checks visibility first, then applies access level rules.
 */
export function canAccessMenu(menuId: string, role: Role): boolean {
  return isMenuVisible(menuId, role)
}
