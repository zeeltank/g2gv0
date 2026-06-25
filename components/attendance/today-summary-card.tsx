'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { AttendanceRecord } from './types'

interface TodaySummaryCardProps {
  record: AttendanceRecord | null
  loading?: boolean
}

export function TodaySummaryCard({ record, loading }: TodaySummaryCardProps) {
  const summaryItems = [
    { label: 'Punch In', value: record?.punchIn || '--' },
    { label: 'Punch Out', value: record?.punchOut || '--' },
    { label: 'Total Hours', value: record?.totalHours || '--' },
    { label: 'Break Time', value: record?.breakTime || '--' },
    { label: 'Overtime', value: record?.overtime || '--' },
    { label: 'Status', value: getStatusLabel(record?.status) },
  ]

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-28" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {summaryItems.map((item) => (
            <div key={item.label} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{item.label}</p>
              <p className="text-sm font-medium text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function getStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    present: 'Present',
    late: 'Late',
    absent: 'Absent',
    'half-day': 'Half Day',
    leave: 'On Leave',
  }
  return labels[status || ''] || '--'
}

function getStatusVariant(status?: string) {
  const variants: Record<string, string> = {
    present: 'text-success',
    late: 'text-warning',
    absent: 'text-destructive',
    'half-day': 'text-warning',
    leave: 'text-muted-foreground',
  }
  return variants[status || ''] || ''
}