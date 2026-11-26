'use client'

import { CircleCheck, Clock3, TriangleAlert } from 'lucide-react'
import { healthLine } from '@/lib/workflows/health'
import { NOTE_TONE } from '@/lib/workflows/tones'
import type { WorkflowHealth } from '@/services/gtm/workflows'
import { cn } from '@/lib/utils'

export const TENANT_WIDE_NOTE = 'Automations apply to your whole organisation, not only to this module.'

/**
 * One quiet line above the list: is the clock that starts automations running, and how often it looks. It says so in words (the icon only repeats them),
 * and says "Not known" when it cannot tell. The second line says the data is organisation-wide.
 */
export function StatusStrip({ health, loading }: { health: WorkflowHealth | null; loading: boolean }) {
  const line = loading ? null : healthLine(health)
  const caution = line?.tone === 'caution'
  const Icon = loading ? Clock3 : caution ? TriangleAlert : health?.state === 'running' ? CircleCheck : Clock3

  return (
    <div className="space-y-1">
      <p role="status" className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-sm', caution ? NOTE_TONE.caution : NOTE_TONE.info)}>
        <Icon className="mt-0.5 size-4 flex-none" aria-hidden="true" />
        <span className="min-w-0 break-words">{loading ? 'Checking the scheduler…' : line?.text}</span>
      </p>
      <p className="px-1 text-xs text-muted-foreground">{TENANT_WIDE_NOTE}</p>
    </div>
  )
}
