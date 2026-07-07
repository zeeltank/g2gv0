'use client'

import { useAuth } from '@/components/auth/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { AccessDeniedPage } from '@/components/auth/access-denied-page'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { ProfileDashboard } from '@/components/profile/profile-dashboard'

export default function ProfilePage() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null

  if (!user) {
    return (
      <AccessDeniedPage reason="Please log in to view your profile." />
    )
  }

  return (
    <ProtectedLayout>
      <GtgAppShell>
        <ProfileDashboard user={user} />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
