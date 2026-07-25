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
import type { AttendanceRecord, MonthlySummary } from '@/domain/hrms/hrit/attendance-management/types'
import { getLaravelContext } from '@/lib/laravel-context'
import { hrmsService, type LaravelAttendanceEntry } from '@/services/hrms'

interface AttendanceCalendarDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  records: AttendanceRecord[]
  monthlySummary?: MonthlySummary | null
}

export function AttendanceCalendarDrawer({
  open,
  onOpenChange,
}: AttendanceCalendarDrawerProps) {
  const { user } = useAuth()
  const [selectedMonth, setSelectedMonth] = React.useState(() => startOfMonth(new Date()))
  const [monthRecords, setMonthRecords] = React.useState<AttendanceRecord[]>([])
  const [summary, setSummary] = React.useState<MonthlySummary | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const days = getDaysInMonth(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1)
  const monthLabel = selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const selectedMonthValue = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`
  const recordsByDate = React.useMemo(() => new Map(monthRecords.map((record) => [record.date, record])), [monthRecords])

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
        const records = (response.attendanceData ?? []).map(mapAttendanceEntry)

        if (cancelled) return

        setMonthRecords(records)
        setSummary({
          present: Number(response.presentDays ?? countStatus(records, 'present')),
          late: Number(response.lateDays ?? countStatus(records, 'late')),
          leave: Number(response.leaveDays ?? countStatus(records, 'leave')),
          absent: Number(response.absentDays ?? countStatus(records, 'absent')),
        })
      } catch (error) {
        if (cancelled) return
        setError(error instanceof Error ? error.message : 'Failed to load monthly attendance.')
        setMonthRecords([])
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger />
      <SheetContent className="w-3/5 max-w-lg p-0 flex flex-col gap-0 border-l border-border/80">
        <SheetHeader className="p-6 pb-0 space-y-0 text-left">
          <SheetTitle>Monthly Calendar</SheetTitle>
          <SheetDescription>
            {monthLabel} attendance overview
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" size="icon" onClick={() => changeMonth(-1)} aria-label="Previous month">
              <ChevronLeft className="size-4" />
            </Button>
            <input
              type="month"
              value={selectedMonthValue}
              onChange={(event) => {
                const [year, month] = event.target.value.split('-').map(Number)
                if (year && month) setSelectedMonth(new Date(year, month - 1, 1))
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground"
              aria-label="Select attendance month"
            />
            <Button variant="outline" size="icon" onClick={() => changeMonth(1)} aria-label="Next month">
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {error && (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="py-3 text-sm font-medium text-destructive">
                {error}
              </CardContent>
            </Card>
          )}

          {loading ? (
            <Skeleton className="h-[330px] rounded-xl" />
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}

              {days.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} />
                }

                const dateStr = formatDateInput(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day))
                const record = recordsByDate.get(dateStr)
                const status = getStatusForDay(record)

                return (
                  <div
                    key={dateStr}
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
          )}

          {summary && (
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

function formatDisplayTime(value?: string | null) {
  if (!value) return undefined

  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(value?: string | null) {
  if (!value) return undefined
  const [hours = '0', minutes = '0'] = value.split(':')
  return `${Number(hours)}h ${Number(minutes)}m`
}

function normalizeAttendanceStatus(entry: LaravelAttendanceEntry): AttendanceRecord['status'] {
  const rawStatus = String(entry.attendance_status ?? entry.status_label ?? entry.type ?? '').toLowerCase()

  if (rawStatus.includes('late')) return 'late'
  if (rawStatus.includes('leave')) return 'leave'
  if (rawStatus.includes('absent')) return 'absent'
  if (rawStatus.includes('half')) return 'half-day'
  if (rawStatus.includes('present')) return 'present'

  return entry.punchin_time ? 'present' : 'absent'
}

function mapAttendanceEntry(entry: LaravelAttendanceEntry): AttendanceRecord {
  const date = new Date(`${entry.day}T00:00:00`)
  const day = Number.isNaN(date.getTime())
    ? entry.day
    : date.toLocaleDateString('en-US', { weekday: 'long' })

  return {
    id: String(entry.id),
    date: entry.day,
    day,
    punchIn: formatDisplayTime(entry.punchin_time),
    punchOut: formatDisplayTime(entry.punchout_time),
    totalHours: formatDuration(entry.timestamp_diff),
    status: normalizeAttendanceStatus(entry),
    location: entry.ipaddress_in ? 'Office' : undefined,
  }
}

function getStatusForDay(record?: AttendanceRecord): 'present' | 'late' | 'absent' | 'leave' | 'none' {
  if (!record) return 'none'
  return record.status === 'half-day' ? 'present' : record.status
}

function countStatus(records: AttendanceRecord[], status: AttendanceRecord['status']) {
  return records.filter((record) => record.status === status).length
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
