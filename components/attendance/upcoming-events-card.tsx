'use client'

import * as React from 'react'
import { Calendar, Gift } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Event } from './types'

interface UpcomingEventsCardProps {
  events: Event[]
  loading?: boolean
  onViewEvents: () => void
}

export function UpcomingEventsCard({ events, loading, onViewEvents }: UpcomingEventsCardProps) {
  // Hide section if no events and not loading
  if (!loading && events.length === 0) {
    return null
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    )
  }

  const nextEvent = events[0]
  const eventCount = events.length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Events</CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          onClick={onViewEvents}
          className="w-full justify-start h-12"
        >
          <div className="flex items-center gap-3">
            <Gift className="size-5 text-primary" />
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">{eventCount} Upcoming Holiday{eventCount > 1 ? 's' : ''}</p>
              <p className="text-xs text-muted-foreground">{nextEvent?.title}</p>
            </div>
          </div>
          <Calendar className="size-4 ml-auto text-muted-foreground" />
        </Button>
      </CardContent>
    </Card>
  )
}