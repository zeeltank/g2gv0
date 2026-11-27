/**
 * The tabs of the Workflows page and the addresses that lead to them.
 *
 * Pure and dependency-free (type-only imports) so the rules can be tested without a browser, and so a Next page file does not have to export them: a
 * `page.tsx` may export only its default component.
 *
 * THE RULES (contract WORKFLOWS-MERGE.md, "The shape of the page"):
 *   - Sales & Marketing (`crm`) and the central view (no module) show three tabs: Automations, Approvals, Runs. The first tab named in `ids` is the one a plain
 *     address opens: Automations for `crm`, Approvals for the central view.
 *   - Every OTHER module shows Approvals only, with no tab bar, exactly as the page did before the merge.
 * Automations and Runs read the tenant's GTM engine, which has no split by module, so only the two views above carry them.
 */

import type { DecentralizedModuleKey } from './access-links'

export type WorkflowTabId = 'automations' | 'approvals' | 'runs'

export interface WorkflowTab {
  id: WorkflowTabId
  label: string
}

/** The tabs in the order they are drawn: the same for every view that has more than one. */
export const WORKFLOW_TABS: readonly WorkflowTab[] = [
  { id: 'automations', label: 'Automations' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'runs', label: 'Runs' },
]

/**
 * Module-level constants, because `useUrlTab` takes its list as a dependency: the FIRST id is the tab a plain address opens, the order is not the drawing order.
 */
export const CRM_TAB_IDS: readonly WorkflowTabId[] = ['automations', 'approvals', 'runs']
export const CENTRAL_TAB_IDS: readonly WorkflowTabId[] = ['approvals', 'automations', 'runs']
export const APPROVALS_ONLY_TAB_IDS: readonly WorkflowTabId[] = ['approvals']

export interface WorkflowTabRules {
  /** What `useUrlTab` accepts; the first one is the default. */
  ids: readonly WorkflowTabId[]
  /** The tabs to draw, in drawing order. */
  tabs: readonly WorkflowTab[]
  defaultTab: WorkflowTabId
  /** False when only Approvals exists: then there is nothing to switch between and no bar is drawn. */
  showTabBar: boolean
}

export function workflowTabRules(moduleKey: DecentralizedModuleKey | null): WorkflowTabRules {
  if (moduleKey === null || moduleKey === 'crm') {
    const ids = moduleKey === 'crm' ? CRM_TAB_IDS : CENTRAL_TAB_IDS
    return { ids, tabs: WORKFLOW_TABS, defaultTab: ids[0], showTabBar: true }
  }

  return {
    ids: APPROVALS_ONLY_TAB_IDS,
    tabs: WORKFLOW_TABS.filter((tab) => tab.id === 'approvals'),
    defaultTab: 'approvals',
    showTabBar: false,
  }
}

export const WORKFLOW_PAGE_PATH = '/platform-services/workflow'

/** An address of the page: the module and, when it is not the one a plain address opens, the tab. Both are always written, so a link reads the same everywhere. */
export function workflowHref(moduleKey: DecentralizedModuleKey | null, tab?: WorkflowTabId): string {
  const params = new URLSearchParams()
  if (moduleKey) params.set('module', moduleKey)
  if (tab) params.set('tab', tab)
  const query = params.toString()

  return query ? `${WORKFLOW_PAGE_PATH}?${query}` : WORKFLOW_PAGE_PATH
}

/**
 * Where the two retired addresses land: the old GTM Workflows page (`/gtm/workflows`) and the old Automation Rules page of Sales & Marketing (a redirect page under
 * app/module/crm/marketing). Both were about automations.
 */
export const AUTOMATIONS_HREF = workflowHref('crm', 'automations')
