import React from 'react'
import { cn } from '@/lib/utils'
import { ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react'

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
            {/* Signature iOS-style top bevel edge */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            
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
    </div>
  )
}
