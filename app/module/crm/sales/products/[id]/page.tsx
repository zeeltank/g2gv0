import { PortfolioRedirectPage } from '@/components/domain/portfolio/portfolio-redirect'
import type { RawSearchParams } from '@/lib/portfolio-redirect'

/**
 * A Product's old full-page address (the id is a CATALOGUE id). It goes to the Sub-product page of the record that holds it, through
 * GET /api/product-master/by-crm/{id}, keeping the query; an id that is not this organisation's, or no longer exists, ends in a clear "not found" page.
 */
export default async function CatalogueProductRedirect({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<RawSearchParams> }) {
  const { id } = await params
  return <PortfolioRedirectPage lookup={{ kind: 'catalogue', id }} params={await searchParams} />
}
