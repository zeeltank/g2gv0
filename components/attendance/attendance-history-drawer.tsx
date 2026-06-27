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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AttendanceRecord, AttendanceStatus } from './types'

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
  const [filteredRecords, setFilteredRecords] = React.useState(records)

  React.useEffect(() => {
    let result = records

    if (search) {
      result = result.filter((r) => r.date.includes(search) || r.day.toLowerCase().includes(search.toLowerCase()))
    }

    if (statusFilter) {
      result = result.filter((r) => r.status === statusFilter)
    }

    setFilteredRecords(result)
  }, [search, statusFilter, records])

  const handleExport = () => {
    // Placeholder for export functionality
    console.log('Exporting attendance data...')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger />
      <SheetContent className="w-2/3 max-w-3xl p-6">
        <SheetHeader>
          <SheetTitle>Attendance History</SheetTitle>
          <SheetDescription>
            View and manage your complete attendance records
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
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
            <Button variant="outline" onClick={handleExport}>
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
                        <Badge variant={getStatusVariant(record.status)} className="capitalize">
                          {record.status.replace('-', ' ')}
                        </Badge>
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

function getStatusVariant(status: AttendanceStatus): 'default' | 'success' | 'warning' | 'destructive' {
  const map: Record<AttendanceStatus, 'default' | 'success' | 'warning' | 'destructive'> = {
    present: 'success',
    late: 'warning',
    absent: 'destructive',
    'half-day': 'warning',
    leave: 'default',
  }
  return map[status] || 'default'
}