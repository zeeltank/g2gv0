import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { AuthProvider } from '@/components/auth/gtg-auth'
import { QueryProvider } from '@/components/providers/query-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { PreferencesProvider } from '@/components/providers/preferences-provider'
import '@mdi/font/css/materialdesignicons.min.css'
import './globals.css'

/*
 * `--font-inter` used to be a plain CSS font-stack STRING set inline on
 * <html> — "Inter" only if the OS happened to have it installed, Segoe UI for
 * most Windows users otherwise. `globals.css` has declared `--font-geist-mono`
 * since before this file loaded any real font at all; `.variable` below
 * finishes that intent rather than inventing a new one, and `--font-geist-sans`
 * replaces the old `--font-inter` name in globals.css to match — there is no
 * Inter anywhere in this build any more, so nothing should still be named
 * after it. `geist/font/*` is a self-hosted next/font build: no network
 * request, no layout shift, no external Google Fonts origin to add to the CSP.
 */

export const metadata: Metadata = {
  title: 'GapstoGrowth — HRMS',
  description: 'GapstoGrowth enterprise HRMS application shell',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      data-brand="gaps-to-growth"
      className={`bg-background ${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          * ═══════════════════════════════════════════════════════════════════
          * THE ONLY THING THAT CAN STOP THE LIGHT FLASH
          * ═══════════════════════════════════════════════════════════════════
          *
          * The dark palette is class-gated — `@custom-variant dark (&:is(.dark *))`
          * in globals.css — so until something puts `dark` on <html>, the page
          * is light. React cannot do it: the earliest a client effect runs is
          * after the bundle has downloaded, parsed and hydrated, and every one of
          * those milliseconds is a white screen for somebody who chose dark.
          *
          * This runs BEFORE the first paint, which is why it has to be an inline
          * blocking script and cannot be a component. It reads only the local
          * paint hint; the server's stored value arrives moments later through
          * PreferencesProvider and wins if they disagree.
          *
          * Kept deliberately tiny and wrapped in try/catch: it executes before
          * anything else on the page, so a throw here would be a blank document.
          * A browser with storage blocked simply falls through to `system`.
          *
          * `/login` is excluded from the calculation on purpose — that screen
          * is always light regardless of the stored or system preference (see
          * the matching effect in login-page.tsx, which additionally corrects
          * ThemeProvider's own post-mount sync so it can't re-darken it a
          * moment later). Checked here too, not only there, so a visitor whose
          * stored preference is dark never sees a flash of the dark login
          * before React has even hydrated.
          */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=window.location.pathname;var t=localStorage.getItem('gtg-theme')||'system';var d=p!=='/login'&&(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches));var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light'}catch(e){}})()`,
          }}
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {/*
          * ThemeProvider WRAPS everything, and that placement is load-bearing.
          *
          * It was imported here once and never rendered. Nothing caught it:
          * `useTheme()` falls back to the context's default value, whose
          * `setTheme` is `() => {}`, so the theme picker changed its own
          * highlight, saved the preference to the server, and repainted
          * nothing - type-safe, lint-clean, builds, and completely dead.
          *
          * That is the same shape as the "Go Live" button that wrote an unread
          * localStorage key. A default context value is a silent no-op, so a
          * provider that is imported but not mounted fails invisibly.
          */}
        <ThemeProvider>
          {/*
            * PreferencesProvider sits INSIDE ThemeProvider because it calls
            * useTheme() to apply the stored theme, and useTheme() throws outside
            * its provider rather than silently doing nothing.
            *
            * IT WAS MISSING HERE ONCE TOO — imported and never rendered, exactly
            * like ThemeProvider above, and for the same reason: an edit that
            * reported success and did not match. It failed even more quietly,
            * because `useAppPreferences()` deliberately returns defaults when
            * there is no provider (so a page never breaks waiting on a
            * preference). The sidebar default, the landing page and the
            * app-wide theme all simply did nothing.
            */}
          <PreferencesProvider>
            <AuthProvider>
              <QueryProvider>{children}</QueryProvider>
              {process.env.NODE_ENV === 'production' && <Analytics />}
            </AuthProvider>
          </PreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
