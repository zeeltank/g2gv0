'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bookmark, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmModule, CrmSavedView } from '@/types/crm'

interface Props {
  module: CrmModule
  /** This list view's current search/filter/sort state, saved verbatim. */
  currentConditions: Record<string, unknown>
  /** Re-applies a saved view's conditions - the caller translates the opaque object back into its own filter state setters. */
  onApply: (conditions: Record<string, unknown>) => void
}

/**
 * Shared Saved Views dropdown, reused across all 4 CRM list views. A real,
 * working version of the abandoned `crm_lists` table's idea - `conditions`
 * is opaque to this component on purpose, since each module's filter shape
 * differs (Leads has leadStatus/assignedTo, Organizations has accountType,
 * etc.); it is only ever read back by the same module that saved it.
 */
export function CrmSavedViews({ module, currentConditions, onApply }: Props) {
  const context = useMemo(() => getLaravelContext(), [])

  const [open, setOpen] = useState(false)
  const [views, setViews] = useState<CrmSavedView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) return
    setLoading(true)
    setError('')
    try {
      const response = await crmService.getSavedViews(context, module)
      setViews(response.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load saved views.')
    } finally {
      setLoading(false)
    }
  }, [context, module])

  useEffect(() => {
    if (open) queueMicrotask(() => { void load() })
  }, [open, load])

  const handleSave = async () => {
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    setError('')
    try {
      await crmService.createSavedView(context, module, name, currentConditions)
      setNewName('')
      setShowNewForm(false)
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save this view.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (view: CrmSavedView) => {
    if (!window.confirm(`Remove the saved view "${view.name}"?`)) return
    try {
      await crmService.deleteSavedView(context, view.id)
      setViews((prev) => prev.filter((v) => v.id !== view.id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to remove this view.')
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Bookmark className="mr-1.5 size-4" aria-hidden="true" />
          Views
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Saved Views</p>

          {error && <p className="text-xs text-destructive">{error}</p>}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading…
            </div>
          )}

          {!loading && views.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">No saved views yet.</p>
          )}

          {!loading && views.length > 0 && (
            <ul className="max-h-60 space-y-1 overflow-y-auto">
              {views.map((view) => (
                <li key={view.id} className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm text-foreground"
                    onClick={() => { onApply(view.conditions); setOpen(false) }}
                  >
                    {view.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${view.name}`}
                    className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                    onClick={() => void handleDelete(view)}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-border pt-3">
            {!showNewForm && (
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setShowNewForm(true)}>
                <Plus className="mr-1.5 size-4" aria-hidden="true" />
                Save current view
              </Button>
            )}

            {showNewForm && (
              <div className="flex items-center gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="View name…"
                  className="h-8"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSave() }}
                />
                <Button size="sm" disabled={!newName.trim() || saving} onClick={() => void handleSave()}>
                  {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : 'Save'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
