'use client'

import { lazy, Suspense } from 'react'
import { useAuth } from '@/components/auth/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { AccessDeniedPage } from '@/components/auth/access-denied-page'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'

const LazyProfileDashboard = lazy(() =>
  import('@/components/profile/profile-dashboard').then((module) => ({ default: module.ProfileDashboard })),
)

export default function ProfilePage() {
  const { user, isLoading } = useAuth()

  if (!user) {
    return (
      <AccessDeniedPage reason="Please log in to view your profile." />
    )
  }

  return (
    <ProtectedLayout>
      <GtgPageShell
        breadcrumbItems={[
          { label: 'Home', href: '/' },
          { label: 'Profile' },
        ]}
      >
        <Suspense fallback={<div className="h-96 rounded-2xl bg-muted/40" />}>
          <GtgBreadcrumbFromContext />
          <LazyProfileDashboard user={user} />
        </Suspense>
      </GtgPageShell>
    </ProtectedLayout>
  )
}
