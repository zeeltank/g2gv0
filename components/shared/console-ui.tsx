'use client'

/**
 * The vocabulary the platform's admin consoles share.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS MOVED OUT OF `app/ai/_components/`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It was local to the AI console, and its own note explained why: so the index and the
 * capability pages could not word or colour the same thing differently. That argument
 * was right and is now bigger than one console.
 *
 * Platform Services lists twelve services with the same three states, and "What's
 * Coming" puts platform services and AI capabilities in ONE list. Two StatusChip
 * implementations that must stay visually identical across three screens is the drift
 * this component was created to prevent, one level up — and the first one to drift is
 * the one nobody is looking at.
 *
 * So there is one implementation, here. `app/ai/_components/console-ui.tsx` re-exports
 * it, which is why no AI screen changed.
 *
 * ── STILL NOT `components/ui/` ──────────────────────────────────────────────
 *
 * `components/ui/` is shadcn primitives and is read-only. This is a product vocabulary —
 * three specific words with three specific meanings — not a primitive. It belongs beside
 * the other cross-domain compositions in `components/shared/`.
 *
 * ── STILL NOT LMS K-12's `ComingSoonBadge` ──────────────────────────────────
 *
 * That component resolves its wording from `lib/roadmap`, a delivery registry G2G does
 * not have. Importing it would mean importing that registry too, and a roadmap with no
 * rows would make every badge read "Coming soon" regardless of what the record's own
 * status says — the exact mistake the status field exists to prevent.
 */

import type { ReactNode } from 'react'
import { Check, Hammer, Lock } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * The three states, spelled once.
 *
 * `CapabilityStatus` from `ai-intelligence-core` and `PlatformServiceStatus` from
 * `platform-services-core` are this same union. Declaring it structurally here rather
 * than importing one of them keeps this file from picking a favourite between two
 * packages it serves equally — and because the unions are identical, either one assigns
 * to it without a cast.
 */
export type ConsoleStatus = 'live' | 'in-progress' | 'coming-soon'

const STATUS_ICON: Record<ConsoleStatus, React.ComponentType<{ className?: string }>> = {
  live: Check,
  'in-progress': Hammer,
  'coming-soon': Lock,
}

// Deliberately muted for everything that is not yet usable: something still being built
// should read as calm and intentional, never as a warning.
const STATUS_CLASS: Record<ConsoleStatus, string> = {
  live: 'border-border bg-background text-foreground',
  'in-progress': 'border-primary/30 bg-primary/10 text-primary',
  'coming-soon': 'border-border bg-muted text-muted-foreground',
}

const STATUS_LABEL: Record<ConsoleStatus, string> = {
  live: 'Live',
  'in-progress': 'In progress',
  'coming-soon': 'Coming soon',
}

export function consoleStatusLabel(status: ConsoleStatus): string {
  return STATUS_LABEL[status]
}

export function StatusChip({
  status,
  size = 'default',
  className,
}: {
  status: ConsoleStatus
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
      {STATUS_LABEL[status]}
    </span>
  )
}

/** One titled block of a console page. */
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
