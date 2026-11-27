import { redirect } from 'next/navigation'
import { AUTOMATIONS_HREF } from '@/lib/platform/workflow-tabs'

/**
 * GTM Workflows became the Automations tab of the Workflows page in Platform Services (26 Nov 2026): the same engine, with a recipe gallery, a builder in a drawer and
 * a run log beside it. This address only sends a visitor on. A temporary (307) redirect that stays for ever: a bookmark or a saved link carries it. The menu row behind it
 * keeps `status 0` in the database, and the Command Center links to the new page directly.
 */
export default function GtmWorkflowsRedirect() {
  redirect(AUTOMATIONS_HREF)
}
