'use client'

import * as React from 'react'
import { CalendarDays ,ChevronRight} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Event } from '../types'

interface UpcomingEventsWidgetProps {
  events: Event[]
  loading?: boolean
  onViewCalendar?: () => void
}

function getDayOfWeek(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

function formatEventDate(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateValue
  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
  })
}

export function UpcomingEventsWidget({ events, loading, onViewCalendar }: UpcomingEventsWidgetProps) {
  if (loading) {
    return (
      <Card className="h-full rounded-xl border-border bg-card shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 px-5 pb-4 pt-5">
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3 px-3 pb-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex h-full flex-col rounded-xl border-border bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 px-5 pb-4 pt-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-600">
          <CalendarDays className="size-5" />
        </span>
        <CardTitle className="text-base font-bold text-foreground">
          Upcoming Events
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between px-3 pb-3">
        <div className="flex flex-col">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-muted"
            >
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground">{formatEventDate(event.date)}</span>
                <span className="text-sm font-medium text-muted-foreground">{event.title}</span>
                <span className="text-xs font-medium text-muted-foreground">{getDayOfWeek(event.date)}</span>
              </div>
              {event.type === 'leave' && (
                <Badge
                  variant="success"
                  className="gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                >
                  Approved
                </Badge>
              )}
            </div>
          ))}
        </div>
        {onViewCalendar && (
          <button
            type="button"
            onClick={onViewCalendar}
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
          >
            View Calendar
          <ChevronRight className="size-4" />
          </button>
        )}
      </CardContent>
    </Card>
  )
}
