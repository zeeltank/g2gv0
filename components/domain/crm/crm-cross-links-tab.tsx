/**
 * Response shapes of the name-matched cross-module links (`GET /api/crm/organizations/{id}/cross-module-links`).
 *
 * The Organization detail page used to show these in a "GTM & Signals" tab, matched by NAME only and at most one GTM account and one Signals company.
 * That tab is retired: its content is now the "Linked records" card of the Account 360 tab, which links the three records on exact evidence (the same
 * name or website, or a link a person confirmed), says why each is linked, and offers the possible matches for a person to confirm or turn down
 * (components/domain/crm/account-360.tsx). The endpoint and these shapes stay, because `services/crm/index.ts` (`OrganizationCrossModuleLinks`) still uses them.
 */

export interface CrossLinkedGtmAccount {
  id: string
  name: string
  stage: string
  deals_count: number
}

export interface CrossLinkedSignalsCompany {
  id: string
  name: string
  industry: string | null
  opportunities_count: number
}

export interface OrganizationCrossModuleLinks {
  gtm_account: CrossLinkedGtmAccount | null
  signals_company: CrossLinkedSignalsCompany | null
}
