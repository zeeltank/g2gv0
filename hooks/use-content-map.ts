import type { ContentRoute } from './use-content-map-utils'
export type { LazyComponent } from './use-content-map-utils'
export type { ContentRoute } from './use-content-map-utils'

// Keyed by tblmenumaster_g2g module id (level=1 row id); 'm0' is the synthetic Home module.
const CONTENT_MAP_LOADERS: Record<string, () => Promise<ContentRoute[]>> = {
  m0: () => import('./content-map-m0').then((module) => module.M0_CONTENT),
  // The Home dashboard is a real tblmenumaster_g2g row now, not a frontend
  // constant. Id 300 was chosen because it was free in BOTH databases, so
  // unlike every other menu this one has the same id in local and live - which
  // is what lets a single key here be correct in both.
  '300': () => import('./content-map-m0').then((module) => module.M0_CONTENT),
  '1': () => import('./content-map-m1').then((module) => module.M1_CONTENT), // Organizational Management
  '2': () => import('./content-map-m2').then((module) => module.M2_CONTENT), // Competency Management
  '3': () => import('./content-map-m3').then((module) => module.M3_CONTENT), // Talent Management
  '4': () => import('./content-map-m4').then((module) => module.M4_CONTENT), // LMS
  '5': () => import('./content-map-m5').then((module) => module.M5_CONTENT), // HRIT Solutions
  '204': () => import('./content-map-m6').then((module) => module.M6_CONTENT), // Task Management
  '186': () => import('./content-map-m7').then((module) => module.M7_CONTENT), // Agentic AI
}

export async function loadContentRoutes(moduleId: string): Promise<ContentRoute[] | undefined> {
  const loader = CONTENT_MAP_LOADERS[moduleId]
  if (!loader) return undefined
  return loader()
}

export async function loadContentRoute(
  active: { moduleId: string; menuId: string; submenuId: string },
  accessLink?: string,
): Promise<ContentRoute | undefined> {
  const routes = await loadContentRoutes(active.moduleId)
  if (!routes) return undefined

  // accessLink is the stable tblmenumaster_g2g column; submenuId/menuId are
  // its numeric ids, kept as a fallback for routes not yet migrated.
  let match = accessLink ? routes.find((route) => route.accessLink === accessLink) : undefined
  if (!match) {
    match = routes.find((route) => route.submenuId === active.submenuId)
  }
  if (!match) {
    match = routes.find((route) => route.menuId === active.menuId)
  }

  return match
}

export const COMING_SOON_CONTENT: Record<string, { title: string; description: string }> = {
  '50': { // Compensation (menu id, Talent Management)
    title: 'Compensation',
    description: 'Manage salaries, bonuses, and equity grants. Coming soon.',
  },
}
