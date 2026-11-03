/** The existing screens the Organizations screen's Organisation 360 parts point at instead of duplicating them. */

/** The screens a link may go to. A screen this person has no menu row for is null: no link is drawn rather than a broken one. */
export interface OrgLinks {
  /** CRM › Organizations; an organisation's page is `${crmOrganisations}/${crm id}`. */
  crmOrganisations: string | null
  /** The GTM accounts screen. It has no page for one account, so a row opens the list (the same as the GTM & Signals tab did). */
  gtm: string | null
  /** The Signals screen (Company Opportunities). */
  signals: string | null
  /** Signal Review, which a signal's title opens. */
  signalReview: string | null
  contacts: string | null
  opportunities: string | null
}

export const ACCESS_LINKS = {
  crmOrganisations: '/module/crm/marketing/organizations',
  gtm: '/gtm/prospecting',
  signals: '/signals',
  /** The menu row's own access_link is `/signal-review`; `/module/crm/signal-review` is the same screen under the CRM root's path. */
  signalReview: ['/signal-review', '/module/crm/signal-review'],
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
    // The first spelling the menu holds: the migration wrote `/signal-review`, and a host may carry the other.
    signalReview: ACCESS_LINKS.signalReview.map(orNull).find((path) => path !== null) ?? null,
    contacts: orNull(ACCESS_LINKS.contacts),
    opportunities: orNull(ACCESS_LINKS.opportunities),
  }
}

/** A record's page on one of the existing screens, or null when that screen is not in the person's menu. */
export const recordHref = (base: string | null, id: number): string | null => (base ? `${base}/${id}` : null)

/**
 * Signal Review opened on one signal: every status (a decided signal would be hidden by its default of "needs a decision") narrowed by the
 * signal's title, which the screen's search matches.
 */
export function signalReviewHref(links: Pick<OrgLinks, 'signalReview'>, title: string): string | null {
  return links.signalReview ? `${links.signalReview}?status=all&q=${encodeURIComponent(title)}` : null
}

/** For tests and previews: every screen present, at the paths the menu holds. */
export const DEFAULT_LINKS: OrgLinks = {
  crmOrganisations: ACCESS_LINKS.crmOrganisations,
  gtm: ACCESS_LINKS.gtm,
  signals: ACCESS_LINKS.signals,
  signalReview: ACCESS_LINKS.signalReview[0],
  contacts: ACCESS_LINKS.contacts,
  opportunities: ACCESS_LINKS.opportunities,
}
