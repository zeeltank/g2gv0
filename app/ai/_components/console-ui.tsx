'use client'

/**
 * The small pieces the AI console's screens share.
 *
 * They exist so the index and the capability pages cannot word or colour the same
 * thing differently — the console's whole claim is that one description of a
 * capability is shown everywhere, and two screens drawing their own chips would
 * undercut that on the first edit.
 *
 * ── WHY THIS IS NOT LMS K-12's `ComingSoonBadge` ────────────────────────────
 *
 * That component resolves its wording from `lib/roadmap`, a delivery registry G2G
 * does not have. Importing it would mean importing that registry too, and a roadmap
 * with no rows would make every badge read "Coming soon" regardless of what the
 * capability's own status says — the exact mistake the status field exists to
 * prevent. So the chip is local and reads the status directly.
 *
 * Nothing here invents a second "not built yet" look for the product at large: this
 * is the AI console's own vocabulary, and it uses the same semantic tokens as the
 * rest of G2G.
 */

import type { ReactNode } from 'react'
import { Check, Hammer, Lock } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  capabilityStatusLabel,
  type CapabilityStatus,
  type ConsumptionState,
} from '@shared/ai-intelligence-core'

const STATUS_ICON: Record<CapabilityStatus, React.ComponentType<{ className?: string }>> = {
  live: Check,
  'in-progress': Hammer,
  'coming-soon': Lock,
}

// Deliberately muted for everything that is not yet usable: a capability that is
// still being built should read as calm and intentional, never as a warning.
const STATUS_CLASS: Record<CapabilityStatus, string> = {
  live: 'border-border bg-background text-foreground',
  'in-progress': 'border-primary/30 bg-primary/10 text-primary',
  'coming-soon': 'border-border bg-muted text-muted-foreground',
}

export function StatusChip({
  status,
  size = 'default',
  className,
}: {
  status: CapabilityStatus
  size?: 'sm' | 'default'
  className?: string
}) {
  const Icon = STATUS_ICON[status]

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        STATUS_CLASS[status],
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      {capabilityStatusLabel(status)}
    </span>
  )
}

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

/** One titled block of a capability page. */
export function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
      {description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>}
      {children && <div className="mt-3">{children}</div>}
    </section>
  )
}

/** A short list of points. */
export function PointList({ points }: { points: readonly string[] }) {
  return (
    <ul className="space-y-2">
      {points.map((point) => (
        <li key={point} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
          <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <span>{point}</span>
        </li>
      ))}
    </ul>
  )
}
