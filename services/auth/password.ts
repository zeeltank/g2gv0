import { apiClient } from '@/services/core'

/**
 * Setting a password — the endpoints that let somebody in for the first time.
 *
 * ── NO CONTEXT, NO TOKEN, ON PURPOSE ────────────────────────────────────────
 *
 * Every other service in this product takes a `LaravelContext` and sends the
 * signed-in user's token. These three cannot: the whole audience is people who
 * CANNOT sign in. The credential is the one-time token in the link.
 *
 * They are rate limited server-side (`throttle:6,1`) so the address list cannot
 * be walked and a token cannot be guessed.
 *
 * ── WHY THIS IS NOT `/settings/…` OR THE WEB ROUTES ─────────────────────────
 *
 * Laravel has had a `ForgotPasswordController` all along, on `routes/web.php`
 * behind session and CSRF middleware — which this frontend has neither of. Its
 * GET entry point also pointed at a method that was commented out, so it
 * returned a 500. That is why "Forgot password?" was a dead `href="#"` link for
 * so long. These are the API-stack equivalents.
 */

export type InviteCheck = {
  status: boolean
  message: string | null
  data: { email: string | null }
}

export type SetPasswordResponse = {
  status: boolean
  message: string
  data?: { email: string }
}

export const passwordService = {
  /** Is this link still good, and whose account is it? */
  check: (token: string) => apiClient.get<InviteCheck>(`/auth/invite/${token}`, {}),

  /** Spend the token and set a real password. */
  setPassword: (token: string, password: string, confirmation: string) =>
    apiClient.post<SetPasswordResponse>('/auth/set-password', {
      token,
      password,
      password_confirmation: confirmation,
    }),

  /**
   * Ask for a reset link.
   *
   * The reply is deliberately identical whether or not the address has an
   * account — so this cannot be used to find out who is registered — and it
   * never contains the link.
   */
  forgot: (email: string) =>
    apiClient.post<{ status: boolean; message: string }>('/auth/forgot-password', { email }),
}
