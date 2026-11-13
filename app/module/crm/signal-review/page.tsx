import { redirect } from 'next/navigation'
import { signalsRedirectTarget, type RawSearchParams } from '@/lib/signal-review-redirect'

/**
 * The same redirect as app/signal-review/page.tsx, for the spelling under the CRM root: the Signal Review screen was merged into Company Opportunities (owner,
 * 13 Nov 2026), so a visitor is sent to the Signals screen with the query string kept. Temporary (307) until the owner confirms; it stays for ever, because
 * older Ask answers and agent runs carry this spelling inside their stored text.
 */
export default async function CrmSignalReviewRedirect({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  redirect(signalsRedirectTarget(await searchParams))
}
