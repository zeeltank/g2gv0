'use client'

import * as React from 'react'
import { Sheet, SheetHeader, SheetTitle, SheetDescription, SheetContent } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEmployeeDayDetail } from '@/hooks/use-employee-day-detail'
import type { MonthlyAttendanceDay } from '@/services/hrms'

export interface DrillDownRecord {
  id: string
  date: string
  employee?: string
  employeeId?: string
  department?: string
  punchIn?: string
  punchOut?: string
  expectedIn?: string
  expectedOut?: string
  workingHours?: string
  lateBy?: string
  earlyBy?: string
  status: 'present' | 'late' | 'absent'
  attendancePercentage?: number
  present?: number
  absent?: number
  late?: number
  earlyGoing?: number
  totalEmployees?: number
}

export interface AttendanceDrillDownDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: DrillDownRecord | null
  /**
   * The fallback rows, used only when this drawer has no employee to fetch for
   * (a department roll-up). For an employee row the drawer loads the real
   * month itself — see useEmployeeDayDetail for why the old slice-the-
   * early-going-list approach could not work.
   */
  recentRecords: DrillDownRecord[]
  /** tbluser.id of the employee this row is about, when it is about one. */
  employeeUserId?: string | number | null
  /** "YYYY-MM" the report is showing. */
  month?: string | null
}

/**
 * A day from the monthly report, in the shape this drawer renders.
 *
 * The status vocabulary is wider on the server (leave, holiday, weekend,
 * incomplete) than the three tones the drawer knows, so anything that is not
 * plainly present or late is shown as absent with its real label kept in the
 * date column's title. Losing the distinction silently would be worse.
 */
function toDrillDownRow(day: MonthlyAttendanceDay): DrillDownRecord {
  const status: DrillDownRecord['status'] =
    day.status === 'present' ? (day.is_late ? 'late' : 'present') : 'absent'

  return {
    id: day.date,
    date: day.date,
    punchIn: day.punchin_time ?? undefined,
    punchOut: day.punchout_time ?? undefined,
    workingHours: day.working_hours ?? undefined,
    lateBy: day.is_late ? 'Late' : undefined,
    status,
  }
}

function getStatusBadgeTone(status: string) {
  switch (status) {
    case 'present': return 'success'
    case 'late': return 'warning'
    case 'absent': return 'destructive'
    default: return 'secondary'
  }
}

export function AttendanceDrillDownDrawer({
  open,
  onOpenChange,
  record,
  recentRecords,
  employeeUserId,
  month,
}: AttendanceDrillDownDrawerProps) {
  /*
   * BEFORE the early return, because hooks cannot be conditional. The hook
   * itself no-ops when employeeUserId or month is null, which is the department
   * roll-up case, so a department drawer costs no request.
   */
  const detail = useEmployeeDayDetail(open ? employeeUserId ?? null : null, month ?? null)

  const rows: DrillDownRecord[] =
    employeeUserId && detail.days.length > 0
      ? detail.days.map(toDrillDownRow)
      : recentRecords

  if (!record) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col gap-0 border-l border-border/80">
        <SheetHeader className="flex flex-row items-start justify-between gap-4 p-6 pb-0 space-y-0 text-left">
          <div>
            <SheetTitle className="text-lg font-semibold">
              {record.department || record.employee || 'Report Details'}
            </SheetTitle>
            {record.employee && (
              <SheetDescription className="mt-1">
                {record.employeeId ? `${record.employeeId} • ` : ''}{record.department || ''}
              </SheetDescription>
            )}
          </div>
          {/* <button
            onClick={() => onOpenChange(false)}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </button> */}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 mt-0">
          {record.attendancePercentage !== undefined && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Attendance %</CardTitle>
                  <TrendingUp className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{record.attendancePercentage}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Present</CardTitle>
                  <TrendingUp className="size-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">{record.present ?? 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Late</CardTitle>
                  <Clock className="size-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">{record.late ?? 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Early Going</CardTitle>
                  <TrendingDown className="size-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{record.earlyGoing ?? 0}</div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {employeeUserId ? 'Attendance by day' : 'Recent Attendance Records'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                {detail.loading ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Loading the month…</p>
                ) : detail.error ? (
                  /*
                    A failed fetch is never rendered as "no records". The old
                    table could only ever say the latter, whatever had happened.
                  */
                  <p className="py-6 text-center text-sm text-destructive">
                    {detail.error} This is a problem loading the records, not a month without any.
                  </p>
                ) : rows.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {employeeUserId
                      ? 'No attendance recorded for this employee in this month.'
                      : 'No recent records'}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Punch In</TableHead>
                        <TableHead>Punch Out</TableHead>
                        <TableHead>Working Hours</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.date}</TableCell>
                          <TableCell>{r.punchIn ?? '--'}</TableCell>
                          <TableCell>{r.punchOut ?? '--'}</TableCell>
                          <TableCell>{r.workingHours ?? '--'}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeTone(r.status)} className="capitalize">
                              {r.status.replace('-', ' ')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  )
}
