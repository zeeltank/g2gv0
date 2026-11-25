import { redirect } from 'next/navigation'
import { priceBooksRedirectTarget } from '@/lib/portfolio-redirect'

/**
 * Price Books were removed (S16, 25 Nov 2026): a Sub-product holds its own price, currency and tax rate in the Product Portfolio. This address only sends a visitor on, to
 * the Product Portfolio tab of Market Signals. A temporary (307) redirect that stays for ever: an old bookmark or a saved link carries it. The menu row behind it keeps
 * `status 1` in the database; the sidebar does not draw it (lib/signals-nav.ts).
 */
export default function PriceBooksRedirect() {
  redirect(priceBooksRedirectTarget())
}
