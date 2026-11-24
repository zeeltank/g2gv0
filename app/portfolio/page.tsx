import { redirect } from 'next/navigation'
import { portfolioRedirectTarget, type RawSearchParams } from '@/lib/portfolio-redirect'

/**
 * The Product Portfolio LIST lives in Market Signals, as the "Product Portfolio" tab (`/signals/portfolio`), under the four Signals tabs (owner, 24 Nov 2026: "we already
 * have it in the Market Signals tab, remove it from the side bar"). The sidebar has no Product Portfolio entry any more, so this address, which every earlier link and
 * bookmark carries, only sends a visitor on, keeping the query string. The Product page (`/portfolio/{key}`) and the Sub-product page (`/portfolio/products/{id}`) stay
 * where they are. A temporary (307) redirect, like the other old addresses.
 */
export default async function ProductPortfolioListRedirect({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  redirect(portfolioRedirectTarget(await searchParams))
}
