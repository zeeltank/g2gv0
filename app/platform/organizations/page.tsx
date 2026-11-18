'use client'

import { lazy, Suspense } from 'react'
import { ProtectedLayout } from '@/components/auth/protected-layout'

const LazyOrganizationsRoster = lazy(() =>
  import('@/components/domain/platform/organizations-roster').then((module) => ({
    default: module.OrganizationsRoster,
  })),
)

/**
 * The internal operator's roster of every organisation on the platform.
 *
 * Same shape as `./new/page.tsx`: no role check here. `ProtectedLayout` only
 * asks whether somebody is signed in; whether they may see or change anything
 * is decided by `platform.owner` on the API, which returns 404 to everybody
 * else. Not in `tblmenumaster_g2g` either - this is not a customer's screen.
 */
export default function PlatformOrganizationsRoute() {
  return (
    <ProtectedLayout>
      <Suspense fallback={<div className="h-screen bg-muted/20" />}>
        <LazyOrganizationsRoster />
      </Suspense>
    </ProtectedLayout>
  )
}
