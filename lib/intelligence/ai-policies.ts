'use client'

/**
 * Client for AI Policies — `/api/ai/policies`.
 *
 * A policy is three records that only mean something together: the policy, its
 * switches, and the scopes it applies to. They are sent and received as one payload
 * for that reason — a partial save would leave a policy on the screen that governs
 * nothing.
 */

import { aiRequest } from './client'

export interface AiPolicyOption {
  value: string
  label: string
}

export interface AiPolicyRuleCatalogItem {
  key: string
  label: string
  default: boolean
}

export interface AiPolicyAssignment {
  id: number
  policy_id: number
  /** `module` means `scope_id` is an `ai_modules` row id. See AiPolicyController. */
  scope_type: string
  scope_id: number | null
  sub_institute_id: number | null
  status: number
}

/** A row a scope can point at. The id is what an assignment stores. */
export interface AiPolicyScopeTarget {
  id: number
  label: string
}

export interface AiPolicyRow {
  id: number
  sub_institute_id: number | null
  /** A shared baseline policy. Visible to every organisation, editable by none. */
  is_platform: boolean
  editable: boolean
  name: string
  description: string | null
  policy_type: string
  status: number
  require_disclosure: number
  require_acknowledgement: number
  ai_detection_required: number
  plagiarism_check_required: number
  detection_provider: string | null
  detection_threshold: number | null
  rules: Record<string, boolean>
  assignments: AiPolicyAssignment[]
  /** Module keys this policy governs, resolved from its `module` assignments. */
  module_keys?: string[]
  created_at?: string | null
  updated_at?: string | null
}

export interface AiPolicyOptions {
  policy_types: AiPolicyOption[]
  rule_catalogue: AiPolicyRuleCatalogItem[]
  scope_types: AiPolicyOption[]
  /**
   * The real rows each scope can name, keyed by scope type.
   *
   * A scope with nothing in this deployment arrives as an empty list, and the form
   * then offers the scope without a picker rather than offering ids that match
   * nothing.
   */
  scope_targets: Record<string, AiPolicyScopeTarget[]>
}

export interface AiPolicyIndex {
  sub_institute_id: string | number
  /** The module the list was narrowed to, or null for every policy. */
  module_key?: string | null
  /** The `ai_modules` ids that key resolved to — what a new assignment must name. */
  module_ids?: number[]
  policies: AiPolicyRow[]
}

export interface AiPolicyPayload {
  name: string
  description?: string | null
  policy_type: string
  status?: number
  require_disclosure?: number
  require_acknowledgement?: number
  ai_detection_required?: number
  plagiarism_check_required?: number
  detection_provider?: string | null
  detection_threshold?: number | null
  rules: Record<string, boolean>
  assignments: Array<{
    scope_type: string
    scope_id: number | null
    status?: number
  }>
}

export function fetchAiPolicyOptions(): Promise<AiPolicyOptions> {
  return aiRequest<AiPolicyOptions>('/policies/options')
}

/** Policies for one module. Omit `moduleKey` for every policy the organisation can see. */
export function fetchAiPolicies(moduleKey?: string | null): Promise<AiPolicyIndex> {
  const query = moduleKey ? `?module_key=${encodeURIComponent(moduleKey)}` : ''

  return aiRequest<AiPolicyIndex>(`/policies${query}`)
}

export function createAiPolicy(payload: AiPolicyPayload): Promise<{ policy: AiPolicyRow }> {
  return aiRequest('/policies', 'POST', payload)
}

export function updateAiPolicy(id: number, payload: AiPolicyPayload): Promise<{ policy: AiPolicyRow }> {
  return aiRequest(`/policies/${id}`, 'PUT', payload)
}

export function retireAiPolicy(id: number): Promise<{ id: number }> {
  return aiRequest(`/policies/${id}`, 'DELETE')
}
