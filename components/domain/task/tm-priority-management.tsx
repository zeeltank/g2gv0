'use client'

/**
 * Administration > Priority Management — real CRUD.
 *
 * System priorities (High / Medium / Low) are constants; custom levels are
 * created, renamed, ordered (lower sorts first) and deactivated here against
 * task_management_priorities. Every task write validates against this set, so
 * a new level is usable in the create form immediately. Deactivation, not
 * deletion: tasks already using the name keep it for display.
 */

import { useCallback, useEffect, useState } from 'react'
import { Lock, Pencil, Plus, Settings2, ShieldAlert, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { taskService } from '@/services/task'
import { PriorityBadge } from './priority-badge'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import type { TaskPriorityOption } from '@/types/task-management'

export function TmPriorityManagement() {
  const [priorities, setPriorities] = useState<TaskPriorityOption[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slaHours, setSlaHours] = useState('')

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
      const response = await taskService.getPriorityOptions(context)
      setPriorities(response.data.priorities)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load priorities.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => { void load() })
  }, [load])

  const startEdit = (option: TaskPriorityOption) => {
    setEditingId(option.id)
    setName(option.name)
    setSlaHours(option.sla_hours !== null ? String(option.sla_hours) : '')
    setMessage('')
  }

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setSlaHours('')
  }

  const save = async () => {
    if (!name.trim()) { setError('A priority name is required.'); return }
    const context = getLaravelContext()
    setBusy(true); setError(''); setMessage('')
    try {
      const payload = {
        name: name.trim(),
        ...(slaHours.trim() ? { sla_hours: Number(slaHours) } : {}),
      }
      const response = editingId
        ? await taskService.updatePriorityOption(context, editingId, payload)
        : await taskService.createPriorityOption(context, payload)
      setMessage(response.message)
      resetForm()
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save the priority.')
    } finally {
      setBusy(false)
    }
  }

  const deactivate = async (option: TaskPriorityOption) => {
    if (!option.id || !window.confirm(`Deactivate "${option.name}"? Tasks already using it keep it for display.`)) return
    const context = getLaravelContext()
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await taskService.deletePriorityOption(context, option.id)
      setMessage(response.message)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to deactivate the priority.')
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
          Priority Management
        </h1>
        <p className="text-sm text-muted-foreground">
          System levels are fixed; custom levels are validated on every task write the moment they exist.
          SLA hours are informational for now.
        </p>
      </div>

      {error && <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</div>}
      {message && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{message}</div>}

      {/* Add / edit */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-primary/10 bg-card/60 p-4">
        <label className="min-w-52 flex-1">
          <span className="mb-1 block text-xs font-semibold">{editingId ? 'Rename priority' : 'New priority name'}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Critical"
            className="h-10 w-full rounded-lg border px-3 text-sm"
          />
        </label>
        <label className="min-w-40">
          <span className="mb-1 block text-xs font-semibold">SLA hours (optional)</span>
          <input
            type="number"
            min={1}
            value={slaHours}
            onChange={(event) => setSlaHours(event.target.value)}
            placeholder="e.g. 24"
            className="h-10 w-full rounded-lg border px-3 text-sm"
          />
        </label>
        <Button onClick={() => void save()} disabled={busy || !name.trim()}>
          {editingId ? <Pencil className="mr-2 size-4" /> : <Plus className="mr-2 size-4" />}
          {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add Priority'}
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
          {priorities.map((option, index) => (
            <div
              key={option.id ?? option.name}
              className={cn(
                'flex flex-wrap items-center gap-4 p-5 transition-colors hover:bg-primary/5',
                index > 0 && 'border-t border-primary/5',
                !option.active && 'opacity-50',
              )}
            >
              <ShieldAlert className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-28">
                <PriorityBadge priority={option.name} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">
                  {option.name}
                  {!option.active && <span className="ml-2 text-xs font-medium text-muted-foreground">(inactive)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {option.sla_hours !== null ? `SLA ${option.sla_hours}h` : 'No SLA'}
                </p>
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
