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
import type { LeaveBalance } from './types'

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

  const totalLeave = balance ? balance.casual + balance.earned + balance.sick : 0

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
            <div className="space-y-3">
              <LeaveBalanceItem label="Casual Leave" days={balance?.casual ?? 0} />
              <LeaveBalanceItem label="Earned Leave" days={balance?.earned ?? 0} />
              <LeaveBalanceItem label="Sick Leave" days={balance?.sick ?? 0} />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Pending Requests</h3>
            <div className="flex justify-between items-center">
              <span className="text-sm">Pending Approval</span>
              <span className="text-lg font-semibold">{balance?.pending ?? 0}</span>
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