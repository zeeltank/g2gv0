'use client'

import * as React from 'react'
import { Sheet, SheetHeader, SheetTitle, SheetDescription, SheetContent } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  recentRecords: DrillDownRecord[]
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
}: AttendanceDrillDownDrawerProps) {
  if (!record) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-2xl overflow-y-auto">
        <SheetHeader className="flex flex-row items-start justify-between gap-4">
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

        <div className="mt-6 space-y-6">
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
              <CardTitle className="text-sm font-medium">Recent Attendance Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                {recentRecords.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No recent records</p>
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
                      {recentRecords.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.date}</TableCell>
                          <TableCell>{r.punchIn ?? '--'}</TableCell>
                          <TableCell>{r.punchOut ?? '--'}</TableCell>
                          <TableCell>{r.workingHours ?? '--'}</TableCell>
                          <TableCell>
                            <Badge tone={getStatusBadgeTone(r.status)} className="capitalize">
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
