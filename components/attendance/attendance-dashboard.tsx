'use client'

import * as React from 'react'
import {
  AlarmClock,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Gift,
  LogIn,
  LogOut,
  MapPin,
  MoreVertical,
} from 'lucide-react'

import { AttendanceCalendarDrawer } from './attendance-calendar-drawer'
import { AttendanceHistoryDrawer } from './attendance-history-drawer'
import { LeaveBalanceModal } from './leave-balance-modal'
import { EventDetailsDrawer } from './event-details-drawer'
import { useAttendance } from './use-attendance'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import type { AttendanceRecord, AttendanceStatus, Event, LeaveBalance } from './types'

const SHIFT_END = '06:00 PM'
const SHIFT_TOTAL_MINUTES = 510
const CURRENT_DATE_LABEL = 'Today, 22 Jun 2026'

const statusVariantMap: Record<AttendanceStatus, 'default' | 'success' | 'warning' | 'destructive'> = {
  present: 'success',
  late: 'warning',
  absent: 'destructive',
  'half-day': 'warning',
  leave: 'default',
}

const statusLabelMap: Record<AttendanceStatus, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  'half-day': 'Half Day',
  leave: 'Leave',
}

export function AttendanceDashboard() {
  const {
    loading,
    processing,
    error,
    todayRecord,
    monthlySummary,
    leaveBalance,
    upcomingEvents,
    attendanceHistory,
    punch,
  } = useAttendance()

  const [calendarOpen, setCalendarOpen] = React.useState(false)
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [leaveModalOpen, setLeaveModalOpen] = React.useState(false)
  const [eventsOpen, setEventsOpen] = React.useState(false)

  return (
    <div className="relative space-y-4 lg:space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground lg:text-xl">
            Good Morning, Amit! <span aria-hidden="true">👋</span>
          </h1>
          <p className="text-sm font-medium text-muted-foreground lg:text-sm">
            Here's your attendance overview for today.
          </p>
        </div>

        <Button
          variant="outline"
          className="h-14 justify-between gap-3 rounded-2xl border-border/80 bg-card px-4 text-base font-semibold shadow-sm sm:min-w-72"
          onClick={() => setCalendarOpen(true)}
          aria-label="Open monthly attendance calendar"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="size-5" />
          </span>
          <span className="flex-1 text-left">{CURRENT_DATE_LABEL}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </header>

      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="py-4 text-sm font-medium text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      <TodayAttendancePanel
        record={todayRecord}
        loading={loading}
        processing={processing}
        onPunch={punch}
      />

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.35fr_1.1fr]">
        <LeaveBalancePanel
          balance={leaveBalance}
          loading={loading}
          onViewBalance={() => setLeaveModalOpen(true)}
        />
        <TodaySummaryPanel record={todayRecord} loading={loading} />
        <NextHolidayPanel
          events={upcomingEvents}
          loading={loading}
          onViewEvents={() => setEventsOpen(true)}
        />
      </section>

      <RecentAttendancePanel
        records={attendanceHistory}
        loading={loading}
        onViewAll={() => setHistoryOpen(true)}
      />

      <AttendanceCalendarDrawer
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        records={attendanceHistory}
        monthlySummary={monthlySummary}
      />

      <AttendanceHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        records={attendanceHistory}
        loading={loading}
      />

      <LeaveBalanceModal
        open={leaveModalOpen}
        onOpenChange={setLeaveModalOpen}
        balance={leaveBalance || null}
        loading={loading}
      />

      <EventDetailsDrawer
        open={eventsOpen}
        onOpenChange={setEventsOpen}
        events={upcomingEvents}
      />
    </div>
  )
}

interface TodayAttendancePanelProps {
  record: AttendanceRecord | null
  loading: boolean
  processing: boolean
  onPunch: (action: 'in' | 'out') => void
}

function TodayAttendancePanel({
  record,
  loading,
  processing,
  onPunch,
}: TodayAttendancePanelProps) {
  const currentTime = useCurrentTime()
  const activeShift = !!record?.punchIn && !record?.punchOut
  const workingDuration = activeShift
    ? formatDuration(currentTime, record?.punchIn)
    : record?.totalHours || '--'
  const workedMinutes = parseDurationToMinutes(workingDuration)
  const progress = Math.min((workedMinutes / SHIFT_TOTAL_MINUTES) * 100, 100)
  const action = activeShift ? 'out' : 'in'
  const ActionIcon = activeShift ? LogOut : LogIn
  const statusLabel = activeShift ? 'Working' : statusLabelMap[record?.status || 'absent']

  if (loading) {
    return <Skeleton className="min-h-[360px] rounded-2xl" />
  }

  return (
    <Card className="overflow-hidden rounded-xl border-border/80 bg-card shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-5 pb-2 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg font-bold">
            Today's Attendance
          </CardTitle>

          {activeShift && (
            <Badge
              variant="success"
              className="h-7 gap-2 rounded-full px-3 text-xs font-semibold"
            >
              <span className="size-2 rounded-full bg-success" />
              Live
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5 pt-2">
        <div className="grid gap-5 xl:grid-cols-[220px_1fr] xl:items-center">

          {/* Progress Circle */}
          <div className="flex justify-center xl:justify-start">
            <div
              className="relative grid size-44 place-items-center rounded-full p-2"
              style={{
                background: `conic-gradient(
              var(--success) ${Math.max(progress, 3.5)}%,
              color-mix(in srgb, var(--success) 16%, transparent) 0
            )`,
              }}
              aria-label={`Attendance progress ${Math.round(progress)} percent`}
            >
              <div className="grid size-full place-items-center rounded-full bg-card shadow-inner">
                <div className="space-y-1 text-center">

                  <div className="mx-auto flex w-fit items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold text-success">
                    <span className="grid size-3 place-items-center rounded-full bg-success/15">
                      <span className="size-1.5 rounded-full bg-success" />
                    </span>
                    {statusLabel}
                  </div>

                  <p className="text-3xl font-bold tracking-tight text-foreground">
                    {workingDuration}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    of 8h 30m
                  </p>

                  <p className="text-xs font-semibold text-success">
                    ({Math.round(progress)}%)
                  </p>

                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_150px_auto_1fr] lg:items-center">

            <TimelinePoint
              icon={LogIn}
              label="Punch In"
              value={record?.punchIn || "--"}
              caption="Today"
              metaIcon={MapPin}
              meta="Office"
              tone="success"
            />

            <TimelineConnector />

            {/* Punch Button */}
            <div className="flex flex-col items-center gap-2 text-center">

              <Button
                onClick={() => onPunch(action)}
                disabled={processing}
                className={cn(
                  "size-20 rounded-xl flex-col gap-1.5 text-sm font-semibold shadow-md",
                  activeShift
                    ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    : "bg-success hover:bg-success/90 text-success-foreground"
                )}
              >
                <ActionIcon className="size-6" />

                {processing
                  ? "Saving..."
                  : activeShift
                    ? "Punch Out"
                    : "Punch In"}
              </Button>

              <p
                className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  activeShift
                    ? "text-destructive"
                    : "text-success"
                )}
              >
                <AlarmClock className="size-3.5" />

                {activeShift
                  ? `Working ${workingDuration}`
                  : "Ready to start"}
              </p>

            </div>

            <TimelineConnector />

            <TimelinePoint
              icon={AlarmClock}
              label="Expected Check Out"
              value={record?.punchOut || SHIFT_END}
              caption="Today"
              tone="primary"
            />

          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface TodaySummaryPanelProps {
  record: AttendanceRecord | null
  loading: boolean
}

function TodaySummaryPanel({ record, loading }: TodaySummaryPanelProps) {
  const currentTime = useCurrentTime()
  const activeShift = !!record?.punchIn && !record?.punchOut
  const workingDuration = activeShift
    ? formatDuration(currentTime, record?.punchIn)
    : record?.totalHours || '--'
  const status = record?.status || 'absent'

  if (loading) {
    return <Skeleton className="min-h-[190px] rounded-2xl" />
  }

  return (
    <Card className="rounded-2xl border-border/80 shadow-sm">
      <CardContent className="p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-success/10 text-success">
              <BarChart3 className="size-8" />
            </span>
            <h2 className="text-lg font-bold text-foreground">Today's Summary</h2>
          </div>
          <Button variant="ghost" size="icon" className="size-10 rounded-full bg-muted" aria-label="Open today summary">
            <ChevronRight className="size-5" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm sm:text-base">
          <SummaryMetric label="Punch In" value={record?.punchIn || '--'} highlight />
          <SummaryMetric label="Punch Out" value={record?.punchOut || '--'} />
          <SummaryMetric label="Total Hours" value={workingDuration} highlight />
          <SummaryMetric label="Break Time" value={record?.breakTime || '--'} />
          <SummaryMetric label="Overtime" value={record?.overtime || '--'} />
          <div>
            <p className="mb-2 font-medium text-muted-foreground">Status</p>
            <Badge variant={statusVariantMap[status]} className="h-9 gap-2 rounded-full px-4 text-base font-bold">
              <span className="size-2 rounded-full bg-current" />
              {statusLabelMap[status]}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryMetric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="border-r border-border pr-4 last:border-r-0 [&:nth-child(3n)]:border-r-0">
      <p className="mb-2 font-medium text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-bold text-foreground', highlight && 'text-success')}>{value}</p>
    </div>
  )
}

interface LeaveBalancePanelProps {
  balance: LeaveBalance | null
  loading: boolean
  onViewBalance: () => void
}

function LeaveBalancePanel({ balance, loading, onViewBalance }: LeaveBalancePanelProps) {
  const availableLeave = (balance?.casual ?? 0) + (balance?.earned ?? 0)

  if (loading) {
    return <Skeleton className="min-h-[190px] rounded-2xl" />
  }

  return (
    <Card className="rounded-2xl border-border/80 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <CalendarCheck className="size-8" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-foreground">Leave Balance</h2>
              <p className="text-lg font-bold text-foreground">{availableLeave} Days</p>
              <p className=" text-sm font-medium text-muted-foreground">Available Leave</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="size-10 shrink-0 rounded-full bg-muted" onClick={onViewBalance} aria-label="View leave balance">
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface NextHolidayPanelProps {
  events: Event[]
  loading: boolean
  onViewEvents: () => void
}

function NextHolidayPanel({ events, loading, onViewEvents }: NextHolidayPanelProps) {
  const event = events[0]

  if (loading) {
    return <Skeleton className="min-h-[190px] rounded-2xl" />
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-violet-100 text-violet-600">
              <Gift className="size-8" />
            </span>
            <h2 className="text-lg font-bold text-foreground">Next Holiday</h2>
          </div>
          <Button variant="ghost" size="icon" className="size-10 shrink-0 rounded-full bg-muted" onClick={onViewEvents} aria-label="View upcoming holidays">
            <ChevronRight className="size-5" />
          </Button>
        </div>

        <div className="mt-7 grid grid-cols-[1fr_auto] items-end gap-4">
          <div>
            <p className="text-lg font-bold text-foreground">{event?.title || 'No holiday scheduled'}</p>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              {event ? formatEventDate(event.date) : '--'}
            </p>
          </div>
          <div className="relative h-24 w-28 shrink-0">
            <div className="absolute bottom-0 left-2 right-0 h-20 rounded-lg border border-primary/20 bg-primary/10 shadow-sm" />
            <div className="absolute bottom-3 left-0 right-3 rounded-lg border border-border bg-card text-center shadow-md">
              <div className="h-4 rounded-t-lg bg-destructive" />
              <p className="pt-2 text-2xl font-bold leading-none text-primary">{event ? getDayOfMonth(event.date) : '--'}</p>
              <p className="pb-2 text-xs font-bold uppercase text-primary">{event ? getShortMonth(event.date) : ''}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface RecentAttendancePanelProps {
  records: AttendanceRecord[]
  loading: boolean
  onViewAll: () => void
}

function RecentAttendancePanel({ records, loading, onViewAll }: RecentAttendancePanelProps) {
  const recentRecords = records.slice(0, 5)

  if (loading) {
    return <Skeleton className="min-h-[240px] rounded-2xl" />
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-6 pb-3 pt-5">
        <CardTitle className="text-lg font-bold">Recent Attendance</CardTitle>
        <Button variant="ghost" size="sm" className="gap-2 text-sm font-semibold text-primary" onClick={onViewAll}>
          View All
          <ChevronRight className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0 pb-2">
        <table className="w-full min-w-[900px] text-sm font-medium">
          <thead>
            <tr className="border-y border-border bg-muted/45 text-left text-sm font-semibold text-foreground">
              <th className="px-6 py-3">Date</th>
              <th className="px-4 py-3">Punch In</th>
              <th className="px-4 py-3">Punch Out</th>
              <th className="px-4 py-3">Total Hours</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {recentRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">
                  No attendance records yet
                </td>
              </tr>
            ) : (
              recentRecords.map((record) => (
                <tr key={record.id} className="border-b border-border last:border-b-0">
                  <td className="px-6 py-4 font-medium text-foreground">{formatRecordDate(record)}</td>
                  <td className="px-4 py-4 font-semibold text-success">
                    <TableDot value={record?.punchIn || '--'} tone="success" />
                  </td>
                  <td className="px-4 py-4 font-semibold text-foreground">
                    <TableDot value={record?.punchOut || '--'} tone="primary" />
                  </td>
                  <td className="px-4 py-4 font-semibold text-foreground">{record.totalHours || '--'}</td>
                  <td className="px-4 py-4">
                    <Badge variant={statusVariantMap[record.status]} className="h-9 gap-2 rounded-full px-4 text-base font-bold">
                      <span className="size-2 rounded-full bg-current" />
                      {statusLabelMap[record.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 font-medium text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="size-5" />
                      {record.location || 'Office'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label="More attendance actions" onClick={onViewAll}>
                      <MoreVertical className="size-5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function TableDot({ value, tone }: { value: string; tone?: 'success' | 'primary' }) {
  const dotColor = tone === 'primary' ? 'bg-primary/15' : 'bg-success/15'
  const circleColor = tone === 'primary' ? 'text-primary' : 'text-success'
  return (
    <span className="inline-flex items-center gap-3">
      <span className={`grid size-4 place-items-center rounded-full ${dotColor}`}>
        <span className={`size-2 rounded-full ${tone === 'primary' ? 'bg-primary' : 'bg-success'}`} />
      </span>
      {value}
    </span>
  )
}

function TimelinePoint({
  icon: Icon,
  label,
  value,
  caption,
  metaIcon: MetaIcon,
  meta,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: string
  caption: string
  metaIcon?: React.ElementType
  meta?: string
  tone: 'primary' | 'success'
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="mb-7 text-sm font-bold uppercase text-muted-foreground">{label}</p>
      <span
        className={cn(
          'mb-5 grid size-24 place-items-center rounded-full',
          tone === 'success' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary',
        )}
      >
        <Icon className="size-11" />
      </span>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className=" text-lg font-medium text-muted-foreground">{caption}</p>
      {meta && MetaIcon && (
        <p className=" flex items-center gap-2 text-lg font-semibold text-foreground">
          <MetaIcon className="size-5 fill-success text-success" />
          {meta}
        </p>
      )}
    </div>
  )
}

function TimelineConnector() {
  return (
    <div className="hidden min-w-24 items-center gap-3 lg:flex">
      <span className="h-px flex-1 border-t-2 border-dashed border-primary/20" />
      <span className="size-4 rounded-full bg-success" />
      <span className="h-px flex-1 border-t-2 border-dashed border-primary/20" />
    </div>
  )
}

function useCurrentTime() {
  const [time, setTime] = React.useState(new Date())

  React.useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  return time
}

function formatDuration(currentTime: Date, startTime?: string) {
  if (!startTime) return '--'

  try {
    const [time, period] = startTime.split(' ')
    const [hour, minute] = time.split(':').map(Number)
    let hrs = hour

    if (period === 'PM' && hrs !== 12) hrs += 12
    if (period === 'AM' && hrs === 12) hrs = 0

    const start = new Date(currentTime)
    start.setHours(hrs, minute, 0, 0)

    const totalMinutes = Math.max(Math.floor((currentTime.getTime() - start.getTime()) / 60000), 0)
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60

    return `${h}h ${m}m`
  } catch {
    return '--'
  }
}

function parseDurationToMinutes(duration?: string) {
  if (!duration || duration === '--') return 0

  const hours = duration.match(/(\d+)h/)?.[1]
  const minutes = duration.match(/(\d+)m/)?.[1]

  return Number(hours || 0) * 60 + Number(minutes || 0)
}

function formatRecordDate(record: AttendanceRecord) {
  const date = new Date(`${record.date}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return `${record.date} (${record.day})`
  }

  return `${date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })} (${record.day})`
}

function formatEventDate(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`)

  if (Number.isNaN(date.getTime())) return dateValue

  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    weekday: 'long',
  })
}

function getDayOfMonth(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '--'
  return String(date.getDate()).padStart(2, '0')
}

function getShortMonth(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short' })
}
