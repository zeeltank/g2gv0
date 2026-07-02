'use client'

import { ArrowUpRight, MoreVertical } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatDateShort } from '@/lib/Leavemanagment-data'
import type { LeaveRequest } from '@/types/Leavedashboard'

interface RecentLeaveRequestsProps {
  requests: LeaveRequest[]
}

const statusBadgeToneMap: Record<LeaveRequest['status'], 'warning' | 'success' | 'destructive'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
}

export function RecentLeaveRequests({ requests }: RecentLeaveRequestsProps) {
  return (
    <Card className="h-full rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-base font-semibold">
          Recent Leave Requests
        </CardTitle>
        <Button
          variant="link"
          className="h-auto p-0 text-sm font-semibold text-primary"
        >
          View All
          <ArrowUpRight className="ml-1 h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Leave Type</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied On</TableHead>
                <TableHead className="w-10 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {request.employee.name
                            .split(' ')
                            .map((part) => part[0])
                            .join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground">
                        {request.employee.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {request.leaveType}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {request.duration}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateShort(request.fromDate)}
                    {request.fromDate !== request.toDate && (
                      <> – {formatDateShort(request.toDate)}</>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeToneMap[request.status]}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateShort(request.appliedDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[160px]">
                        <DropdownMenuItem onClick={() => console.log('View', request.id)}>
                          View
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
