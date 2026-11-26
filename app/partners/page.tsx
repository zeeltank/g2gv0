import { redirect } from 'next/navigation'

/**
 * The Partner Network tab of Market Signals was removed (owner, 26 Nov 2026), so this address only sends a visitor on, to Market Signals (/signals), the way
 * app/signal-review/page.tsx does for the retired Signal Review. A bookmark or a stored link to /partners must not end on a 404. The query string is NOT carried over:
 * the removed screen's filters (type, status, state) mean nothing to Market Signals, and `status` would narrow its list to the wrong thing.
 * It is a temporary (307) redirect, like the Signal Review one. The menu row behind the old tab is deleted by hp_erp's `signals:market-signals-menu` command.
 */
export default function PartnersRedirect(): never {
  redirect('/signals')
}
