import { CalendarDays } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/Leavemanagment-data'
import type { Holiday } from '@/types/Leavedashboard'

interface HolidayCardProps {
  holidays: Holiday[]
}

export function HolidayCard({ holidays }: HolidayCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Holidays</CardTitle>
        <CardDescription>Company holidays scheduled ahead</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {holidays.map((holiday) => (
          <div
            key={holiday.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-muted p-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarDays className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{holiday.name}</p>
                <p className="text-xs text-muted-foreground">{holiday.day}</p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-medium text-foreground">{formatDate(holiday.date)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
