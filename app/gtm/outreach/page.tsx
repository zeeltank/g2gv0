import { redirect } from 'next/navigation'
import { outreachHref } from '@/lib/signals/outreach-model'

/**
 * The GTM Outreach screen became the Messages view of the Outreach tab of Market Signals (27 Nov 2026; owner decision): the same queue, checks, approvals and suppression list, now beside
 * the companies and people a message is written to. This address only sends a visitor on. A temporary (307) redirect that stays for ever: a bookmark, a saved link or an agent message
 * carries it. The menu row behind it (`/gtm/outreach`) stays in the database with status 1 and is now the Outreach tab's rights row, so everyone who had Outreach keeps it; the sidebar
 * does not draw it (lib/signals-nav.ts).
 */
export default function GtmOutreachRedirect(): never {
  redirect(outreachHref('messages'))
}
