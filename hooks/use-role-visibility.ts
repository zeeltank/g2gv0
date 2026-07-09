import { filterNavigationByRole, isMenuVisible, canAccessMenu } from '@/lib/gtg-nav-visibility'
import { type Role } from '@/types/role'

export { filterNavigationByRole, isMenuVisible, canAccessMenu }
export type { Role }

export function useRoleVisibility(role: Role) {
  return {
    filteredNav: filterNavigationByRole(role),
    isMenuVisible: (menuId: string) => isMenuVisible(menuId, role),
    canAccess: (menuId: string) => canAccessMenu(menuId, role),
  }
}
