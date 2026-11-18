'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { PageTabs, tabButtonId, tabPanelId, TabPanel } from '@/components/shared/scaffolds/page-tabs'
import { useUrlTab } from '@/components/shared/scaffolds/use-url-tab'
import { CONTACT_SCOPE_IDS, CONTACT_SCOPE_PARAM, contactScopeTabs } from '@/lib/facts/scope-model'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import type { FactsApi } from '@/services/facts/api-types'
import { factsService } from '@/services/facts/facts-service'
import { FactSuggestions } from './fact-suggestions'

export const CONTACT_SCOPE_PREFIX = 'contact-scope'

/**
 * The scope switch of the Contacts list: Contacts (the list, passed in as `children` and left exactly as it was) and Suggestions (the facts an agent or a
 * source suggested, waiting for a person). The open scope is `?scope=` in the address; the first is the default and keeps the plain address. The count on
 * the Suggestions tab is read once from the queue and again after every decision, and a failure there never touches the list: the tab then shows no count
 * and the scope itself says what went wrong. `service` is for tests; the screen passes its own.
 */
export function ContactScopes({ service = factsService, children }: { service?: FactsApi; children: ReactNode }) {
  const context = useMemo(() => getLaravelContext(), [])
  const [scope, setScope] = useUrlTab(CONTACT_SCOPE_IDS, CONTACT_SCOPE_PARAM)
  const [waiting, setWaiting] = useState<number | null>(null)

  const readCount = useCallback(async () => {
    if (!isLaravelContextReady(context)) return
    try {
      const response = await service.queue({ status: 'proposed', page: 1, per_page: 1 })
      setWaiting(response.data.pagination.total)
    } catch {
      // The switch shows no count and the Suggestions scope says why when it is opened; the list is unaffected.
    }
  }, [context, service])

  useEffect(() => {
    queueMicrotask(() => { void readCount() })
  }, [readCount])

  const open = scope === 'contacts'
  return (
    <>
      <PageTabs tabs={contactScopeTabs(waiting)} active={scope} onChange={setScope} label="Contact lists" idPrefix={CONTACT_SCOPE_PREFIX} />

      {/* The Contacts panel spaces its children the way the page does, so the list looks exactly as it did before the switch existed. */}
      <div role="tabpanel" id={tabPanelId(CONTACT_SCOPE_PREFIX, 'contacts')} aria-labelledby={tabButtonId(CONTACT_SCOPE_PREFIX, 'contacts')} hidden={!open} className="space-y-4">
        {open ? children : null}
      </div>

      <TabPanel id="suggestions" active={scope} idPrefix={CONTACT_SCOPE_PREFIX}>
        <FactSuggestions service={service} onChanged={() => { void readCount() }} />
      </TabPanel>
    </>
  )
}
