import { redirect } from 'next/navigation'
import { salesMarketingRunsHref } from '@/lib/agent/run-log-tabs'
import type { RawSearchParams } from '@/lib/signal-review-redirect'

/**
 * Agent Run History was merged into the Run Log of Agentic AI (26 Nov 2026; owner decision): it is the "Sales & Marketing agents" section of /module/agentic-ai/run-log. This address only
 * sends a visitor on, keeping the sub-tab an old link named (`?tab=waiting`, `?tab=autonomy`). A temporary (307) redirect that stays for ever: a bookmark, a saved link or an agent
 * message carries it. The menu row behind it stays in the database with status 1 on purpose: the agent API checks a right on it (AgentAccess::RUN_HISTORY), so deleting it would lock
 * the Waiting queue, the runs and the autonomy settings. The sidebar does not draw it (lib/signals-nav.ts).
 */
export default async function CrmAgentRunsRedirect({ searchParams }: { searchParams: Promise<RawSearchParams> }): Promise<never> {
  const params = await searchParams
  const raw = params.tab
  redirect(salesMarketingRunsHref(Array.isArray(raw) ? raw[0] : raw))
}
