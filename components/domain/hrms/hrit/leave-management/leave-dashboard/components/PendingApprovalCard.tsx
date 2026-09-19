'use client'

import { ArrowRight, Check, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDateShort } from '@/lib/leave-management-data'
import type { LeaveRequest } from '@/types/leave-dashboard'

interface PendingApprovalsCardProps {
  requests: LeaveRequest[]
  onViewDetails: (request: LeaveRequest) => void
  onViewAll: () => void
  onDecision: (request: LeaveRequest, status: 'approved' | 'rejected') => void
  processingRequestId?: string | null
} 

export function PendingApprovalsCard({
  requests,
  onViewDetails,
  onViewAll,
  onDecision,
  processingRequestId,
}: PendingApprovalsCardProps) {
  return (
    <Card className="h-full rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-base font-semibold">
          Pending Approvals
        </CardTitle>

        <Button
          variant="link"
          className="h-auto p-0 text-sm font-semibold text-primary"
          onClick={onViewAll}
        >
          View all ({requests.length})
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/*
          F-194. This card used to .map() straight into its body, so an empty
          dataset rendered a heading above whitespace. On a newly-configured
          tenant the whole dashboard was a grid of headed cards containing
          nothing - indistinguishable from a broken page. Each empty state
          names the cause AND the next step, the way payroll-type does.
        */}
        {requests.length === 0 ? (
          <EmptyState
            title="Nothing waiting on you"
            description="Leave requests appear here while they need a decision. An empty list means every request in your scope has been actioned."
          />
        ) : (
          <>
        {requests.slice(0, 4).map((request) => (
          <div
            key={request.id}
            role="button"
            tabIndex={0}
            onClick={() => onViewDetails(request)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onViewDetails(request)
            }}
            className="flex items-center justify-between rounded-xl border border-border bg-background p-3 transition-all hover:bg-muted/30"
          >
            {/* Left Section */}
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11">
                <AvatarImage src={request.employee.avatar} />

                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {request.employee.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')}
                </AvatarFallback>
              </Avatar>

              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  {request.employee.name}
                </h4>

                <p className="text-xs text-muted-foreground">
                  {request.leaveType}
                </p>
              </div>
            </div>

            {/* Middle Section */}
            <div className="text-center">
              <p className="text-xs font-semibold text-foreground">
                {formatDateShort(request.fromDate)}
                {request.fromDate !== request.toDate &&
                  ` - ${formatDateShort(request.toDate)}`}
              </p>

              <p className="text-xs text-muted-foreground">
                {request.duration}
              </p>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 rounded-lg border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
                aria-label={`Approve ${request.employee.name}'s leave request`}
                disabled={processingRequestId === request.id}
                onClick={(event) => {
                  event.stopPropagation()
                  onDecision(request, 'approved')
                }}
              >
                <Check className="h-4 w-4" />
              </Button>

              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 rounded-lg border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
                aria-label={`Reject ${request.employee.name}'s leave request`}
                disabled={processingRequestId === request.id}
                onClick={(event) => {
                  event.stopPropagation()
                  onDecision(request, 'rejected')
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
          </>
        )}
      </CardContent>
    </Card>
  )
}
