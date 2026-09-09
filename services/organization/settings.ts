import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'

/**
 * Organisation-level settings and the audit trail.
 *
 * No tenant id is ever sent. Like `/account/*`, every one of these resolves the
 * organisation from the token's owner — so there is no parameter that could
 * name somebody else's, and no way for a caller to read across.
 */

export type OrgSettings = {
  'org.week_start': string
  'org.working_days': string
  'org.financial_year_start_month': string
  'org.currency': string
  'org.date_format': string
  'org.number_format': string
  'org.timezone': string
  'security.password_min_length': string
  'security.password_require_symbol': string
  'security.invite_hours': string
  'security.otp_login_enabled': string
}

export type OrgSettingsResponse = {
  status: number
  data: {
    settings: OrgSettings
    working_days: string[]
    choices: {
      date_format: string[]
      number_format: string[]
      week_start: string[]
    }
    /**
     * Which groups have a reader in the product TODAY.
     *
     * Reported by the server so the screen can label what is live and what is
     * being kept for later, rather than implying every stored choice is applied.
     */
    enforced: {
      password_policy: boolean
      invite_hours: boolean
      otp_login: boolean
      calendar: boolean
      formats: boolean
    }
  }
}

export type AuditEntry = {
  id: number
  type: string
  entity_type: string | null
  entity_id: string | null
  actor_id: number | null
  /** Null when the actor's account has since been removed. The entry outlives them. */
  actor_name: string | null
  detail: string | null
  occurred_at: string | null
}

export type AuditResponse = {
  status: number
  data: {
    entries: AuditEntry[]
    total: number
    next_cursor: number | null
    /** The types this organisation has actually produced, not a hardcoded list. */
    types: string[]
  }
}

function auth(context: LaravelContext) {
  return { type: 'api', token: context.token }
}

export const organizationSettingsService = {
  get: (context: LaravelContext) =>
    apiClient.get<OrgSettingsResponse>('/organization/settings', auth(context)),

  /**
   * Save some settings.
   *
   * ── THE WIRE KEYS ARE FLAT; THE STORED KEYS ARE PREFIXED ──────────────────
   *
   * `org.date_format` is how the setting is STORED, and it is prefixed so one
   * tenant's rows stay legible across modules. It is NOT how it is sent: a dot
   * in a Laravel validation key means nested-array access, so a dotted request
   * key makes every rule silently skip. The endpoint validated nothing until
   * this was found.
   *
   * This function takes the stored keys — the ones callers already have from
   * `settings` — and flattens them on the way out, so no caller has to know.
   */
  save: (
    context: LaravelContext,
    changes: Partial<Record<keyof OrgSettings, string | number | boolean>>,
  ) => {
    const flat: Record<string, string | number | boolean> = {}

    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) continue

      // 'org.date_format' -> 'date_format', 'security.invite_hours' -> 'invite_hours'
      flat[key.replace(/^(org|security)\./, '')] = value
    }

    return apiClient.put<OrgSettingsResponse>('/organization/settings', {
      ...auth(context),
      ...flat,
    })
  },

  audit: (
    context: LaravelContext,
    filters: { type?: string; from?: string; to?: string; cursor?: number } = {},
  ) =>
    apiClient.get<AuditResponse>('/organization/audit', {
      ...auth(context),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
      ...(filters.cursor ? { cursor: String(filters.cursor) } : {}),
    }),
}
