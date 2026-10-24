'use client'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { CourseQuizWorkspace } from '@/components/domain/lms/delivery/course-quiz-workspace'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'

export default function CourseQuizPage() {
  return (
    <ProtectedLayout>
      <GtgAppShell>
        <CourseQuizWorkspace />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
