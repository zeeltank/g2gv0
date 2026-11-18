import type {
  Org360, OrgAccountItem, OrgCreateCrmResult, OrgEnvelope, OrgForCrmResult, OrgLifecycle, OrgLinkRequest, OrgListResponse, OrgMeta, OrgSuggestion,
} from './types'

/** The list's query as the API takes it. A missing value is left out so the server applies no filter for it. */
export interface OrgListParams {
  q?: string
  lifecycle?: OrgLifecycle
  has_crm?: 0 | 1
  has_gtm?: 0 | 1
  has_signals?: 0 | 1
  page?: number
  per_page?: number
  sort?: string
}

/** PATCH /{id}: only what changed. `owner_user_id: null` takes the owner off. */
export interface OrgPatchRequest {
  lifecycle?: OrgLifecycle
  owner_user_id?: number | null
  name?: string
}

/** POST /{id}/create-crm-organisation */
export interface OrgCreateCrmRequest {
  restore_deleted?: boolean
}

/** What the Organisation 360 screens need from the server. Components take this shape, so a test can hand them a fake. */
export interface OrgAccountsApi {
  list(params: OrgListParams): Promise<OrgListResponse>
  meta(): Promise<OrgEnvelope<OrgMeta>>
  /** Every possible duplicate of the organisation, or with `identityId` only the pairs that involve a record of that one organisation. */
  suggestions(identityId?: number | string): Promise<OrgEnvelope<OrgSuggestion[]>>
  get(id: number | string): Promise<OrgEnvelope<Org360>>
  /**
   * The 360 of a CRM organisation, making its identity first when it has none (a CRM organisation made after the backfill). It records only derived data
   * and decides what the backfill decides (an exact name or website, never a fuzzy match), so the view right is enough.
   */
  forCrm(crmOrganizationId: number | string): Promise<OrgForCrmResult>
  /** Confirms or rejects one possible duplicate. */
  link(body: OrgLinkRequest): Promise<OrgEnvelope<OrgAccountItem | null>>
  /** The contract does not say what PATCH answers with, so callers read the 360 again instead of relying on it. */
  patch(id: number | string, body: OrgPatchRequest): Promise<OrgEnvelope<unknown>>
  createCrmOrganisation(id: number | string, body?: OrgCreateCrmRequest): Promise<OrgCreateCrmResult>
}
