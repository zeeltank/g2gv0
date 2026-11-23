import { PortfolioRedirectPage } from '@/components/domain/portfolio/portfolio-redirect'
import type { RawSearchParams } from '@/lib/portfolio-redirect'

/** A Service's old full-page address (the id is a CATALOGUE id). The same redirect as the Products one: a service is a Sub-product of type Service. */
export default async function CatalogueServiceRedirect({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<RawSearchParams> }) {
  const { id } = await params
  return <PortfolioRedirectPage lookup={{ kind: 'catalogue', id }} params={await searchParams} />
}
