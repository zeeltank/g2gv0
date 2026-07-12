'use client'

import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SetupCompletionStepProps {
  router: ReturnType<typeof useRouter>
}

export function SetupCompletionStep({ router }: SetupCompletionStepProps) {
  return (
    <div className="rounded-lg border border-border bg-card px-6 py-14 text-center shadow-sm">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success text-success-foreground">
        <Check className="size-7" />
      </div>
      <h2 className="mt-5 text-2xl font-bold text-foreground">
        Organization Setup Completed Successfully
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Your organization is now configured and ready to use.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Button onClick={() => router.push('/settings/portal-review')}>
          Continue to Portal Review
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            router.push('/module/m1/org-setup/employee-directory')
          }
        >
          Manage Employees
        </Button>
      </div>
    </div>
  )
}
