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
}

export interface IcpEditorState {
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

export interface IcpCheckResult {
  status: number
  data: { valid: boolean; problems: string[]; activation_blockers: string[] }
}

export const productIcpService = {
  get: (c: LaravelContext, product: string) => apiClient.get<{ status: number; data: IcpEditorState }>(path(product), base(c)),

  /** Checks the ICP on the server. Nothing is saved. */
  check: (c: LaravelContext, product: string, config: IcpConfig) =>
    apiClient.post<IcpCheckResult>(`${path(product)}/validate?${qs(c)}`, { config }),

  /** Saves (a new version of) the product's ICP. `activate` also makes it the product's active ICP. Starts no research. */
  save: (c: LaravelContext, product: string, body: { config: IcpConfig; name?: string; note?: string; activate?: boolean }) =>
    apiClient.put<{ status: number; message: string; data: IcpEditorState }>(`${path(product)}?${qs(c)}`, body),

  setStatus: (c: LaravelContext, product: string, status: 'active' | 'draft' | 'archived') =>
    apiClient.patch<{ status: number; data: IcpEditorState }>(`${path(product)}/status?${qs(c)}`, { status }),
}
