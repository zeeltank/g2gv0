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
        'group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5',
        'transition-all duration-300 ease-out',
        'hover:shadow-md hover:-translate-y-0.5 hover:bg-card/80',
        'shadow-[inset_0_2px_0_0_var(--primary)]', // iOS signature thin blue bevel
        'animate-in fade-in slide-in-from-bottom-3',
      )}
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}
    >
      <div className="flex flex-col gap-4">
        {/* Top row: Icon + Trend */}
        <div className="flex items-start justify-between">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105">
            <Icon className="size-5" strokeWidth={1.8} />
          </div>

          {card.trend && (
            <div className="flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              {TrendIcon && <TrendIcon className="size-3" />}
              {card.trend.label}
            </div>
          )}
        </div>

        {/* Value + Title */}
        <div className="space-y-0.5">
          <div className="text-3xl font-bold tracking-tight text-foreground">
            {card.value}
          </div>
          <div className="text-sm font-semibold text-foreground/80">{card.title}</div>
        </div>

        {/* Subtitle */}
        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
          {card.subtitle}
        </p>

        {/* Action link */}
        {card.actionLabel && (
          <button
            type="button"
            onClick={card.onAction}
            className={cn(
              'mt-auto flex items-center gap-1.5 text-xs font-semibold text-primary cursor-pointer',
              'transition-all duration-200 opacity-70 group-hover:opacity-100',
            )}
          >
            {card.actionLabel}
            <ArrowRight className="size-3 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        )}
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
