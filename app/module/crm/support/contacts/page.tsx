import { redirect } from 'next/navigation'
import { peopleListTarget, type RawSearchParams } from '@/lib/people-redirect'

/**
 * The Support area's Contacts list (S18, 25 Nov 2026: Contacts were merged into Organizations). It sends a visitor to the All people scope of the Support Organizations
 * list, so the area the person came from is kept. A temporary (307) redirect that stays for ever.
 */
export default async function CrmSupportContactsRedirect({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  redirect(peopleListTarget('support', await searchParams))
}
