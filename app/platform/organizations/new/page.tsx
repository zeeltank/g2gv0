'use client'

import { lazy, Suspense } from 'react'
import { ProtectedLayout } from '@/components/auth/protected-layout'

const LazyCreateOrganizationForm = lazy(() =>
  import('@/components/domain/platform/create-organization-form').then((module) => ({
    default: module.CreateOrganizationForm,
  })),
)

/**
 * The internal operator's screen for creating an organisation.
 *
 * ── WHY THERE IS NO ROLE CHECK HERE ─────────────────────────────────────────
 *
 * `ProtectedLayout` only asks whether somebody is signed in. Whether they may
 * CREATE AN ORGANISATION is decided by `platform.owner` on the endpoint, which
 * returns 404 to everybody else.
 *
 * Hiding the route in the frontend as well would be a second, weaker copy of
 * that rule - the kind that drifts, and that a person can walk around by typing
 * the URL. The screen loads for anyone who reaches it and the API refuses them,
 * which is the correct failure: the frontend may be wrong about what to show,
 * never about what it may fetch.
 *
 * It is deliberately not in `tblmenumaster_g2g` either. The menu catalogue is
 * the customer's navigation, and this is not a customer's screen.
 */
export default function CreateOrganizationRoute() {
  return (
    <ProtectedLayout>
      <Suspense fallback={<div className="h-screen bg-muted/20" />}>
        <LazyCreateOrganizationForm />
      </Suspense>
    </ProtectedLayout>
  )
}
