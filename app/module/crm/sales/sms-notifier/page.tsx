import { redirect } from 'next/navigation'
import { outreachHref } from '@/lib/signals/outreach-model'

/**
 * The SMS Notifier screen became the SMS log section of the Messages view of the Outreach tab of Market Signals (27 Nov 2026; owner decision). The list of sent text messages is
 * the same; the stand-alone "Send SMS" button is gone, because SMS cannot be sent from the Outreach tab yet (the Send SMS dialogs of an organisation, an opportunity and a person
 * are untouched). This address only sends a visitor on. A temporary (307) redirect that stays for ever: a bookmark or a saved link carries it. The menu row behind it keeps
 * `status 1` in the database (it still gates the SMS log, WhatsApp and saved views); the sidebar does not draw it (lib/signals-nav.ts).
 */
export default function CrmSmsNotifierRedirect(): never {
  redirect(outreachHref('messages', 'sms'))
}
