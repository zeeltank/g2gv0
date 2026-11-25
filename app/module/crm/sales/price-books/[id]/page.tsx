import { redirect } from 'next/navigation'
import { priceBooksRedirectTarget } from '@/lib/portfolio-redirect'

/**
 * A removed Price Book's own page (S16, 25 Nov 2026). The book is gone and so is its id's meaning, so the visitor lands on the Product Portfolio tab of Market Signals, the
 * same place as the list address next to this folder. Temporary (307), and it stays for ever: a saved link carries the old address.
 */
export default function PriceBookRedirect() {
  redirect(priceBooksRedirectTarget())
}
