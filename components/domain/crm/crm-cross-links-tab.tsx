/**
 * Response shapes of the name-matched cross-module links (`GET /api/crm/organizations/{id}/cross-module-links` and the GTM side's
 * `GET /api/gtm/accounts/{id}/cross-module-links`).
 *
 * The Organization detail page used to show these in a "GTM & Signals" tab, matched by NAME only and at most one GTM account and one Signals company.
 * That tab is retired: its content is now the "Linked records" card of the Account 360 tab, which links the three records on exact evidence (the same
 * name or website, or a link a person confirmed), says why each is linked, and offers the possible matches for a person to confirm or turn down
 * (components/domain/crm/account-360.tsx). The endpoints and these shapes stay, because the GTM prospecting screen (`CrossLinkedCrmOrganization`) and
 * `services/gtm/gtm.ts` (`AccountCrossModuleLinks`) still use them.
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

export interface CrossLinkedCrmOrganization {
  id: string
  name: string
  account_no: string
}

export interface OrganizationCrossModuleLinks {
  gtm_account: CrossLinkedGtmAccount | null
  signals_company: CrossLinkedSignalsCompany | null
}

/**
 * `AccountCrossModuleLinks` is the GTM-side response shape (`AccountController::crossModuleLinks()`); its two fields are consumed directly where needed
 * (`prospecting-view.tsx`'s compact "Also in CRM" badge; the Signals half is already shown in depth by that dialog's own "Buying signals" section).
 */
export interface AccountCrossModuleLinks {
  crm_organization: CrossLinkedCrmOrganization | null
  signals_company: CrossLinkedSignalsCompany | null
}
