'use client'

import { KPICard } from '@/shared/business/kpi-card'
import { Users, TrendingUp, TrendingDown, Clock, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AttendanceKPICard {
  id: string
  label: string
  value: number
  unit?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}

interface AttendanceKPICardsProps {
  cards: AttendanceKPICard[]
  className?: string
}

export function AttendanceKPICards({ cards, className }: AttendanceKPICardsProps) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-5', className)}>
      {cards.map((card) => (
        <KPICard
          key={card.id}
          label={card.label}
          value={card.value}
          unit={card.unit}
          icon={card.icon}
          description={card.trendValue}
        />
      ))}
    </div>
  )
}

/**
 * NO trend / trendValue HERE, DELIBERATELY.
 *
 * These five cards used to carry hardcoded deltas - '+2.5%', '-1.2%', '+0.8%'
 * and '0.0%' - as constants inside this function. KPICard renders `description`
 * beneath the figure, so every tenant, every filter and every date range showed
 * the same four numbers, and a user reads "+2.5%" as this month against last.
 *
 * A delta needs a prior-period figure and no attendance endpoint returns one:
 * AttendanceKpiResponse carries present_today, leave_utilization and
 * active_employees, and nothing else. `trend` and `trendValue` stay on the
 * interface so a real comparison can be passed in the day one exists - but an
 * invented number is worse than no number, because it does not announce itself.
 */
export function getEnhancedSummaryCards(data: {
  totalEmployees: number
  attendancePercentage: number
  latePercentage: number
  earlyGoingPercentage: number
  absentPercentage: number
}): AttendanceKPICard[] {
  return [
    {
      id: 'total-employees',
      label: 'Total Employees',
      value: data.totalEmployees,
      icon: <Users className="size-4 text-foreground" />,
    },
    {
      id: 'attendance',
      label: 'Attendance %',
      value: data.attendancePercentage,
      unit: '%',
      icon: <TrendingUp className="size-4 text-success" />,
    },
    {
      id: 'late',
      label: 'Late %',
      value: data.latePercentage,
      unit: '%',
      icon: <Clock className="size-4 text-warning" />,
    },
    {
      id: 'early-going',
      label: 'Early Going %',
      value: data.earlyGoingPercentage,
      unit: '%',
      icon: <TrendingDown className="size-4 text-destructive" />,
    },
    {
      id: 'absent',
      label: 'Absent %',
      value: data.absentPercentage,
      unit: '%',
      icon: <XCircle className="size-4 text-destructive" />,
    },
  ]
}
