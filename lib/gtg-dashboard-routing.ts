import { type Role } from '@/lib/gtg-roles'

/**
 * Role-based dashboard routing per the requirement:
 * Admin → Admin Dashboard
 * HR → HR Operations Dashboard
 * Department Head → Team Dashboard
 * Employee → Personal Dashboard
 */
export function getDashboardRoute(role: Role): string {
  switch (role) {
    case 'admin':
      return '/dashboard/admin'
    case 'hr':
      return '/dashboard/hr-operations'
    case 'dept-head':
      return '/dashboard/team'
    case 'employee':
      return '/dashboard/personal'
  }
}

/**
 * Get the friendly name for the dashboard
 */
export function getDashboardLabel(role: Role): string {
  switch (role) {
    case 'admin':
      return 'Admin Dashboard'
    case 'hr':
      return 'HR Operations Dashboard'
    case 'dept-head':
      return 'Team Dashboard'
    case 'employee':
      return 'Personal Dashboard'
  }
}
