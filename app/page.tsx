'use client'

import { useAuth } from '@/components/auth/gtg-auth'
import { useEffect } from 'react'

/*
 * `window.location.href`, not `router.push()` — a real bug, not a style
 * choice. This crosses proxy.ts's auth boundary (signed-out visitors get
 * bounced to /login; signed-in ones get sent on to /dashboard), and
 * `router.push()` is a soft, client-side RSC fetch. A signed-in browser
 * carrying a cookie/local-state mismatch (localStorage says authenticated,
 * the `gtg-session` cookie proxy.ts actually reads does not) can hit
 * exactly this boundary, have proxy.ts redirect the SOFT fetch itself, and
 * be left on a blank page with the URL already bar optimistically updated
 * but no matching content ever rendered — traced from a real report, a
 * DevTools trace showing a live 307 between /dashboard and /login that
 * never resolved into a rendered page. A hard navigation makes a real,
 * fresh HTTP request that proxy.ts evaluates as an ordinary page load, not
 * an RSC transition with a payload the client router has to reconcile —
 * sidesteps the failure class entirely rather than working around one
 * specific trigger of it. This route only runs this decision once per
 * visit to `/`, so the extra round-trip a hard navigation costs here is
 * not a real cost anywhere that matters.
 */
export default function Page() {
  const { user, isLoading, isAuthenticated } = useAuth()

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }

    if (user) {
      window.location.href = '/dashboard'
    }
  }, [isLoading, isAuthenticated, user])

  if (isLoading) {
    return null
  }

  return null
}

