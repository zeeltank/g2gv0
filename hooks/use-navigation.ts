import { HOME_NAV, resolveBreadcrumb, type ActiveNav, type NavModule } from '@/lib/gtg-navigation'

export { HOME_NAV }
export type { ActiveNav }
export { resolveBreadcrumb }

export function useNavigation(modules: NavModule[]) {
  return { resolveBreadcrumb: (active: ActiveNav) => resolveBreadcrumb(active, modules) }
}
