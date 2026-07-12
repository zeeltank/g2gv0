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
}

export interface MyRequest {
  id: string
  type: string
  status: string
  count: number
}

export interface UpcomingEventItem {
  id: string
  date: string
  title: string
  day: string
  status?: string
}
