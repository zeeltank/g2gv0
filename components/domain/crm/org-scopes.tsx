'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { PageTabs, tabButtonId, tabPanelId, TabPanel } from '@/components/shared/scaffolds/page-tabs'
import { useUrlTab } from '@/components/shared/scaffolds/use-url-tab'
import { isLaravelContextReady, type LaravelContext } from '@/lib/laravel-context'
import type { OrgLinks } from '@/lib/org-accounts/links'
import { scopeCounts, scopeTabs, SCOPE_IDS, SCOPE_PARAM } from '@/lib/org-accounts/scope-model'
import type { FactsApi } from '@/services/facts/api-types'
import { factsService } from '@/services/facts/facts-service'
import type { OrgAccountsApi } from '@/services/org-accounts/api-types'
import { orgAccountsService } from '@/services/org-accounts/org-accounts-service'
import { FactSuggestions } from './fact-suggestions'
import { OrgDiscoveredPanel } from './org-account-discovered'
import { OrgDuplicatesPanel } from './org-account-duplicates'
import { NoticeBar } from './org-account-parts'
import { useOrgScopes } from './use-org-scopes'

export const SCOPE_PREFIX = 'org-scope'

/**
 * The scope switch of the Organizations list: Companies (the CRM list, passed in as `children` and left exactly as it was), Discovered (organisations found in Signals or
 * GTM that are not in the CRM yet), Possible duplicates, and, for a person who holds the contacts view right, All people (`people`, the people of every company) and
 * Suggestions (the facts an agent or a source suggested, which were a scope of the old Contacts list). The open scope is `?scope=` in the address; the first (`crm`) is the
 * default and keeps the plain address. The counts, the rights and the duplicates come from /api/org-accounts and a failure there never touches the CRM list: the switch then
 * shows no counts and the other scopes say what went wrong. A person without `people` who opens `?scope=people` lands on Companies. `service`, `links` and `factsApi` are for
 * tests; the screen passes its own.
 */
export function OrgScopes({ context, service = orgAccountsService, links, children, people, peopleCount = null, factsApi = factsService }: {
  context: LaravelContext
  service?: OrgAccountsApi
  links: OrgLinks
  /** The CRM scope: today's list. */
  children: ReactNode
  /** The All people scope. Given only to a person who holds the contacts view right; without it neither All people nor Suggestions is offered. */
  people?: ReactNode
  /** How many people there are, for the tab; null until known. */
  peopleCount?: number | null
  factsApi?: FactsApi
}) {
  const [scope, setScope] = useUrlTab(SCOPE_IDS, SCOPE_PARAM)
  const scopes = useOrgScopes(service, context)
  const { ensureSuggestions } = scopes
  useEffect(() => {
    if (scope === 'duplicates') ensureSuggestions()
  }, [scope, ensureSuggestions])

  const offersPeople = people !== undefined
  const [waiting, setWaiting] = useState<number | null>(null)
  const readWaiting = useCallback(async () => {
    if (!offersPeople || !isLaravelContextReady(context)) return
    try {
      const response = await factsApi.queue({ status: 'proposed', page: 1, per_page: 1 })
      setWaiting(response.data.pagination.total)
    } catch {
      // The tab shows no count and the Suggestions scope says why when it is opened; the lists are unaffected.
    }
  }, [offersPeople, context, factsApi])
  useEffect(() => {
    queueMicrotask(() => { void readWaiting() })
  }, [readWaiting])

  const shown = !offersPeople && (scope === 'people' || scope === 'suggestions') ? 'crm' : scope
  const open = shown === 'crm'
  const counts = { ...scopeCounts(scopes.summary, scopes.liveDuplicates), ...(offersPeople ? { people: peopleCount, suggestions: waiting } : {}) }
  return (
    <>
      <PageTabs tabs={scopeTabs(counts)} active={shown} onChange={setScope} label="Organization lists" idPrefix={SCOPE_PREFIX} />

      {/* The CRM panel spaces its children the way the page does, so the list looks exactly as it did before the switch existed. */}
      <div role="tabpanel" id={tabPanelId(SCOPE_PREFIX, 'crm')} aria-labelledby={tabButtonId(SCOPE_PREFIX, 'crm')} hidden={!open} className="space-y-4">
        {open ? children : null}
      </div>

      <TabPanel id="discovered" active={shown} idPrefix={SCOPE_PREFIX}>
        <OrgDiscoveredPanel context={context} service={service} links={links} canCreate={scopes.can.createCrm} onChanged={() => void scopes.refreshSummary()} />
      </TabPanel>

      <TabPanel id="duplicates" active={shown} idPrefix={SCOPE_PREFIX}>
        <div className="space-y-3">
          {scopes.notice && <NoticeBar notice={scopes.notice} onDismiss={() => scopes.setNotice(null)} />}
          <OrgDuplicatesPanel
            suggestions={scopes.suggestions}
            error={scopes.suggestionsError}
            hidden={scopes.hidden}
            canConfirm={scopes.can.confirmLinks}
            busy={scopes.busy}
            failure={scopes.failure}
            onRetry={scopes.retrySuggestions}
            onDecide={scopes.decide}
          />
        </div>
      </TabPanel>

      {offersPeople && (
        <>
          {/* Like the CRM panel, All people spaces its children the way the page does. */}
          <div role="tabpanel" id={tabPanelId(SCOPE_PREFIX, 'people')} aria-labelledby={tabButtonId(SCOPE_PREFIX, 'people')} hidden={shown !== 'people'} className="space-y-4">
            {shown === 'people' ? people : null}
          </div>

          <TabPanel id="suggestions" active={shown} idPrefix={SCOPE_PREFIX}>
            <FactSuggestions service={factsApi} onChanged={() => { void readWaiting() }} />
          </TabPanel>
        </>
      )}
    </>
  )
}
