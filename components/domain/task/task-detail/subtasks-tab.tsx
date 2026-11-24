'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { taskService } from '@/services/task'
import { getLaravelContext } from '@/lib/laravel-context'
import type { TaskSubtask } from '@/types/task-management'

/**
 * A task's checklist. Anyone who can see the task can tick an item (the
 * endpoint only checks the tenant), and adding or removing items is offered to
 * the people who can manage the task.
 *
 * The list lives in the panel, not here, so the tab can show its count before it
 * is opened; this component only edits it.
 */
export function SubtasksTab({ taskId, subtasks, loading, canManage, onChange, onTouched }: {
  taskId: string
  subtasks: TaskSubtask[]
  loading: boolean
  canManage: boolean
  onChange: (next: TaskSubtask[]) => void
  /** Called after any change, so the history can pick it up. */
  onTouched: () => void
}) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function reload() {
    const response = await taskService.getTaskSubtasks(getLaravelContext(), taskId)
    onChange(response.data.subtasks)
    onTouched()
  }

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key); setError('')
    try { await action(); await reload() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'That did not save.') }
    finally { setBusy(null) }
  }

  const done = subtasks.filter((subtask) => subtask.is_done).length

  return (
    <div className="space-y-3 pt-3">
      {subtasks.length > 0 && (
        <div className="flex items-center gap-3" aria-label={`${done} of ${subtasks.length} done`}>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round((done / subtasks.length) * 100)}%` }} />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">{done}/{subtasks.length}</span>
        </div>
      )}

      {loading && <div className="flex h-16 items-center justify-center"><Spinner /></div>}
      {!loading && subtasks.length === 0 && (
        <p className="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">
          No subtasks yet.{canManage ? ' Add the first step below.' : ''}
        </p>
      )}

      <ul className="space-y-1">
        {subtasks.map((subtask) => (
          <li key={subtask.id} className="group flex min-h-8 items-center gap-2 rounded-lg px-1 hover:bg-accent/50">
            <input
              type="checkbox"
              checked={subtask.is_done}
              disabled={busy !== null}
              onChange={() => void run(`t-${subtask.id}`, () => taskService.toggleTaskSubtask(getLaravelContext(), taskId, subtask.id))}
              aria-label={subtask.title}
              className="size-4 shrink-0"
            />
            <span className={cn('min-w-0 flex-1 break-words text-sm', subtask.is_done && 'text-muted-foreground line-through')}>{subtask.title}</span>
            {canManage && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run(`d-${subtask.id}`, () => taskService.deleteTaskSubtask(getLaravelContext(), taskId, subtask.id))}
                aria-label={`Remove ${subtask.title}`}
                className="rounded-md p-1.5 text-muted-foreground opacity-60 outline-none hover:bg-accent hover:text-destructive hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const next = title.trim()
            if (!next) return
            void run('add', () => taskService.addTaskSubtask(getLaravelContext(), taskId, next)).then(() => setTitle(''))
          }}
        >
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={255}
            placeholder="Add a step"
            aria-label="New subtask"
            className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" variant="outline" size="sm" className="h-9" disabled={!title.trim() || busy !== null}>
            {busy === 'add' ? <Spinner className="size-4" /> : <Plus className="size-4" aria-hidden="true" />}Add
          </Button>
        </form>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
