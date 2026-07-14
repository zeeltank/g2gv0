'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ActivityItem {
  id: string
  title: string
  description?: string
  timestamp: string
  status?: 'completed' | 'pending' | 'failed'
  icon?: React.ReactNode
}

interface ActivityWidgetProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  activities: ActivityItem[]
  maxItems?: number
  onActivityClick?: (id: string) => void
}

const statusColors = {
  completed: 'bg-success/10 text-success',
  pending: 'bg-warning/10 text-warning',
  failed: 'bg-danger/10 text-danger',
}

const ActivityWidget = React.forwardRef<HTMLDivElement, ActivityWidgetProps>(
  ({ title, description, activities, maxItems = 5, onActivityClick, className, ...props }, ref) => {
    const displayedActivities = activities.slice(0, maxItems)

    return (
      <Card ref={ref} className={className} {...props}>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {displayedActivities.length > 0 ? (
              displayedActivities.map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => onActivityClick?.(activity.id)}
                  className="w-full text-left p-2 rounded-md hover:bg-surface-muted transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {activity.icon && (
                      <div className="text-muted-foreground flex-shrink-0 mt-1">{activity.icon}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{activity.title}</p>
                        {activity.status && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              statusColors[activity.status] || 'bg-muted text-muted-foreground',
                            )}
                          >
                            {activity.status}
                          </Badge>
                        )}
                      </div>
                      {activity.description && (
                        <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{activity.timestamp}</p>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No activities</p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  },
)
ActivityWidget.displayName = 'ActivityWidget'

export { ActivityWidget, type ActivityWidgetProps, type ActivityItem }
