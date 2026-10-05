'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AttendanceDrillDownDrawer, type DrillDownRecord } from '@/domain/hrms/hrit/attendance-management/attendance-tracking/components/attendance-drill-down-drawer'

export interface GroupedRecord {
  id: string
  label?: string
  value?: string
  employee?: string
  employees?: number
  present?: number
  absent?: number
  late?: number
  earlyGoing?: number
  attendancePercentage?: number
  averageWorkingHours?: string
  totalWorkingHours?: string
  status?: 'present' | 'late' | 'absent'
  date?: string
  department?: string
  employeeId?: string
  punchIn?: string
  punchOut?: string
  expectedIn?: string
  expectedOut?: string
  workingHours?: string
  lateBy?: string
  earlyBy?: string
  /*
   * The day counts departmentwiseAttendanceReportCreate has always returned and
   * this table has never shown. They were being folded into two composite
   * strings - "12/22 days" and "3 days" - which is fine to glance at and
   * useless to sort, filter or export. HR asking "who has the most half-days
   * this quarter" could not answer it from the screen that holds the number.
   */
  halfDays?: number
  workingDays?: number
  holidays?: number
  weekOffs?: number
  recentRecords?: DrillDownRecord[]
}

interface AttendanceGroupedTableProps {
  records: GroupedRecord[]
  groupBy: string
  searchValue: string
  onSearchChange: (value: string) => void
  onView?: (record: GroupedRecord) => void
  /**
   * "YYYY-MM" the drill-down drawer should load. Passed down rather than
   * derived here, because the report's range lives on the page.
   */
  month?: string | null
  className?: string
}

function getAttendanceBadge(percentage?: number) {
  if (percentage === undefined) return null
  if (percentage >= 90) return { tone: 'success' as const, label: 'Excellent' }
  if (percentage >= 75) return { tone: 'default' as const, label: 'Good' }
  if (percentage >= 60) return { tone: 'warning' as const, label: 'Average' }
  return { tone: 'destructive' as const, label: 'Poor' }
}

export function AttendanceGroupedTable({
  records,
  groupBy,
  searchValue,
  onSearchChange,
  onView,
  month,
  className,
}: AttendanceGroupedTableProps) {
  const [sortBy, setSortBy] = React.useState<string>('')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc')
  const [drillDown, setDrillDown] = React.useState<GroupedRecord | null>(null)

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('asc')
    }
  }

  const sortedRecords = React.useMemo(() => {
    if (!sortBy) return records
    return [...records].sort((a, b) => {
      const aVal = a[sortBy as keyof GroupedRecord]
      const bVal = b[sortBy as keyof GroupedRecord]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return 0
    })
  }, [records, sortBy, sortDir])

  const getColumns = () => {
    switch (groupBy) {
      case 'organization':
        /*
         * F-175. 'Early Going' was here and was ALWAYS ZERO.
         *
         * This grouping is built from departmentReport, which carries
         * total_att_day / total_ab_day / late / workingDays and nothing about
         * early departures - so the accumulator read `entry.earlyGoing += 0`
         * on every row. A column of zeros labelled as a metric is worse than
         * no column: it reads as "nobody left early", which is a claim.
         *
         * The real figure exists only in getEarlyGoingReport, which answers for
         * ONE DATE. Putting a single day's count beside range-based present and
         * absent totals would be a different kind of wrong. Removed.
         */
        return [
          { id: 'department', label: 'Department' },
          { id: 'employees', label: 'Total Employees' },
          { id: 'present', label: 'Present' },
          { id: 'absent', label: 'Absent' },
          { id: 'late', label: 'Late' },
          { id: 'attendancePercentage', label: 'Attendance %' },
        ]
      /*
       * NO PUNCH-TIME COLUMNS ON THESE TWO GROUPINGS.
       *
       * Punch In, Punch Out, Expected In, Expected Out and Early By used to sit
       * here and were hardcoded '--' on every row, because these groupings are
       * built from departmentReport - a day-count SUMMARY that carries no punch
       * times at all. Five of eleven columns were a constant dash, which reads
       * as "still loading" rather than "this view does not have that".
       *
       * The per-punch data exists only for a single date (getEarlyGoingReport)
       * and for the signed-in user (getMyAttendance); there is no endpoint
       * returning other employees' punch times across a range. So the columns
       * are removed rather than filled.
       */
      case 'department':
        // F-176. `employee` was computed in the page and never rendered, so
        // these two groupings identified people by employee number alone.
        return [
          { id: 'employee', label: 'Employee' },
          { id: 'employeeId', label: 'Employee ID' },
          { id: 'department', label: 'Department' },
          { id: 'date', label: 'Date' },
          { id: 'workingHours', label: 'Working Hours' },
          { id: 'lateBy', label: 'Late By' },
          { id: 'status', label: 'Status' },
        ]
      case 'employee':
        /*
         * The full row. Present / Absent / Half Day / Late / Working Days were
         * all in the response and none were on screen - two of them squashed
         * into the "12/22 days" and "3 days" strings, the rest discarded. Each
         * is its own sortable column now, which is what "show any employee's
         * report with more detail" actually requires.
         */
        return [
          { id: 'employee', label: 'Employee' },   // F-176
          { id: 'employeeId', label: 'Employee ID' },
          { id: 'department', label: 'Department' },
          { id: 'present', label: 'Present' },
          { id: 'absent', label: 'Absent' },
          { id: 'halfDays', label: 'Half Day' },
          { id: 'late', label: 'Late' },
          { id: 'holidays', label: 'Holidays' },
          { id: 'weekOffs', label: 'Week Off' },
          { id: 'workingDays', label: 'Working Days' },
          { id: 'attendancePercentage', label: 'Attendance %' },
          { id: 'status', label: 'Status' },
        ]
      // F-175. `case 'date'` was here. It is gone with the Group By option that
      // selected it - see enhanced-attendance-filters.tsx.
      default:
        return [
          { id: 'department', label: 'Department' },
          { id: 'employees', label: 'Total Employees' },
          { id: 'present', label: 'Present' },
          { id: 'absent', label: 'Absent' },
          { id: 'late', label: 'Late' },
          { id: 'attendancePercentage', label: 'Attendance %' },
        ]
    }
  }

  const columns = getColumns()

  const renderCellContent = (row: GroupedRecord, colId: string): React.ReactNode => {
    if (colId === 'attendancePercentage' && row.attendancePercentage !== undefined) {
      const rowBadge = getAttendanceBadge(row.attendancePercentage)
      return (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.attendancePercentage}%</span>
          {rowBadge && (
            <Badge variant={rowBadge.tone} className="text-[10px]">
              {rowBadge.label}
            </Badge>
          )}
        </div>
      )
    }
    if (colId === 'status') {
      return (
        <StatusBadge status={row.status || ''} />
      )
    }
    const val = row[colId as keyof GroupedRecord]
    if (val === undefined || val === null) return '--'
    if (typeof val === 'number') return <span className="font-medium">{val}</span>
    if (typeof val === 'string') return <span className="text-muted-foreground">{val}</span>
    return '--'
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Attendance Summary</CardTitle>
        <div className="flex items-center gap-2">
          <SearchInput
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            className="w-64"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className="h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col.id)}
                      className="flex items-center gap-1 cursor-pointer hover:text-foreground"
                    >
                      {col.label}
                      {sortBy === col.id && (
                        <span className="text-foreground">
                          {sortDir === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  </th>
                ))}
                <th className="h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="py-8 text-center text-sm text-muted-foreground">
                    No records found
                  </td>
                </tr>
              ) : sortedRecords.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border transition-colors hover:bg-muted/50"
                >
                  {columns.map((col) => (
                    <td key={col.id} className="p-4 align-middle">
                      {renderCellContent(row, col.id)}
                    </td>
                  ))}
                  <td className="p-4 align-middle">
                    <div className="flex items-center gap-2">
                      {/*
                        F-202. Unlabelled, while the identical control on the
                        sibling tab (attendance-reports) has always been named.
                      */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-full"
                        aria-label={`View details for ${row.employee ?? row.department ?? 'this row'}`}
                        title="View details"
                        onClick={() => setDrillDown(row)}
                      >
                        <Eye className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <AttendanceDrillDownDrawer
        open={!!drillDown}
        onOpenChange={(val) => !val && setDrillDown(null)}
        record={drillDown as DrillDownRecord}
        recentRecords={drillDown?.recentRecords ?? []}
        /*
          Only an employee row has a person to fetch for. A department roll-up
          passes null and the drawer keeps its existing summary behaviour
          instead of requesting a month for nobody.
        */
        employeeUserId={groupBy === 'employee' ? drillDown?.id ?? null : null}
        month={month ?? null}
      />
    </Card>
  )
}
