import type { PmOption } from '../../services/product-master/types'

/** One opportunity, shaped like the existing presenter's answer (camelCase), with none of slice 11's fields: what an older server sends. */
export function opportunity(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '31', opportunityNo: 'OPP-AB12CD34', name: 'Hillcrest ERP rollout', organizationId: '5', organizationName: 'Hillcrest Academy', campaignId: null, campaignName: null,
    amount: 450000, currency: 'INR', closingDate: '2026-12-15', salesStage: 'Negotiation/Review', probability: 60, weightedRevenue: 270000, leadSource: null, potentialType: null,
    nextStep: null, forecastCategory: null, description: null, closeReason: null, convertedFromGtmDealId: null, assignedTo: '2', createdBy: '2',
    createdAt: '2026-11-01 10:00:00', updatedAt: null, ...over,
  }
}

export const PRODUCT = { id: 9, key: 'scholarclone-erp', name: 'School ERP' }

/** The seven reasons of config/crm_sales.php, as the pipeline answer lists them. */
export const REASONS = [
  { code: 'price', label: 'Price too high' },
  { code: 'no_budget', label: 'No budget' },
  { code: 'no_decision', label: 'No decision made' },
  { code: 'competitor', label: 'Chose a competitor' },
  { code: 'timing', label: 'Timing was wrong' },
  { code: 'no_response', label: 'Stopped responding' },
  { code: 'other', label: 'Other' },
]

export const STAGES = ['Prospecting', 'Qualification', 'Negotiation/Review', 'Closed Won', 'Closed Lost']

/** The pipeline answer (`GET /api/crm/opportunities/pipeline`); with `reasons` null it is an older server's, with no `lossReasons` key at all. */
export function pipelineAnswer(reasons: unknown[] | null = REASONS, stages: string[] = STAGES) {
  return {
    status: 1,
    message: 'Opportunity pipeline.',
    data: {
      stages: stages.map((stage) => ({ stage, label: stage, color: null, count: 0, totalAmount: 0 })),
      ...(reasons === null ? {} : { lossReasons: reasons }),
    },
  }
}

export const options: PmOption[] = [
  { id: 4, key: 'scholarclone', name: 'ScholarClone', kind: 'product', parentId: null, label: 'ScholarClone' },
  { id: 9, key: 'scholarclone-erp', name: 'School ERP', kind: 'sub_product', parentId: 4, label: 'ScholarClone › School ERP' },
  { id: 12, key: 'g2g', name: 'G2G', kind: 'product', parentId: null, label: 'G2G' },
]

export function listAnswer(items: unknown[], total?: number) {
  return { status: 1, message: 'Opportunities.', data: { items, pagination: { current_page: 1, last_page: Math.max(1, Math.ceil((total ?? items.length) / 20)), per_page: 20, total: total ?? items.length } } }
}
