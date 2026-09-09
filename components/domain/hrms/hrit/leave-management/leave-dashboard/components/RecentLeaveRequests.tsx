'use client'

import { ArrowUpRight, MoreVertical } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
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
import { formatDateShort } from '@/lib/leave-management-data'
import type { LeaveRequest } from '@/types/leave-dashboard'

interface RecentLeaveRequestsProps {
  requests: LeaveRequest[]
  /** Opens the request in the detail drawer the dashboard already renders. */
  onView?: (request: LeaveRequest) => void
  /**
   * The header's "View All". It had no handler at all - while the per-row
   * "View" beside it did, and while three sibling cards on this same dashboard
   * were already wired to the page's navigate() helper. F-112 fixed the row
   * item in this very file and left the button eight lines above it inert.
   */
  onViewAll?: () => void
}

export function RecentLeaveRequests({ requests, onView, onViewAll }: RecentLeaveRequestsProps) {
  return (
    <Card className="h-full rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-base font-semibold">
          Recent Leave Requests
        </CardTitle>
        <Button
          variant="link"
          className="h-auto p-0 text-sm font-semibold text-primary"
          onClick={onViewAll}
          disabled={!onViewAll}
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
                    <StatusBadge status={request.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateShort(request.appliedDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground outline-none transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[160px]">
                        {/*
                          * F-112. Was `console.log('View', request.id)`. The
                          * detail drawer and its open handler already existed on
                          * this page - the component was simply never handed them.
                          */}
                        <DropdownMenuItem onClick={() => onView?.(request)}>
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
