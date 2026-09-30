'use client'

import { useAuth } from '@/components/auth/gtg-auth'
import { useEffect } from 'react'

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  /*
   * `window.location.href`, not `router.push()` — see app/page.tsx's file
   * header for the full reasoning. Same auth-boundary crossing, same
   * traced failure: a soft/RSC navigation redirected by proxy.ts can leave
   * this page blank with the URL already updated but nothing rendered,
   * instead of a real page load landing cleanly on /login. This path
   * fires rarely in practice — the common case (never signed in) is
   * already caught server-side by proxy.ts before this component ever
   * mounts; this only runs when auth state changes after mount — so the
   * extra round-trip a hard navigation costs is not a real cost on the
   * common path.
   */
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/login'
    }
  }, [isAuthenticated, isLoading])

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return null
  }

  return children
}
