/**
 * The tabs of the Organization detail page. The name-matched "GTM & Signals" tab is retired: the Account 360 tab is where an organization's linked
 * records (the CRM organization, the GTM account and the Signals company) are shown, with the reason each is linked.
 */

export type OrgDetailTab = 'details' | 'hierarchy' | 'opportunities' | 'quotes' | 'schedule' | 'comments' | 'documents' | 'emails' | 'history' | 'projects' | 'account_360' | 'custom'

/** The tabs every organization has, in order. (A "Custom Fields" tab is added after them when the organization has custom fields.) */
export const ORG_DETAIL_TABS: ReadonlyArray<{ id: OrgDetailTab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'hierarchy', label: 'Hierarchy' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'quotes', label: 'Quotes' },
  { id: 'account_360', label: 'Account 360' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'comments', label: 'Comments' },
  { id: 'documents', label: 'Documents' },
  { id: 'emails', label: 'Emails' },
  { id: 'history', label: 'History' },
  { id: 'projects', label: 'Projects' },
]

/**
 * The tab a link asks for (`?tab=account_360`), when it is one every organization has; Details otherwise. A tab that no longer exists (an old bookmark to
 * `cross_links`) and one that only some organizations have (`custom`) open Details instead of a blank page.
 */
export function tabFromSearch(search: string): OrgDetailTab {
  const wanted = new URLSearchParams(search).get('tab')
  return ORG_DETAIL_TABS.find((tab) => tab.id === wanted)?.id ?? 'details'
}
