'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { LearningDeliveryWorkspace } from '@/components/domain/lms/delivery/learning-delivery-workspace'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'

export default function MyLearningPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell>
        <LearningDeliveryWorkspace />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
