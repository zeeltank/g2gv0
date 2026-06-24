'use client'

import * as React from 'react'
import { CalendarCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { LeaveBalance } from './types'

interface LeaveBalanceCardProps {
  balance: LeaveBalance | null
  loading?: boolean
  onViewBalance: () => void
}

export function LeaveBalanceCard({ balance, loading, onViewBalance }: LeaveBalanceCardProps) {
  const totalLeave = balance ? balance.casual + balance.earned + balance.sick : 0

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave Balance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <CalendarCheck className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{totalLeave} Days</p>
            <p className="text-xs text-muted-foreground">Available</p>
          </div>
        </div>
        <Button variant="outline" onClick={onViewBalance} className="w-full">
          View Details
        </Button>
      </CardContent>
    </Card>
  )
}