import { redirect } from 'next/navigation'
import { signalsRedirectTarget, type RawSearchParams } from '@/lib/signal-review-redirect'

/**
 * The Signal Review screen was merged into Company Opportunities (owner, 13 Nov 2026), so this address only sends a visitor on, keeping the query string
 * (`?status=all&q=...` as an old Ask answer, an agent run or a bookmark has it). It is a temporary (307) redirect until the owner confirms it is permanent, and it
 * stays for ever. The menu row behind it keeps `status 1` in the database; the sidebar hides it in code (lib/signals-nav.ts).
 */
export default async function SignalReviewRedirect({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  redirect(signalsRedirectTarget(await searchParams))
}
