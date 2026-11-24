import { redirect } from 'next/navigation'
import { servicesRedirectTarget, type RawSearchParams } from '@/lib/portfolio-redirect'

/**
 * The Services screen was merged into the Product Portfolio (owner, 13 Nov 2026; a service is a Sub-product of type Service), so this address sends a visitor to
 * the list on Services, keeping the rest of the query. Temporary (307) until the owner confirms; it stays for ever. The menu row behind it (469) keeps `status 1`
 * in the database; the sidebar shows it only to a person who has Services but not Products (lib/signals-nav.ts).
 */
export default async function ServicesRedirect({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  redirect(servicesRedirectTarget(await searchParams))
}
