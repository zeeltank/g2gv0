import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import ClientPresentationLayout from '@/app/module/lms/learning/client-presentation/layout'

/*
 * Everything under /share: the public pages of a Sales Kit link. The same fonts as the signed-in deck (the interactive deck is one of the things a link can open, and it needs them), and told not
 * to be indexed, cached, archived or passed on in a Referer, as /present is. The same rules are also sent as headers (next.config.mjs, source /share/:path*), which is what covers the 404 as well.
 * The font loader is called in that layout module and stays there.
 */
export const metadata: Metadata = {
  title: 'Shared from the Sales Kit',
  robots: 'noindex, nofollow, noarchive, nosnippet, noimageindex',
  referrer: 'no-referrer',
}

export default function PublicShareLayout({ children }: { children: ReactNode }) {
  return <ClientPresentationLayout>{children}</ClientPresentationLayout>
}
