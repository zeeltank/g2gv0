// Re-export all role-related types and functions from types/role.ts
// This maintains backwards compatibility for existing imports from @/lib/gtg-roles
export {
  ROLES,
  getAccess,
  roleLabel,
} from '@/types/role'

export type { Role, Access } from '@/types/role'
