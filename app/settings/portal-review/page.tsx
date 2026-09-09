import { redirect } from 'next/navigation'

/**
 * Portal Review moved into the setup wizard's last step.
 *
 * ── WHAT WAS HERE, AND WHY NONE OF IT SURVIVED ──────────────────────────────
 *
 * 461 lines in which almost nothing was real:
 *
 *   - It read `/api/onboarding`, a `globalThis` Map in the Next.js process that
 *     NOTHING WRITES. Every number on the page was therefore permanently 0 or
 *     "Not configured".
 *   - `configured` was computed for all five review cards and never
 *     destructured, so a hardcoded green "Completed" rendered on every one of
 *     them, directly above rows reading "Not configured".
 *   - Progress was `const COMPLETED = new Set([...])` and `currentStep={5}` -
 *     constants, not state.
 *   - "Go Live" called `localStorage.setItem('gtg-portal-live', 'true')`. No
 *     server call. That key is read NOWHERE in the codebase, so the button did
 *     literally nothing. So did "Save as Draft".
 *   - Three "Review" buttons - Employee Warnings, Organization Settings,
 *     Financial Year - flipped a local boolean and then permanently disabled
 *     themselves. They reviewed nothing.
 *   - Its Back button read "Back to Employee Import" and went to the setup
 *     checklist, which is not employee import.
 *
 * And `/settings` redirected here, so this was the default settings landing
 * page.
 *
 * ── WHERE IT WENT ───────────────────────────────────────────────────────────
 *
 * The idea was sound: read back what you have built before you call it done.
 * That is now the wizard's final step, where the numbers come from
 * `GET /api/organization/setup-status` - counted from the tenant's real tables -
 * and there is no "go live" flag because the product already knows, by
 * measurement, what is set up and what is not.
 */
export default function PortalReviewRedirect() {
  redirect('/organization/setup')
}
