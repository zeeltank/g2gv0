'use client'

import * as React from 'react'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Gift, Clock } from 'lucide-react'
import type { Event } from './types'

interface EventDetailsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  events: Event[]
}

export function EventDetailsDrawer({
  open,
  onOpenChange,
  events,
}: EventDetailsDrawerProps) {
  const upcomingEvents = events.filter((e) => isFutureDate(e.date))
  const pastEvents = events.filter((e) => !isFutureDate(e.date))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Events & Holidays</SheetTitle>
          <SheetDescription>
            Upcoming holidays and events
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="size-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No upcoming events</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Upcoming</h3>
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}

          {pastEvents.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Past Events</h3>
              {pastEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface EventCardProps {
  event: Event
}

function EventCard({ event }: EventCardProps) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <Gift className="size-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-foreground">{event.title}</h4>
            <Badge variant="outline" className="text-xs">
              {event.type}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDate(event.date)}
          </p>
          {event.description && (
            <p className="text-xs text-muted-foreground mt-2">{event.description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function isFutureDate(dateStr: string): boolean {
  const eventDate = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return eventDate >= today
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}