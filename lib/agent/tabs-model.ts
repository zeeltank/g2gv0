import type { PageTab } from '@/components/shared/scaffolds/page-tabs'

/**
 * The tabs of Agent Run History (`?tab=waiting`). Pure, so a link such as `?tab=waiting` is proved to read back the way it was written, and who sees the
 * Autonomy tab is decided here and tested, not left to the layout. The first tab is the default and keeps the plain address: today's list of runs, unchanged.
 */
export const AGENT_TAB_IDS = ['runs', 'waiting', 'autonomy'] as const
export type AgentTab = (typeof AGENT_TAB_IDS)[number]
export const AGENT_TAB_PARAM = 'tab'
export const AGENT_TAB_PREFIX = 'agent-tab'

/** The tab an address names, as one of ours (useUrlTab answers a plain string; it only ever answers one of the ids, but the type should not have to be taken on trust). */
export function toAgentTab(value: string): AgentTab {
  return (AGENT_TAB_IDS as readonly string[]).includes(value) ? (value as AgentTab) : AGENT_TAB_IDS[0]
}

/** How the autonomy settings were read: the Autonomy tab's whole life depends on it, because only that answer says whether the person may change anything. */
export type AutonomyPhase = 'loading' | 'ready' | 'error' | 'unavailable' | 'forbidden'

/**
 * Whether the Autonomy tab is offered.
 *   shown   - the person may change the settings, or the read failed and the tab is where the failure is said (the server may not have it yet; a retry may work)
 *   hidden  - the person may not change them (administrators only), or may not read them at all: no tab, no controls, and a pasted address lands on Runs
 *   pending - the answer is not here yet: nothing is guessed, and the tab is listed only when the address asked for it
 */
export type AutonomyAccess = 'pending' | 'shown' | 'hidden'

export function autonomyAccess(phase: AutonomyPhase, canChange: boolean | null): AutonomyAccess {
  switch (phase) {
    case 'loading': return 'pending'
    case 'forbidden': return 'hidden'
    case 'ready': return canChange === true ? 'shown' : 'hidden'
    default: return 'shown'
  }
}

/** The tab to show: the one the address names, unless it is the Autonomy tab and the person may not have it. */
export function effectiveTab(urlTab: AgentTab, access: AutonomyAccess): AgentTab {
  return urlTab === 'autonomy' && access === 'hidden' ? 'runs' : urlTab
}

/**
 * The tabs of the switch. The count on "Waiting for you" is how many proposals nobody has decided across the organisation; null until it has been read (or
 * when it cannot be), so nothing is guessed before then. Runs carries no count: its own summary already says how many runs there are.
 */
export function agentTabs(access: AutonomyAccess, urlTab: AgentTab, waiting: number | null): PageTab[] {
  const tabs: PageTab[] = [
    { id: 'runs', label: 'Runs' },
    { id: 'waiting', label: 'Waiting for you', count: waiting },
  ]
  if (access === 'shown' || (access === 'pending' && urlTab === 'autonomy')) tabs.push({ id: 'autonomy', label: 'Autonomy' })
  return tabs
}
