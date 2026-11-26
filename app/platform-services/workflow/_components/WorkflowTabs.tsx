'use client'

/**
 * The tabs of the Workflows page: Automations, Approvals and Runs, with the tab kept in the address (`?tab=`) so a link opens the same tab and Back works.
 *
 * WHICH TABS EXIST depends on the module (lib/platform/workflow-tabs.ts): Sales & Marketing and the central view carry all three, every other module only Approvals,
 * with no tab bar, as the page was before the merge. The panels come in from the page as elements, so this file knows nothing about what is inside them, and a panel's
 * data is read only when its tab is open (`TabPanel` builds its content only while it is the active one).
 *
 * Needs a Suspense boundary above it, like anything that reads the address.
 */

import type { ReactNode } from 'react'

import { PageTabs, TabPanel, useUrlTab } from '@/components/shared/scaffolds'
import type { DecentralizedModuleKey } from '@/lib/platform/access-links'
import { workflowTabRules, type WorkflowTabId } from '@/lib/platform/workflow-tabs'

const ID_PREFIX = 'workflow'

export function WorkflowTabs({ moduleKey, panels }: { moduleKey: DecentralizedModuleKey | null; panels: Record<WorkflowTabId, ReactNode> }) {
  const rules = workflowTabRules(moduleKey)
  const [active, setActive] = useUrlTab(rules.ids)

  if (!rules.showTabBar) return <>{panels.approvals}</>

  return (
    <div className="space-y-5">
      <PageTabs tabs={rules.tabs} active={active} onChange={(id) => setActive(id)} label="Workflow sections" idPrefix={ID_PREFIX} />
      {rules.tabs.map((tab) => (
        <TabPanel key={tab.id} id={tab.id} active={active} idPrefix={ID_PREFIX}>
          {panels[tab.id]}
        </TabPanel>
      ))}
    </div>
  )
}
