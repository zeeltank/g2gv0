import { CalendarRange } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateShort } from '@/lib/Leavemanagment-data'
import type { EmployeeLeave } from '@/types/Leavedashboard'

interface UpcomingLeaveCardProps {
  leaves: EmployeeLeave[]
}

export function UpcomingLeaveCard({ leaves }: UpcomingLeaveCardProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Upcoming Leaves</CardTitle>
        <CardDescription>Approved leave plans coming up soon</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {leaves.map((leave) => (
          <div key={leave.id} className="rounded-lg border border-border p-3 transition-colors hover:bg-surface-muted">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-semibold text-foreground">{leave.employee}</p>
                <Badge variant="outline">{leave.leaveType}</Badge>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <CalendarRange className="size-4 text-primary" />
                {leave.duration}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">From</p>
                <p className="font-medium text-foreground">{formatDateShort(leave.fromDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">To</p>
                <p className="font-medium text-foreground">{formatDateShort(leave.toDate)}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
