'use client'

import * as React from 'react'
import {
  Calendar,
  Clock,
  Activity,
  MapPin,
  LogIn,
  LogOut,
  Info,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'

import type {
  AttendanceRecord,
  AttendanceStatus,
} from './types'

interface TodayStatusCardProps {
  record: AttendanceRecord | null
  loading?: boolean
  processing?: boolean
  error?: string | null
  onPunch: (action: 'in' | 'out') => void
}

const statusLabels: Record<AttendanceStatus, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  'half-day': 'Half Day',
  leave: 'Leave',
}

export function TodayStatusCard({
  record,
  loading,
  processing,
  error,
  onPunch,
}: TodayStatusCardProps) {
  const currentTime = useCurrentTime()

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>

        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructivered">{error}</p>
        </CardContent>
      </Card>
    )
  }

  const activeShift =
    !!record?.punchIn && !record?.punchOut

  const actionLabel = activeShift
    ? 'Punch Out'
    : 'Punch In'

  const ActionIcon = activeShift
    ? LogOut
    : LogIn

  const buttonColor = activeShift
    ? 'from-destructive via-destructive/70 to-destructive/80'
    : 'from-success via-success-70 to-success-80'

  const ringColor = activeShift
    ? 'border-destructive/20'
    : 'border-success/20'

  const workingDuration = activeShift
    ? formatDuration(currentTime, record?.punchIn)
    : '--'

  return (
    <Card className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Calendar className="h-6 w-6 text-primary" />
            </div>

            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900text-lg font-semibold leading-none tracking-tight">
                Today's Attendance
              </h2>

              <Info className="h-4 w-4 text-slate-400" />
            </div>
          </div>

          <div className="rounded-full border border-success bg-success/10 px-5 py-2 text-sm font-semibold text-success">
            {statusLabels[record?.status || 'absent']}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6 pt-0">
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">

          <div className="space-y-4">

            <InfoBlock
              // icon={<Calendar className="h-6 w-6 text-blue-600" />}
              title="Working Since"
              value={record?.punchIn || '--'}
            />

            <InfoBlock
              // icon={<Clock className="h-6 w-6 text-blue-600" />}
              title="Live Working Duration"
              value={workingDuration}
              subtitle={
                activeShift
                  ? 'Currently working'
                  : 'Not punched in'
              }
              subtitleClass="text-green-600"
            />

            <InfoBlock
              // icon={<Activity className="h-6 w-6 text-blue-600" />}
              title="Last Punch Activity"
              value={
                record?.punchOut ||
                record?.punchIn ||
                '--'
              }
            />

            {record?.location && (
              <div className="flex items-start gap-4">
                {/* <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                  <MapPin className="h-6 w-6 text-blue-600" />
                </div> */}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Attendance Location
                  </p>

                  <Tooltip content={record.location}>
                    <p className="max-w-lg truncate text-lg font-semibold text-slate-900">
                      {record.location}
                    </p>
                  </Tooltip>
                </div>
              </div>
            )}
          </div>

         <div className="flex items-center justify-center">
  <div className={`rounded-full border-[10px] p-3 ${ringColor}`}>
    <button
      onClick={() => onPunch(activeShift ? 'out' : 'in')}
      disabled={processing}
      className={`
        flex h-38 w-38 flex-col items-center justify-center
        rounded-full text-white shadow-xl transition-all
        hover:scale-105 disabled:opacity-50
        bg-gradient-to-b ${buttonColor}
      `}
    >
      <ActionIcon className="mb-3 h-14 w-14" />

      <span className="text-xl font-bold">
        {processing ? 'Loading...' : actionLabel}
      </span>
    </button>
  </div>
</div>
        </div>
      </CardContent>
    </Card>
  )
}

function InfoBlock({
  title,
  value,
  subtitle,
  subtitleClass,
}: {
  title: string
  value: string
  subtitle?: string
  subtitleClass?: string
}) {
  return (
    <div className="flex items-start gap-4">

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </p>

        <p className=" text-lg font-bold text-slate-900">
          {value}
        </p>

        {subtitle && (
          <p className={`text-base ${subtitleClass}`}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

function useCurrentTime() {
  const [time, setTime] = React.useState(new Date())

  React.useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 60000)

    return () => clearInterval(timer)
  }, [])

  return time
}

function formatDuration(
  currentTime: Date,
  startTime?: string
) {
  if (!startTime) return '--'

  try {
    const [time, period] = startTime.split(' ')
    const [hour, minute] = time
      .split(':')
      .map(Number)

    let hrs = hour

    if (period === 'PM' && hrs !== 12)
      hrs += 12

    if (period === 'AM' && hrs === 12)
      hrs = 0

    const start = new Date()

    start.setHours(hrs)
    start.setMinutes(minute)
    start.setSeconds(0)

    const diff =
      currentTime.getTime() -
      start.getTime()

    const totalMinutes = Math.floor(
      diff / 60000
    )

    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60

    return `${h}h ${m}m`
  } catch {
    return '--'
  }
}