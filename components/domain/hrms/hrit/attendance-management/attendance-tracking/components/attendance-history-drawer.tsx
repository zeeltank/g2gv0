'use client'

import * as React from 'react'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { csvText, downloadCsv } from '@/domain/hrms/hrit/payroll-management/shared/payroll-shell'
import type { AttendanceRecord, AttendanceStatus } from '@/domain/hrms/hrit/attendance-management/types'

interface AttendanceHistoryDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  records: AttendanceRecord[]
  loading?: boolean
}

export function AttendanceHistoryDrawer({
  open,
  onOpenChange,
  records,
  loading,
}: AttendanceHistoryDrawerProps) {
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('')
  
  // Use useMemo to derive filtered records (avoids setState in useEffect)
  const filteredRecords = React.useMemo(() => {
    let result = records

    if (search) {
      result = result.filter((r) => r.date.includes(search) || r.day.toLowerCase().includes(search.toLowerCase()))
    }

    if (statusFilter) {
      result = result.filter((r) => r.status === statusFilter)
    }

    return result
  }, [search, statusFilter, records])

  /*
   * EXPORT IS BUILT NOW, and it always could have been.
   *
   * The comment that stood here said the export "IS NOT BUILT" and defended
   * leaving the button disabled. That was true of this component and false of
   * the screen: `downloadCsv` is a real file producer, and the same page's
   * "Download Timesheet" quick action already exports these very records
   * through it. No endpoint is needed - the rows are already in memory, and
   * they are the FILTERED rows, so the file matches what the user is looking at.
   */
  const handleExport = React.useCallback(() => {
    downloadCsv(
      `attendance-history-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Day', 'Punch In', 'Punch Out', 'Total Hours', 'Status'],
      filteredRecords.map((record) => [
        // Dates and clock times as text: a bare 2025-09-01 becomes a date
        // serial in Excel and renders ###### the moment the column is narrow.
        csvText(record.date ?? ''),
        String(record.day ?? ''),
        csvText(record.punchIn ?? ''),
        csvText(record.punchOut ?? ''),
        csvText(record.totalHours ?? ''),
        String(record.status ?? ''),
      ]),
    )
  }, [filteredRecords])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger />
      <SheetContent className="w-2/3 max-w-3xl p-0 flex flex-col gap-0 border-l border-border/80">
        <SheetHeader className="p-6 pb-0 space-y-0 text-left">
          <SheetTitle>Attendance History</SheetTitle>
          <SheetDescription>
            View and manage your complete attendance records
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder="Search by date..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              className="w-40"
              options={[
                { value: '', label: 'All Status' },
                { value: 'present', label: 'Present' },
                { value: 'late', label: 'Late' },
                { value: 'absent', label: 'Absent' },
                { value: 'leave', label: 'Leave' },
              ]}
            />
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={loading || filteredRecords.length === 0}
              title={filteredRecords.length === 0 ? 'Nothing to export' : undefined}
            >
              Export
            </Button>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No records found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Punch In</TableHead>
                    <TableHead>Punch Out</TableHead>
                    <TableHead>Total Hours</TableHead>
                    {/* No "Break" column. `breakTime` is declared on the type and
                        assigned by nothing - no mapper sets it and no attendance
                        endpoint returns break data - so the column could only ever
                        print "--", which reads as "still loading" rather than
                        "this is not recorded". */}
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.date}</TableCell>
                      <TableCell>{record.day}</TableCell>
                      <TableCell>{record.punchIn || '--'}</TableCell>
                      <TableCell>{record.punchOut || '--'}</TableCell>
                      <TableCell>{record.totalHours || '--'}</TableCell>
                      <TableCell>
                        <StatusBadge status={record.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}