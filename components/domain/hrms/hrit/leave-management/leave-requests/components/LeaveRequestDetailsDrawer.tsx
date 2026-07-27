'use client'

import * as React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/ui/status-badge'
import { Spinner } from '@/components/ui/spinner'
import { AttendanceTabs } from '@/domain/hrms/hrit/attendance-management/attendance-tracking/components/attendance-tabs'
import { Check, X, MessageSquare, Paperclip, History, Send } from 'lucide-react'
import type { LeaveRequest, LeaveRequestStatus } from '@/types/leave-dashboard'
import type { LeaveRequestDetail, LeaveStatus } from '@/services/hrms'
import { Input } from '@/components/ui/input'

interface LeaveRequestDetailsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: LeaveRequest | null
  /** Live payload from /api/leave/requests/{id} - balances, comments, timeline. */
  detail?: LeaveRequestDetail | null
  loading?: boolean
  processing?: boolean
  onDecision?: (id: number, status: LeaveStatus, remarks?: { hrRemarks?: string }) => void
}

const statusLabelMap: Record<LeaveRequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  'sent-back': 'Sent Back',
  cancelled: 'Cancelled',
  approved_lwp: 'Approved LWP',
}

const tabItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'comments', label: 'Comments' },
  { id: 'attachments', label: 'Attachments' },
  { id: 'audit', label: 'Audit Trail' },
]

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function LeaveRequestDetailsDrawer({
  open,
  onOpenChange,
  request,
  detail,
  loading = false,
  processing = false,
  onDecision,
}: LeaveRequestDetailsDrawerProps) {
  const [activeTab, setActiveTab] = React.useState('overview')
  const [remark, setRemark] = React.useState('')

  // Reset on close in the handler rather than an effect, so no cascading render.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setActiveTab('overview')
      setRemark('')
    }
    onOpenChange(next)
  }

  if (!request) return null

  const requestId = Number(request.id)
  const balances = detail?.balances ?? []
  const comments = detail?.comments ?? []
  const timeline = detail?.timeline ?? []

  const decide = (status: LeaveStatus) => {
    onDecision?.(requestId, status, remark.trim() ? { hrRemarks: remark.trim() } : undefined)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col gap-0 border-l border-border/80">
        <SheetHeader className="shrink-0 p-6 pb-0 space-y-0 text-left">
          <SheetTitle>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold">{request.leaveType}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-lg font-semibold text-muted-foreground">#{request.id}</span>
            </div>
            <div className="mt-1 text-sm font-normal text-muted-foreground">
              {request.employee.name} · {request.department}
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          <AttendanceTabs tabs={tabItems} active={activeTab} onChange={setActiveTab} />

          <div className="flex items-center justify-between py-2">
            <StatusBadge status={request.status} label={statusLabelMap[request.status] ?? request.status} />
            <span className="text-sm text-muted-foreground">
              Submitted {formatDate(request.submittedDate)}
            </span>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          )}

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
                        {request.employee.name.split(' ').map((part) => part[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-base font-semibold">{request.employee.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {[request.employee.designation, request.department, request.employeeId]
                          .filter(Boolean)
                          .join(' · ')}
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
                      <p className="font-semibold">{formatDate(request.fromDate)}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">End Date</p>
                      <p className="font-semibold">{formatDate(request.toDate)}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Approver</p>
                      <p className="font-semibold">{request.approver || '—'}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Contact</p>
                      <p className="font-semibold">{request.employee.mobileNumber || '—'}</p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <p className="text-xs text-muted-foreground mb-1">Reason</p>
                    <p>{request.reason || '—'}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Leave Balance Snapshot</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {balances.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No leave allocation is configured for this employee&apos;s department this year.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {balances
                        .filter((balance) => balance.total > 0)
                        .map((balance) => (
                          <div key={balance.leave_type} className="rounded-lg bg-muted p-4">
                            <p className="text-xs text-muted-foreground">{balance.leave_type}</p>
                            <p className="text-xl font-semibold">{balance.remaining} days</p>
                            <p className="text-xs text-muted-foreground">
                              {balance.used} of {balance.total} used
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Approval History</CardTitle>
                </CardHeader>
                <CardContent>
                  {request.status === 'pending' && (
                    <p className="text-sm text-muted-foreground">
                      Awaiting decision{request.approver ? ` from ${request.approver}` : ''}.
                    </p>
                  )}

                  {(request.status === 'approved' || request.status === 'approved_lwp') && (
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      <span>{request.approver || 'An approver'} marked this request as</span>
                      <StatusBadge status={request.status} label={statusLabelMap[request.status]} />
                    </div>
                  )}

                  {(request.status === 'rejected' || request.status === 'cancelled') && (
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 text-destructive" />
                      <span>{request.approver || 'An approver'} marked this request as</span>
                      <StatusBadge status={request.status} label={statusLabelMap[request.status]} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-8 px-2 py-2">
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No timeline events recorded yet.</p>
              ) : (
                timeline.map((entry, index) => (
                  <div key={`${entry.stage}-${index}`} className="flex items-start gap-3">
                    <div className="mt-1.5 h-3 w-3 rounded-full bg-primary" />
                    <div>
                      <p className="text-sm font-semibold">{entry.stage}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {[entry.actor, formatDateTime(entry.timestamp)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="flex flex-col justify-between min-h-[350px]">
              {comments.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center px-6">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <MessageSquare className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">No comments yet</h3>
                  <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                    Comments from approvers or HR will appear here.
                  </p>
                </div>
              ) : (
                <div className="flex flex-1 flex-col gap-4">
                  {comments.map((comment, index) => (
                    <div key={`${comment.role}-${index}`} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">
                          {comment.author}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">{comment.role}</span>
                        </p>
                        <span className="text-xs text-muted-foreground">{formatDateTime(comment.timestamp)}</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{comment.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {request.status === 'pending' && (
                <div className="bg-background p-4">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Add an HR remark..."
                      className="flex-1"
                      value={remark}
                      onChange={(event) => setRemark(event.target.value)}
                    />
                    <Button
                      className="gap-2"
                      disabled={processing || !remark.trim()}
                      onClick={() => decide('pending')}
                    >
                      <Send className="h-4 w-4" />
                      Save
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    The remark is stored against this request and applied with your next decision.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'attachments' && (
            <div className="flex min-h-[350px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Paperclip className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No attachments</h3>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                Supporting documents are not stored against leave requests in the ERP yet.
              </p>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-5 px-2 py-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border">
                  <History className="h-3 w-3 text-muted-foreground" />
                </div>
                <p className="text-sm">
                  <span className="font-semibold">Created</span>{' '}
                  <span className="text-muted-foreground">
                    by {request.employee.name} on {formatDateTime(request.submittedDate)}
                  </span>
                </p>
              </div>

              {timeline.slice(1).map((entry, index) => (
                <div key={`audit-${index}`} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border">
                    <History className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <p className="text-sm">
                    <span className="font-semibold">{entry.stage}</span>{' '}
                    <span className="text-muted-foreground">
                      {entry.actor ? `by ${entry.actor} ` : ''}on {formatDateTime(entry.timestamp)}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {request.status === 'pending' && onDecision && (
          <div className="shrink-0 border-t border-border bg-card p-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={processing} onClick={() => decide('sent_back')}>
              Send Back
            </Button>
            <Button variant="outline" size="sm" disabled={processing} onClick={() => decide('cancelled')}>
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive text-destructive hover:bg-destructive/10"
              disabled={processing}
              onClick={() => decide('rejected')}
            >
              Reject
            </Button>
            <Button
              size="sm"
              className="bg-success text-success-foreground hover:bg-success/90"
              disabled={processing}
              onClick={() => decide('approved')}
            >
              Approve
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
