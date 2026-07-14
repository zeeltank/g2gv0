'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <span className="text-2xl font-bold">!</span>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          An unexpected error occurred while loading this page.
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Try again
      </button>
    </div>
  )
}
