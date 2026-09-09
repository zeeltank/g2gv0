'use client'

import * as React from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { EmployeeLeave } from '@/types/leave-dashboard'

interface LeaveCalendarDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  upcomingLeaves: EmployeeLeave[]
}

export function LeaveCalendarDrawer({
  open,
  onOpenChange,
  upcomingLeaves,
}: LeaveCalendarDrawerProps) {
  /*
   * THE REAL CURRENT MONTH.
   *
   * This was `getDaysInMonth(2026, 6) // June 2026`, with a hardcoded
   * "June 2026 leave overview" caption and leave dots matched against
   * `2026-06-${day}`. The button that opens this drawer shows today's real
   * date, so the calendar it opened contradicted the control that opened it -
   * and every leave dot was positioned against a month that had passed.
   *
   * Derived from `new Date()` rather than the `currentDate` prop, which is a
   * formatted display string ("Monday, September 8, 2026") and not something
   * to parse. The prop is gone.
   */
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const days = getDaysInMonth(year, month)
  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(today)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-3/5 max-w-lg p-0 flex flex-col gap-0 border-l border-border/80">
        <SheetHeader className="p-6 pb-0 space-y-0 text-left">
          <SheetTitle>Monthly Leave Calendar</SheetTitle>
          <SheetDescription>
            {monthLabel} leave overview
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}

            {days.map((day, index) => {
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const leavesOnDay = upcomingLeaves.filter((leave) => {
                const from = new Date(leave.fromDate)
                const to = new Date(leave.toDate)
                const current = new Date(dateStr)
                return current >= from && current <= to
              })

              if (day === null) {
                return <div key={`empty-${index}`} />
              }

              return (
                <div
                  key={day}
                  className="aspect-square flex items-center justify-center rounded-lg border border-border text-sm relative"
                >
                  <span className={leavesOnDay.length > 0 ? 'text-primary font-medium' : 'text-muted-foreground'}>{day}</span>
                  {leavesOnDay.length > 0 && (
                    <div className="absolute bottom-1 size-1.5 rounded-full bg-primary" />
                  )}
                </div>
              )
            })}
          </div>

          <UpcomingLeavesList leaves={upcomingLeaves} />

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Legend</h3>
            {/* No "Holiday" entry. This grid only ever draws leave dots - no
                holiday is passed to this drawer - so a legend for a marker that
                is never rendered told the reader the calendar shows something
                it does not. */}
            <div className="flex flex-wrap gap-3">
              <LegendItem color="bg-primary" label="Leave Day" />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface LegendItemProps {
  color: string
  label: string
}

function LegendItem({ color, label }: LegendItemProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`size-2.5 rounded-full ${color}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

interface UpcomingLeavesListProps {
  leaves: EmployeeLeave[]
}

function UpcomingLeavesList({ leaves }: UpcomingLeavesListProps) {
  const upcoming = leaves.slice(0, 5)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upcoming Leaves</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming leaves</p>
        ) : (
          upcoming.map((leave) => (
            <div key={leave.id} className="flex justify-between">
              <span className="text-sm">{leave.employee}</span>
              <Badge variant="default" className="text-xs">
                {leave.leaveType}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function getDaysInMonth(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const days: (number | null)[] = []

  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  return days
}