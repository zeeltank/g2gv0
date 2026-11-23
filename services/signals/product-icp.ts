import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import type { ProductInfo } from '@/services/portfolio/types'

/**
 * A product's own Ideal Customer Profile (administrators only). The product is the address; the server decides the product line and
 * the validation, and saving never starts research.
 */

export interface IcpTrigger {
  source: string
  part?: string | null
  decay?: number | null
  pain?: string
  phrases: string[]
}

export interface IcpQuery {
  id: string
  source: string
  topic: string
  days: number
  q: string
  domains?: string[]
}

export interface IcpRule {
  attribute?: string
  field?: string
  op: string
  value?: unknown
  label: string
  prompt?: string
}

/** The settings the editor manages (everything else on a stored ICP is kept as stored by the server). */
export interface IcpConfig {
  label?: string
  pitch?: string
  industry_label?: string
  guidance?: string
  customer_model?: 'b2b' | 'b2c' | 'b2g' | 'both'
  buyer_types?: string[]
  regions?: string[]
  priority_cities?: string[]
  competitors?: string[]
  vendor_phrases?: string[]
  parts?: Record<string, string>
  triggers?: Record<string, IcpTrigger>
  queries?: IcpQuery[]
  disqualifiers?: { label: string; phrases: string[] }[]
  must_have?: IcpRule[]
  per_run?: { catalogue?: number; accounts?: number }
  /** The portfolio products this ICP is for, by Offer ID. Absent on an older ICP (it then uses its product's offers); an empty list means none chosen. */
  offer_ids?: string[]
}

export interface IcpEditorState {
  customer_model?: 'b2b' | 'b2c' | 'b2g'
  icp_models?: Record<'b2b' | 'b2c' | 'b2g', { ready: boolean; missing: string[]; configured: boolean }>
  product: ProductInfo & {
    state: 'ready' | 'needs_setup' | 'invalid'
    next_step: string | null
    draft_icp: { id: number; name: string } | null
  }
  profile: { id: number; key: string; name: string; status: 'draft' | 'active' | 'archived'; version: number; updated_at: string | null } | null
  config_source: 'saved' | 'template' | 'empty'
  config: IcpConfig
  problems: string[]
  profiles: { id: number; key: string; name: string; status: string; version: number }[]
  versions: { version: number; changed_by: number | null; note: string | null; at: string | null }[]
  options: { sources: string[]; topics: string[]; operators: string[]; max_searches_per_run: number }
}

const base = (c: LaravelContext): Record<string, string> => ({
  sub_institute_id: c.subInstituteId,
  ...(c.token ? { type: 'api', token: c.token } : {}),
})
const qs = (c: LaravelContext) => new URLSearchParams(base(c)).toString()
const path = (product: string) => `/signals/icp/products/${encodeURIComponent(product)}`

export interface IcpComparisonDimension {
  key: 'segment_fit' | 'need_coverage' | 'trigger_alignment'
  label: string
  weight: number
  description: string
  /** 0-100, or null when the ICP or the product holds too little data for this dimension. */
  score: number | null
  status: 'scored' | 'insufficient_data'
  matched: string[]
  missing: string[]
  evidence: string[]
  note: string
}

export interface IcpComparisonResult {
  offer: { id: number | null; offer_id: string | null; name: string | null; parent_product: string | null }
  status: 'scored' | 'insufficient_data'
  /** Null whenever the data is insufficient: no score is ever made up. */
  score: number | null
  summary: string
  method: string
  ai_used: boolean
  dimensions: IcpComparisonDimension[]
  gaps: { dimension: string; requirement: string }[]
  market: { icp_industry: string | null; icp_regions: string[]; product_segments: string[]; deployment_model: string | null; geography_status: string; note: string }
  facts: { readiness_status: string | null; readiness_confirmed: boolean; pricing_model: string | null; typical_deal_band: string | null }
  recommendations: string[]
}

export interface IcpComparison {
  status: number
  data: {
    product: string
    icp: { label: string | null; industry_label: string | null; buyer_types: string[]; regions: string[]; parts: number; triggers: number; saved: boolean }
    method: string
    results: IcpComparisonResult[]
    unknown_offer_ids: string[]
  }
}

export interface IcpCheckResult {
  status: number
  data: { valid: boolean; problems: string[]; activation_blockers: string[] }
}

/** The product after it was created, as the products list describes it. */
export interface CreatedProduct { status: number; message: string; data: { product: ProductInfo } }

export interface ProductDependencies {
  status: number
  data: {
    key: string
    label: string
    sub_products_count: number
    icp_profiles_count: number
    opportunities_count: number
    research_runs_count: number
    target_accounts_count: number
    can_delete: boolean
  }
}

export const productIcpService = {
  /** Creates a NEW top-level product for the organisation (administrators only). */
  createProduct: (c: LaravelContext, body: { key: string; label: string; description?: string; category?: string; logo?: string; status?: string }) =>
    apiClient.post<CreatedProduct>(`/signals/icp/products?${qs(c)}`, body),

  /** Updates an existing Main Product (custom or built-in). */
  updateProduct: (c: LaravelContext, product: string, body: { label?: string; description?: string; category?: string; logo?: string; status?: string }) =>
    apiClient.put<{ status: number; message: string; data: { product: ProductInfo } }>(`${path(product)}?${qs(c)}`, body),

  /** Inspects product dependencies before safe deletion. */
  getProductDependencies: (c: LaravelContext, product: string) =>
    apiClient.get<ProductDependencies>(`${path(product)}/dependencies?${qs(c)}`),

  /** Deletes a product from the database with safe sub-product archiving and foreign-key preservation. */
  deleteProduct: (c: LaravelContext, product: string) =>
    apiClient.delete<{ status: number; message: string; data: { removed: string } }>(`${path(product)}?${qs(c)}`),

  /** Checks an ICP's settings on the server before the product exists (no product needed). Nothing is saved. */
  checkConfig: (c: LaravelContext, config: IcpConfig, model: 'b2b' | 'b2c' | 'b2g' = 'b2b') =>
    apiClient.post<{ status: number; data: { valid: boolean; problems: string[] } }>(`/signals/icp/validate?${qs(c)}`, { config, customer_model: model }),
}
