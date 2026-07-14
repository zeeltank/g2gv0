'use client'

import { lazy, Suspense } from 'react'

const LazyModuleConfigurationPage = lazy(() =>
  import('@/components/settings/module-configuration-page').then((module) => ({ default: module.ModuleConfigurationPage })),
)

export default function ModuleConfigurationRoute() {
  return (
    <Suspense fallback={<div className="h-[70vh] rounded-2xl bg-muted/40" />}>
      <LazyModuleConfigurationPage />
    </Suspense>
  )
}
