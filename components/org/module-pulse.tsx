'use client'

import * as React from 'react'
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─── Public Types (reusable across modules) ─── */
export interface PulseCardData {
  id: string
  title: string
  value: string | number
  subtitle: string
  icon: React.ElementType
  trend?: {
    direction: 'up' | 'down' | 'neutral'
    label: string
  }
  actionLabel?: string
  onAction?: () => void
  chartData?: number[] // Array of data points for the dynamic graph
}

/* ─── Sparkline Component ─── */
function Sparkline({ data, index }: { data: number[]; index: number }) {
  if (!data || data.length < 2) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const width = 100
  const height = 30 // Internal viewBox height

  // Normalize points to fit within SVG
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((val - min) / range) * height
    const paddedY = 2 + y * 0.8 // Padding to prevent clipping stroke
    return { x, y: paddedY }
  })

  // Create smooth cubic bezier path
  let d = `M ${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i]
    const next = points[i + 1]
    const midX = (curr.x + next.x) / 2
    d += ` C ${midX},${curr.y} ${midX},${next.y} ${next.x},${next.y}`
  }

  // Create closed path for the gradient fill
  const fillD = `${d} L ${width},${height + 5} L 0,${height + 5} Z`
  const gradId = `pulse-grad-${index}`

  return (
    <svg
      className="absolute bottom-0 left-0 w-full h-16 text-primary pointer-events-none opacity-80"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.25} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0.0} />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${gradId})`} stroke="none" />
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow-sm"
      />
    </svg>
  )
}

/* ─── Individual Pulse Card ─── */
function PulseCard({ card, index }: { card: PulseCardData; index: number }) {
  const Icon = card.icon
  const TrendIcon =
    card.trend?.direction === 'up'
      ? TrendingUp
      : card.trend?.direction === 'down'
        ? TrendingDown
        : null

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-primary/20 bg-card/50 backdrop-blur-sm p-5',
        'transition-all duration-300 ease-out',
        'hover:shadow-md hover:-translate-y-0.5 hover:bg-card/80 hover:border-primary/40',
        'animate-in fade-in slide-in-from-bottom-3',
      )}
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}
    >
      {/* Background Sparkline Graph */}
      {card.chartData && card.chartData.length > 0 && (
        <Sparkline data={card.chartData} index={index} />
      )}

      <div className="relative z-10 flex flex-col gap-4 h-full pb-6">
        {/* Top row: Icon + Trend */}
        <div className="flex items-start justify-between">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105">
            <Icon className="size-5" strokeWidth={1.8} />
          </div>

          {card.trend && (
            <div className="flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm border border-border/50">
              {TrendIcon && <TrendIcon className="size-3" />}
              {card.trend.label}
            </div>
          )}
        </div>

        {/* Value + Title */}
        <div className="space-y-0.5 mt-2">
          <div className="text-3xl font-bold tracking-tight text-foreground">
            {card.value}
          </div>
          <div className="text-sm font-semibold text-foreground/80">{card.title}</div>
        </div>
      </div>
    </div>
  )
}

/* ─── Module Pulse Grid (Generic — works for any module) ─── */
interface ModulePulseProps {
  cards: PulseCardData[]
  className?: string
}

export function ModulePulse({ cards, className }: ModulePulseProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4',
        className,
      )}
    >
      {cards.map((card, i) => (
        <PulseCard key={card.id} card={card} index={i} />
      ))}
    </div>
  )
}
