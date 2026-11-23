import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import type { CrmBulkActionResponse } from '@/types/crm'
import { productMasterService } from './product-master-service'
import type { PmEnvelope, PmMeta } from './types'
import type {
  ByCrmAnswer, MatchDecisionBody, MatchDecisionResult, MatchesEnvelope, PortfolioItemType, PortfolioListEnvelope, PortfolioListQuery, RecordHead,
} from './portfolio-list-types'

/**
 * The calls the Product Portfolio LIST and its pair review make (slice 15, track P3-A). The organisation and the person come from the bearer token the shared
 * client sends, never from a parameter. A refusal arrives as an ApiError whose `status` is 403 (not allowed), 404, 409 or 422.
 *
 * The two bulk calls are the Products screen's own endpoints (`POST /api/crm/products/bulk/delete` and `/bulk/assign`, keyed by the CATALOGUE id). They differ
 * from the old screen's calls in ONE thing: they send `itemType`. The server answers 422 "A valid itemType (product or service) is required." to a bulk call
 * without it (CrmProductController::bulkDelete and bulkAssign, `validItemType`), and the old list's calls (`crmService.bulkDeleteProducts` and
 * `bulkAssignProducts`) never sent it, so on the old screen both bulk actions were refused. A batch holds ONE item type (the server refuses a mixed assign).
 */
export const portfolioListService = {
  /** One page of the flat list, in the order the screen draws it (groups). An absent field is not sent, so the server applies no filter for it. */
  list(query: PortfolioListQuery = {}): Promise<PortfolioListEnvelope> {
    const params: Record<string, string> = {}
    if (query.q) params.q = query.q
    if (query.productId) params.productId = String(query.productId)
    if (query.type) params.type = query.type
    if (query.sold) params.sold = query.sold
    if (query.readiness) params.readiness = query.readiness
    if (query.status) params.status = query.status
    if (query.sort) params.sort = query.sort
    if (query.dir) params.dir = query.dir
    if (query.page) params.page = String(query.page)
    if (query.per) params.per = String(query.per)
    return apiClient.get('/product-master/list', params)
  },

  /** The Products (level 1) for the Product filter. */
  lines(): Promise<PmEnvelope<Array<{ id: number; key: string; name: string }>>> {
    return productMasterService.lines()
  },

  /** The choices the filters offer (the readiness words) and what the caller may do. */
  meta(): Promise<PmEnvelope<PmMeta>> {
    return productMasterService.meta()
  },

  /** The suggestions of the pair review, with their reasons, and the answers already given (administrators only: a 403 for anybody else). */
  matches(): Promise<MatchesEnvelope> {
    return apiClient.get('/product-master/matches')
  },

  /** One answer for one pair. `same` makes the two ONE record; `different` only writes the decision. */
  decide(body: MatchDecisionBody): Promise<MatchDecisionResult> {
    return apiClient.post('/product-master/matches/decide', { ...body })
  },

  /** Which master record holds this catalogue id (also one in the Recycle Bin), for the permanent redirects of the old addresses. A 404 for an id that is not this organisation's. */
  byCrm(crmId: number | string): Promise<ByCrmAnswer> {
    return apiClient.get(`/product-master/by-crm/${encodeURIComponent(String(crmId))}`)
  },

  /** The record's own head (what kind it is, and its key), for the redirect of an old Product line address. */
  head(id: number | string): Promise<PmEnvelope<RecordHead>> {
    return apiClient.get(`/product-master/${encodeURIComponent(String(id))}`)
  },

  /** The catalogue id of a Sub-product, from its Sell section (a 403 for a caller who may not view it). */
  async crmIdOf(masterId: number): Promise<number | null> {
    const answer = await apiClient.get<PmEnvelope<{ crmProductId?: number | null } | null>>(`/product-master/${encodeURIComponent(String(masterId))}/sell`)
    const id = answer.data?.crmProductId
    return typeof id === 'number' && id > 0 ? id : null
  },

  /** Moves catalogue entries of ONE item type to the Recycle Bin. `ids` are CATALOGUE ids. */
  bulkDelete(context: LaravelContext, itemType: PortfolioItemType, ids: number[]): Promise<CrmBulkActionResponse> {
    return apiClient.post('/crm/products/bulk/delete', { ids, itemType, token: context.token, sub_institute_id: context.subInstituteId })
  },

  /** Gives catalogue entries of ONE item type to another person. `ids` are CATALOGUE ids. */
  bulkAssign(context: LaravelContext, itemType: PortfolioItemType, ids: number[], assignedTo: string): Promise<CrmBulkActionResponse> {
    return apiClient.post('/crm/products/bulk/assign', { ids, itemType, assignedTo, token: context.token, sub_institute_id: context.subInstituteId })
  },
}

export type PortfolioListApi = Pick<typeof portfolioListService, 'list' | 'lines' | 'meta' | 'matches' | 'decide' | 'crmIdOf' | 'bulkDelete' | 'bulkAssign'>
