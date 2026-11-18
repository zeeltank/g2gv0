'use client'

import { useEffect, type ReactNode } from 'react'
import { PageTabs, tabButtonId, tabPanelId, TabPanel } from '@/components/shared/scaffolds/page-tabs'
import { useUrlTab } from '@/components/shared/scaffolds/use-url-tab'
import type { LaravelContext } from '@/lib/laravel-context'
import type { OrgLinks } from '@/lib/org-accounts/links'
import { scopeCounts, scopeTabs, SCOPE_IDS, SCOPE_PARAM } from '@/lib/org-accounts/scope-model'
import type { OrgAccountsApi } from '@/services/org-accounts/api-types'
import { orgAccountsService } from '@/services/org-accounts/org-accounts-service'
import { OrgDiscoveredPanel } from './org-account-discovered'
import { OrgDuplicatesPanel } from './org-account-duplicates'
import { NoticeBar } from './org-account-parts'
import { useOrgScopes } from './use-org-scopes'

export const SCOPE_PREFIX = 'org-scope'

/**
 * The scope switch of the Organizations list: Organizations (the CRM list, passed in as `children` and left exactly as it was), Discovered (organisations
 * found in Signals or GTM that are not in the CRM yet) and Possible duplicates. The open scope is `?scope=` in the address; the first (`crm`) is the default
 * and keeps the plain address. The counts, the rights and the duplicates come from /api/org-accounts and a failure there never touches the CRM list: the
 * switch then shows no counts and the other scopes say what went wrong. `service` and `links` are for tests; the screen passes its own.
 */
export function OrgScopes({ context, service = orgAccountsService, links, children }: {
  context: LaravelContext
  service?: OrgAccountsApi
  links: OrgLinks
  /** The CRM scope: today's list. */
  children: ReactNode
}) {
  const [scope, setScope] = useUrlTab(SCOPE_IDS, SCOPE_PARAM)
  const scopes = useOrgScopes(service, context)
  const { ensureSuggestions } = scopes
  useEffect(() => {
    if (scope === 'duplicates') ensureSuggestions()
  }, [scope, ensureSuggestions])

  const open = scope === 'crm'
  return (
    <>
      <PageTabs tabs={scopeTabs(scopeCounts(scopes.summary, scopes.liveDuplicates))} active={scope} onChange={setScope} label="Organization lists" idPrefix={SCOPE_PREFIX} />

      {/* The CRM panel spaces its children the way the page does, so the list looks exactly as it did before the switch existed. */}
      <div role="tabpanel" id={tabPanelId(SCOPE_PREFIX, 'crm')} aria-labelledby={tabButtonId(SCOPE_PREFIX, 'crm')} hidden={!open} className="space-y-4">
        {open ? children : null}
      </div>

      <TabPanel id="discovered" active={scope} idPrefix={SCOPE_PREFIX}>
        <OrgDiscoveredPanel context={context} service={service} links={links} canCreate={scopes.can.createCrm} onChanged={() => void scopes.refreshSummary()} />
      </TabPanel>

      <TabPanel id="duplicates" active={scope} idPrefix={SCOPE_PREFIX}>
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
    </>
  )
}
