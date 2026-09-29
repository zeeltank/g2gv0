/**
 * Integrations — every third-party connection this platform declares.
 *
 * ── FOUR KINDS, AND ONLY `credential` IS WRITABLE HERE ──────────────────────
 *
 * `readonly_env` mirrors an env-flag check that already exists elsewhere (the
 * task-management session endpoint); `oauth_stub` surfaces NangoController's own
 * honest "not configured" state; `crud_existing` summarises `lms_integrations` and
 * links to the real screen that owns it (LMS Administration & Governance) rather
 * than re-implementing that CRUD here. `credential` is the only kind this file's
 * `saveIntegration`/`testIntegration`/`deleteIntegration` touch — see
 * `IntegrationController` for why.
 *
 * A `password`-type field's `value` is always null from the server; `has_value`
 * says whether one is saved. Never render `value` as a password's current text —
 * there isn't one to render, by design.
 */

import { platformRequest } from './client'

export type IntegrationKind = 'readonly_env' | 'oauth_stub' | 'crud_existing' | 'credential'
export type IntegrationStatus = 'configured' | 'not_configured' | 'error' | 'unknown'
export type IntegrationFieldType = 'text' | 'number' | 'select' | 'password'

export interface IntegrationFieldDef {
  key: string
  label: string
  type: IntegrationFieldType
  required: boolean
  options: string[] | null
  /** Never populated for a `password` field — see the file note. */
  value: string | number | null
  /** Only meaningful for a `password` field. Null for every other type. */
  has_value: boolean | null
}

export interface IntegrationProvider {
  key: string
  label: string
  description: string
  module: string | null
  kind: IntegrationKind
  status: IntegrationStatus
  /** `readonly_env` only — the env var this reads. */
  env?: string | null
  /** `crud_existing` only. */
  screen?: string | null
  connected_count?: number | null
  total_count?: number | null
  /** `credential` only. */
  fields?: IntegrationFieldDef[]
  last_tested_at?: string | null
  last_test_message?: string | null
  updated_at?: string | null
  updated_by?: string | null
}

/** `module` narrows to one module's own providers — the decentralized Integration tab. */
export function fetchIntegrations(module?: string): Promise<{ providers: IntegrationProvider[] }> {
  return platformRequest<{ providers: IntegrationProvider[] }>('/integrations', { module })
}

/** `config` is field key -> value. Omit a `password` field (or send it empty) to
    leave a previously-saved secret unchanged — it is never required on every save. */
export function saveIntegration(
  key: string,
  config: Record<string, string | number>,
): Promise<{ provider: IntegrationProvider }> {
  return platformRequest<{ provider: IntegrationProvider }>(`/integrations/${key}`, undefined, {
    method: 'POST',
    body: { config },
  })
}

/**
 * A real connectivity test — an actual SMTP handshake or an actual signed HTTP POST,
 * never a canned success. Pass `config` to test values before they are saved;
 * omit it to re-test whatever is already stored.
 */
export function testIntegration(
  key: string,
  config?: Record<string, string | number>,
): Promise<{ ok: boolean; message: string }> {
  return platformRequest<{ ok: boolean; message: string }>(`/integrations/${key}/test`, undefined, {
    method: 'POST',
    body: config ? { config } : {},
  })
}

export function deleteIntegration(key: string): Promise<{ deleted: string }> {
  return platformRequest<{ deleted: string }>(`/integrations/${key}`, undefined, { method: 'DELETE' })
}
