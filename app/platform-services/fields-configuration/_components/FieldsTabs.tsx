'use client'

/**
 * The tabs of the Field settings page: Custom fields plus the five master-data consoles of Sales & Marketing (picklist values, tax rates, lead scoring and assignment,
 * web-to-lead, SLA policies), with the tab kept in the address (`?tab=`) so a link opens the same tab and Back works.
 *
 * WHICH TABS EXIST depends on the module (lib/platform/fields-tabs.ts): Sales & Marketing carries all six, every other module and the central view only Custom fields, with
 * no tab bar, as the page was before the merge. The panels come in from the page as elements, so this file knows nothing about what is inside them, and a panel's data is
 * read only when its tab is open (`TabPanel` builds its content only while it is the active one).
 *
 * Needs a Suspense boundary above it, like anything that reads the address.
 */

import type { ReactNode } from 'react'

import { PageTabs, TabPanel, useUrlTab } from '@/components/shared/scaffolds'
import type { DecentralizedModuleKey } from '@/lib/platform/access-links'
import { fieldsTabRules, type FieldsTabId } from '@/lib/platform/fields-tabs'

const ID_PREFIX = 'fields'

export function FieldsTabs({ moduleKey, panels }: { moduleKey: DecentralizedModuleKey | null; panels: Record<FieldsTabId, ReactNode> }) {
  const rules = fieldsTabRules(moduleKey)
  const [active, setActive] = useUrlTab(rules.ids)

  if (!rules.showTabBar) return <>{panels.custom}</>

  return (
    <div className="mt-6 space-y-5">
      <PageTabs tabs={rules.tabs} active={active} onChange={(id) => setActive(id)} label="Field settings sections" idPrefix={ID_PREFIX} />
      {rules.tabs.map((tab) => (
        <TabPanel key={tab.id} id={tab.id} active={active} idPrefix={ID_PREFIX}>
          {panels[tab.id]}
        </TabPanel>
      ))}
    </div>
  )
}
