'use client'

import { useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { taskService } from '@/services/task'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import type { TaskActivityItem } from '@/types/task-management'
import { relativeTime } from './date-utils'

/** What each audit event is called to a person. An unmapped slug still shows, as readable words, rather than vanishing. */
const EVENT_LABELS: Record<string, string> = {
  created: 'created the task',
  updated: 'edited the task',
  status_changed: 'changed the status',
  workspace_updated: 'edited the task',
  schedule_updated: 'changed the schedule',
  legacy_updated: 'edited the task',
  legacy_deleted: 'deleted the task',
  archived: 'archived the task',
  approved: 'approved the task',
  rejected: 'sent the task back for rework',
  deadline_extended: 'extended the deadline',
  deadline_extension_requested: 'asked for more time',
  deadline_extension_rejected: 'declined the extension',
  deadline_extension_withdrawn: 'withdrew the extension request',
  subtask_added: 'added a subtask',
  subtask_completed: 'completed a subtask',
  subtask_reopened: 'reopened a subtask',
  subtask_removed: 'removed a subtask',
}

function eventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type.replace(/_/g, ' ')
}

type Filter = 'all' | 'comments' | 'history'

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'comments', label: 'Comments' },
  { id: 'history', label: 'History' },
]

/**
 * A task's history and conversation in one feed, newest first. Comments are
 * written from the composer pinned under the panel, which bumps `version` so
 * this re-reads; nothing is typed here.
 */
export function ActivityTab({ taskId, version }: { taskId: string; version: number }) {
  const [items, setItems] = useState<TaskActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      const context = getLaravelContext()
      if (!isLaravelContextReady(context)) return
      taskService.getTaskActivity(context, taskId)
        .then((response) => { if (active) { setItems(response.data.activity); setError('') } })
        .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load the activity.') })
        .finally(() => { if (active) setLoading(false) })
    })
    return () => { active = false }
  }, [taskId, version])

  const visible = items.filter((item) => filter === 'all' || (filter === 'comments' ? item.type === 'comment' : item.type !== 'comment'))

  return (
    <div className="space-y-3 pt-3">
      <div role="group" aria-label="Show" className="inline-flex rounded-lg border p-0.5">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
            className={cn(
              'h-7 rounded-md px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring',
              filter === option.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading && <div className="flex h-24 items-center justify-center"><Spinner /></div>}
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}

      {!loading && !error && visible.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
          <MessageSquare className="size-5" aria-hidden="true" />
          {filter === 'history' ? 'No changes recorded yet.' : 'No comments yet. Write one below.'}
        </div>
      )}

      <ol className="space-y-2">
        {visible.map((item) => item.type === 'comment' ? (
          <li key={`c-${item.id}`} className="rounded-xl border bg-card p-3">
            <p className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{item.actor ?? 'Someone'}</span>
              <time dateTime={item.created_at ?? undefined}>{relativeTime(item.created_at)}</time>
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{item.content}</p>
          </li>
        ) : (
          <li key={`e-${item.id}`} className="flex flex-wrap items-baseline justify-between gap-2 px-1 text-xs text-muted-foreground">
            <span><span className="font-medium text-foreground">{item.actor ?? 'Someone'}</span> {eventLabel(item.type)}</span>
            <time dateTime={item.created_at ?? undefined}>{relativeTime(item.created_at)}</time>
          </li>
        ))}
      </ol>
    </div>
  )
}
