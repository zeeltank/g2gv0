import { CalendarDays, UserRound } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import type { DashboardUser } from '@/types/Leavedashboard'

interface DashboardHeaderProps {
  user: DashboardUser
  currentDate: string
}

export function DashboardHeader({ user, currentDate }: DashboardHeaderProps) {
  return (
    <Card className="overflow-hidden border-border/80 bg-card">
      <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Welcome back,</p>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
              {user.name}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserRound className="size-4" />
              <span>{user.role}</span>
            </div>
          </div>
        </div>
        <div className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground sm:w-auto">
          <CalendarDays className="size-4 text-primary" />
          <span className="font-medium text-foreground">{currentDate}</span>
        </div>
      </CardContent>
    </Card>
  )
}
