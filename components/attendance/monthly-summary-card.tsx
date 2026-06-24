'use client'

import * as React from 'react'
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock3,
  BriefcaseBusiness,
  XCircle,
} from 'lucide-react'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import type { MonthlySummary } from './types'

interface MonthlySummaryCardProps {
  summary: MonthlySummary | null
  loading?: boolean
  onViewCalendar: () => void
}

export function MonthlySummaryCard({
  summary,
  loading = false,
  onViewCalendar,
}: MonthlySummaryCardProps) {
  const summaryItems = [
    {
      label: 'Present',
      value: summary?.present ?? 0,
      icon: CheckCircle2,

      cardClass:
        'border-success/20 bg-success/5',

      iconContainerClass:
        'bg-success/10 text-success',

      valueClass:
        'text-success',
    },
    {
      label: 'Late',
      value: summary?.late ?? 0,
      icon: Clock3,

      cardClass:
        'border-warning/20 bg-warning/5',

      iconContainerClass:
        'bg-warning/10 text-warning',

      valueClass:
        'text-warning',
    },
    {
      label: 'Leave',
      value: summary?.leave ?? 0,
      icon: BriefcaseBusiness,

      cardClass:
        'border-primary/20 bg-primary/5',

      iconContainerClass:
        'bg-primary/10 text-primary',

      valueClass:
        'text-primary',
    },
    {
      label: 'Absent',
      value: summary?.absent ?? 0,
      icon: XCircle,

      cardClass:
        'border-destructive/20 bg-destructive/5',

      iconContainerClass:
        'bg-destructive/10 text-destructive',

      valueClass:
        'text-destructive',
    },
  ]

  if (loading) {
    return (
      <Card className="overflow-hidden rounded-[28px]">
        <CardContent className="space-y-6 p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-2xl" />

            <div className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-36 rounded-2xl"
              />
            ))}
          </div>

          <Skeleton className="h-12 w-full rounded-2xl" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden rounded-[28px] border border-border bg-background shadow-smoverflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
      <CardHeader>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Calendar className="h-6 w-6 text-primary" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-900text-lg font-semibold leading-none tracking-tight">
              This Month Summary
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Overview of your attendance this month
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 pt-0">
        <div className="grid grid-cols-4 gap-3">
          {summaryItems.map((item) => {
            const Icon = item.icon

            return (
             <div
  key={item.label}
  className={cn(
    'rounded-2xl border p-3 transition-all duration-200 hover:shadow-sm text-center flex flex-col items-center',
    item.cardClass
  )}
>
  <div
    className={cn(
      'mb-4 flex h-11 w-11 items-center justify-center rounded-xl',
      item.iconContainerClass
    )}
  >
    <Icon className="h-5 w-5" />
  </div>

  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
    {item.label}
  </p>

  <p
    className={cn(
      'mt-1 text-lg font-bold leading-none',
      item.valueClass
    )}
  >
    {item.value}
  </p>
</div>
            )
          })}
        </div>

        <div className="pt-5">
          <Button
            variant="outline"
            onClick={onViewCalendar}
            className="
              h-10
              w-full
              rounded-2xl
              border-primary/20
              bg-primary/5
              text-primary
              hover:bg-primary/10
              hover:text-primary
            "
          >
            <CalendarDays className="mr-2 h-4 w-4" />

            <span>View Calendar</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}