'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ClipboardCheck } from 'lucide-react'

import { CourseQuizPanel } from './course-quiz-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/error-state'

const LEARNING_PATH = '/module/lms/learning/my-learning'

/** A focused destination for a course assessment, distinct from the player. */
export function CourseQuizWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const courseId = Number(searchParams.get('course_id'))

  if (!Number.isInteger(courseId) || courseId <= 0) {
    return (
      <div className="w-full min-w-0 pt-2">
        <ErrorState
          title="Choose a course first"
          description="Open a course from My Learning before starting its assessment."
          retry={() => router.push(LEARNING_PATH)}
        />
      </div>
    )
  }

  const coursePath = `${LEARNING_PATH}?course_id=${courseId}`

  return (
    <main className="flex w-full min-w-0 flex-col gap-6 pt-2">
      <div className="flex w-full min-w-0 items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => router.push(coursePath)}>
          <ArrowLeft className="size-4" />
          Back to course
        </Button>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Assessment</span>
      </div>

      <Card className="w-full min-w-0 overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.08] via-card to-card shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6 sm:p-8">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <ClipboardCheck className="size-5" />
          </span>
          <div className="w-full min-w-0">
            <p className="text-sm font-semibold text-primary">Course assessment</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Put your learning into practice
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
              Take your assessment in a focused space. Your progress, attempts, pass mark, and result are saved securely as you go.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="w-full min-w-0"><CourseQuizPanel courseId={courseId} onPassed={() => router.refresh()} /></div>
    </main>
  )
}
