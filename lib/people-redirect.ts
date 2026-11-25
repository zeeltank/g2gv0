import { personPath, type PeopleArea, type PersonRef } from '@/lib/org-accounts/links'

/**
 * Where the old Contacts addresses land (owner decision of 25 Nov 2026; hp_erp docs/agentic-crm/slices/S18-CONTACTS-INTO-ORGANIZATIONS-CONTRACT.md, track T3).
 *
 * Contacts were merged into Organizations: a person is a tab of a company (People) and a scope of the Organizations list (All people). The two old addresses are redirect
 * pages that stay for ever (an Ask answer, an agent run, a saved link and any bookmark carry them). The pages are the `page.tsx` files under
 * app/module/crm/marketing/contacts and app/module/crm/support/contacts (their folders ARE the old addresses). The area (marketing or support) the visitor came from is kept.
 *
 *   /module/crm/{area}/contacts           -> /module/crm/{area}/organizations?scope=people        (the list; `?scope=suggestions` goes to the Suggestions scope)
 *   /module/crm/{area}/contacts/{id}      -> /module/crm/{area}/organizations/{companyId}?tab=people&person={id}     (the person has a company)
 *                                         -> /module/crm/{area}/organizations?scope=people&person={id}               (the person has none)
 *
 * The paths are fixed: nothing in a query can send a person anywhere else, so no query is carried.
 */

/** What Next hands a page as `searchParams` once awaited: a key seen once is a string, a key repeated is a list. */
export type RawSearchParams = Record<string, string | string[] | undefined>

export const organisationsAddress = (area: PeopleArea): string => `/module/crm/${area}/organizations`

/** The list address: All people, or the Suggestions scope when that is what the old link asked for (it was a scope of the old Contacts list too). */
export function peopleListTarget(area: PeopleArea, params: RawSearchParams = {}): string {
  const scope = params.scope === 'suggestions' ? 'suggestions' : 'people'
  return `${organisationsAddress(area)}?scope=${scope}`
}

/** One person's address, from what the person's own record says (its `organizationId`). Null when the id is not a record id. */
export function personTarget(person: PersonRef, area: PeopleArea): string | null {
  return personPath(organisationsAddress(area), person)
}
