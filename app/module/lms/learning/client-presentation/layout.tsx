import { Fraunces, Manrope } from 'next/font/google'

import type { ReactNode } from 'react'

/*
 * Fonts for the client presentation only. Manrope is the ScholarClone brand heading face; Fraunces is the editorial serif used for the
 * large questions and statements. Both are self-hosted by next/font at build time (no request to Google from the visitor's browser).
 */
const display = Fraunces({ subsets: ['latin'], style: ['normal', 'italic'], axes: ['opsz'], variable: '--cp-display', display: 'swap' })
const sans = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--cp-sans', display: 'swap' })

export default function ClientPresentationLayout({ children }: { children: ReactNode }) {
  return <div className={`${display.variable} ${sans.variable}`}>{children}</div>
}
