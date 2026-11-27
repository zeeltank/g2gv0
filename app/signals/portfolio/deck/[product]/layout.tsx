import type { ReactNode } from 'react'

import ClientPresentationLayout from '@/app/module/lms/learning/client-presentation/layout'

/*
 * The interactive deck of the Sales Kit, at an address that does not say "learning". It is the same player and the same fonts as the signed-in client presentation under
 * /module/lms/learning (that layout loads Manrope and Fraunces, self-hosted); only the address differs, so a Sales Kit link does not look like a My Learning course. The font loader is
 * called in that layout module and stays there: Next.js needs `next/font` to be called at the top of the module that owns it, so this file only wraps it, as /present does.
 */
export default function SalesKitDeckLayout({ children }: { children: ReactNode }) {
  return <ClientPresentationLayout>{children}</ClientPresentationLayout>
}
