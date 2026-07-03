'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { LeaveCalendarDrawer } from './LeaveCalendarDrawer'
import type { EmployeeLeave } from '@/types/Leavedashboard'

interface DashboardHeaderProps {
  userName: string
  currentDate: string
  upcomingLeaves: EmployeeLeave[]
}

export function DashboardHeader({ userName, currentDate, upcomingLeaves }: DashboardHeaderProps) {
  const [calendarOpen, setCalendarOpen] = useState(false)

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground lg:text-xl">
            Good Morning, {userName}! <span aria-hidden="true">👋</span>
          </h1>
          <p className="text-sm font-medium text-muted-foreground lg:text-sm">
            Here's your leave management overview for today.
          </p>
        </div>

        <Button
          variant="outline"
          className="h-14 justify-between gap-3 rounded-2xl border-border/80 bg-card px-4 text-base font-semibold shadow-sm sm:min-w-72"
          onClick={() => setCalendarOpen(true)}
          aria-label="Open monthly leave calendar"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            L
          </span>
          <span className="flex-1 text-left">{currentDate}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </header>

      <LeaveCalendarDrawer
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        upcomingLeaves={upcomingLeaves}
        currentDate={currentDate}
      />
    </>
  )
}
