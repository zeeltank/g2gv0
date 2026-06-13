'use client'

import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AccessDeniedPage({
  reason = 'You do not have permission to access this page.',
}: {
  reason?: string
} = {}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mb-6 inline-flex rounded-full bg-danger/10 p-4">
          <ShieldAlert className="size-8 text-danger" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">{reason}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/dashboard" className="inline-flex">
            <Button>Go to Dashboard</Button>
          </Link>
          <Link href="/" className="inline-flex">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
