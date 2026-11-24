import { PortfolioRedirectPage } from '@/components/domain/portfolio/portfolio-redirect'
import type { RawSearchParams } from '@/lib/portfolio-redirect'

/**
 * The old Product line page (the id is a MASTER record id). It goes to the Product page for a Product and to the Sub-product page for anything else, by the
 * record's `kind` (GET /api/product-master/{id}), keeping the query.
 */
export default async function ProductLineRedirect({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<RawSearchParams> }) {
  const { id } = await params
  return <PortfolioRedirectPage lookup={{ kind: 'line', id }} params={await searchParams} />
}
