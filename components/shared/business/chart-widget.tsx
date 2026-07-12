'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface ChartWidgetProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  isLoading?: boolean
  children: React.ReactNode
  footer?: React.ReactNode
  compact?: boolean
}

const ChartWidget = React.forwardRef<HTMLDivElement, ChartWidgetProps>(
  (
    { title, description, isLoading, children, footer, compact = false, className, ...props },
    ref,
  ) => (
    <Card ref={ref} className={cn(compact && 'shadow-none', className)} {...props}>
      <CardHeader className={compact ? 'pb-2' : ''}>
        <CardTitle className={compact ? 'text-sm' : 'text-base'}>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className={compact ? 'py-2' : ''}>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-40 w-full rounded-md" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-40 w-full">{children}</div>
            {footer && <div className="mt-4 border-t border-border pt-4">{footer}</div>}
          </>
        )}
      </CardContent>
    </Card>
  ),
)
ChartWidget.displayName = 'ChartWidget'

export { ChartWidget, type ChartWidgetProps }
