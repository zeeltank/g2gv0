import { GTG_NAVIGATION, resolveBreadcrumb, type ActiveNav } from '@/lib/gtg-navigation'

export { GTG_NAVIGATION }
export type { ActiveNav }
export { resolveBreadcrumb }

export function useNavigation() {
  return { GTG_NAVIGATION, resolveBreadcrumb }
}
