import { CalendarDays, ArrowRight } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate } from '@/lib/leave-management-data'
import type { Holiday } from '@/types/leave-dashboard'
import { Button } from '@/components/ui/button'

interface HolidayCardProps {
  holidays: Holiday[]
  onViewAll: () => void
}

export function HolidayCard({ holidays, onViewAll }: HolidayCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div className="flex flex-col">
          <CardTitle className="text-base">
            Upcoming Holidays
          </CardTitle>

          <CardDescription>
            Company holidays scheduled ahead
          </CardDescription>
        </div>

        <Button
          variant="link"
          className="h-auto px-0 text-xs font-semibold"
          onClick={onViewAll}
        >
          View all
          <ArrowRight className="ml-1 size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/*
          F-194. This card used to .map() straight into its body, so an empty
          dataset rendered a heading above whitespace. On a newly-configured
          tenant the whole dashboard was a grid of headed cards containing
          nothing - indistinguishable from a broken page. Each empty state
          names the cause AND the next step, the way payroll-type does.
        */}
        {holidays.length === 0 ? (
          <EmptyState
            title="No holidays configured"
            description="Add them under Configuration → Holiday Calendar. Until then, leave requests treat every working day as workable."
          />
        ) : (
          <>
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
          </>
        )}
      </CardContent>
    </Card>
  )
}
