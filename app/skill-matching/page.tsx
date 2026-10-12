'use client'

import { lazy, Suspense } from 'react'

const LazySkillMatchingExplain = lazy(() =>
  import('@/domain/competency/skill-matching-explain').then((m) => ({ default: m.SkillMatchingExplain })),
)

export default function SkillMatchingPage() {
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto w-full">
      <Suspense fallback={<div className="h-64 rounded-2xl bg-muted/40" />}>
        <LazySkillMatchingExplain />
      </Suspense>
    </div>
  )
}
