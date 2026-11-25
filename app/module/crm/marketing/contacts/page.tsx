import { redirect } from 'next/navigation'
import { peopleListTarget, type RawSearchParams } from '@/lib/people-redirect'

/**
 * Contacts were merged into Organizations (S18, 25 Nov 2026): the list is the All people scope of the Organizations list. This address only sends a visitor on. A
 * temporary (307) redirect that stays for ever: a bookmark or a saved link carries it. The menu row behind it keeps `status 1` in the database; the sidebar does not
 * draw it (lib/signals-nav.ts).
 */
export default async function CrmContactsRedirect({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  redirect(peopleListTarget('marketing', await searchParams))
}
