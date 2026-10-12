'use client'

/**
 * A campaign's target-management UI - the one piece of this module with no
 * existing precedent to copy. Three sub-tabs (Leads / Contacts / Organizations),
 * each with two ways to bulk-add every matching record in one action
 * (crmService.bulkAddCampaignTargets) rather than a one-at-a-time picker -
 * campaign targeting is usually "everyone whose company starts with Acme",
 * not a single record, so bulk actions are the only ones built here: a
 * free-text search, or a saved view (the same ones built for that module's
 * own list screen - its stored search term becomes the filter here too).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CampaignTarget, CrmSavedView } from '@/types/crm'

type TargetKind = 'leads' | 'contacts' | 'organizations'

const TABS: Array<{ id: TargetKind; label: string; singular: 'lead' | 'contact' | 'organization' }> = [
  { id: 'leads', label: 'Leads', singular: 'lead' },
  { id: 'contacts', label: 'Contacts', singular: 'contact' },
  { id: 'organizations', label: 'Organizations', singular: 'organization' },
]

const RESPONSE_STATUS_OPTIONS = [
  { label: 'None', value: 'none' },
  { label: 'Contacted - Successful', value: 'contacted_successful' },
  { label: 'Contacted - Unsuccessful', value: 'contacted_unsuccessful' },
  { label: 'Contacted - Never Contact Again', value: 'contacted_never_again' },
]

function statusDotClass(status: string): string {
  if (status === 'contacted_successful') return 'bg-success'
  if (status === 'contacted_unsuccessful' || status === 'contacted_never_again') return 'bg-destructive'
  return 'bg-muted-foreground/40'
}

const EMPTY_TARGETS: Record<TargetKind, CampaignTarget[]> = { leads: [], contacts: [], organizations: [] }

export function CampaignTargetManager({ campaignId }: { campaignId: string }) {
  const context = useMemo(() => getLaravelContext(), [])

  const [tab, setTab] = useState<TargetKind>('leads')
  const [targets, setTargets] = useState<Record<TargetKind, CampaignTarget[]>>(EMPTY_TARGETS)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [busyRowId, setBusyRowId] = useState<string | null>(null)
  const [savedViews, setSavedViews] = useState<CrmSavedView[]>([])
  const [selectedViewId, setSelectedViewId] = useState('')
  const [addingFromView, setAddingFromView] = useState(false)

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getCampaignTargets(context, campaignId)
      setTargets(response.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load campaign targets.')
    } finally {
      setIsLoading(false)
    }
  }, [context, campaignId])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0]
  const rows = targets[tab]

  const loadSavedViews = useCallback(async () => {
    if (!isLaravelContextReady(context)) return
    try {
      const response = await crmService.getSavedViews(context, activeTab.id)
      setSavedViews(response.data)
    } catch {
      /* the search box still works with an empty saved-views list */
    }
  }, [context, activeTab.id])

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedViewId('')
      void loadSavedViews()
    })
  }, [loadSavedViews])

  const addMatching = async () => {
    const query = search.trim()
    if (!query) return
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); return }
    setAdding(true)
    setError('')
    try {
      await crmService.bulkAddCampaignTargets(context, campaignId, activeTab.singular, { search: query })
      setSearch('')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add matching records.')
    } finally {
      setAdding(false)
    }
  }

  const addFromSavedView = async () => {
    if (!selectedViewId) return
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); return }
    setAddingFromView(true)
    setError('')
    try {
      await crmService.bulkAddCampaignTargets(context, campaignId, activeTab.singular, { savedViewId: selectedViewId })
      setSelectedViewId('')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add from that saved view.')
    } finally {
      setAddingFromView(false)
    }
  }

  const removeRow = async (targetRowId: string) => {
    if (!isLaravelContextReady(context)) return
    setBusyRowId(targetRowId)
    setError('')
    try {
      await crmService.removeCampaignTarget(context, campaignId, targetRowId)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to remove that target.')
    } finally {
      setBusyRowId(null)
    }
  }

  const updateStatus = async (targetRowId: string, responseStatus: string) => {
    if (!isLaravelContextReady(context)) return
    setBusyRowId(targetRowId)
    setError('')
    try {
      await crmService.updateCampaignTargetStatus(context, campaignId, targetRowId, responseStatus)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update that status.')
    } finally {
      setBusyRowId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setSearch('') }}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label} <span className="text-xs text-muted-foreground">({targets[t.id].length})</span>
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void addMatching() }}
            placeholder={`Search ${activeTab.label.toLowerCase()} to add…`}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" disabled={adding || !search.trim()} onClick={() => void addMatching()}>
          {adding ? 'Adding…' : `Add all matching “${search.trim()}”`}
        </Button>
      </div>

      {savedViews.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedViewId}
            onChange={setSelectedViewId}
            options={savedViews.map((view) => ({ label: view.name, value: view.id }))}
            placeholder="Add from a saved view…"
            className="w-64"
            aria-label="Saved view to add from"
          />
          <Button variant="outline" size="sm" disabled={addingFromView || !selectedViewId} onClick={() => void addFromSavedView()}>
            {addingFromView ? 'Adding…' : 'Add all matching that view'}
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading {activeTab.label.toLowerCase()}…
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <p className="py-6 text-sm text-muted-foreground">No {activeTab.label.toLowerCase()} targeted yet.</p>
      )}

      {!isLoading && rows.length > 0 && (
        <div className="divide-y divide-border rounded-lg border border-border">
          {rows.map((row) => (
            <div key={row.targetRowId} className="flex items-center gap-3 p-3">
              <span className={cn('size-2 shrink-0 rounded-full', statusDotClass(row.responseStatus))} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                {row.subLabel && <p className="truncate text-xs text-muted-foreground">{row.subLabel}</p>}
              </div>
              <Select
                value={row.responseStatus || 'none'}
                onChange={(value) => void updateStatus(row.targetRowId, value)}
                options={RESPONSE_STATUS_OPTIONS}
                disabled={busyRowId === row.targetRowId}
                className="w-56 shrink-0"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={busyRowId === row.targetRowId}
                onClick={() => void removeRow(row.targetRowId)}
                aria-label={`Remove ${row.name}`}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
