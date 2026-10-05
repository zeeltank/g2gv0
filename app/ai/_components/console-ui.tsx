'use client'

/**
 * The AI console's own small pieces.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MOST OF THIS FILE MOVED, AND THE REASON IT MOVED IS THE REASON IT EXISTED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `StatusChip`, `SectionCard` and `PointList` now live in
 * `components/shared/console-ui.tsx`. They were written here so the AI index and the
 * capability pages could not word or colour the same thing differently; Platform
 * Services then arrived with the same three states, and "What's Coming" lists platform
 * services and AI capabilities together in ONE table. A second implementation of the
 * chip would have had to stay pixel-identical across three screens by hand, which is the
 * same drift one level up.
 *
 * They are re-exported rather than having their import sites rewritten, so `app/ai/page.tsx`,
 * `app/ai/[capability]/page.tsx` and `CapabilityShell.tsx` are untouched by the move —
 * a refactor that changes no behaviour should change as few files as it can.
 *
 * `CapabilityStatus` is structurally `ConsoleStatus`, so `StatusChip` accepts it with no
 * cast and no adapter.
 *
 * ── WHAT STAYED, AND WHY ────────────────────────────────────────────────────
 *
 * `ConsumptionPill` is about `SolutionConsumption` — whether G2G, LMS K-12 or Enterprise
 * Brain consumes a capability today. That is a fact about the AI registry's three-product
 * model, which Platform Services has no equivalent of and should not grow one to match.
 * Sharing it would be sharing a concept, not a component.
 */

import { cn } from '@/lib/utils'
import type { ConsumptionState } from '@shared/ai-intelligence-core'

export { PointList, SectionCard, StatusChip } from '@/components/shared/console-ui'

const CONSUMPTION: Record<ConsumptionState, { label: string; className: string }> = {
  // Never colour alone: each state is named, so the table reads the same to someone
  // who cannot distinguish the fills.
  yes: { label: 'In use', className: 'border-primary/30 bg-primary/10 text-primary' },
  partial: { label: 'Partly', className: 'border-border bg-muted text-foreground' },
  no: {
    label: 'Not yet',
    className: 'border-dashed border-border bg-transparent text-muted-foreground',
  },
}

export function ConsumptionPill({ state }: { state: ConsumptionState }) {
  const { label, className } = CONSUMPTION[state]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap',
        className,
      )}
    >
      {label}
    </span>
  )
}
