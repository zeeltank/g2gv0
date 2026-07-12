'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const metricCardVariants = cva('', {
  variants: {
    layout: {
      vertical: 'space-y-4',
      horizontal: 'flex flex-row items-center justify-between',
    },
  },
  defaultVariants: {
    layout: 'vertical',
  },
})

interface MetricCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof metricCardVariants> {
  title: string
  subtitle?: string
  primary: {
    label: string
    value: string | number
  }
  secondary?: Array<{
    label: string
    value: string | number
  }>
  action?: React.ReactNode
}

const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  ({ title, subtitle, primary, secondary, action, layout, className, ...props }, ref) => {
    const isVertical = layout === 'vertical'

    return (
      <Card ref={ref} className={className} {...props}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
          {subtitle && <CardDescription>{subtitle}</CardDescription>}
        </CardHeader>
        <CardContent className={metricCardVariants({ layout })}>
          <div className={cn(isVertical ? 'space-y-1' : 'space-y-0.5')}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {primary.label}
            </p>
            <p className="text-3xl font-bold text-foreground">{primary.value}</p>
          </div>
          {secondary && secondary.length > 0 && (
            <div className={cn('grid gap-4', isVertical ? 'grid-cols-2' : 'grid-cols-2')}>
              {secondary.map((item) => (
                <div key={item.label} className="space-y-1">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-lg font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          )}
          {action && <div className={cn(isVertical ? 'pt-2' : '')}>{action}</div>}
        </CardContent>
      </Card>
    )
  },
)
MetricCard.displayName = 'MetricCard'

export { MetricCard, type MetricCardProps }
