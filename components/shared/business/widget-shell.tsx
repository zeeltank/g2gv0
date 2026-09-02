'use client'

import React from 'react'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Every dashboard widget occupies the same fixed-height grid cell. */
export const WIDGET_HEIGHT = 'h-[420px]'

export type KpiTrend = 'neutral' | 'warning' | 'success' | 'primary'

export function KpiCard({
  title,
  value,
  subtext,
  icon: Icon,
  trend = 'neutral',
  loading = false,
}: {
  title: string
  value: string | number
  subtext: string
  icon: React.ElementType
  trend?: KpiTrend
  loading?: boolean
}) {
  const trendColor =
    trend === 'warning'
      ? 'text-destructive'
      : trend === 'success'
        ? 'text-success'
        : trend === 'primary'
          ? 'text-primary'
          : 'text-muted-foreground'

  return (
    <Card className="rounded-xl border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
            <Icon className="size-6" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="my-1 h-7 w-12" />
            ) : (
              <h3 className="text-2xl font-bold tracking-tight text-foreground">{value}</h3>
            )}
            {loading ? (
              <Skeleton className="h-3 w-20" />
            ) : (
              <p className={cn('truncate text-xs font-semibold', trendColor)}>{subtext}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Widget chrome: fixed-height card, optional header action and footer link.
 * Keeping this in one place is what lets every widget share the same loading,
 * empty and error treatment.
 */
export function WidgetShell({
  title,
  headerAction,
  footerAction,
  children,
  className,
}: {
  title: string
  headerAction?: React.ReactNode
  footerAction?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border-border/80 shadow-sm',
        WIDGET_HEIGHT,
        className,
      )}
    >
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/60 px-5 pb-3 pt-5">
        <CardTitle className="text-base font-bold">{title}</CardTitle>
        {headerAction}
      </CardHeader>
      {children}
      {footerAction && (
        <div className="mt-auto border-t border-border/50 bg-muted/10 px-3 py-2">{footerAction}</div>
      )}
    </Card>
  )
}

export function WidgetLink({
  label,
  onClick,
  variant = 'header',
}: {
  label: string
  onClick: () => void
  variant?: 'header' | 'footer'
}) {
  if (variant === 'footer') {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        className="h-8 w-full justify-start gap-1 text-[13px] font-semibold text-primary"
      >
        {label} <ChevronRight className="size-4" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="h-8 gap-1 text-xs font-semibold text-primary"
    >
      {label} <ChevronRight className="size-3.5" />
    </Button>
  )
}

/** Skeleton rows used while a widget's data is still in flight. */
export function WidgetLoading({ rows = 4 }: { rows?: number }) {
  return (
    <CardContent className="flex-1 space-y-3 overflow-hidden p-5">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </CardContent>
  )
}

export function WidgetMessage({
  icon: Icon,
  title,
  description,
  action,
  tone = 'muted',
}: {
  icon?: React.ElementType
  title: string
  description?: string
  action?: React.ReactNode
  tone?: 'muted' | 'danger'
}) {
  return (
    <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      {Icon && (
        <Icon className={cn('size-7', tone === 'danger' ? 'text-destructive' : 'text-muted-foreground/50')} />
      )}
      <p
        className={cn(
          'text-sm font-semibold',
          tone === 'danger' ? 'text-destructive' : 'text-foreground',
        )}
      >
        {title}
      </p>
      {description && <p className="max-w-[220px] text-xs text-muted-foreground">{description}</p>}
      {action}
    </CardContent>
  )
}

/**
 * A real proportional donut, drawn with SVG arcs.
 *
 * The previous implementation was a fixed CSS border arc that never moved with
 * the value, so a 12% and a 90% reading looked identical.
 */
export interface DonutSegment {
  value: number
  /** Any Tailwind text-* colour class; the arc is stroked with currentColor. */
  colorClass: string
  label: string
}

export function DonutChart({
  segments,
  centerValue,
  centerLabel,
  size = 128,
  thickness = 12,
}: {
  segments: DonutSegment[]
  centerValue: string | number
  centerLabel: string
  size?: number
  thickness?: number
}) {
  const total = segments.reduce((sum, segment) => sum + Math.max(segment.value, 0), 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius

  let offset = 0

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className="stroke-muted"
        />
        {total > 0 &&
          segments.map((segment, index) => {
            const portion = Math.max(segment.value, 0) / total
            const dash = portion * circumference
            const element = (
              <circle
                key={index}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={thickness}
                strokeLinecap="butt"
                stroke="currentColor"
                className={segment.colorClass}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              >
                <title>{`${segment.label}: ${segment.value}`}</title>
              </circle>
            )
            offset += dash
            return element
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black tracking-tight text-foreground">{centerValue}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {centerLabel}
        </span>
      </div>
    </div>
  )
}

/** Legend row beside a donut: coloured dot, label, count and share. */
export function DonutLegendRow({
  colorClass,
  label,
  count,
  percentage,
}: {
  colorClass: string
  label: string
  count: number
  percentage: number
}) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <div className="flex items-center gap-2 font-medium text-foreground">
        <span className={cn('size-2.5 rounded-full', colorClass)} />
        {label}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-bold">{count}</span>
        <span className="w-8 text-right font-semibold text-muted-foreground">{percentage}%</span>
      </div>
    </div>
  )
}
