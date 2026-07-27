'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import type { MonthlySummary } from '@/domain/hrms/hrit/attendance-management/types'
import { getLaravelContext } from '@/lib/laravel-context'
import { hrmsService, type LaravelAttendanceCalendarDay } from '@/services/hrms'

/** Statuses the calendar can mark. Anything else is left unmarked. */
type DayStatus = 'present' | 'late' | 'absent' | 'leave'

const DAY_STATUSES: DayStatus[] = ['present', 'late', 'absent', 'leave']

const STATUS_COLOR: Record<DayStatus, string> = {
  present: 'bg-success',
  late: 'bg-warning',
  absent: 'bg-destructive',
  leave: 'bg-primary',
}

const STATUS_CELL: Record<DayStatus, string> = {
  present: 'border-success/40 bg-success/10',
  late: 'border-warning/40 bg-warning/10',
  absent: 'border-destructive/40 bg-destructive/10',
  leave: 'border-primary/40 bg-primary/10',
}

const STATUS_LABEL: Record<DayStatus, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  leave: 'Leave',
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface AttendanceCalendarDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AttendanceCalendarDrawer({ open, onOpenChange }: AttendanceCalendarDrawerProps) {
  const { user } = useAuth()
  const [selectedMonth, setSelectedMonth] = React.useState(() => startOfMonth(new Date()))
  const [calendarDays, setCalendarDays] = React.useState<LaravelAttendanceCalendarDay[]>([])
  const [summary, setSummary] = React.useState<MonthlySummary | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const monthLabel = selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const selectedMonthValue = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`
  const grid = React.useMemo(() => buildMonthGrid(selectedMonth), [selectedMonth])
  const todayKey = React.useMemo(() => formatDateInput(new Date()), [])

  // API-provided status per date. A date missing from this map is rendered unmarked.
  const dayByDate = React.useMemo(
    () => new Map(calendarDays.map((day) => [day.date, day])),
    [calendarDays],
  )

  React.useEffect(() => {
    if (!open) return

    let cancelled = false

    async function loadMonthAttendance() {
      setLoading(true)
      setError(null)

      try {
        const context = getLaravelContext(user)
        const response = await hrmsService.getMyAttendance(context, {
          fromDate: formatDateInput(selectedMonth),
          toDate: formatDateInput(endOfMonth(selectedMonth)),
        })

        if (cancelled) return

        setCalendarDays(response.calendar ?? [])
        setSummary(readSummary(response))
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load monthly attendance.')
        setCalendarDays([])
        setSummary(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadMonthAttendance()

    return () => {
      cancelled = true
    }
  }, [open, selectedMonth, user])

  const changeMonth = (offset: number) => {
    setSelectedMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  const handleMonthInput = (value: string) => {
    const [year, month] = value.split('-').map(Number)
    if (year && month) setSelectedMonth(new Date(year, month - 1, 1))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger />
      <SheetContent className="w-3/5 max-w-lg p-0 flex flex-col gap-0 border-l border-border/80">
        <SheetHeader className="p-6 pb-0 space-y-0 text-left">
          <SheetTitle>Monthly Calendar</SheetTitle>
          <SheetDescription>{monthLabel} attendance overview</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => changeMonth(-1)}
              disabled={loading}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <input
              type="month"
              value={selectedMonthValue}
              onChange={(event) => handleMonthInput(event.target.value)}
              disabled={loading}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground disabled:opacity-60"
              aria-label="Select attendance month"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => changeMonth(1)}
              disabled={loading}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {error && (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="py-3 text-sm font-medium text-destructive">{error}</CardContent>
            </Card>
          )}

          {loading ? (
            <Skeleton className="h-[330px] rounded-xl" />
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {label}
                </div>
              ))}

              {grid.map((dateKey, index) => {
                if (dateKey === null) {
                  return <div key={`empty-${index}`} />
                }

                const apiDay = dayByDate.get(dateKey)
                const status = toDayStatus(apiDay?.status)
                const dayNumber = Number(dateKey.slice(-2))
                const isToday = dateKey === todayKey

                return (
                  <div
                    key={dateKey}
                    title={describeDay(dateKey, apiDay, status)}
                    className={[
                      'aspect-square flex items-center justify-center rounded-lg border text-sm relative',
                      status ? STATUS_CELL[status] : 'border-border',
                      isToday ? 'ring-2 ring-ring ring-offset-1 ring-offset-background' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className={status ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                      {dayNumber}
                    </span>
                    {status && (
                      <span
                        className={`absolute bottom-1 size-1.5 rounded-full ${STATUS_COLOR[status]}`}
                        aria-hidden="true"
                      />
                    )}
                    {status && <span className="sr-only">{STATUS_LABEL[status]}</span>}
                  </div>
                )
              })}
            </div>
          )}

          {!loading && summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monthly Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Present</span>
                  <Badge variant="success">{summary.present}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Late</span>
                  <Badge variant="warning">{summary.late}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Leave</span>
                  <Badge variant="default">{summary.leave}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Absent</span>
                  <Badge variant="destructive">{summary.absent}</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Legend</h3>
            <div className="flex flex-wrap gap-3">
              {DAY_STATUSES.map((status) => (
                <div key={status} className="flex items-center gap-1.5">
                  <div className={`size-2.5 rounded-full ${STATUS_COLOR[status]}`} />
                  <span className="text-xs text-muted-foreground">{STATUS_LABEL[status]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Only render a status the API actually returned for that date. */
function toDayStatus(status?: string | null): DayStatus | null {
  return DAY_STATUSES.includes(status as DayStatus) ? (status as DayStatus) : null
}

/**
 * Monthly summary straight from the API. Returns null when the API omits the
 * counts so the card is hidden rather than showing derived numbers.
 */
function readSummary(response: {
  presentDays?: number
  lateDays?: number
  leaveDays?: number
  absentDays?: number
}): MonthlySummary | null {
  const { presentDays, lateDays, leaveDays, absentDays } = response
  const counts = [presentDays, lateDays, leaveDays, absentDays]

  if (counts.some((count) => count === undefined || count === null)) return null

  return {
    present: Number(presentDays),
    late: Number(lateDays),
    leave: Number(leaveDays),
    absent: Number(absentDays),
  }
}

function describeDay(dateKey: string, apiDay: LaravelAttendanceCalendarDay | undefined, status: DayStatus | null) {
  const parts = [formatLongDate(dateKey)]

  if (status) parts.push(STATUS_LABEL[status])
  if (apiDay?.is_holiday && apiDay.holiday_name) parts.push(apiDay.holiday_name)
  if (status === 'leave' && apiDay?.leave_type) parts.push(apiDay.leave_type)
  if (apiDay?.punchin_time) parts.push(`In ${formatDisplayTime(apiDay.punchin_time)}`)
  if (apiDay?.punchout_time) parts.push(`Out ${formatDisplayTime(apiDay.punchout_time)}`)

  return parts.join(' • ')
}

function formatLongDate(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateKey
  return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDisplayTime(value?: string | null) {
  if (!value) return ''

  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function formatDateInput(date: Date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Leading blanks for the first weekday, then one Y-m-d key per day of the month. */
function buildMonthGrid(month: Date): (string | null)[] {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const leadingBlanks = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

  const cells: (string | null)[] = Array.from({ length: leadingBlanks }, () => null)

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(formatDateInput(new Date(year, monthIndex, day)))
  }

  return cells
}
