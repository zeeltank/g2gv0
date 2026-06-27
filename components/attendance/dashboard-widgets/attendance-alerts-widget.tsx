'use client'

import * as React from 'react'
import { AlertTriangle ,ChevronRight} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { AttendanceAlert } from './widget-types'

interface AttendanceAlertsWidgetProps {
  alerts: AttendanceAlert[]
  loading?: boolean
}

const severityConfig = {
  critical: {
    dot: 'bg-destructive',
    label: 'Critical',
  },
  warning: {
    dot: 'bg-warning',
    label: 'Warning',
  },
  info: {
    dot: 'bg-primary',
    label: 'Info',
  },
}

export function AttendanceAlertsWidget({ alerts, loading }: AttendanceAlertsWidgetProps) {
  if (loading) {
    return (
      <Card className="h-full rounded-xl border-border bg-card shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 px-5 pb-4 pt-5">
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-2 px-3 pb-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex h-full flex-col rounded-xl border-border bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 px-5 pb-4 pt-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </span>
        <CardTitle className="text-base font-bold text-foreground">
          Attendance Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-3 pb-3">
        <div className="flex flex-col">
          {alerts.map((alert) => {
            const config = severityConfig[alert.severity]
            return (
              <button
                key={alert.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
              >
                <span className={`size-2 shrink-0 rounded-full ${config.dot}`} />
                <span className="flex-1 text-sm font-medium text-foreground">
                  {alert.text}
                </span>
               <ChevronRight className="size-4" />
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
