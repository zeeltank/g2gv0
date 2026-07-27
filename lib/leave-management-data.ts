import type { LeaveQuickAction } from '@/types/leave-dashboard'

/**
 * Leave Management presentation helpers.
 *
 * All leave data now comes from the Laravel /api/leave/* endpoints via
 * services/hrms/leave.ts and hooks/use-leave.ts. What remains here is the
 * navigation-only quick action list plus the date formatters the dashboard
 * cards share.
 */

export const quickActions: LeaveQuickAction[] = [
  { id: 'apply', icon: 'calendar-plus', label: 'Apply Leave', description: 'Request time off from work' },
  { id: 'requests', icon: 'clipboard-list', label: 'My Requests', description: 'View your leave history' },
  { id: 'balance', icon: 'calendar-days', label: 'Leave Balance', description: 'Check your remaining leaves' },
  { id: 'reports', icon: 'chart-bar', label: 'Leave Reports', description: 'View team analytics' },
]

/** Guards against the empty / malformed dates the API can return for open ranges. */
function parseDate(dateString: string): Date | null {
  if (!dateString) return null
  const parsed = new Date(dateString.includes('T') ? dateString : `${dateString}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const formatDate = (dateString: string): string => {
  const parsed = parseDate(dateString)
  if (!parsed) return '—'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

export const formatDateShort = (dateString: string): string => {
  const parsed = parseDate(dateString)
  if (!parsed) return '—'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(parsed)
}

export const getCurrentDate = (): string =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date())
