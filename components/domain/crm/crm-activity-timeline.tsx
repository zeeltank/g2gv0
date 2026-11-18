'use client'

/**
 * Unified activity timeline — merges scheduled calendar events (calls,
 * meetings, follow-ups) and sent/received emails into a single chronological
 * feed for a Lead, Contact, Organization, or Opportunity.
 *
 * Data is loaded from two independent sources in parallel:
 *   1. task_management_calendar_events via taskService.getLinkedCalendarEvents
 *   2. CRM email links via crmService.getLeadEmails / getContactEmails / etc.
 *
 * Both sources already exist; this component just combines them.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Calendar, CalendarClock, CheckSquare, Mail, Phone,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { LaravelContext } from '@/lib/laravel-context'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import { taskService } from '@/services/task'
import type { CalendarEvent } from '@/types/task-management'
import type { CrmEmailLinkEntry } from '@/types/crm'
import { CreateEventModal } from '@/components/domain/task/create-event-modal'
import type { LinkedRecordType } from './linked-record-picker'

export type ActivityEntityType = 'lead' | 'contact' | 'organization' | 'opportunity'

interface Props {
  entityType: ActivityEntityType
  entityId: string
  context: LaravelContext
}

type ActivityKind = 'event' | 'email'

interface TimelineItem {
  id: string
  kind: ActivityKind
  title: string
  subLabel: string | null
  date: string | null
  status?: string | null
  isInbound?: boolean
}

function toLinkedType(entityType: ActivityEntityType): LinkedRecordType {
  const map: Record<ActivityEntityType, LinkedRecordType> = {
    lead: 'LEAD',
    contact: 'CONTACT',
    organization: 'ORGANIZATION',
    opportunity: 'OPPORTUNITY',
  }
  return map[entityType]
}

function getEmails(context: LaravelContext, entityType: ActivityEntityType, entityId: string) {
  switch (entityType) {
    case 'lead': return crmService.getLeadEmails(context, entityId)
    case 'contact': return crmService.getContactEmails(context, entityId)
    case 'organization': return crmService.getOrganizationEmails(context, entityId)
    case 'opportunity': return crmService.getOpportunityEmails(context, entityId)
  }
}

function eventIcon(title: string) {
  const t = title.toLowerCase()
  if (t.includes('call') || t.includes('phone')) return Phone
  if (t.includes('task') || t.includes('follow')) return CheckSquare
  return Calendar
}

function formatDate(raw: string | null): string {
  if (!raw) return ''
  const d = new Date(raw.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function eventStatusVariant(status?: string | null): string {
  if (status === 'Held') return 'bg-success/15 text-success'
  if (status === 'Cancelled') return 'bg-destructive/15 text-destructive'
  return 'bg-muted text-muted-foreground'
}

function toItems(events: CalendarEvent[], emails: CrmEmailLinkEntry[]): TimelineItem[] {
  const fromEvents: TimelineItem[] = events.map((e) => ({
    id: `ev-${e.id}`,
    kind: 'event' as const,
    title: e.title,
    subLabel: e.location ?? null,
    date: e.start_at,
    status: e.status,
  }))

  const fromEmails: TimelineItem[] = emails.map((e) => ({
    id: `em-${e.id}`,
    kind: 'email' as const,
    title: e.subject,
    subLabel: e.createdByName ?? null,
    date: e.sentAt ?? e.createdAt,
    status: e.status,
    isInbound: e.direction === 'inbound' || e.status === 'Received',
  }))

  return [...fromEvents, ...fromEmails].sort((a, b) => {
    const ta = a.date ? new Date(a.date.replace(' ', 'T')).getTime() : 0
    const tb = b.date ? new Date(b.date.replace(' ', 'T')).getTime() : 0
    return tb - ta
  })
}

export function CrmActivityTimeline({ entityType, entityId, context }: Props) {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [eventsRes, emailsRes] = await Promise.all([
        taskService.getLinkedCalendarEvents(context, toLinkedType(entityType), entityId),
        getEmails(context, entityType, entityId),
      ])
      setItems(toItems(eventsRes.data.entries, emailsRes.data))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load activity.')
    } finally {
      setLoading(false)
    }
  }, [context, entityType, entityId])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const linkedType = toLinkedType(entityType)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Activity Timeline</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Calendar className="mr-1.5 size-4" aria-hidden="true" />
          Schedule
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="mt-0.5 size-8 shrink-0 rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-2/3 rounded bg-muted" />
                <div className="h-3 w-1/3 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <EmptyState
          icon={<CalendarClock className="size-8" aria-hidden="true" />}
          title="No activity yet"
          description="Schedule a call, meeting, or follow-up, or send an email to start the timeline."
          action={(
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Calendar className="mr-1.5 size-4" aria-hidden="true" />
              Schedule
            </Button>
          )}
        />
      )}

      {!loading && items.length > 0 && (
        <div className="relative space-y-0">
          {/* Vertical line */}
          <div className="absolute left-3.5 top-4 bottom-4 w-px bg-border" aria-hidden="true" />

          {items.map((item) => {
            const Icon = item.kind === 'email' ? Mail : eventIcon(item.title)
            return (
              <div key={item.id} className="relative flex items-start gap-3 py-3">
                <span
                  className={cn(
                    'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-border',
                    item.kind === 'email'
                      ? (item.isInbound ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')
                      : 'bg-card text-muted-foreground',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                    {item.kind === 'email' && (
                      <Badge variant="outline" className="text-[10px]">
                        {item.isInbound ? 'Inbound' : 'Email'}
                      </Badge>
                    )}
                    {item.kind === 'event' && item.status && (
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', eventStatusVariant(item.status))}>
                        {item.status}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    {item.subLabel && <span>{item.subLabel}</span>}
                    {item.subLabel && item.date && <span>·</span>}
                    {item.date && <span>{formatDate(item.date)}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CreateEventModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); void load() }}
        initialLink={{ type: linkedType, id: entityId, label: entityType }}
      />
    </div>
  )
}
