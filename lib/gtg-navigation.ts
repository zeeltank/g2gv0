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
