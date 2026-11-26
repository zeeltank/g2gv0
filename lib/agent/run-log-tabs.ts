import type { PageTab } from '@/components/shared/scaffolds/page-tabs'

/**
 * The two sections of the Run Log (`/module/agentic-ai/run-log?section=sales-marketing`), after Agent Run History was merged into it (26 Nov 2026, owner decision).
 * Pure, so a link is proved to read back the way it was written, and who is offered the second section is decided here and tested, not left to the layout.
 *
 *   agentic          the Agentic AI module's own runs (status, agent, dates, cost, a trace per run): what the Run Log always was. Everybody who can open the Run Log has it.
 *   sales-marketing  the Sales & Marketing agents (the screen that was Agent Run History, with its own Runs / Waiting for you / Autonomy tabs in `?tab=`). The agent API checks a
 *                    right on the Agent Run History menu row, so a person without it must not be offered a section that would only answer 403.
 *
 * The parameter is `section`, not `tab`: the Sales & Marketing screen already keeps its own sub-tab in `?tab=`, and the two must not overwrite each other.
 */
export const RUN_LOG_SECTION_IDS = ['agentic', 'sales-marketing'] as const
export type RunLogSection = (typeof RUN_LOG_SECTION_IDS)[number]
export const RUN_LOG_SECTION_PARAM = 'section'
export const RUN_LOG_PREFIX = 'run-log'
export const RUN_LOG_PATH = '/module/agentic-ai/run-log'

/** The section an address names, as one of ours (an unknown word is the first section, the plain address). */
export function toRunLogSection(value: string): RunLogSection {
  return (RUN_LOG_SECTION_IDS as readonly string[]).includes(value) ? (value as RunLogSection) : RUN_LOG_SECTION_IDS[0]
}

/**
 * Whether the person may read the Sales & Marketing agents.
 *   loading  the probe has not answered yet
 *   allowed  the agent API answered
 *   denied   the agent API answered 403: no right on the Agent Run History row
 *   failed   anything else (the server has no such route yet, the network): not a statement about rights
 */
export type SalesMarketingAccess = 'loading' | 'allowed' | 'denied' | 'failed'

/**
 * The sections to offer. `allowed` lists it; `denied` never does; `loading` and `failed` list it only when the address asks for it (so a pasted link shows where the problem is
 * said, and nobody is offered a section on a guess).
 */
export function runLogSections(access: SalesMarketingAccess, asked: RunLogSection, waiting: number | null): PageTab[] {
  const tabs: PageTab[] = [{ id: 'agentic', label: 'Agentic AI runs' }]
  const offer = access === 'allowed' || ((access === 'loading' || access === 'failed') && asked === 'sales-marketing')
  if (offer) tabs.push({ id: 'sales-marketing', label: 'Sales & Marketing agents', count: access === 'allowed' ? waiting : null })

  return tabs
}

/** The section to show: the one the address names, unless it is Sales & Marketing and the person has been told they may not read it. */
export function effectiveSection(asked: RunLogSection, access: SalesMarketingAccess): RunLogSection {
  return asked === 'sales-marketing' && access === 'denied' ? 'agentic' : asked
}

/** Where the retired Agent Run History address leads: the Sales & Marketing section, on the sub-tab the old link named (`runs` is the plain address of that screen). */
export function salesMarketingRunsHref(subTab?: string | null): string {
  const sub = subTab && subTab !== 'runs' ? `&tab=${encodeURIComponent(subTab)}` : ''

  return `${RUN_LOG_PATH}?${RUN_LOG_SECTION_PARAM}=sales-marketing${sub}`
}
