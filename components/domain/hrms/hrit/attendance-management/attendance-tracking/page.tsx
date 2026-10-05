'use client'

import * as React from 'react'
import { lazy, Suspense } from 'react'
import {
  AlarmClock,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Home,
  LogIn,
  LogOut,
  MapPin,
  MoreVertical,
  CalendarPlus,
  Building2,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'

import { useRouter } from 'next/navigation'
import { useAttendance, workModeLabel, type WorkMode } from '@/hooks/use-attendance'
import { csvText, downloadCsv } from '@/domain/hrms/hrit/payroll-management/shared/payroll-shell'
import { useAuth } from '@/components/auth/gtg-auth'
import { getGreeting } from '@/lib/greeting'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import type {
  AttendanceRecord,
  AttendanceStatus,
  ShiftWindow,
} from '@/domain/hrms/hrit/attendance-management/types'

const AttendanceCalendarDrawer = lazy(() =>
  import('@/domain/hrms/hrit/attendance-management/attendance-tracking/components/attendance-calendar-drawer').then((m) => ({
    default: m.AttendanceCalendarDrawer,
  })),
)

const AttendanceHistoryDrawer = lazy(() =>
  import('@/domain/hrms/hrit/attendance-management/attendance-tracking/components/attendance-history-drawer').then((m) => ({
    default: m.AttendanceHistoryDrawer,
  })),
)

const EventDetailsDrawer = lazy(() =>
  import('@/domain/hrms/hrit/attendance-management/attendance-tracking/components/event-details-drawer').then((m) => ({
    default: m.EventDetailsDrawer,
  })),
)

const RegularisationDrawer = lazy(() =>
  import('@/domain/hrms/hrit/attendance-management/attendance-tracking/components/regularisation-drawer').then((m) => ({
    default: m.RegularisationDrawer,
  })),
)

const RegularisationQueue = lazy(() =>
  import('@/domain/hrms/hrit/attendance-management/attendance-tracking/components/regularisation-queue').then((m) => ({
    default: m.RegularisationQueue,
  })),
)

const EmployeeSnapshotWidget = lazy(() =>
  import('@/domain/hrms/hrit/attendance-management/attendance-tracking/components/widgets').then((m) => ({
    default: m.EmployeeSnapshotWidget,
  })),
)

const QuickActionsWidget = lazy(() =>
  import('@/domain/hrms/hrit/attendance-management/attendance-tracking/components/widgets').then((m) => ({
    default: m.QuickActionsWidget,
  })),
)

const AttendanceAlertsWidget = lazy(() =>
  import('@/domain/hrms/hrit/attendance-management/attendance-tracking/components/widgets').then((m) => ({
    default: m.AttendanceAlertsWidget,
  })),
)

const MyRequestsWidget = lazy(() =>
  import('@/domain/hrms/hrit/attendance-management/attendance-tracking/components/widgets').then((m) => ({
    default: m.MyRequestsWidget,
  })),
)

const UpcomingEventsWidget = lazy(() =>
  import('@/domain/hrms/hrit/attendance-management/attendance-tracking/components/widgets').then((m) => ({
    default: m.UpcomingEventsWidget,
  })),
)

/*
 * F-98, F-113 and F-112. What used to live here:
 *
 *   const SHIFT_END = '06:00 PM'          the ring's end, for everyone
 *   const SHIFT_TOTAL_MINUTES = 510       "of 8h 30m", for everyone
 *   const CURRENT_DATE_LABEL = 'Today, 22 Jun 2026'   one fixed day, forever
 *   const ATTENDANCE_ALERTS = [...]       four invented alerts
 *   const MY_REQUESTS = [...]             four invented counts
 *   QUICK_ACTIONS with onClick: () => {}  five buttons that did nothing
 *
 * All of it is now real: the shift comes from the employee's own roster on
 * tbluser, the alerts and counts from GET /api/attendance/self-summary, the
 * date from the clock, and every action goes somewhere.
 */

const statusLabelMap: Record<AttendanceStatus, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  'half-day': 'Half Day',
  leave: 'Leave',
}

const WORK_MODE_OPTIONS: { value: WorkMode; label: string; icon: React.ElementType }[] = [
  { value: 'office', label: 'Office', icon: Building2 },
  { value: 'home', label: 'Home', icon: Home },
  { value: 'field', label: 'Field', icon: MapPin },
]

const widgetFallback = (
  <Card className="h-full rounded-xl border-border bg-card shadow-sm">
    <CardContent className="flex h-full items-center justify-center py-10 text-sm text-muted-foreground">
      Loading...
    </CardContent>
  </Card>
)

export function AttendanceDashboard() {
  const {
    loading,
    processing,
    error,
    todayRecord,
    attendancePercentage,
    leaveBalance,
    upcomingEvents,
    attendanceHistory,
    shift,
    alerts,
    requests,
    todayWorkMode,
    punch,
    retry,
    reload,
  } = useAttendance()
  const { user } = useAuth()
  const router = useRouter()

  const [calendarOpen, setCalendarOpen] = React.useState(false)
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [eventsOpen, setEventsOpen] = React.useState(false)
  const [regularisationOpen, setRegularisationOpen] = React.useState(false)
  const [regularisationDay, setRegularisationDay] = React.useState<string | null>(null)
  const [workMode, setWorkMode] = React.useState<WorkMode>('office')
  /**
   * F-196. The work mode awaiting confirmation, because applying it while
   * clocked in re-records the punch-in at the CURRENT time.
   */
  const [pendingWorkMode, setPendingWorkMode] = React.useState<WorkMode | null>(null)

  /*
   * F-196. The work-mode control looks like a display switch and WRITES A
   * PUNCH.
   *
   * useAttendance.punch posts punchAttendanceIn with `time = now`, so an
   * employee clicking "Home" at 14:32 had their morning punch-in re-recorded
   * at 14:32 - no confirmation, no success message, no warning that the start
   * time was being replaced.
   *
   * The decision lives here rather than in the segmented control, because this
   * is where "am I currently clocked in" is known. Choosing a mode while NOT
   * clocked in is free and applies immediately; it only preselects the mode for
   * the punch the user is about to make.
   */
  const handleWorkModeChange = React.useCallback(
    (mode: WorkMode) => {
      const clockedIn = Boolean(todayRecord?.punchIn && !todayRecord?.punchOut)
      if (clockedIn && mode !== workMode) {
        setPendingWorkMode(mode)
        return
      }
      setWorkMode(mode)
    },
    [todayRecord?.punchIn, todayRecord?.punchOut, workMode],
  )

  // Preselect the mode already recorded for today, so punching out and back in
  // does not silently move someone from home to office.
  React.useEffect(() => {
    if (todayWorkMode) setWorkMode(todayWorkMode)
  }, [todayWorkMode])

  /** The date the calendar button shows. Was the constant 'Today, 22 Jun 2026'. */
  const todayLabel = React.useMemo(
    () =>
      `Today, ${new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })}`,
    [],
  )

  const openRegularisation = React.useCallback((day?: string | null) => {
    setRegularisationDay(day ?? null)
    setRegularisationOpen(true)
  }, [])

  /** Every one of these was `onClick: () => {}` before (F-112). */
  const quickActions = React.useMemo(
    () => [
      {
        id: 'apply-leave',
        label: 'Apply Leave',
        icon: CalendarPlus,
        // The Leave Requests page already opens its drawer on ?apply=1 —
        // reuse that entry point rather than mounting a second copy here.
        onClick: () => router.push('/module/hrit-solutions/leave-management/leave-requests?apply=1'),
      },
      {
        id: 'regularize',
        label: 'Regularize Attendance',
        icon: Clock,
        onClick: () => openRegularisation(null),
      },
      {
        id: 'mark-wfh',
        label: workMode === 'home' ? 'Working from Home' : 'Mark WFH',
        icon: Home,
        onClick: () => {
          // F-196. Same rule as the segmented control: preselecting the mode is
          // free, re-punching an active shift is not.
          if (todayRecord?.punchIn && !todayRecord?.punchOut) {
            setPendingWorkMode('home')
            return
          }
          setWorkMode('home')
        },
      },
      {
        id: 'download-timesheet',
        label: 'Download Timesheet',
        icon: Download,
        onClick: () =>
          downloadCsv(
            `my-timesheet-${new Date().toISOString().slice(0, 7)}.csv`,
            ['Date', 'Day', 'Punch In', 'Punch Out', 'Total Hours', 'Status', 'Work Mode'],
            attendanceHistory.map((record) => [
              // See the note in payroll-shell's csvText: bare dates and
              // HH:MM durations are what produced "######" in these exports.
              csvText(record.date),
              record.day,
              csvText(record.punchIn ?? ''),
              csvText(record.punchOut ?? ''),
              csvText(record.totalHours ?? ''),
              record.status ? statusLabelMap[record.status] : 'Unknown',
              workModeLabel(record.workMode),
            ]),
          ),
      },
      {
        id: 'monthly-report',
        label: 'View Monthly Report',
        icon: BarChart3,
        onClick: () => setCalendarOpen(true),
      },
    ],
    [attendanceHistory, openRegularisation, punch, router, todayRecord, workMode],
  )

  return (
    <div className="relative space-y-4 lg:space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground lg:text-xl">
            {getGreeting(user?.name ?? 'there')}
          </h1>
          <p className="text-sm font-medium text-muted-foreground lg:text-sm">
            Here&apos;s your attendance overview for today.
          </p>
        </div>

        <Button
          variant="outline"
          className="h-14 justify-between gap-3 rounded-2xl border-border/80 bg-card px-4 text-base font-semibold shadow-sm sm:min-w-72"
          onClick={() => setCalendarOpen(true)}
          aria-label="Open monthly attendance calendar"
        >
          {/* Was the literal character "c" - CalendarDays was imported and
              never used. The leave dashboard's header carried the same defect
              as a literal "L". */}
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="size-5" />
          </span>
          <span className="flex-1 text-left">{todayLabel}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </header>

      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm font-medium text-destructive">
            <span>{error}</span>
            {/* F-117: this retries the LOAD. It used to write a punch. */}
            <Button variant="outline" size="sm" onClick={retry}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      <TodayAttendancePanel
        record={todayRecord}
        loading={loading}
        processing={processing}
        shift={shift}
        workMode={workMode}
        onWorkModeChange={handleWorkModeChange}
        onPunch={punch}
      />

      {/*
        Container breakpoints, not viewport ones. Five columns need real room:
        at 1024px viewport with the sidebar expanded each card was about 130px
        wide, which is why titles and buttons collided. @2xl/@4xl/@6xl measure
        what this section actually has, so the count drops when the sidebar
        opens instead of only when the window shrinks.
      */}
      <section className="grid gap-4 @2xl/content:grid-cols-2 @4xl/content:grid-cols-3 @6xl/content:grid-cols-5">
        <Suspense fallback={widgetFallback}>
          <EmployeeSnapshotWidget
            leaveBalance={leaveBalance}
            nextHoliday={upcomingEvents[0] || null}
            attendance={attendancePercentage}
            loading={loading}
          />
        </Suspense>
        <Suspense fallback={widgetFallback}>
          <QuickActionsWidget actions={quickActions} loading={loading} />
        </Suspense>
        <Suspense fallback={widgetFallback}>
          <AttendanceAlertsWidget
            alerts={alerts}
            loading={loading}
            onAlertClick={(alert) => openRegularisation(alert.date)}
          />
        </Suspense>
        <Suspense fallback={widgetFallback}>
          <MyRequestsWidget
            requests={requests}
            loading={loading}
            onViewAll={() => router.push('/module/hrit-solutions/leave-management/leave-requests')}
          />
        </Suspense>
        <Suspense fallback={widgetFallback}>
          <UpcomingEventsWidget events={upcomingEvents} loading={loading} onViewCalendar={() => setEventsOpen(true)} />
        </Suspense>
      </section>

      {/*
        * Renders nothing unless the API allows this caller to review - see the
        * component. Placed above their own history because an approval queue is
        * work waiting on them.
        */}
      <Suspense fallback={null}>
        <RegularisationQueue onDecided={reload} />
      </Suspense>

      <RecentAttendancePanel
        records={attendanceHistory}
        loading={loading}
        onViewAll={() => setHistoryOpen(true)}
      />

      <Suspense fallback={null}>
        <AttendanceCalendarDrawer
          open={calendarOpen}
          onOpenChange={setCalendarOpen}
        />

        <AttendanceHistoryDrawer
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          records={attendanceHistory}
          loading={loading}
        />

        <EventDetailsDrawer
          open={eventsOpen}
          onOpenChange={setEventsOpen}
          events={upcomingEvents}
        />

        <RegularisationDrawer
          open={regularisationOpen}
          onOpenChange={setRegularisationOpen}
          initialDay={regularisationDay}
          records={attendanceHistory}
          onSubmitted={reload}
        />
      </Suspense>

      {/* F-196. Confirm before a mode change rewrites today's start time. */}
      <AlertDialog
        open={pendingWorkMode !== null}
        onOpenChange={(open) => !open && setPendingWorkMode(null)}
      >
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Re-record your punch-in?</AlertDialogTitle>
            <AlertDialogDescription>
              You are already clocked in. Switching to{' '}
              {pendingWorkMode === 'home' ? 'Work from Home' : 'Office'} records a new punch-in at
              the current time, replacing this morning&rsquo;s start time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setPendingWorkMode(null)}
            >
              Keep my start time
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                const mode = pendingWorkMode
                setPendingWorkMode(null)
                if (!mode) return
                setWorkMode(mode)
                void punch('in', mode)
              }}
            >
              Re-record it
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface TodayAttendancePanelProps {
  record: AttendanceRecord | null
  loading: boolean
  processing: boolean
  shift: ShiftWindow | null
  workMode: WorkMode
  onWorkModeChange: (mode: WorkMode) => void
  onPunch: (action: 'in' | 'out', workMode?: WorkMode) => void
}

function TodayAttendancePanel({
  record,
  loading,
  processing,
  shift,
  workMode,
  onWorkModeChange,
  onPunch,
}: TodayAttendancePanelProps) {
  const currentTime = useCurrentTime()
  const activeShift = !!record?.punchIn && !record?.punchOut
  const workingDuration = activeShift
    ? formatDuration(currentTime, record?.punchIn)
    : record?.totalHours || '--'
  const workedMinutes = parseDurationToMinutes(workingDuration)

  /*
   * F-113. The ring was drawn against SHIFT_TOTAL_MINUTES = 510 — 8h30m for
   * every employee in every tenant. It now uses the employee's own roster from
   * tbluser, and when they have none it says so instead of inventing one.
   */
  const hasRoster = shift?.source === 'roster' && !!shift.expectedMinutes
  const shiftMinutes = hasRoster ? (shift?.expectedMinutes ?? 0) : 0
  const progress = shiftMinutes > 0 ? Math.min((workedMinutes / shiftMinutes) * 100, 100) : 0
  const shiftLengthLabel = shiftMinutes > 0
    ? `of ${Math.floor(shiftMinutes / 60)}h ${String(shiftMinutes % 60).padStart(2, '0')}m`
    : 'No shift set'

  const action = activeShift ? 'out' : 'in'
  const ActionIcon = activeShift ? LogOut : LogIn
  const statusLabel = activeShift
    ? 'Working'
    : record?.status
      ? statusLabelMap[record.status]
      : 'Not punched in'

  if (loading) {
    return <Skeleton className="min-h-[360px] rounded-2xl" />
  }

  return (
    <Card className="overflow-hidden rounded-xl border-border/80 bg-card shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-5 pb-2 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg font-bold">
            Today&apos;s Attendance
          </CardTitle>

          {activeShift && (
            <StatusBadge status="Live" size="sm" className="gap-1.5">
              <span className="size-2 rounded-full bg-current" />
              Live
            </StatusBadge>
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
                    {shiftLengthLabel}
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
              value={record?.punchIn || '--'}
              caption={hasRoster && shift?.expectedIn ? `Expected ${shift.expectedIn}` : 'Today'}
              metaIcon={MapPin}
              /* F-115: was the literal "Office". */
              meta={workModeLabel(record?.workMode ?? workMode)}
              tone="success"
            />

            <TimelineConnector />

            {/* Punch Button */}
            <div className="flex flex-col items-center gap-2 text-center">

              {/* F-112: "Mark WFH" used to be a no-op. Work mode is recorded. */}
              <div className="mb-1 inline-flex rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label="Where are you working from?">
                {WORK_MODE_OPTIONS.map((option) => {
                  const OptionIcon = option.icon
                  const selected = (record?.workMode ?? workMode) === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      /*
                       * F-196. This looks like a display toggle and WRITES A
                       * PUNCH.
                       *
                       * useAttendance.punch posts punchAttendanceIn with
                       * `time = now`, so an employee clicking "Home" at 14:32
                       * had their morning punch-in re-recorded at 14:32 - no
                       * confirmation, no success message, no warning that the
                       * start time was being replaced.
                       *
                       * Changing the mode while clocked in now asks first. The
                       * mode itself still changes immediately either way; only
                       * the re-punch is confirmed.
                       */
                      onClick={() => onWorkModeChange(option.value)}
                      aria-pressed={selected}
                      title={option.label}
                      className={cn(
                        'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors',
                        selected
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <OptionIcon className="size-3.5" />
                      {option.label}
                    </button>
                  )
                })}
              </div>

              <Button
                onClick={() => onPunch(action, workMode)}
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
              label={record?.punchOut ? 'Punch Out' : 'Expected Check Out'}
              value={record?.punchOut || shift?.expectedOut || '--'}
              caption={hasRoster ? 'Today' : 'No roster configured'}
              tone="primary"
            />

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
                  No attendance records found
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
                    <StatusBadge
                      status={record.status ?? 'unknown'}
                      label={record.status ? statusLabelMap[record.status] : 'Unknown'}
                      className="h-9 gap-2 rounded-full px-4 text-base font-bold"
                    />
                  </td>
                  <td className="px-4 py-4 font-medium text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="size-5" />
                      {workModeLabel(record.workMode)}
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
