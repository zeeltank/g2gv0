'use client'

import { useEffect } from 'react'

/*
 * The last-resort net. `error.tsx` only wraps the root layout's children —
 * it cannot catch a throw inside a provider mounted directly in
 * app/layout.tsx (ThemeProvider, PreferencesProvider, AuthProvider,
 * QueryProvider). Before this file existed, nothing did: a throw up there
 * left the document permanently blank, painted only by whatever the
 * pre-hydration theme script had already applied to <html> — the exact
 * "sometimes white, sometimes black, completely blank" bug traced to an
 * unguarded storage read in AuthProvider's mount effect (see
 * lib/laravel-session.ts / components/auth/gtg-auth.tsx). That read is
 * guarded now, but this file stays regardless — it's the backstop for
 * whatever the next one of these turns out to be, not a fix for this one
 * specific bug.
 *
 * Next.js requires this file to render its own <html>/<body> — it replaces
 * the ENTIRE tree, root layout included, when it activates. No Tailwind
 * theme classes, no provider-supplied tokens: the failure could be in any
 * of them, so this can't assume any of them still work. Plain inline
 * styles only, deliberately not matching error.tsx's themed look.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          display: 'flex',
          minHeight: '100dvh',
          width: '100%',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '0 1.5rem',
          textAlign: 'center',
          background: '#ffffff',
          color: '#0f172a',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ marginTop: '0.5rem', maxWidth: '28rem', fontSize: '0.875rem', color: '#64748b' }}>
            The app hit an unexpected error while starting up. Reloading usually fixes this.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          style={{
            display: 'inline-flex',
            height: '2.5rem',
            alignItems: 'center',
            borderRadius: '0.375rem',
            border: 'none',
            background: '#2563eb',
            padding: '0 1.25rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#ffffff',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
