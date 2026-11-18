'use client'

/**
 * What a lead's full page shows once the shell is around it: loads the lead and the picklists, and draws "opening", the error, "not found" or the lead.
 *
 * It exists as its own component (it used to be inline in app/module/crm/marketing/leads/[id]/page.tsx) so a test can open the whole screen without the
 * sidebar shell, and because of one rule that is easy to break: a RE-load (after Save, Edit or Convert) must keep the lead page mounted. LeadDetailPage
 * holds the notice that tells the person what just happened ("No contact was created: ..."); unmounting it for the reload threw that notice away, so the
 * day-in-the-life run never saw it. The "opening" state is for the first load of a lead only.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import { LeadDetailPage } from '@/domain/crm/lead-detail-page'
import type { CrmPicklistValue, Lead } from '@/types/crm'

interface Props {
  id: string
  onBack: () => void
  /** Tells the route which lead is open (for its breadcrumb); null while there is none. */
  onLead?: (lead: Lead | null) => void
}

export function LeadDetailScreen({ id, onBack, onLead }: Props) {
  const context = useMemo(() => getLaravelContext(), [])

  const [lead, setLead] = useState<Lead | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [picklists, setPicklists] = useState<{
    leadStatus: CrmPicklistValue[]; leadSource: CrmPicklistValue[]
    industry: CrmPicklistValue[]; rating: CrmPicklistValue[]
  }>({ leadStatus: [], leadSource: [], industry: [], rating: [] })

  /** The id whose lead is on screen; a load for any other id is a first load and shows "Opening lead…". */
  const shownFor = useRef<string | null>(null)

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    const reload = shownFor.current === id
    if (!reload) setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getLead(context, id)
      shownFor.current = id
      setLead(response.data)
      onLead?.(response.data)
    } catch (cause) {
      // A reload that fails leaves the page (and its notice) where it is: what the person just did was saved, only the refresh did not arrive.
      if (!reload) setError(cause instanceof Error ? cause.message : 'Failed to load this lead.')
    } finally {
      setIsLoading(false)
    }
  }, [context, id, onLead])

  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => { void load() })
  }, [load])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'leads')
      .then((response) => {
        const leads = response.data.leads ?? {}
        setPicklists({
          leadStatus: leads.lead_status ?? [], leadSource: leads.lead_source ?? [],
          industry: leads.industry ?? [], rating: leads.rating ?? [],
        })
      })
      .catch(() => { /* the detail page still works with empty dropdowns */ })
  }, [context])

  return (
    <>
      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Opening lead…
        </div>
      )}

      {!isLoading && error && (
        <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-10 text-center text-sm text-destructive">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={onBack}>Back to Leads</Button>
        </div>
      )}

      {!isLoading && !error && !lead && (
        <div className="space-y-3 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <p>This lead could not be found, or you do not have access to it.</p>
          <Button variant="outline" size="sm" onClick={onBack}>Back to Leads</Button>
        </div>
      )}

      {!isLoading && !error && lead && (
        <LeadDetailPage lead={lead} onSaved={() => void load()} onBack={onBack} picklists={picklists} />
      )}
    </>
  )
}
