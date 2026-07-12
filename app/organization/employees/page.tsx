'use client'

import { lazy, Suspense } from 'react'

const LazyEmployeeDirectory = lazy(() =>
  import('@/components/org/employee-directory').then((module) => ({ default: module.EmployeeDirectory })),
)

export default function EmployeesPage() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
      <Suspense fallback={<div className="h-96 rounded-2xl bg-muted/40" />}>
        <LazyEmployeeDirectory />
      </Suspense>
    </div>
  )
}
