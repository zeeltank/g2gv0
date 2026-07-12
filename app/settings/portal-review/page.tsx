'use client'

import { lazy, Suspense } from 'react'

const LazyPortalReviewPage = lazy(() =>
  import('@/components/settings/portal-review-page').then((module) => ({ default: module.PortalReviewPage })),
)

export default function PortalReviewRoute() {
  return (
    <Suspense fallback={<div className="h-[70vh] rounded-2xl bg-muted/40" />}>
      <LazyPortalReviewPage />
    </Suspense>
  )
}
