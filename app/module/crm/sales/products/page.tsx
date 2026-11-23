import { redirect } from 'next/navigation'
import { portfolioRedirectTarget, type RawSearchParams } from '@/lib/portfolio-redirect'

/**
 * The Products screen was merged into the Product Portfolio (owner, 13 Nov 2026), so this address only sends a visitor on, keeping the query string. It is a
 * temporary (307) redirect until the owner confirms it is permanent, and it stays for ever: an Ask answer, a saved link or a bookmark carries this address.
 * The menu row behind it (468) keeps `status 1` in the database; the sidebar draws it as "Product Portfolio" in code (lib/signals-nav.ts).
 */
export default async function ProductsRedirect({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  redirect(portfolioRedirectTarget(await searchParams))
}
