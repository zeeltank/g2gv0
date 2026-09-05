'use client'

import * as React from 'react'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import type { LeaveBalance } from '@/domain/hrms/hrit/attendance-management/types'

interface LeaveBalanceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  balance: LeaveBalance | null
  loading?: boolean
}

export function LeaveBalanceModal({
  open,
  onOpenChange,
  balance,
  loading,
}: LeaveBalanceModalProps) {
  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger />
        <DialogContent>
          <DialogHeader>
            <Skeleton className="h-6 w-32" />
          </DialogHeader>
          <div className="space-y-4 py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const totalLeave = balance?.remaining ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave Balance Details</DialogTitle>
          <DialogDescription>
            Your available leave balance and pending requests
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Available Leaves</h3>
            {/*
              * F-97. Was three hardcoded rows — Casual / Earned / Sick — which
              * are not the leave types any tenant here has configured. Tenant 3's
              * are "Annual Leave", "Scholar Clone" and "Scholar Clone 2".
              */}
            <div className="space-y-3">
              {(balance?.types ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No leave types are configured for your organisation yet.
                </p>
              )}
              {(balance?.types ?? []).map((type) => (
                <LeaveBalanceItem key={type.leaveType} label={type.leaveType} days={type.remaining} />
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Used this year</h3>
            <div className="flex justify-between items-center">
              <span className="text-sm">Days taken</span>
              <span className="text-lg font-semibold">{balance?.used ?? 0}</span>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Total Available</span>
            <span className="text-xl font-bold">{totalLeave} Days</span>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface LeaveBalanceItemProps {
  label: string
  days: number
}

function LeaveBalanceItem({ label, days }: LeaveBalanceItemProps) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm">{label}</span>
      <span className="text-lg font-semibold">{days} Days</span>
    </div>
  )
}