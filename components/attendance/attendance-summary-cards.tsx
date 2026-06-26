'use client'

import * as React from 'react'
import { KPICard } from '@/components/business/kpi-card'
import { Users, Clock, Building2, BarChart3, CalendarDays, CalendarCheck, CalendarX } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SummaryCard {
  id: string
  label: string
  value: string | number
  unit?: string
  icon?: React.ReactNode
  description?: string
}

interface AttendanceSummaryCardsProps extends React.HTMLAttributes<HTMLDivElement> {
  cards: SummaryCard[]
}

export function AttendanceSummaryCards({ cards, className, ...props }: AttendanceSummaryCardsProps) {
  return (
    <div
      className={cn(
        'grid gap-4 md:grid-cols-2 lg:grid-cols-4',
        className,
      )}
      {...props}
    >
      {cards.map((card) => (
        <KPICard
          key={card.id}
          label={card.label}
          value={card.value}
          unit={card.unit}
          icon={card.icon}
          description={card.description}
        />
      ))}
    </div>
  )
}

const iconMap: Record<string, React.ReactNode> = {
  users: <Users className="size-5" />,
  clock: <Clock className="size-5" />,
  building: <Building2 className="size-5" />,
  chart: <BarChart3 className="size-5" />,
  calendarDays: <CalendarDays className="size-5" />,
  calendarCheck: <CalendarCheck className="size-5" />,
  calendarX: <CalendarX className="size-5" />,
}

export function getEarlyGoingCards(
  totalEmployees: number,
  earlyGoingCount: number,
  averageEarlyMinutes: number,
  highestEarlyDept: string,
): SummaryCard[] {
  return [
    {
      id: 'total-employees',
      label: 'Total Employees',
      value: totalEmployees,
      icon: iconMap.users,
    },
    {
      id: 'early-going-count',
      label: 'Early Going Count',
      value: earlyGoingCount,
      icon: iconMap.clock,
    },
    {
      id: 'avg-early-minutes',
      label: 'Average Early Minutes',
      value: averageEarlyMinutes,
      unit: 'min',
      icon: iconMap.chart,
    },
    {
      id: 'highest-early-dept',
      label: 'Highest Early Going Department',
      value: highestEarlyDept,
      icon: iconMap.building,
    },
  ]
}

export function getDepartmentWiseCards(
  totalDepartments: number,
  bestAttendanceDept: string,
  lowestAttendanceDept: string,
  highestEarlyDept: string,
): SummaryCard[] {
  return [
    {
      id: 'total-depts',
      label: 'Total Departments',
      value: totalDepartments,
      icon: iconMap.building,
    },
    {
      id: 'best-attendance',
      label: 'Best Attendance Department',
      value: bestAttendanceDept,
      icon: iconMap.calendarCheck,
    },
    {
      id: 'lowest-attendance',
      label: 'Lowest Attendance Department',
      value: lowestAttendanceDept,
      icon: iconMap.calendarX,
    },
    {
      id: 'highest-early',
      label: 'Highest Early Going Department',
      value: highestEarlyDept,
      icon: iconMap.users,
    },
  ]
}

export function getEmployeeWiseCards(
  workingDays: number,
  presentDays: number,
  absentDays: number,
  lateEarlyDays: number,
): SummaryCard[] {
  return [
    {
      id: 'working-days',
      label: 'Working Days',
      value: workingDays,
      icon: iconMap.calendarDays,
    },
    {
      id: 'present-days',
      label: 'Present Days',
      value: presentDays,
      icon: iconMap.calendarCheck,
    },
    {
      id: 'absent-days',
      label: 'Absent Days',
      value: absentDays,
      icon: iconMap.calendarX,
    },
    {
      id: 'late-early',
      label: 'Late / Early Days',
      value: lateEarlyDays,
      icon: iconMap.clock,
    },
  ]
}