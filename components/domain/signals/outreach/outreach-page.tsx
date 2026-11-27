'use client'

import { useState, type ReactNode } from 'react'
import { SectionBar } from '@/components/domain/signals/signals-header'
import { PageTabs, TabPanel } from '@/components/shared/scaffolds/page-tabs'
import { useUrlTab } from '@/components/shared/scaffolds/use-url-tab'
import { INITIAL_OUTREACH_STATE, OUTREACH_VIEW_IDS, OUTREACH_VIEW_PARAM, OUTREACH_VIEWS, type OutreachListState } from '@/lib/signals/outreach-model'
import { outreachService, type OutreachApi } from '@/services/signals/outreach'
import { OutreachCompanies } from './outreach-companies'
import { OutreachPeople } from './outreach-people'
import type { MessageDeps } from './write-message-dialog'

const PREFIX = 'outreach-view'

/**
 * The Outreach tab of Market Signals: three views under one switch, like the Organizations list. Companies and All people are this folder's own screens; Messages is the
 * message queue, which is given in as `messages` because it is the older Outreach screen moved here, with its own gates and switches.
 *
 * Only the open view is built, so a view that reads data reads it when it is opened. The open view is `?view=` in the address (Companies, the first, keeps the plain address). The
 * search, chip, sort and page of each list live here, so they survive a visit to another view. The header buttons of the open list (Add company, Add person) are drawn in the
 * row under the intro line, where the Organizations list keeps its own.
 */
export function OutreachPage({ service = outreachService, messages, messageDeps }: {
  service?: OutreachApi
  /** The Messages view: the queue, the do not contact list and the SMS log. */
  messages: ReactNode
  /** For tests: stand-ins for the checks and the approval queue that the message dialog reaches outside the Outreach API for. */
  messageDeps?: MessageDeps
}) {
  const [view, setView] = useUrlTab(OUTREACH_VIEW_IDS, OUTREACH_VIEW_PARAM)
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  const companiesState = useState<OutreachListState>(INITIAL_OUTREACH_STATE)
  const peopleState = useState<OutreachListState>(INITIAL_OUTREACH_STATE)

  return (
    <div className="space-y-4">
      <SectionBar
        description="The companies your signals found and the people at them. Write to them, and turn the right ones into leads."
        actions={view === 'messages' ? undefined : <div ref={setActionsHost} className="flex flex-wrap items-center gap-2" />}
      />

      <PageTabs tabs={OUTREACH_VIEWS} active={view} onChange={setView} label="Outreach sections" idPrefix={PREFIX} />

      <TabPanel id="companies" active={view} idPrefix={PREFIX}>
        <OutreachCompanies service={service} listState={companiesState} actionsHost={actionsHost} messageDeps={messageDeps} />
      </TabPanel>
      <TabPanel id="people" active={view} idPrefix={PREFIX}>
        <OutreachPeople service={service} listState={peopleState} actionsHost={actionsHost} messageDeps={messageDeps} />
      </TabPanel>
      <TabPanel id="messages" active={view} idPrefix={PREFIX}>
        {messages}
      </TabPanel>
    </div>
  )
}
