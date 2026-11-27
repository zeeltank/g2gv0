import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import ClientPresentationLayout from '../module/lms/learning/client-presentation/layout'

/*
 * The public share pages. Same fonts as the signed-in deck, and told not to be indexed, cached, archived or passed on in a Referer:
 * the address carries the link's signature, so it must not leak to a search engine or to another site the viewer clicks through to.
 * The same rules are also sent as headers (next.config.mjs, source /present/:path*), which is what covers the 404 as well.
 */
export const metadata: Metadata = {
  title: 'ScholarClone',
  robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true, noimageindex: true },
  referrer: 'no-referrer',
}

export default function PublicPresentationLayout({ children }: { children: ReactNode }) {
  return <ClientPresentationLayout>{children}</ClientPresentationLayout>
}
