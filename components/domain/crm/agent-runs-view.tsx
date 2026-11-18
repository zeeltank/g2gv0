'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { History } from 'lucide-react'
import { PageTabs, TabPanel } from '@/components/shared/scaffolds/page-tabs'
import { useUrlTab } from '@/components/shared/scaffolds/use-url-tab'
import { COUNT_PARAMS } from '@/lib/agent/queue-model'
import { AGENT_TAB_IDS, AGENT_TAB_PARAM, AGENT_TAB_PREFIX, agentTabs, autonomyAccess, effectiveTab, toAgentTab } from '@/lib/agent/tabs-model'
import { AGENT_MARK_TONE, CHIP_BASE } from '@/lib/agent/tones'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import type { AgentApi } from '@/services/agent/api-types'
import { agentService } from '@/services/agent/agent-service'
import { AgentAutonomy } from './agent-autonomy'
import { useAutonomyState } from './agent-autonomy-state'
import { AgentRunsPanel } from './agent-runs-panel'
import { AgentWaitingQueue } from './agent-waiting-queue'

/**
 * Agent Run History, with three tabs and no other entry in the sidebar (`?tab=` in the address, so a refresh and a pasted link open the same tab):
 *   Runs         - every run of an agent, as the screen has always shown it (agent-runs-panel.tsx).
 *   Waiting for you - every proposal nobody has decided, across organisations, to accept or dismiss without opening organisations one by one; the number
 *                  waiting is on the tab.
 *   Autonomy     - how much the agent may do on its own for each kind of action, and the organisation's kill switch. Administrators only: the tab is not
 *                  listed for anybody else, and a non-administrator who pastes its address lands on Runs.
 * The autonomy settings are read once here, because their answer decides whether the Autonomy tab exists, and the Waiting tab warns while the agent is
 * switched off. A server that has not got the queue or the settings yet (the route answers 404) is said so in that tab, and the other tabs keep working.
 */
export function AgentRunsView({ service = agentService }: { service?: AgentApi }) {
  const context = useMemo(() => getLaravelContext(), [])
  const [named, setUrlTab] = useUrlTab(AGENT_TAB_IDS, AGENT_TAB_PARAM)
  const urlTab = toAgentTab(named)
  const autonomy = useAutonomyState(service)
  const { load: loadAutonomy } = autonomy
  const [waiting, setWaiting] = useState<number | null>(null)
  // Only the newest answer may set the number: the first read must not put an old count back over one the list has just reported.
  const countRead = useRef(0)

  const access = autonomyAccess(autonomy.phase, autonomy.data ? autonomy.data.can.change : null)
  const tab = effectiveTab(urlTab, access)
  const tabs = agentTabs(access, urlTab, waiting)

  // A person who may not have the Autonomy tab and pasted its address: the address says what they are looking at (Runs).
  useEffect(() => {
    if (urlTab === 'autonomy' && access === 'hidden') setUrlTab('runs')
  }, [urlTab, access, setUrlTab])

  // The number on "Waiting for you" is read once, before the tab is opened; after that the list reports it every time it reads. A failure leaves no number.
  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    const mine = ++countRead.current
    service.proposals(COUNT_PARAMS).then((response) => {
      if (mine === countRead.current) setWaiting(response.data.pagination.total)
    }).catch(() => undefined)
  }, [context, service])

  const reportTotal = useCallback((total: number) => {
    countRead.current += 1
    setWaiting(total)
  }, [setWaiting])

  // Something was decided in the queue: the counters under each level and the kill switch are read again, quietly.
  const decided = useCallback(() => { void loadAutonomy(true) }, [loadAutonomy])

  return (
    <div className="@container mx-auto max-w-6xl space-y-6 p-4 @xl:p-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Agent run history</h1>
          <span className={cn(CHIP_BASE, AGENT_MARK_TONE)}>
            <History aria-hidden className="size-3" /> Audit log
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Every run of an agent: what it read, what it proposed, what it did on its own, what a person decided, and what it cost.
        </p>
      </div>

      <PageTabs tabs={tabs} active={tab} onChange={setUrlTab} label="Agent run history sections" idPrefix={AGENT_TAB_PREFIX} />

      <TabPanel id="runs" active={tab} idPrefix={AGENT_TAB_PREFIX}>
        <AgentRunsPanel service={service} />
      </TabPanel>

      <TabPanel id="waiting" active={tab} idPrefix={AGENT_TAB_PREFIX}>
        <AgentWaitingQueue service={service} kill={autonomy.data ? autonomy.data.kill_switch : null} onTotal={reportTotal} onChanged={decided} />
      </TabPanel>

      {/* The panel is on the page only while its tab is: a panel whose tab is not listed would point at nothing. */}
      {tabs.some((entry) => entry.id === 'autonomy') && (
        <TabPanel id="autonomy" active={tab} idPrefix={AGENT_TAB_PREFIX}>
          <AgentAutonomy store={autonomy} service={service} />
        </TabPanel>
      )}
    </div>
  )
}
