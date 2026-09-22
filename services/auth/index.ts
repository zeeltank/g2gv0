/**
 * Auth Service
 *
 * Backed by the Laravel web route `Route::resource('login', authController::class)`
 * (App\Http\Controllers\auth\authController::index). The controller reads
 * email / password / type from the query string and replies with JSON when
 * `type=API`, so the call is a GET - exactly like the Laravel-side client.
 */

import { webClient } from '@/services/core'
import type { LaravelSessionData } from '@/lib/laravel-session'

/** `$res['data']` - the tbluser row plus the resolved profile name. */
export interface LaravelLoginUser {
  id: number
  user_name: string | null
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  email: string | null
  mobile: string | null
  user_profile_id: number | null
  user_profile?: string | null
  sub_institute_id: number | string
  client_id: number | string | null
  is_admin: number | boolean | null
  status: number | boolean | null
  employee_no: string | null
  department_id: number | string | null
  image: string | null
}

export interface LaravelAcademicTerm {
  id: number
  title: string | null
  syear: number | string | null
  start_date: string | null
  end_date: string | null
  sort_order?: number | null
}

export interface LaravelAcademicYear {
  id: number
  syear: number | string | null
}

/**
 * Success  -> { status: 1, message, data, academicTerms, academicYears, sessionData }
 * Rejected -> { status: 0, message: "Invalid User Id And Password" } (HTTP 200)
 * Invalid  -> { status: false, message: "<first validation error>" } (HTTP 422,
 *             surfaced as an ApiError by the api client before it reaches here)
 */
export interface LaravelLoginResponse {
  status: number | boolean | string
  message?: string | Record<string, string[]> | null
  data?: LaravelLoginUser
  academicTerms?: LaravelAcademicTerm[]
  academicYears?: LaravelAcademicYear[]
  sessionData?: LaravelSessionData
}

export interface LoginCredentials {
  email: string
  password: string
  /**
   * A code from the authenticator app, on the second attempt.
   *
   * Absent on the first call, always. The server answers 401 with
   * `two_factor_required` when the account is enrolled and no code was sent, and
   * the screen then asks for one — so nothing here has to know in advance whether
   * a given account has two-step verification on.
   */
  twoFactorCode?: string
  /** One of the ten single-use codes, for somebody without their phone. */
  recoveryCode?: string
}

export const LOGIN_FAILED_MESSAGE = 'Invalid User Id And Password'

/** Laravel sends 1 on success and 0/false on every rejection. */
export function isLoginSuccess(status: LaravelLoginResponse['status']): boolean {
  if (typeof status === 'boolean') return status
  return Number(status) === 1
}

/**
 * `message` is a plain string on this endpoint, but the sibling OTP actions put
 * a validator bag there - flatten either shape into something displayable.
 */
export function resolveLoginMessage(
  message: LaravelLoginResponse['message'],
  fallback = LOGIN_FAILED_MESSAGE,
): string {
  if (typeof message === 'string' && message.trim()) return message.trim()

  if (message && typeof message === 'object') {
    const first = Object.values(message).flat().find((entry) => typeof entry === 'string' && entry)
    if (first) return first
  }

  return fallback
}

export const authService = {
  /**
   * `credentials: 'include'` mirrors the Laravel-side client so the ERP session
   * cookie is accepted when the frontend is served from an allowed origin.
   */
  login: (credentials: LoginCredentials) =>
    webClient.get<LaravelLoginResponse>(
      '/login',
      {
        email: credentials.email,
        password: credentials.password,
        type: 'API',
        /*
         * Sent only when there is one, so the server can tell "has not been asked
         * yet" from "answered wrongly" — it returns `two_factor_required` for the
         * first and an error for the second, and an always-present empty string
         * would collapse the two.
         *
         * The parameter names are the server's: `two_factor_code` and
         * `recovery_code`, read in authController::twoFactorChallenge.
         */
        ...(credentials.twoFactorCode ? { two_factor_code: credentials.twoFactorCode } : {}),
        ...(credentials.recoveryCode ? { recovery_code: credentials.recoveryCode } : {}),
      },
      { credentials: 'include' },
    ),
}
