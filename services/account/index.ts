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

/** The employment facts a person may see about themselves but not change. */
export type AccountWork = {
  /** From `s_user_jobrole` via `jobtitle_id` - NOT `s_jobrole`; see the server. */
  job_title: string | null
  department: string | null
  /** Null for every live user today: nothing populates `reporting_manager_id` yet. */
  reporting_manager: string | null
  employee_no: string | null
  /** Sparse - 14 of 299 live people have one. Omit it when null, do not print a dash. */
  joined_date: string | null
}

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

  /**
   * WHO THIS PERSON IS AT WORK. READ-ONLY.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * WHY THIS IS A SEPARATE OBJECT AND NOT MORE FIELDS ALONGSIDE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Everything above is editable by its owner. Nothing in here is - it belongs to
   * HR, and `AccountController::updateProfile` discards a write to any of it the
   * same way it discards an invented field.
   *
   * Nesting it says that in the type rather than in a comment somebody has to
   * find: a screen cannot accidentally drop `work.job_title` into a form and
   * wonder why saving does nothing, because it is not shaped like the fields that
   * save.
   *
   * It exists because this product had TWO profile screens. `/profile` fetched the
   * HRMS endpoints separately just to show a job title, while `/settings?s=profile`
   * was the only place anything could be changed - two sources of truth for one
   * person, with no reason to agree. This is the one source.
   */
  work: AccountWork | null
}

export type Theme = 'system' | 'light' | 'dark'

/**
 * Who may see a personal field, narrowest last.
 *
 * `everyone` is the default deliberately: changing what existing organisations
 * already see, silently, on the day of a deploy would break directories people
 * rely on. The honest move is to offer the choice, not to make it for them.
 */
export type Visibility = 'everyone' | 'department' | 'private'

export type AccountPreferences = {
  theme: Theme
  sidebar_collapsed: boolean
  density: 'comfortable' | 'compact'
  locale: string
  timezone: string
  date_format: string
  landing_page: 'dashboard' | 'last-visited'
  notify_email: boolean

  /*
   * How somebody presents themselves. Stored as preferences rather than as
   * columns on a 99-column `tbluser` - see UserPreferences::DEFAULTS.
   */
  display_name: string
  pronouns: string
  about: string

  /* Who may see the parts of a person that are not work. */
  visible_mobile: Visibility
  visible_birthdate: Visibility
  visible_address: Visibility
  /** One switch per event the dispatcher can send. */
  notify_events: Record<string, boolean>
}

/** What enrolment hands back so an app can be set up. */
export type TwoFactorEnrolment = {
  secret: string
  /** In groups of four, because this gets typed in by hand. */
  secret_grouped: string
  /**
   * `otpauth://…` — on a phone, tapping this opens the authenticator and enrols.
   *
   * There is no QR image: no encoder exists in either repository, and writing one
   * means Reed-Solomon error correction with no published vectors to check it
   * against. Tap-to-enrol and manual entry cover both devices without one.
   */
  uri: string
  digits: number
  period: number
}

/** One line of a person's security history. */
export type AccountActivityEntry = {
  /** `sign_in` comes from a token; `event` from the event store. */
  kind: 'sign_in' | 'event'
  type: string
  at: string | null
  /** The device label, on sign-ins only. */
  device: string | null
  detail: string | null
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
    /**
     * Whether two-step verification is on, and how much fallback is left.
     *
     * Read from here rather than from a call of its own: this payload is already
     * fetched once per session and held in `PreferencesProvider`, so the badge is
     * right the moment Sign-in & security opens. `recovery_codes_left` is a COUNT
     * and never the codes — those exist in readable form exactly once, in the
     * response that issues them.
     */
    two_factor: {
      enabled: boolean
      recovery_codes_left: number
      /**
       * Whether the ORGANISATION obliges this person to have it on.
       *
       * True with `enabled: false` means every other endpoint is returning 403 —
       * `RequireTwoFactorEnrolment` refuses everything but this payload and the two
       * enrolment calls. It is what lets the screen explain a product that has
       * apparently stopped working, instead of leaving somebody to conclude it is
       * broken.
       */
      required: boolean
    }
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

  /**
   * Replace the photo and nothing else.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * WHY THIS EXISTS ALONGSIDE `updateProfile`
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Settings sends the photo WITH the text fields, because there it is one field
   * of a form and a half-saved form is the thing to avoid. `/profile` has no form
   * at all, so the photo has to commit on its own the moment it is framed.
   *
   * Rather than let that screen hand-roll a second multipart call, both paths go
   * through one uploader. `putForm` adds `_method=PUT`, which Laravel's method
   * spoofing turns back into the PUT route - the SAME route and controller the
   * JSON path uses, so there is no second endpoint to keep in step.
   *
   * `image_error` comes back when the file reached the server and the object store
   * refused it. The profile row is still written in that case, so the caller has
   * to surface the message rather than treat a 200 as complete success.
   */
  updatePhoto: (context: LaravelContext, file: File) => {
    const body = new FormData()
    body.append('type', 'API')
    body.append('token', context.token)
    body.append('image', file)

    return apiClient.putForm<AccountMe & { image_error?: string }>('/account/profile', body)
  },

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

  /**
   * End this session on the server.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * SIGNING OUT USED TO BE PURELY LOCAL
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * There was no logout endpoint in the backend at all, so "Sign out" cleared
   * localStorage and nothing else. The Sanctum token stayed valid for its full
   * 30-day window: anybody who recovered it from a shared machine was still
   * authenticated as that person.
   *
   * Revokes only the calling token. Signing out of a laptop must not sign the same
   * person out of their phone - that is `endSessions`, a separate action somebody
   * chooses deliberately.
   *
   * ── THE CALLER MUST NOT WAIT ON THIS TO SUCCEED ─────────────────────────────
   *
   * A person clicking Sign out has to end up signed out even if the network is
   * down. So callers fire this and clear local state regardless; see `logout()` in
   * `gtg-auth.tsx`. Leaving somebody stuck in a session because a request failed
   * would be a worse outcome than a token that outlives the browser state.
   */
  logout: (context: LaravelContext) =>
    apiClient.post<{ status: boolean; message: string }>('/account/logout', params(context)),

  /* ── two-step verification ─────────────────────────────────────────────── */

  /**
   * Begin enrolment. Returns a secret that does NOT yet protect the account.
   *
   * No password required, deliberately: asking for one to ADD protection only
   * discourages people from adding it. The two calls that WEAKEN it do ask.
   */
  twoFactorStart: (context: LaravelContext) =>
    apiClient.post<{ status: boolean; data: TwoFactorEnrolment }>(
      '/account/2fa/start',
      params(context),
    ),

  /** Confirm with a code from the app. Returns the recovery codes, once. */
  twoFactorConfirm: (context: LaravelContext, code: string) =>
    apiClient.post<{ status: boolean; message: string; data: { recovery_codes: string[] } }>(
      '/account/2fa/confirm',
      { ...params(context), code },
    ),

  /** Fresh recovery codes. The old set stops working. */
  twoFactorRecoveryCodes: (context: LaravelContext, currentPassword: string) =>
    apiClient.post<{ status: boolean; message: string; data: { recovery_codes: string[] } }>(
      '/account/2fa/recovery-codes',
      { ...params(context), current_password: currentPassword },
    ),

  /**
   * Turn it off. Needs the password — it is a reduction in protection.
   *
   * POST, not DELETE, and that is about the password rather than about REST:
   * `apiClient.delete()` has no body and puts its parameters in the QUERY STRING.
   * `api-client.ts` already documents why that is unacceptable for a credential —
   * "a URL is not a private place: access logs, browser history, proxy and CDN
   * logs, and the Referer header". A password there is worse than the token that
   * note was written about, so no DELETE route is offered at all.
   */
  twoFactorDisable: (context: LaravelContext, currentPassword: string) =>
    apiClient.post<{ status: boolean; message: string }>('/account/2fa/disable', {
      ...params(context),
      current_password: currentPassword,
    }),

  /**
   * This person's own security history.
   *
   * No id parameter by design: the server resolves the subject from the token, so
   * there is nothing here that could be pointed at somebody else.
   */
  activity: (context: LaravelContext, limit = 25) =>
    apiClient.get<{
      status: boolean
      data: { entries: AccountActivityEntry[]; since: string | null }
    }>('/account/activity', { ...params(context), limit: String(limit) }),

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
