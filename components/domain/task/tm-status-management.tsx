'use client'

/**
 * Administration > Status Management — real CRUD.
 *
 * The four system statuses are the workflow engine (boards, summaries and
 * transition rules key off them) and stay read-only. A custom status is a
 * tenant-defined label mapped onto one of those categories — created, renamed,
 * re-ordered and deactivated here against task_management_statuses, and
 * accepted by every task write the moment it exists. Deactivation, not
 * deletion: tasks already carrying the label keep it for display.
 */

import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Lock, Pencil, Plus, Settings2, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { taskService } from '@/services/task'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import type { TaskStatus, TaskStatusOption } from '@/types/task-management'

/** Mirror of the server's transition matrix, shown as documentation. */
const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  'PENDING': ['IN-PROGRESS', 'ON HOLD', 'COMPLETED'],
  'IN-PROGRESS': ['ON HOLD', 'COMPLETED', 'PENDING'],
  'ON HOLD': ['PENDING', 'IN-PROGRESS', 'COMPLETED'],
  'COMPLETED': ['IN-PROGRESS'],
}

const CATEGORY_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'PENDING', label: 'Pending (to do)' },
  { value: 'IN-PROGRESS', label: 'In Progress' },
  { value: 'ON HOLD', label: 'On Hold (blocked / review)' },
  { value: 'COMPLETED', label: 'Completed (done)' },
]

export function TmStatusManagement() {
  const [statuses, setStatuses] = useState<TaskStatusOption[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // The add/edit mini-form. `editingId` null = creating.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<TaskStatus>('PENDING')

  const load = useCallback(async () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await taskService.getStatusOptions(context)
      setStatuses(response.data.statuses)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load statuses.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => { void load() })
  }, [load])

  const startEdit = (option: TaskStatusOption) => {
    setEditingId(option.id)
    setName(option.name)
    setCategory(option.category)
    setMessage('')
  }

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setCategory('PENDING')
  }

  const save = async () => {
    if (!name.trim()) { setError('A status name is required.'); return }
    const context = getLaravelContext()
    setBusy(true); setError(''); setMessage('')
    try {
      const response = editingId
        ? await taskService.updateStatusOption(context, editingId, { name: name.trim(), category })
        : await taskService.createStatusOption(context, { name: name.trim(), category })
      setMessage(response.message)
      resetForm()
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save the status.')
    } finally {
      setBusy(false)
    }
  }

  const deactivate = async (option: TaskStatusOption) => {
    if (!option.id || !window.confirm(`Deactivate "${option.name}"? Tasks already using it keep the label.`)) return
    const context = getLaravelContext()
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await taskService.deleteStatusOption(context, option.id)
      setMessage(response.message)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to deactivate the status.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="g2g-scrollbar flex h-full flex-col gap-6 overflow-y-auto p-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-primary shadow-sm">
            <Settings2 className="h-6 w-6" />
          </div>
          Status Management
        </h1>
        <p className="text-sm text-muted-foreground">
          System statuses drive the workflow; custom statuses are your organisation&apos;s labels on top of them,
          usable in every task the moment they are created.
        </p>
      </div>

      {error && <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</div>}
      {message && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{message}</div>}

      {/* Add / edit */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-primary/10 bg-card/60 p-4">
        <label className="flex-1 min-w-52">
          <span className="mb-1 block text-xs font-semibold">{editingId ? 'Rename status' : 'New status name'}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. In Review"
            className="h-10 w-full rounded-lg border px-3 text-sm"
          />
        </label>
        <label className="min-w-56">
          <span className="mb-1 block text-xs font-semibold">Behaves as</span>
          <Select value={category} onChange={(value) => setCategory(value as TaskStatus)} options={CATEGORY_OPTIONS} />
        </label>
        <Button onClick={() => void save()} disabled={busy || !name.trim()}>
          {editingId ? <Pencil className="mr-2 size-4" /> : <Plus className="mr-2 size-4" />}
          {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add Status'}
        </Button>
        {editingId && (
          <Button variant="outline" onClick={resetForm} disabled={busy}>
            <X className="mr-2 size-4" /> Cancel
          </Button>
        )}
      </div>

      {loading && <div className="flex h-40 items-center justify-center"><Spinner /></div>}

      {!loading && (
        <div className="overflow-hidden rounded-[24px] border border-primary/10 bg-card/90 shadow-xl backdrop-blur-2xl">
          {statuses.map((option, index) => (
            <div
              key={option.id ?? option.name}
              className={cn(
                'flex flex-wrap items-center gap-4 p-5 transition-colors hover:bg-primary/5',
                index > 0 && 'border-t border-primary/5',
                !option.active && 'opacity-50',
              )}
            >
              <div className="min-w-44">
                <StatusBadge status={option.is_system ? option.name : option.category} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">
                  {option.name}
                  {!option.active && <span className="ml-2 text-xs font-medium text-muted-foreground">(inactive)</span>}
                </p>
                {option.is_system ? (
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-semibold">Can move to:</span>
                    {(TRANSITIONS[option.category] ?? []).map((target) => (
                      <span key={target} className="flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" /> {target}
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Behaves as {option.category}</p>
                )}
              </div>

              {option.is_system ? (
                <span className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <Lock className="h-3 w-3" /> System
                </span>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => startEdit(option)} disabled={busy}>
                    <Pencil className="mr-1.5 size-3.5" /> Edit
                  </Button>
                  {option.active && (
                    <Button variant="outline" size="sm" className="text-danger" onClick={() => void deactivate(option)} disabled={busy}>
                      <Trash2 className="mr-1.5 size-3.5" /> Deactivate
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
