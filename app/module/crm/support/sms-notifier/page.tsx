import { redirect } from 'next/navigation'
import { outreachHref } from '@/lib/signals/outreach-model'

/**
 * The Support copy of the SMS Notifier (a second menu entry for the same screen) became the SMS log section of the Messages view of the Outreach tab of Market Signals (27 Nov 2026;
 * owner decision), like the Sales one (app/module/crm/sales/sms-notifier/page.tsx). This address only sends a visitor on. A temporary (307) redirect that stays for ever: a bookmark
 * or a saved link carries it. The menu row behind it keeps `status 1` in the database; the sidebar does not draw it (lib/signals-nav.ts).
 */
export default function CrmSupportSmsNotifierRedirect(): never {
  redirect(outreachHref('messages', 'sms'))
}
