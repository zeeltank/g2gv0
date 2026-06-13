'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Insight {
  id: string
  title: string
  description?: string
  priority: 'high' | 'medium' | 'low'
  category?: string
  action?: {
    label: string
    onClick: () => void
  }
}

interface InsightWidgetProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  insights: Insight[]
  maxItems?: number
}

const priorityColors = {
  high: 'bg-danger/10 text-danger',
  medium: 'bg-warning/10 text-warning',
  low: 'bg-info/10 text-info',
}

const InsightWidget = React.forwardRef<HTMLDivElement, InsightWidgetProps>(
  ({ title, description, insights, maxItems = 3, className, ...props }, ref) => {
    const displayedInsights = insights.slice(0, maxItems)

    return (
      <Card ref={ref} className={className} {...props}>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {displayedInsights.length > 0 ? (
              displayedInsights.map((insight) => (
                <div
                  key={insight.id}
                  className="p-3 rounded-lg border border-border hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-foreground flex-1">{insight.title}</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs flex-shrink-0',
                        priorityColors[insight.priority] || 'bg-muted',
                      )}
                    >
                      {insight.priority}
                    </Badge>
                  </div>
                  {insight.description && (
                    <p className="text-xs text-muted-foreground mb-2">{insight.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    {insight.category && (
                      <span className="text-xs text-muted-foreground">{insight.category}</span>
                    )}
                    {insight.action && (
                      <button
                        onClick={insight.action.onClick}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {insight.action.label}
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No insights</p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  },
)
InsightWidget.displayName = 'InsightWidget'

export { InsightWidget, type InsightWidgetProps, type Insight }
