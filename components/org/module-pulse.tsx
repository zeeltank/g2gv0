import React from 'react'
import { cn } from '@/lib/utils'
import { ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react'

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
  icon: any
  trend?: {
    direction: 'up' | 'down'
    label: string
  }
  actionLabel?: string
}

interface ModulePulseProps {
  cards: PulseCardData[]
}

export function ModulePulse({ cards }: ModulePulseProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.id}
            className={cn(
              "group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all duration-300",
              "border-primary/20 hover:border-primary/40 hover:shadow-md cursor-pointer hover:-translate-y-0.5",
              "before:absolute before:inset-0 before:-z-10 before:bg-gradient-to-br before:from-primary/5 before:to-transparent before:opacity-0 before:transition-opacity hover:before:opacity-100"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {card.title}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <h3 className="text-3xl font-bold tracking-tight text-foreground">
                {card.value}
              </h3>
              {card.trend && (
                <span className={cn(
                  "flex items-center text-xs font-medium",
                  card.trend.direction === 'up' ? "text-success" : "text-danger"
                )}>
                  {card.trend.direction === 'up' ? (
                    <ArrowUpRight className="mr-0.5 h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="mr-0.5 h-3 w-3" />
                  )}
                  {card.trend.label}
                </span>
              )}
            </div>

            <p className="mt-2 text-xs text-muted-foreground line-clamp-1">
              {card.subtitle}
            </p>

            {card.actionLabel && (
              <div className="mt-4 flex items-center text-sm font-medium text-primary opacity-80 transition-opacity group-hover:opacity-100">
                {card.actionLabel}
                <ArrowRight className="ml-1 h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            )}
          </div>
        )
      })}
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
        'group relative overflow-hidden rounded-2xl border border-primary/20 bg-card/50 backdrop-blur-sm p-5',
        'transition-all duration-300 ease-out',
        'hover:shadow-md hover:-translate-y-0.5 hover:bg-card/80 hover:border-primary/40',
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
