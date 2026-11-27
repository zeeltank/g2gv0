import { redirect } from 'next/navigation'
import { AUTOMATIONS_HREF } from '@/lib/platform/workflow-tabs'

/**
 * Automation Rules were merged into the Automations tab of the Workflows page (26 Nov 2026; owner decision): the rules saved here were never run by anything, and the
 * Workflows engine is the one that does. This address only sends a visitor on. A temporary (307) redirect that stays for ever: a bookmark or a saved link carries it.
 * The menu row behind it keeps `status 1` in the database, because a Role & Permissions save deletes the rights of every row that is not status 1; the sidebar does
 * not draw it (lib/signals-nav.ts).
 */
export default function CrmAutomationRulesRedirect() {
  redirect(AUTOMATIONS_HREF)
}
