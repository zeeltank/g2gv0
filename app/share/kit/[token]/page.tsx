import type { Metadata } from 'next'

import { sharedKitElement } from './shared-kit-page'

// Every request asks the server again, so a stopped or expired link stops working at once and no copy of a shared page is ever served from a cache.
export const dynamic = 'force-dynamic'

// The address is a secret link: never indexed, archived or passed on in a Referer (the same rules are also sent as headers, next.config.mjs, source /share/:path*).
export const metadata: Metadata = {
  title: 'Shared from the Sales Kit',
  robots: 'noindex, nofollow, noarchive, nosnippet, noimageindex',
  referrer: 'no-referrer',
}

/**
 * A Sales Kit entry shared by link, for somebody who is not signed in. It is NOT a way round sign-in: it opens ONE entry, only with the link's own token, and it sets no cookie, creates no
 * session and calls no authenticated API. Every refusal is the same plain 404 (see `sharedKitElement`).
 */
export default async function SharedKitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  return sharedKitElement(token)
}
