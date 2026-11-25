'use client'

import { Filter, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { TaskPriorityOption, WorkspaceQuick, WorkspaceSort } from '@/types/task-management'

/**
 * The Task Dashboard's toolbar pieces. They are controlled and know nothing
 * about loading: the screen owns the state and the request, so every control
 * here is just a way to set one value that goes into the URL and the query.
 */

/** What each one-click filter is called. The cards over the list reuse the same names for their pill. */
export const QUICK_LABELS: Record<WorkspaceQuick, string> = {
  mine: 'Mine',
  overdue: 'Overdue',
  due_today: 'Due today',
  due_week: 'Due this week',
  unassigned: 'Unassigned',
  blocked: 'Blocked',
  needs_review: 'Needs review',
  active: 'Active tasks',
  attention: 'Blocked or overdue',
  completed_month: 'Completed this month',
  approved_review: 'Approved',
  sent_back: 'Sent back',
}

/** The chips, in the order people reach for them. Anything not here (the card filters) is shown as a removable pill instead. */
export const QUICK_CHIPS: WorkspaceQuick[] = ['mine', 'overdue', 'due_today', 'due_week', 'unassigned', 'blocked', 'needs_review']

/**
 * One-click filters with the count each would list. One at a time: picking a
 * second replaces the first, and picking the active one clears it. A count
 * is shown only when the server sent one, so a chip never promises a number it
 * does not have.
 */
export function QuickChips({ active, counts, onChange }: {
  active: WorkspaceQuick | null
  counts: Partial<Record<WorkspaceQuick, number>>
  onChange: (next: WorkspaceQuick | null) => void
}) {
  return (
    <div role="group" aria-label="Quick filters" className="flex flex-wrap items-center gap-2">
      {QUICK_CHIPS.map((key) => {
        const on = active === key
        const count = counts[key]
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? null : key)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              on ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background text-foreground hover:bg-accent',
            )}
          >
            {QUICK_LABELS[key]}
            {count !== undefined && (
              <span className={cn('tabular-nums', on ? 'text-primary-foreground/80' : key === 'overdue' && count > 0 ? 'font-semibold text-red-700 dark:text-red-300' : 'text-muted-foreground')}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export interface DashboardFilters {
  priority: string
  assigneeId: string
  from: string
  to: string
}

export const NO_FILTERS: DashboardFilters = { priority: '', assigneeId: '', from: '', to: '' }

const FIELD = 'h-9 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * The filters the API has always accepted and the screen never offered: priority,
 * assignee and a date window. They sit in a popover so the bar stays one row,
 * and the button carries how many are applied so a hidden filter is never a
 * surprise.
 */
export function FilterPopover({ filters, priorities, users, onChange }: {
  filters: DashboardFilters
  priorities: TaskPriorityOption[]
  users: Array<{ id: string; name: string }>
  onChange: (next: DashboardFilters) => void
}) {
  const applied = [filters.priority, filters.assigneeId, filters.from, filters.to].filter(Boolean).length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 rounded-xl" aria-label={applied ? `Filters, ${applied} applied` : 'Filters'}>
          <Filter className="mr-2 size-4" aria-hidden="true" />Filters
          {applied > 0 && <span className="ml-2 rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-5 text-primary-foreground">{applied}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="space-y-1">
          <label htmlFor="dash-priority" className="text-xs font-medium text-muted-foreground">Priority</label>
          <select id="dash-priority" className={FIELD} value={filters.priority} onChange={(event) => onChange({ ...filters, priority: event.target.value })}>
            <option value="">Any priority</option>
            {priorities.filter((option) => option.active).sort((a, b) => a.sort_order - b.sort_order).map((option) => (
              <option key={option.id ?? option.name} value={option.name}>{option.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="dash-assignee" className="text-xs font-medium text-muted-foreground">Assignee</label>
          <select id="dash-assignee" className={FIELD} value={filters.assigneeId} onChange={(event) => onChange({ ...filters, assigneeId: event.target.value })}>
            <option value="">Anyone</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        </div>
        <fieldset className="space-y-1">
          <legend className="text-xs font-medium text-muted-foreground">Task runs between</legend>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" aria-label="From" className={FIELD} value={filters.from} max={filters.to || undefined} onChange={(event) => onChange({ ...filters, from: event.target.value })} />
            <input type="date" aria-label="To" className={FIELD} value={filters.to} min={filters.from || undefined} onChange={(event) => onChange({ ...filters, to: event.target.value })} />
          </div>
          <p className="text-xs text-muted-foreground">A task counts if any day from its start to its due date falls in this window.</p>
        </fieldset>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" disabled={!applied} onClick={() => onChange(NO_FILTERS)}>Clear filters</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

const SORTS: Array<{ value: WorkspaceSort; label: string }> = [
  { value: 'due_desc', label: 'Due date, latest first' },
  { value: 'due_asc', label: 'Due date, soonest first' },
  { value: 'priority', label: 'Priority' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'created', label: 'Newest' },
]

export function SortSelect({ value, onChange }: { value: WorkspaceSort; onChange: (next: WorkspaceSort) => void }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as WorkspaceSort)}
      aria-label="Sort tasks"
      className="h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
}

export type DashboardLayout = 'list' | 'board'

/**
 * List or Board: how the SAME tasks are drawn. (The old strip mixed this with
 * what is shown - approvals, backlog, analytics - and called the kanban "Grid"
 * and the approvals queue "Board".) A text label on every button above 1024px;
 * below it the icon stands alone, with the name still in its accessible label.
 */
export function LayoutToggle({ value, onChange }: { value: DashboardLayout; onChange: (next: DashboardLayout) => void }) {
  return (
    <div role="group" aria-label="Layout" className="flex h-10 items-center rounded-xl border bg-muted/20 p-1">
      {([['list', List, 'List'], ['board', LayoutGrid, 'Board']] as const).map(([key, Icon, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          aria-label={`${label} layout`}
          title={`${label} layout`}
          onClick={() => onChange(key)}
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
            value === key ? 'bg-background text-primary shadow-sm ring-1 ring-primary/10' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="size-4" aria-hidden="true" /><span className="hidden lg:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}
