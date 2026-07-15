import { GTG_NAVIGATION, HOME_NAV, resolveBreadcrumb, type ActiveNav } from '@/lib/gtg-navigation'

export { GTG_NAVIGATION, HOME_NAV }
export type { ActiveNav }
export { resolveBreadcrumb }

export function useNavigation() {
  return { GTG_NAVIGATION, resolveBreadcrumb }
}
