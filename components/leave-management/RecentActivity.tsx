import { CheckCircle2, ClipboardList, XCircle, type LucideIcon } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Activity, ActivityType } from '@/types/Leavedashboard'

interface RecentActivityProps {
  activities: Activity[]
}

const activityIconMap: Record<ActivityType, LucideIcon> = {
  application: ClipboardList,
  approval: CheckCircle2,
  rejection: XCircle,
}

const activityToneMap: Record<ActivityType, string> = {
  application: 'bg-primary/10 text-primary ring-primary/20',
  approval: 'bg-success/10 text-success ring-success/20',
  rejection: 'bg-destructive/10 text-destructive ring-destructive/20',
}

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest leave workflow updates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {activities.map((activity, index) => {
            const Icon = activityIconMap[activity.type]

            return (
              <div key={activity.id} className="relative flex gap-3 pb-5 last:pb-0">
                {index !== activities.length - 1 ? (
                  <span className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px bg-border" />
                ) : null}
                <div className={cn('z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-1', activityToneMap[activity.type])}>
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <p className="text-sm font-semibold text-foreground">{activity.title}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">{activity.timestamp}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{activity.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
