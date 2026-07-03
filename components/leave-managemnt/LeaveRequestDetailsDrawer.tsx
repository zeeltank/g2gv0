'use client'

import * as React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { AttendanceTabs } from '@/components/attendance/attendance-tabs'
import { Check, X, FileText, Calendar, MessageSquare, Paperclip, History, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeaveRequest, LeaveRequestStatus } from '@/types/Leavedashboard'
import { Input } from "@/components/ui/input";

interface LeaveRequestDetailsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: LeaveRequest | null
}

const statusBadgeVariantMap: Record<LeaveRequestStatus, 'success' | 'warning' | 'destructive' | 'navy' | 'muted'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
  'sent-back': 'navy',
  cancelled: 'muted',
}

const statusLabelMap: Record<LeaveRequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  'sent-back': 'Sent Back',
  cancelled: 'Cancelled',
}

const tabItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'comments', label: 'Comments' },
  { id: 'attachments', label: 'Attachments' },
  { id: 'audit', label: 'Audit Trail' },
]

export function LeaveRequestDetailsDrawer({
  open,
  onOpenChange,
  request,
}: LeaveRequestDetailsDrawerProps) {
  const [activeTab, setActiveTab] = React.useState('overview')

  if (!request) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-xl flex flex-col h-full overflow-hidden">
        <SheetHeader className="shrink-0">
          <SheetTitle>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold">{request.leaveType}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-lg font-semibold text-muted-foreground">{request.id}</span>
            </div>
            <div className="mt-1 text-sm font-normal text-muted-foreground">
              {request.employee.name} · {request.department}
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-6 space-y-6">
          <AttendanceTabs
            tabs={tabItems}
            active={activeTab}
            onChange={setActiveTab}
          />

          <div className="flex items-center justify-between py-2">
            <Badge variant={statusBadgeVariantMap[request.status]} className="capitalize">
              {statusLabelMap[request.status]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Submitted {request.submittedDate ? new Date(request.submittedDate).toISOString().split('T')[0] : '—'}
            </span>
          </div>

          {activeTab === 'overview' && (
            <>
              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Employee Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Avatar className="size-16">
                      <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                        {request.employee.name.split(' ').map((p) => p[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-base font-semibold">
                        {request.employee.name}
                      </p>

                      <p className="text-sm text-muted-foreground">
                        {request.employee.designation} · {request.department} · {request.employeeId}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Request Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-x-10 gap-y-6">

                    <div>
                      <p className="text-xs text-muted-foreground">Leave Type</p>
                      <p className="font-semibold">{request.leaveType}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="font-semibold">{request.duration}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Start Date</p>
                      <p className="font-semibold">{request.fromDate}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">End Date</p>
                      <p className="font-semibold">{request.toDate}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Approver</p>
                      <p className="font-semibold">
                        {request.approver || "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Emergency Contact
                      </p>

                      <p className="font-semibold">
                        {request.employee.mobileNumber}
                      </p>
                    </div>

                  </div>

                  <div className="mt-6">
                    <p className="text-xs text-muted-foreground mb-1">
                      Reason
                    </p>

                    <p>{request.reason}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Leave Balance Snapshot</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">

                    <div className="rounded-lg bg-muted p-4">
                      <p className="text-xs text-muted-foreground">
                        Casual Leave
                      </p>

                      <p className="text-xl font-semibold">
                        6 days
                      </p>
                    </div>

                    <div className="rounded-lg bg-muted p-4">
                      <p className="text-xs text-muted-foreground">
                        Sick Leave
                      </p>

                      <p className="text-xl font-semibold">
                        5 days
                      </p>
                    </div>

                    <div className="rounded-lg bg-muted p-4">
                      <p className="text-xs text-muted-foreground">
                        Earned Leave
                      </p>

                      <p className="text-xl font-semibold">
                        14 days
                      </p>
                    </div>

                    <div className="rounded-lg bg-muted p-4">
                      <p className="text-xs text-muted-foreground">
                        Work From Home
                      </p>

                      <p className="text-xl font-semibold">
                        6 days
                      </p>
                    </div>

                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Approval History</CardTitle>
                </CardHeader>
                <CardContent>

                  {request.status === "pending" && (
                    <p className="text-sm text-muted-foreground">
                      Awaiting decision from
                      <span className="font-medium">
                        {" "}
                        {request.approver}
                      </span>.
                    </p>
                  )}

                  {request.status === "approved" && (
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />

                      <span>
                        {request.approver} marked this request as
                      </span>

                      <Badge variant="success">
                        Approved
                      </Badge>
                    </div>
                  )}

                  {request.status === "rejected" && (
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 text-red-600" />

                      <span>
                        {request.approver} marked this request as
                      </span>

                      <Badge variant="destructive">
                        Rejected
                      </Badge>
                    </div>
                  )}

                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "timeline" && (
            <div className="space-y-8 px-2 py-2">

              {/* Request Submitted */}
              <div className="flex items-start gap-3">
                <div className="mt-1.5 h-3 w-3 rounded-full bg-primary" />

                <div>
                  <p className="text-sm font-semibold">
                    Request submitted
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {request.employee.name} · {request.submittedDate}
                  </p>
                </div>
              </div>

              {/* Approved */}
              {request.status === "approved" && (
                <div className="flex items-start gap-3">
                  <div className="mt-1.5 h-3 w-3 rounded-full bg-primary" />

                  <div>
                    <p className="text-sm font-semibold">
                      Request approved
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {request.approver} · {request.toDate}
                    </p>
                  </div>
                </div>
              )}

              {/* Rejected */}
              {request.status === "rejected" && (
                <div className="flex items-start gap-3">
                  <div className="mt-1.5 h-3 w-3 rounded-full bg-primary" />

                  <div>
                    <p className="text-sm font-semibold">
                      Request rejected
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {request.approver} · {request.toDate}
                    </p>
                  </div>
                </div>
              )}

              {/* Sent Back */}
              {request.status === "sent-back" && (
                <div className="flex items-start gap-3">
                  <div className="mt-1.5 h-3 w-3 rounded-full bg-primary" />

                  <div>
                    <p className="text-sm font-semibold">
                      Request sent back
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {request.approver} · {request.toDate}
                    </p>
                  </div>
                </div>
              )}

            </div>
          )}
          {activeTab === "comments" && (
            <div className="flex flex-col justify-between min-h-[350px]">
              {/* Empty State */}
              <div className="flex flex-1 flex-col items-center justify-center text-center px-6">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <MessageSquare className="h-7 w-7 text-muted-foreground" />
                </div>

                <h3 className="text-lg font-semibold">No comments yet</h3>

                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Comments from approvers or HR will appear here.
                </p>
              </div>

              {/* Comment Box */}
              <div className=" bg-background p-4">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Add a comment..."
                    className="flex-1"
                  />

                  <Button className="gap-2">
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "attachments" && (
            <div className="flex min-h-[350px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Paperclip className="h-7 w-7 text-muted-foreground" />
              </div>

              <h3 className="text-lg font-semibold">
                No attachments
              </h3>

              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                Supporting documents for this leave request will appear here.
              </p>
            </div>
          )}

          {activeTab === "audit" && (
            <div className="space-y-5 px-2 py-2">

              {/* Created */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border">
                  <History className="h-3 w-3 text-muted-foreground" />
                </div>

                <p className="text-sm">
                  <span className="font-semibold">Created</span>{" "}
                  <span className="text-muted-foreground">
                    by {request.employee.name} on {request.submittedDate}
                  </span>
                </p>
              </div>

              {/* Approved */}
              {request.status === "approved" && (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border">
                    <History className="h-3 w-3 text-muted-foreground" />
                  </div>

                  <p className="text-sm">
                    <span className="font-semibold">Approved</span>{" "}
                    <span className="text-muted-foreground">
                      by {request.approver} on {request.toDate}
                    </span>
                  </p>
                </div>
              )}

              {/* Rejected */}
              {request.status === "rejected" && (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border">
                    <History className="h-3 w-3 text-muted-foreground" />
                  </div>

                  <p className="text-sm">
                    <span className="font-semibold">Rejected</span>{" "}
                    <span className="text-muted-foreground">
                      by {request.approver} on {request.toDate}
                    </span>
                  </p>
                </div>
              )}

              {/* Sent Back */}
              {request.status === "sent-back" && (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border">
                    <History className="h-3 w-3 text-muted-foreground" />
                  </div>

                  <p className="text-sm">
                    <span className="font-semibold">Sent Back</span>{" "}
                    <span className="text-muted-foreground">
                      by {request.approver} on {request.toDate}
                    </span>
                  </p>
                </div>
              )}

            </div>
          )}
        </div>

        {request.status === 'pending' && (
          <div className="shrink-0 border-t border-border bg-card p-4 flex justify-end gap-2">
            <Button variant="outline" size="sm">Edit</Button>
            <Button variant="outline" size="sm">Escalate</Button>
            <Button variant="outline" size="sm">Send Back</Button>
            <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive/10">
              Reject
            </Button>
            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90">
              Approve
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}