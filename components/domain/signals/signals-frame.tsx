'use client'

import type { ReactNode } from 'react'
import type { SignalsTabKey } from '@/lib/signals-nav'
import { SignalsHeader } from '@/components/domain/signals/signals-header'

/** The one frame of every Signals screen: the shared header with its four tabs, then that screen's own content, on one aligned column. */
export function SignalsFrame({ active, children }: { active: SignalsTabKey; children: ReactNode }) {
  return (
    <div className="@container mx-auto max-w-6xl space-y-5 p-4 @xl:p-6">
      <SignalsHeader active={active} />
      {children}
    </div>
  )
}
