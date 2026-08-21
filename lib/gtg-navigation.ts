/**
 * A single node in the Modules -> Menus -> Submenus -> ... tree, at any
 * depth. The tree is built entirely from tblmenumaster_g2g id/parent_id
 * relationships (see useSidebarNavigation), so a node's `children` can be
 * empty (a leaf), or nest arbitrarily deep — nothing in this type or the
 * code that walks it assumes a fixed number of levels.
 */
export type NavNode = {
  id: string
  label: string
  icon?: string | null
  accessLink?: string | null
  children: NavNode[]
}

export type NavModule = NavNode & {
  short: string
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
export const COMPLIANCE_LIBRARY_ACCESS_LINK = '/module/organizational-management/compliance-and-discipline/compliance-library'
export const DISCIPLINARY_LIBRARY_ACCESS_LINK = '/module/organizational-management/compliance-and-discipline/disciplinary-library'
export const LMS_LEARNING_CATALOG_ACCESS_LINK = '/module/lms/learning/learning-catalog'
export const LMS_MY_LEARNING_ACCESS_LINK = '/module/lms/learning/my-learning'
export const LMS_ASSIGNMENTS_ACCESS_LINK = '/module/lms/training-and-records/assignments'
export const LMS_SESSIONS_CALENDAR_ACCESS_LINK = '/module/lms/training-and-records/sessions-and-calendar'
/**
 * Capability Library - where job roles, skills and competencies are authored.
 *
 * Matches tblmenumaster_g2g row 223 exactly; content-map-m2.ts resolves it to
 * CmLibrariesTaxonomy, which opens on the Job Role tab.
 */
export const CAPABILITY_LIBRARY_ACCESS_LINK = '/module/capability-intelligence/capability-library'
export const COMPETENCY_LIBRARY_ACCESS_LINK = '/module/capability-intelligence/competency-library'
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

/**
 * Depth-first search for the node with the given id, starting from `nodes`.
 * Returns the full ancestor chain (root-first, target last) or null if not
 * found. Used by resolveBreadcrumb and the sidebar so both work at any tree
 * depth without assuming a fixed number of levels.
 */
export function findNodePath(nodes: NavNode[], id: string): NavNode[] | null {
  for (const node of nodes) {
    if (node.id === id) return [node]
    const childPath = findNodePath(node.children, id)
    if (childPath) return [node, ...childPath]
  }
  return null
}

export function resolveBreadcrumb(active: ActiveNav, modules: NavModule[]): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ label: 'Home', href: '/' }]

  if (active.moduleId === 'm0') {
    return [{ label: 'Home', href: '/dashboard' }, { label: 'Main Dashboard' }]
  }

  const navModule = modules.find((m) => m.id === active.moduleId)
  if (!navModule) return items

  items.push({ label: navModule.label })

  const targetId = active.submenuId || active.menuId
  const path = targetId ? findNodePath(navModule.children, targetId) : null
  for (const node of path ?? []) {
    items.push({ label: node.label, href: node.accessLink ?? undefined })
  }

  return items
}

/**
 * Walks the live Modules -> Menus -> Submenus -> ... tree (already filtered
 * to the caller's profile rights, arbitrary depth) and returns accessLink
 * back only if some node in the tree actually has it — i.e. the target
 * exists and the caller can see it. Returns undefined otherwise, so callers
 * can fall back to a safe route instead of navigating somewhere the profile
 * has no rights to.
 */
export function getRouteByAccessLink(modules: NavModule[], accessLink: string): string | undefined {
  const search = (nodes: NavNode[]): string | undefined => {
    for (const node of nodes) {
      if (node.accessLink === accessLink) return node.accessLink
      const found = search(node.children)
      if (found) return found
    }
    return undefined
  }
  return search(modules)
}
