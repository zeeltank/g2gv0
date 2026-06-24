'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AttendanceRecord } from './types'

interface RecentAttendanceCardProps {
  records: AttendanceRecord[]
  loading?: boolean
  onViewAll: () => void
}

export function RecentAttendanceCard({ records, loading, onViewAll }: RecentAttendanceCardProps) {
  const recentRecords = records.slice(0, 3)

  const statusVariant = (status: string) => {
    const map: Record<string, 'default' | 'success' | 'warning' | 'destructive'> = {
      present: 'success',
      late: 'warning',
      absent: 'destructive',
      'half-day': 'warning',
      leave: 'default',
    }
    return map[status] || 'default'
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-28" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="px-6 pb-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Attendance</CardTitle>
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {recentRecords.length === 0 ? (
          <div className="px-6 pb-6">
            <p className="text-sm text-muted-foreground py-4 text-center">No attendance records yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Punch In</TableHead>
                  <TableHead>Punch Out</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="pl-6 font-medium">{record.date}</TableCell>
                    <TableCell>{record.punchIn || '--'}</TableCell>
                    <TableCell>{record.punchOut || '--'}</TableCell>
                    <TableCell className="pr-6">
                      <Badge variant={statusVariant(record.status)} className="capitalize">
                        {record.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}