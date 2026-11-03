/** Where the Organisation 360 screens live, and the existing screens they point at instead of duplicating. */

export const ORG_360_ACCESS_LINK = '/module/crm/organisation-360'

/** The screens an organisation's 360 links to. A screen this person has no menu row for is null: no link is drawn rather than a broken one. */
export interface OrgLinks {
  /** The Organisation 360 list; a detail page is `${list}/${id}`. */
  list: string
  /** CRM › Organizations; a CRM organisation's page is `${crmOrganisations}/${crm id}`. */
  crmOrganisations: string | null
  /** CRM › Contacts. */
  contacts: string | null
  /** CRM › Opportunities. */
  opportunities: string | null
  /** Signal Review, which the Signals tab sends a person to. */
  signalReview: string | null
}

export const ACCESS_LINKS = {
  crmOrganisations: '/module/crm/marketing/organizations',
  contacts: '/module/crm/marketing/contacts',
  opportunities: '/module/crm/sales/opportunities',
  signalReview: '/module/crm/signal-review',
} as const

/** What the sidebar's `resolveAccessLink` answers for a screen the menu does not contain. */
const UNRESOLVED = '/dashboard'

/** The links as the signed-in person's menu resolves them. */
export function buildLinks(resolve: (accessLink: string) => string): OrgLinks {
  const orNull = (accessLink: string) => {
    const path = resolve(accessLink)
    return path === UNRESOLVED ? null : path
  }
  return {
    list: resolve(ORG_360_ACCESS_LINK),
    crmOrganisations: orNull(ACCESS_LINKS.crmOrganisations),
    contacts: orNull(ACCESS_LINKS.contacts),
    opportunities: orNull(ACCESS_LINKS.opportunities),
    signalReview: orNull(ACCESS_LINKS.signalReview),
  }
}

export const detailHref = (links: Pick<OrgLinks, 'list'>, id: number): string => `${links.list}/${id}`

/** A record's page on one of the existing screens, or null when that screen is not in the person's menu. */
export const recordHref = (base: string | null, id: number): string | null => (base ? `${base}/${id}` : null)

/**
 * Signal Review opened on one signal: every status (a decided signal would be hidden by its default of "needs a decision") narrowed by the
 * signal's title, which the screen's search matches.
 */
export function signalReviewHref(links: Pick<OrgLinks, 'signalReview'>, title: string): string | null {
  return links.signalReview ? `${links.signalReview}?status=all&q=${encodeURIComponent(title)}` : null
}

/** For tests and previews: every screen present, at the paths the content map registers. */
export const DEFAULT_LINKS: OrgLinks = {
  list: ORG_360_ACCESS_LINK,
  crmOrganisations: ACCESS_LINKS.crmOrganisations,
  contacts: ACCESS_LINKS.contacts,
  opportunities: ACCESS_LINKS.opportunities,
  signalReview: ACCESS_LINKS.signalReview,
}
