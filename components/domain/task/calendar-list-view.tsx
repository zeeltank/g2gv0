'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, CircleDot, Flag, ListTodo } from 'lucide-react'
import type { CalendarEntry, CalendarFeed, WorkspaceTask } from '@/types/task-management'
import { localDate, localDateTime, taskSpan } from './calendar-event-mapping'

interface Row {
  id: string
  kind: 'TASK' | 'EVENT' | 'MILESTONE' | 'CHECKPOINT'
  title: string
  date: string
  dateLabel: string
  timeLabel: string
  status: string
  person: string
}

const KIND_ICON = { TASK: ListTodo, EVENT: CalendarClock, MILESTONE: Flag, CHECKPOINT: CircleDot } as const
const KIND_LABEL = { TASK: 'Task', EVENT: 'Event', MILESTONE: 'Milestone', CHECKPOINT: 'Checkpoint' } as const

type SortKey = 'date' | 'kind' | 'title' | 'status' | 'person'

interface Props {
  tasks: WorkspaceTask[]
  entries: CalendarEntry[]
  feeds: CalendarFeed[]
  onTaskClick: (taskId: string) => void
  onEventClick: (eventId: string) => void
}

/**
 * A flat, sortable alternative to the grid - the same tasks/entries already
 * fetched for Month/Week/Day, just laid out as rows. No new backend call.
 */
export function CalendarListView({ tasks, entries, feeds, onTaskClick, onEventClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const nameByUserId = useMemo(() => {
    const map = new Map<string, string>()
    feeds.forEach((feed) => map.set(feed.user_id, feed.name))
    return map
  }, [feeds])

  const rows = useMemo<Row[]>(() => {
    const taskRows: Row[] = tasks.map((task): Row => {
      const span = taskSpan(task)
      const date = span ? format(span.end, 'yyyy-MM-dd') : ''
      return {
        id: task.id, kind: 'TASK', title: task.title,
        date, dateLabel: date ? format(span!.end, 'd MMM yyyy') : '—',
        timeLabel: 'All day', status: task.status_label || task.status,
        person: task.assignee || 'Unassigned',
      }
    }).filter((row) => row.date !== '')

    const entryRows: Row[] = entries.map((entry): Row => {
      const isTimedEvent = entry.kind === 'EVENT' && !entry.all_day
      const start = isTimedEvent ? localDateTime(entry.start) : localDate(entry.start.slice(0, 10))
      return {
        id: entry.id, kind: entry.kind, title: entry.title,
        date: format(start, 'yyyy-MM-dd'), dateLabel: format(start, 'd MMM yyyy'),
        timeLabel: isTimedEvent ? format(start, 'h:mm a') : 'All day',
        status: entry.status,
        person: entry.owner_id ? (nameByUserId.get(entry.owner_id) || '—') : '—',
      }
    })

    const all = [...taskRows, ...entryRows]
    const dir = sortDir === 'asc' ? 1 : -1
    return all.sort((a, b) => {
      if (sortKey === 'kind') return dir * KIND_LABEL[a.kind].localeCompare(KIND_LABEL[b.kind])
      return dir * String(a[sortKey]).localeCompare(String(b[sortKey]))
    })
  }, [tasks, entries, nameByUserId, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (column !== sortKey) return <ArrowUpDown className="size-3 opacity-40" />
    return sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
  }

  const headerButton = (key: SortKey, label: string) => (
    <button type="button" onClick={() => toggleSort(key)} className="flex items-center gap-1 text-left font-medium hover:text-foreground">
      {label}<SortIcon column={key} />
    </button>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-3">Kind</th>
            <th className="p-3">{headerButton('title', 'Title')}</th>
            <th className="p-3">{headerButton('date', 'Date')}</th>
            <th className="p-3">Time</th>
            <th className="p-3">{headerButton('status', 'Status')}</th>
            <th className="p-3">{headerButton('person', 'Assignee / Owner')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const Icon = KIND_ICON[row.kind]
            const clickable = row.kind === 'TASK' || row.kind === 'EVENT'
            return (
              <tr
                key={`${row.kind}-${row.id}`}
                onClick={clickable ? () => (row.kind === 'TASK' ? onTaskClick(row.id) : onEventClick(row.id)) : undefined}
                className={`border-b last:border-0 ${clickable ? 'cursor-pointer hover:bg-muted/30' : ''}`}
              >
                <td className="p-3"><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="size-3.5" />{KIND_LABEL[row.kind]}</span></td>
                <td className="p-3 font-medium">{row.title}</td>
                <td className="p-3 text-muted-foreground">{row.dateLabel}</td>
                <td className="p-3 text-muted-foreground">{row.timeLabel}</td>
                <td className="p-3 text-muted-foreground">{row.status}</td>
                <td className="p-3 text-muted-foreground">{row.person}</td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">Nothing scheduled in this range.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
