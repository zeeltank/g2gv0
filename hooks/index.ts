export { useAttendance } from './use-attendance'
export { useNavigation, GTG_NAVIGATION, resolveBreadcrumb, type ActiveNav } from './use-navigation'
export { useRoleVisibility, filterNavigationByRole, isMenuVisible, canAccessMenu, type Role } from './use-role-visibility'
export { ROLES, roleLabel, getAccess, type Role as RoleType, type Access } from './use-roles'
export { 
  getContentRoute, 
  COMING_SOON_CONTENT,
  MODULE_CONTENT_MAP,
  M1_CONTENT, M2_CONTENT, M3_CONTENT, M4_CONTENT, M5_CONTENT, M6_CONTENT,
  type LazyComponent, 
  type ContentRoute 
} from './use-content-map'
