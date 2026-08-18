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

  // EXPORT IS NOT BUILT. This handler logged to the console and returned, so the
  // button reported success by doing nothing visible - the same shape as the
  // notification bell before X-06, and the only one of the four dead controls
  // that a literal pattern could not see.
  //
  // The button is disabled rather than removed: an attendance export is a
  // reasonable thing to want, and deleting it would erase the fact that somebody
  // intended it. Disabled and labelled says both true things at once - it is not
  // available, and it is not forgotten.

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
            <Button variant="outline" disabled title="Export is not available yet">
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
                    <TableHead>Break</TableHead>
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
                      <TableCell>{record.breakTime || '--'}</TableCell>
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