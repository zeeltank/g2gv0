import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { getDeviceId } from '@/lib/device-id'

/**
 * Your own account — the first self-service surface in this product.
 *
 * ── NOTHING HERE TAKES A USER ID ────────────────────────────────────────────
 *
 * Every endpoint resolves the subject from the token's owner. There is no
 * parameter that could name somebody else, which is why these are safe to call
 * from any role without a further guard: an employee and an administrator both
 * reach their own record and only their own.
 */

export type AccountProfile = {
  id: number
  email: string | null
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  name_suffix: string | null
  mobile: string | null
  gender: string | null
  birthdate: string | null
  address: string | null
  address_2: string | null
  city: string | null
  state: string | null
  pincode: string | null
  image: string | null
  /** Built server-side from the object store — the frontend must not know the CDN host. */
  image_url: string | null
  employee_no: string | null
  last_login: string | null
}

export type Theme = 'system' | 'light' | 'dark'

export type AccountPreferences = {
  theme: Theme
  sidebar_collapsed: boolean
  density: 'comfortable' | 'compact'
  locale: string
  timezone: string
  date_format: string
  landing_page: 'dashboard' | 'last-visited'
  notify_email: boolean
  /** One switch per event the dispatcher can send. */
  notify_events: Record<string, boolean>
}

export type AccountSession = {
  id: number
  name: string
  last_used_at: string | null
  created_at: string | null
  expires_at: string | null
  /** The session making this request. It cannot be ended by id. */
  current: boolean
}

/** Which of this person's settings are pinned to the browser they are using. */
export type DeviceScope = {
  device_id: string
  /** False when the browser could not keep an id — private window, storage blocked. */
  is_device: boolean
  device_scoped_keys: string[]
}

export type AccountMe = {
  status: boolean
  data: {
    profile: AccountProfile
    preferences: AccountPreferences
    device_scope: DeviceScope
    /** Decides which SECTIONS are shown. Presentation only — every endpoint is guarded. */
    role: string | null
    notifiable_events: string[]
    /**
     * The subset of `notifiable_events` an email can actually be BUILT for.
     *
     * Three of the ten have an in-app template and no email one, so they can
     * never be emailed. The screen marks them rather than offering a switch
     * that changes nothing.
     */
    emailable_events: string[]
    choices: {
      theme: Theme[]
      landing_page: string[]
      date_format: string[]
    }
  }
}

/**
 * Auth plus this browser's identity.
 *
 * `device_id` rides on every account call, read and write. The server decides
 * which keys it applies to (`UserPreferences::DEVICE_SCOPED` — theme, sidebar,
 * density) and stores everything else against the account, so no caller here has
 * to know or remember the distinction.
 */
function params(context: LaravelContext) {
  return {
    ...(context.token ? { type: 'api', token: context.token } : {}),
    ...(getDeviceId() ? { device_id: getDeviceId() } : {}),
  }
}

export const accountService = {
  me: (context: LaravelContext) => apiClient.get<AccountMe>('/account/me', params(context)),

  updateProfile: (context: LaravelContext, changes: Partial<AccountProfile>) =>
    apiClient.put<AccountMe>('/account/profile', { ...params(context), ...changes }),

  updatePreferences: (context: LaravelContext, changes: Partial<AccountPreferences>) =>
    apiClient.put<{ status: boolean; message: string; data: { preferences: AccountPreferences } }>(
      '/account/preferences',
      { ...params(context), ...changes },
    ),

  changePassword: (
    context: LaravelContext,
    currentPassword: string,
    password: string,
    confirmation: string,
  ) =>
    apiClient.post<{ status: boolean; message: string }>('/account/password', {
      ...params(context),
      current_password: currentPassword,
      password,
      password_confirmation: confirmation,
    }),

  sessions: (context: LaravelContext) =>
    apiClient.get<{ status: boolean; data: { sessions: AccountSession[] } }>(
      '/account/sessions',
      params(context),
    ),

  // `delete` takes the params map directly, not an options object.
  endSession: (context: LaravelContext, id: number) =>
    apiClient.delete<{ status: boolean; message: string }>(
      `/account/sessions/${id}`,
      params(context) as Record<string, string>,
    ),

  /** "Use these on all my devices" — copy this browser's appearance to the account. */
  promotePreferences: (context: LaravelContext) =>
    apiClient.post<{ status: boolean; message: string; data: { preferences: AccountPreferences } }>(
      '/account/preferences/promote',
      params(context),
    ),

  /** Forget this browser's overrides, so it follows the account default again. */
  forgetDevicePreferences: (context: LaravelContext) =>
    apiClient.delete<{ status: boolean; message: string; data: { preferences: AccountPreferences } }>(
      '/account/preferences/device',
      params(context) as Record<string, string>,
    ),

  /** Sign out everywhere except the device making the request. */
  endOtherSessions: (context: LaravelContext) =>
    apiClient.delete<{ status: boolean; message: string }>(
      '/account/sessions',
      params(context) as Record<string, string>,
    ),
}
