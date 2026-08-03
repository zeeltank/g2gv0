export type NavSubmenu = {
  id: string
  label: string
  icon?: string | null
  accessLink?: string | null
}

export type NavMenu = {
  id: string
  label: string
  icon?: string | null
  accessLink?: string | null
  submenus: NavSubmenu[]
}

export type NavModule = {
  id: string
  label: string
  short: string
  icon?: string | null
  accessLink?: string | null
  menus: NavMenu[]
  /** Standalone modules navigate directly to their page and have no child menus/submenus. */
  standalone?: boolean
}

/**
 * Direct navigation target for the standalone Main Dashboard (Home) module.
 * The application's landing screen after login - not a tblmenumaster_g2g row.
 */
export const HOME_NAV: ActiveNav = {
  moduleId: 'm0',
  menuId: 'main-dashboard',
  submenuId: 'main-dashboard',
}

/**
 * Well-known tblmenumaster_g2g access_link values referenced from onboarding/setup
 * flows that need to navigate to a specific screen before the sidebar tree has
 * rendered a clickable link for it. These are the actual access_link strings
 * returned by ajax_sidebar_menu_g2g — not database ids — so they track whatever
 * the backend currently serves. Resolve with useSidebarNavigation's
 * resolveAccessLink() so a target the caller's profile can't see falls back
 * gracefully instead of navigating to a page they have no rights to.
 */
export const ORG_PROFILE_ACCESS_LINK = '/module/organizational-management/organization-setup/organization-profile'
export const DEPT_MANAGEMENT_ACCESS_LINK = '/module/organizational-management/organization-setup/department-management'
export const EMPLOYEE_DIRECTORY_ACCESS_LINK = '/module/organizational-management/user-management/employee-directory'
export const ROLE_PERMISSIONS_ACCESS_LINK = '/module/organizational-management/user-management/role-and-permissions'
export const LMS_LEARNING_CATALOG_ACCESS_LINK = '/module/lms/learning/learning-catalog'
export const LMS_MY_LEARNING_ACCESS_LINK = '/module/lms/learning/my-learning'
export const LMS_ASSIGNMENTS_ACCESS_LINK = '/module/lms/training-and-records/assignments'
export const LMS_SESSIONS_CALENDAR_ACCESS_LINK = '/module/lms/training-and-records/sessions-and-calendar'
export const AG_CREATE_AGENT_ACCESS_LINK = '/module/agentic-ai/create-agent'
export const AG_AGENT_LIBRARY_ACCESS_LINK = '/module/agentic-ai/agentic-library'
export const AG_RUN_LOG_ACCESS_LINK = '/module/agentic-ai/run-log'
export const AG_ANALYTICS_ACCESS_LINK = '/module/agentic-ai/analytics'

export type BreadcrumbItem = {
  label: string
  href?: string
}

export type ActiveNav = {
  moduleId: string
  menuId: string
  submenuId: string
}

export function resolveBreadcrumb(active: ActiveNav, modules: NavModule[]): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ label: 'Home', href: '/' }]

  if (active.moduleId === 'm0') {
    return [{ label: 'Home', href: '/dashboard' }, { label: 'Main Dashboard' }]
  }

  const navModule = modules.find((m) => m.id === active.moduleId)
  const menu = navModule?.menus.find((mn) => mn.id === active.menuId)
  const submenu = menu?.submenus.find((s) => s.id === active.submenuId)

  if (navModule?.label) {
    items.push({ label: navModule.label })
  }
  if (menu?.label) {
    items.push({ label: menu.label, href: menu.accessLink ?? undefined })
  }
  if (submenu?.label) {
    items.push({ label: submenu.label, href: submenu.accessLink ?? undefined })
  }

  return items
}

/**
 * Walks the live Modules -> Menus -> Submenus tree (already filtered to the
 * caller's profile rights) and returns accessLink back only if some node in
 * the tree actually has it — i.e. the target exists and the caller can see
 * it. Returns undefined otherwise, so callers can fall back to a safe route
 * instead of navigating somewhere the profile has no rights to.
 */
export function getRouteByAccessLink(modules: NavModule[], accessLink: string): string | undefined {
  for (const mod of modules) {
    if (mod.accessLink === accessLink) return mod.accessLink
    for (const menu of mod.menus) {
      if (menu.accessLink === accessLink) return menu.accessLink
      for (const submenu of menu.submenus) {
        if (submenu.accessLink === accessLink) return submenu.accessLink
      }
    }
  }
  return undefined
}
