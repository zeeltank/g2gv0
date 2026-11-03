'use client'

import { ListPage } from '@/components/shared/scaffolds/list-page'
import { PageTabs, TabPanel, type PageTab } from '@/components/shared/scaffolds/page-tabs'
import { useUrlTab } from '@/components/shared/scaffolds/use-url-tab'
import { SignalReviewList } from './signal-review-list'
import { SignalRunsPanel } from './signal-runs-panel'

// Defined once, outside the component: useUrlTab depends on the ids. The first is the default and keeps the plain address.
const TAB_IDS = ['signals', 'runs'] as const
const TABS: PageTab[] = [
  { id: 'signals', label: 'Signals' },
  { id: 'runs', label: 'Runs' },
]
const ID_PREFIX = 'signal-review'

/**
 * Signal Review (Sales & Marketing › Signals › Signal Review): the signals worth a look, with the evidence behind each, and a place to decide on them
 * and keep the reason. The Runs tab shows what each research run did and cost. The open tab is kept in the address (?tab=runs).
 */
export function SignalReviewView() {
  const [tab, setTab] = useUrlTab(TAB_IDS)

  return (
    <ListPage
      title="Signal Review"
      description="See why each signal is here, decide what to do with it, and keep the reason."
      toolbar={<div className="w-full"><PageTabs tabs={TABS} active={tab} onChange={setTab} label="Signal Review sections" idPrefix={ID_PREFIX} /></div>}
      status="ready"
    >
      <TabPanel id="signals" active={tab} idPrefix={ID_PREFIX}><SignalReviewList /></TabPanel>
      <TabPanel id="runs" active={tab} idPrefix={ID_PREFIX}><SignalRunsPanel /></TabPanel>
    </ListPage>
  )
}
