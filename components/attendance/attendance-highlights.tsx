'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy, AlertTriangle, Clock } from 'lucide-react'

export interface AttendanceHighlightsData {
  highestAttendanceDept: string
  highestAbsenteeismDept: string
  highestEarlyGoingDept: string
}

interface AttendanceHighlightsProps {
  data: AttendanceHighlightsData
  className?: string
}

export function AttendanceHighlights({ data, className }: AttendanceHighlightsProps) {
  const highlights = [
    {
      id: 'highest-attendance',
      label: 'Highest Attendance',
      value: data.highestAttendanceDept,
      icon: <Trophy className="size-5 text-success" />,
      iconBg: 'bg-success/10',
    },
    {
      id: 'highest-absenteeism',
      label: 'Highest Absenteeism',
      value: data.highestAbsenteeismDept,
      icon: <AlertTriangle className="size-5 text-destructive" />,
      iconBg: 'bg-destructive/10',
    },
    {
      id: 'highest-early-going',
      label: 'Most Early Going',
      value: data.highestEarlyGoingDept,
      icon: <Clock className="size-5 text-warning" />,
      iconBg: 'bg-warning/10',
    },
  ]

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Operational Highlights</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${item.iconBg}`}>
                {item.icon}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-sm font-semibold text-foreground">{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
