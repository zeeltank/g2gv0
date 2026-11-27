import { redirect } from 'next/navigation'
import { outreachHref } from '@/lib/signals/outreach-model'

/**
 * The Outreach Approvals queue was retired into the Messages view of the Outreach tab of Market Signals (27 Nov 2026; owner decision). It was only a ledger: nothing was sent from it
 * and no screen created its rows, while the Messages queue is where a message is approved and sent. This address only sends a visitor on. A temporary (307) redirect that stays
 * for ever: a bookmark or a saved link carries it. The menu row behind it keeps `status 1` in the database, because a Role & Permissions save deletes the rights of every row that is
 * not status 1; the sidebar does not draw it (lib/signals-nav.ts).
 */
export default function CrmOutreachApprovalsRedirect(): never {
  redirect(outreachHref('messages'))
}
