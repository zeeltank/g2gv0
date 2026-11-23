import localFont from 'next/font/local'

import type { ReactNode } from 'react'

/*
 * Fonts for the client presentation only. Manrope is the ScholarClone brand heading face; Fraunces is the editorial serif used for the
 * large questions and statements. Both are self-hosted (components/domain/lms/client-presentation/fonts, OFL 1.1), so neither the
 * build nor the visitor's browser makes any request to Google.
 */
const display = localFont({
  src: [
    { path: '../../../../../components/domain/lms/client-presentation/fonts/Fraunces-normal-latin.woff2', weight: '100 900', style: 'normal' },
    { path: '../../../../../components/domain/lms/client-presentation/fonts/Fraunces-italic-latin.woff2', weight: '100 900', style: 'italic' },
  ],
  variable: '--cp-display',
  display: 'swap',
})
const sans = localFont({
  src: [{ path: '../../../../../components/domain/lms/client-presentation/fonts/Manrope-latin.woff2', weight: '200 800', style: 'normal' }],
  variable: '--cp-sans',
  display: 'swap',
})

export default function ClientPresentationLayout({ children }: { children: ReactNode }) {
  return <div className={`${display.variable} ${sans.variable}`}>{children}</div>
}
