'use client'

import * as React from 'react'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { AttendanceRecord, MonthlySummary } from './types'

interface AttendanceCalendarDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  records: AttendanceRecord[]
  monthlySummary?: MonthlySummary | null
}

export function AttendanceCalendarDrawer({
  open,
  onOpenChange,
  records,
  monthlySummary,
}: AttendanceCalendarDrawerProps) {
  const days = getDaysInMonth(2026, 6) // June 2026

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger />
      <SheetContent className="w-3/5 max-w-lg">
        <SheetHeader>
          <SheetTitle>Monthly Calendar</SheetTitle>
          <SheetDescription>
            June 2026 attendance overview
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}

            {days.map((day, index) => {
              const dateStr = `2026-06-${String(day).padStart(2, '0')}`
              const record = records.find((r) => r.date === dateStr)

              if (day === null) {
                return <div key={`empty-${index}`} />
              }

              const status = getStatusForDay(record)

              return (
                <div
                  key={day}
                  className="aspect-square flex items-center justify-center rounded-lg border border-border text-sm relative"
                >
                  <span className={getDayClassName(status)}>{day}</span>
                  {status !== 'none' && (
                    <div className={getIndicatorClassName(status)} />
                  )}
                </div>
              )
            })}
          </div>

          {monthlySummary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monthly Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Present</span>
                  <Badge variant="success">{monthlySummary.present}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Late</span>
                  <Badge variant="warning">{monthlySummary.late}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Leave</span>
                  <Badge variant="default">{monthlySummary.leave}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Absent</span>
                  <Badge variant="destructive">{monthlySummary.absent}</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Legend</h3>
            <div className="flex flex-wrap gap-3">
              <LegendItem color="bg-success" label="Present" />
              <LegendItem color="bg-warning" label="Late" />
              <LegendItem color="bg-destructive" label="Absent" />
              <LegendItem color="bg-primary" label="Leave" />
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

function getStatusForDay(record?: AttendanceRecord): 'present' | 'late' | 'absent' | 'leave' | 'none' {
  if (!record) return 'none'
  return record.status === 'half-day' ? 'present' : record.status
}

function getDayClassName(status: string): string {
  const map: Record<string, string> = {
    present: 'text-foreground',
    late: 'text-foreground',
    absent: 'text-muted-foreground',
    leave: 'text-foreground',
    none: 'text-muted-foreground',
  }
  return map[status] || 'text-muted-foreground'
}

function getIndicatorClassName(status: string): string {
  const map: Record<string, string> = {
    present: 'absolute bottom-1 size-1.5 rounded-full bg-success',
    late: 'absolute bottom-1 size-1.5 rounded-full bg-warning',
    absent: 'absolute bottom-1 size-1.5 rounded-full bg-destructive/60',
    leave: 'absolute bottom-1 size-1.5 rounded-full bg-primary',
  }
  return map[status] || ''
}