'use client'

/**
 * Client for AI Providers & Model Management — `/api/ai/configuration`.
 *
 * The write half of what `ai-capabilities.ts` reads. It is a separate file for the
 * same reason the controller behind it is a separate controller: the endpoints that
 * can change a credential are worth being able to find in one place.
 *
 * NOTHING HERE EVER RECEIVES AN API KEY BACK. A configuration arrives with
 * `key_preview` — four characters either side of a mask — which is enough to tell two
 * credentials apart and not enough to use one. The key travels in one direction only:
 * into `createAiConfiguration` / `updateAiConfiguration`.
 */

import { aiRequest } from './client'

export interface AiModuleOption {
  key: string
  label: string
  description: string
  /** True when this module resolves its provider through the saved configuration. */
  wired: boolean
  consumer: string
}

export interface AiProviderOption {
  key: string
  label: string
  /** False when the platform has no client shape that can call this provider. */
  driveable: boolean
  api_type: string
  docs: string
}

export interface AiModelOption {
  id: number
  provider: string
  model_id: string
  label: string
  max_output_tokens: number | null
  input_cost_per_1k: number | null
  output_cost_per_1k: number | null
  sort_order: number
  status: number
  /** `platform` rows are shared across the estate and read-only to an organisation. */
  scope: 'platform' | 'institute'
}

export interface AiConfigurationOptions {
  modules: AiModuleOption[]
  providers: AiProviderOption[]
  models: Record<string, AiModelOption[]>
  active_driver: string
}

export interface AiConfigurationRow {
  id: number
  ai_module: string | null
  module_label: string
  module_wired: boolean
  provider: string
  provider_label: string
  api_type: string
  model: string | null
  account_email: string | null
  api_limit: string | null
  status: number
  scope: 'platform' | 'institute'
  editable: boolean
  key_preview: string | null
  updated_at: string | null
}

/** What a module resolves to right now, including modules with nothing saved. */
export interface AiResolvedRow {
  module: string
  module_label: string
  description: string
  wired: boolean
  provider: string
  provider_label: string
  model: string | null
  source: 'module' | 'module_platform' | 'pool' | 'pool_platform' | 'env' | 'config'
  scope: string
  key_id: number | string | null
  has_key: boolean
  driveable: boolean
}

export interface AiConfigurationIndex {
  sub_institute_id: string | number
  configurations: AiConfigurationRow[]
  resolved: AiResolvedRow[]
}

export interface AiModelIndex {
  sub_institute_id: string | number
  providers: AiProviderOption[]
  models: Record<string, AiModelOption[]>
}

export interface AiConfigurationPayload {
  ai_module: string
  provider: string
  model: string | null
  /** Omitted on edit to leave the stored credential untouched. */
  api_key?: string
  account_email?: string | null
  api_limit?: number | null
  status?: number
}

export interface AiModelPayload {
  provider: string
  model_id: string
  label: string
  max_output_tokens?: number | null
  input_cost_per_1k?: number | null
  output_cost_per_1k?: number | null
  sort_order?: number
  status?: number
}

export function fetchAiConfigurationOptions(): Promise<AiConfigurationOptions> {
  return aiRequest<AiConfigurationOptions>('/configuration/options')
}

export function fetchAiConfigurations(): Promise<AiConfigurationIndex> {
  return aiRequest<AiConfigurationIndex>('/configuration')
}

export function createAiConfiguration(
  payload: AiConfigurationPayload,
): Promise<{ configuration: AiConfigurationRow }> {
  return aiRequest('/configuration', 'POST', payload)
}

export function updateAiConfiguration(
  id: number,
  payload: AiConfigurationPayload,
): Promise<{ configuration: AiConfigurationRow }> {
  return aiRequest(`/configuration/${id}`, 'PUT', payload)
}

export function retireAiConfiguration(id: number): Promise<{ id: number }> {
  return aiRequest(`/configuration/${id}`, 'DELETE')
}

export function fetchAiModels(): Promise<AiModelIndex> {
  return aiRequest<AiModelIndex>('/configuration-models')
}

export function createAiModel(payload: AiModelPayload): Promise<{ model: AiModelOption }> {
  return aiRequest('/configuration-models', 'POST', payload)
}

export function updateAiModel(id: number, payload: AiModelPayload): Promise<{ model: AiModelOption }> {
  return aiRequest(`/configuration-models/${id}`, 'PUT', payload)
}
