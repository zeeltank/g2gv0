'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Badge } from '@/components/ui/badge'
import { Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AttendanceDrillDownDrawer, type DrillDownRecord } from './attendance-drill-down-drawer'

export interface GroupedRecord {
  id: string
  label?: string
  value?: string
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
  recentRecords?: DrillDownRecord[]
}

interface AttendanceGroupedTableProps {
  records: GroupedRecord[]
  groupBy: string
  searchValue: string
  onSearchChange: (value: string) => void
  onView?: (record: GroupedRecord) => void
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
        return [
          { id: 'department', label: 'Department' },
          { id: 'employees', label: 'Total Employees' },
          { id: 'present', label: 'Present' },
          { id: 'absent', label: 'Absent' },
          { id: 'late', label: 'Late' },
          { id: 'earlyGoing', label: 'Early Going' },
          { id: 'attendancePercentage', label: 'Attendance %' },
        ]
      case 'department':
        return [
          { id: 'employeeId', label: 'Employee ID' },
          { id: 'department', label: 'Department' },
          { id: 'date', label: 'Date' },
          { id: 'punchIn', label: 'Punch In' },
          { id: 'punchOut', label: 'Punch Out' },
          { id: 'expectedIn', label: 'Expected In' },
          { id: 'expectedOut', label: 'Expected Out' },
          { id: 'workingHours', label: 'Working Hours' },
          { id: 'lateBy', label: 'Late By' },
          { id: 'earlyBy', label: 'Early By' },
          { id: 'status', label: 'Status' },
        ]
      case 'employee':
        return [
          { id: 'employeeId', label: 'Employee ID' },
          { id: 'date', label: 'Date' },
          { id: 'department', label: 'Department' },
          { id: 'punchIn', label: 'Punch In' },
          { id: 'punchOut', label: 'Punch Out' },
          { id: 'workingHours', label: 'Working Hours' },
          { id: 'lateBy', label: 'Late By' },
          { id: 'earlyBy', label: 'Early By' },
          { id: 'status', label: 'Status' },
        ]
      case 'date':
        return [
          { id: 'date', label: 'Date' },
          { id: 'department', label: 'Department' },
          { id: 'employees', label: 'Total Employees' },
          { id: 'present', label: 'Present' },
          { id: 'absent', label: 'Absent' },
          { id: 'late', label: 'Late' },
          { id: 'earlyGoing', label: 'Early Going' },
          { id: 'attendancePercentage', label: 'Attendance %' },
        ]
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
            <Badge tone={rowBadge.tone} className="text-[10px]">
              {rowBadge.label}
            </Badge>
          )}
        </div>
      )
    }
    if (colId === 'status') {
      return (
        <Badge
          tone={
            row.status === 'present' ? 'success' :
            row.status === 'late' ? 'warning' : 'destructive'
          }
          className="capitalize"
        >
          {row.status?.replace('-', ' ')}
        </Badge>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-full"
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
      />
    </Card>
  )
}