import type { ContentRoute } from './use-content-map-utils'
export type { LazyComponent } from './use-content-map-utils'
export type { ContentRoute } from './use-content-map-utils'

const CONTENT_MAP_LOADERS: Record<string, () => Promise<ContentRoute[]>> = {
  m0: () => import('./content-map-m0').then((module) => module.M0_CONTENT),
  m1: () => import('./content-map-m1').then((module) => module.M1_CONTENT),
  m2: () => import('./content-map-m2').then((module) => module.M2_CONTENT),
  m3: () => import('./content-map-m3').then((module) => module.M3_CONTENT),
  m4: () => import('./content-map-m4').then((module) => module.M4_CONTENT),
  m5: () => import('./content-map-m5').then((module) => module.M5_CONTENT),
  m6: () => import('./content-map-m6').then((module) => module.M6_CONTENT),
}

export async function loadContentRoutes(moduleId: string): Promise<ContentRoute[] | undefined> {
  const loader = CONTENT_MAP_LOADERS[moduleId]
  if (!loader) return undefined
  return loader()
}

export async function loadContentRoute(
  active: { moduleId: string; menuId: string; submenuId: string },
): Promise<ContentRoute | undefined> {
  const routes = await loadContentRoutes(active.moduleId)
  if (!routes) return undefined

  let match = routes.find((route) => route.submenuId === active.submenuId)
  if (!match) {
    match = routes.find((route) => route.menuId === active.menuId)
  }

  return match
}

export const COMING_SOON_CONTENT: Record<string, { title: string; description: string }> = {
  compensation: {
    title: 'Compensation',
    description: 'Manage salaries, bonuses, and equity grants. Coming soon.',
  },
  'payroll-processing': {
    title: 'Payroll Processing',
    description: 'Run payroll cycles, manage salary components, and generate payslips. Coming soon.',
  },
}
