import type { ElementType } from 'react'

export interface QuickAction {
  id: string
  label: string
  icon: ElementType
  href?: string
  onClick?: () => void
}

export interface AttendanceAlert {
  id: string
  text: string
  severity: 'critical' | 'warning' | 'info'
  /** The day the alert is about, when it has one. Drives the "Fix it" link. */
  date?: string | null
}

/**
 * One row of the My Requests tile.
 *
 * This was `{ type, status, count }` — a single status and a single number,
 * which is why the hardcoded version could say "Regularization / Pending / 1"
 * and nothing else. The API returns the three counts that actually exist.
 */
export interface MyRequest {
  id: string
  type: string
  pending: number
  approved: number
  rejected: number
}

export interface UpcomingEventItem {
  id: string
  date: string
  title: string
  day: string
  status?: string
}
