'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { PageTabs, TabPanel } from '@/components/shared/scaffolds/page-tabs'
import { useUrlTab } from '@/components/shared/scaffolds/use-url-tab'
import { COUNT_PARAMS } from '@/lib/agent/queue-model'
import {
  RUN_LOG_PREFIX,
  RUN_LOG_SECTION_IDS,
  RUN_LOG_SECTION_PARAM,
  effectiveSection,
  runLogSections,
  toRunLogSection,
  type SalesMarketingAccess,
} from '@/lib/agent/run-log-tabs'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import type { AgentApi } from '@/services/agent/api-types'
import { agentService } from '@/services/agent/agent-service'
import { AgentRunsView } from '@/domain/crm/agent-runs-view'
import { AgRunLog } from './ag-run-log'

/** The HTTP status an error carries (the API client's errors do), or null for anything else, such as a lost connection. */
function statusOf(error: unknown): number | null {
  return typeof error === 'object' && error !== null && 'status' in error && typeof (error as { status: unknown }).status === 'number' ? (error as { status: number }).status : null
}

/**
 * The Run Log of Agentic AI, with the Sales & Marketing agents merged into it (26 Nov 2026, owner decision: Agent Run History left the CRM sidebar):
 *   Agentic AI runs        - the Run Log as it always was (ag-run-log.tsx).
 *   Sales & Marketing agents - the screen that was Agent Run History (agent-runs-view.tsx), with its own Runs / Waiting for you / Autonomy tabs in `?tab=`.
 * The section is kept in `?section=` (the second screen keeps its own sub-tab in `?tab=`, so the two must not share a parameter). The second section is offered only to a person the
 * agent API lets in: the API checks a right on the Agent Run History menu row, which stays in the database for exactly that reason. One light read, the count of proposals nobody has
 * decided, tells a person with the right (it also puts the number on the tab) from one without (403); a failure that is not a 403 says nothing about rights, so the section is then
 * listed only when the address asks for it, and the screen inside says what went wrong.
 *
 * `agenticPanel` and `service` are for tests; the page passes neither.
 */
export function AgRunLogPage({ service = agentService, agenticPanel }: { service?: AgentApi; agenticPanel?: ReactNode }) {
  const context = useMemo(() => getLaravelContext(), [])
  const [named, setSection] = useUrlTab(RUN_LOG_SECTION_IDS, RUN_LOG_SECTION_PARAM)
  const asked = toRunLogSection(named)
  const [access, setAccess] = useState<SalesMarketingAccess>('loading')
  const [waiting, setWaiting] = useState<number | null>(null)

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    let live = true
    service.proposals(COUNT_PARAMS)
      .then((response) => {
        if (!live) return
        setWaiting(response.data.pagination.total)
        setAccess('allowed')
      })
      .catch((error: unknown) => {
        if (live) setAccess(statusOf(error) === 403 ? 'denied' : 'failed')
      })

    return () => { live = false }
  }, [context, service])

  const section = effectiveSection(asked, access)
  const tabs = runLogSections(access, asked, waiting)

  // A person who may not read the Sales & Marketing agents and pasted its address: the address says what they are looking at.
  useEffect(() => {
    if (asked === 'sales-marketing' && access === 'denied') setSection('agentic')
  }, [asked, access, setSection])

  return (
    <div className="g2g-scrollbar h-full overflow-y-auto">
      <div className="space-y-4 px-6 pt-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Run log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every agent execution, with the step-by-step trace behind it
            {access === 'allowed' ? ', and the history, the waiting queue and the autonomy settings of the Sales & Marketing agents.' : '.'}
          </p>
        </div>
        {tabs.length > 1 && <PageTabs tabs={tabs} active={section} onChange={(id) => setSection(id)} label="Run log sections" idPrefix={RUN_LOG_PREFIX} />}
      </div>

      <TabPanel id="agentic" active={section} idPrefix={RUN_LOG_PREFIX}>
        {agenticPanel ?? <AgRunLog embedded />}
      </TabPanel>

      {tabs.some((entry) => entry.id === 'sales-marketing') && (
        <TabPanel id="sales-marketing" active={section} idPrefix={RUN_LOG_PREFIX}>
          <AgentRunsView service={service} embedded />
        </TabPanel>
      )}
    </div>
  )
}
