/** The existing screens the Organizations screen's Organisation 360 parts point at instead of duplicating them. */

/** The screens a link may go to. A screen this person has no menu row for is null: no link is drawn rather than a broken one. */
export interface OrgLinks {
  /** CRM › Organizations; an organisation's page is `${crmOrganisations}/${crm id}`. */
  crmOrganisations: string | null
  /** The GTM accounts screen. It has no page for one account, so a row opens the list (the same as the GTM & Signals tab did). */
  gtm: string | null
  /** The Signals screen (Company Opportunities). A signal's title opens it too, narrowed to that signal (see `signalHref`). */
  signals: string | null
  contacts: string | null
  opportunities: string | null
}

export const ACCESS_LINKS = {
  crmOrganisations: '/module/crm/marketing/organizations',
  gtm: '/gtm/prospecting',
  signals: '/signals',
  contacts: '/module/crm/marketing/contacts',
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
    gtm: orNull(ACCESS_LINKS.gtm),
    signals: orNull(ACCESS_LINKS.signals),
    contacts: orNull(ACCESS_LINKS.contacts),
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
  gtm: ACCESS_LINKS.gtm,
  signals: ACCESS_LINKS.signals,
  contacts: ACCESS_LINKS.contacts,
  opportunities: ACCESS_LINKS.opportunities,
}
