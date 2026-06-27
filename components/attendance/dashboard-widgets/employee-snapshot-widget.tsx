'use client'

import * as React from 'react'
import { User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import type { LeaveBalance, Event } from '../types'

interface EmployeeSnapshotWidgetProps {
  leaveBalance: LeaveBalance | null
  nextHoliday: Event | null
  attendance: number
  loading?: boolean
}

export function EmployeeSnapshotWidget({
  leaveBalance,
  nextHoliday,
  attendance,
  loading,
}: EmployeeSnapshotWidgetProps) {
  const availableLeave = leaveBalance
    ? leaveBalance.casual + leaveBalance.earned
    : 0

  if (loading) {
    return (
      <Card className="h-full rounded-xl border-border bg-card shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 px-5 pb-4 pt-5">
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-5 px-5 pb-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-4 w-12" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatEventDate = (dateValue: string) => {
    const date = new Date(`${dateValue}T00:00:00`)
    if (Number.isNaN(date.getTime())) return dateValue
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <Card className="flex h-full flex-col rounded-xl border-border bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 px-5 pb-4 pt-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <User className="size-5" />
        </span>
        <CardTitle className="text-base font-bold text-foreground">
          Employee Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between space-y-5 px-5 pb-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Leave Balance
          </p>
          <p className="text-xl font-bold text-foreground">{availableLeave} Days</p>
          <p className="text-xs font-medium text-muted-foreground">Available Leave</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Next Holiday
          </p>
          <p className="text-sm font-bold text-foreground">
            {nextHoliday?.title || 'No holiday scheduled'}
          </p>
          <p className="text-xs font-medium text-muted-foreground">
            {nextHoliday ? formatEventDate(nextHoliday.date) : '--'}
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Attendance
            </p>
            <p className="text-sm font-bold text-foreground">{attendance}%</p>
          </div>
          <Progress value={attendance} className="h-2" />
        </div>
      </CardContent>
    </Card>
  )
}
