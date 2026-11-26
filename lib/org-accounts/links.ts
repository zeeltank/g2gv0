/** The existing screens the Organizations screen's Organisation 360 parts point at instead of duplicating them. */

/** The screens a link may go to. A screen this person has no menu row for is null: no link is drawn rather than a broken one. */
export interface OrgLinks {
  /** CRM › Organizations; an organisation's page is `${crmOrganisations}/${crm id}`. */
  crmOrganisations: string | null
  /** The Signals screen (Company Opportunities). A signal's title opens it too, narrowed to that signal (see `signalHref`). */
  signals: string | null
  opportunities: string | null
}

export const ACCESS_LINKS = {
  crmOrganisations: '/module/crm/marketing/organizations',
  signals: '/signals',
  opportunities: '/module/crm/sales/opportunities',
} as const

/** What the sidebar's `resolveAccessLink` answers for a screen the menu does not contain. */
const UNRESOLVED = '/dashboard'

/** The links as the signed-in person's menu resolves them. `resolve` answers the access_link itself when the menu holds it, else '/dashboard'. */
export function buildLinks(resolve: (accessLink: string) => string): OrgLinks {
  const orNull = (accessLink: string) => {
    const path = resolve(accessLink)
    return path === UNRESOLVED ? null : path
  }
  return {
    crmOrganisations: orNull(ACCESS_LINKS.crmOrganisations),
    signals: orNull(ACCESS_LINKS.signals),
    opportunities: orNull(ACCESS_LINKS.opportunities),
  }
}

/** A record's page on one of the existing screens, or null when that screen is not in the person's menu. */
export const recordHref = (base: string | null, id: number): string | null => (base ? `${base}/${id}` : null)

/**
 * One signal opened in Company Opportunities (`/signals`): every status (a decided signal would be hidden by the default of "needs a decision") narrowed by the
 * signal's title, which the screen's search matches. The Signal Review screen was merged into Company Opportunities on 13 Nov 2026, so this follows the Signals
 * link and no longer looks for a menu row of its own (the function keeps its older name). Its query uses the names the screen reads: `status` and `q`.
 */
export function signalHref(links: Pick<OrgLinks, 'signals'>, title: string): string | null {
  return links.signals ? `${links.signals}?status=all&q=${encodeURIComponent(title)}` : null
}

/** For tests and previews: every screen present, at the paths the menu holds. */
export const DEFAULT_LINKS: OrgLinks = {
  crmOrganisations: ACCESS_LINKS.crmOrganisations,
  signals: ACCESS_LINKS.signals,
  opportunities: ACCESS_LINKS.opportunities,
}

// ── People (S18, 25 Nov 2026: Contacts were merged into Organizations) ───────────────────────────────────────────────────────────────

/** The two areas a person's page can be reached from; the address a visitor used decides which one the redirect keeps. */
export type PeopleArea = 'marketing' | 'support'

const organisationsRow = (area: PeopleArea): string => `/module/crm/${area}/organizations`

/** What names a person: an id, and the company when it is known. */
export interface PersonRef {
  id: number | string
  organizationId?: number | string | null
}

const isRecordId = (value: unknown): boolean => /^[1-9]\d{0,14}$/.test(String(value ?? ''))

/**
 * The address of one person, under the Organizations screen (`base` is the organisations page, as the menu resolves it). A person with a company opens on that company's
 * People tab (`?tab=people&person=`); a person with none opens in All people (`?scope=people&person=`), where the person opens in a drawer. Null for an id that is not a
 * record id: nothing is guessed.
 */
export function personPath(base: string, person: PersonRef): string | null {
  if (!isRecordId(person.id)) return null
  const id = String(person.id)
  return isRecordId(person.organizationId) ? `${base}/${String(person.organizationId)}?tab=people&person=${id}` : `${base}?scope=people&person=${id}`
}

/**
 * THE one way to link to a person. With `resolve` (the sidebar's resolveAccessLink) the Organizations row is looked up in the person's own menu, the `area` first and the
 * other area as the fallback; null when the person has neither, so no link is drawn rather than a broken one. Without `resolve` it is the plain address of the area.
 */
export function personHref(person: PersonRef, area: PeopleArea = 'marketing', resolve?: (accessLink: string) => string): string | null {
  if (!resolve) return personPath(organisationsRow(area), person)
  const order: PeopleArea[] = area === 'support' ? ['support', 'marketing'] : ['marketing', 'support']
  for (const candidate of order) {
    const base = resolve(organisationsRow(candidate))
    if (base !== UNRESOLVED) return personPath(base, person)
  }
  return null
}
