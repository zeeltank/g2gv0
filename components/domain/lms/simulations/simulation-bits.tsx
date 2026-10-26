import { Boxes, BrainCircuit, CheckCircle2, CodeXml, FlaskConical, HeartPulse, Landmark, Network, ShieldCheck, TrendingUp, Users, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import type { SimulationCard, SimulationStatus } from '@/services/lms/simulations'

import { categoryKindOf } from './simulation-format'

/** The glyph for a category (see `categoryKindOf`). Drawn from a fixed set of elements, so it is the same component on every render. */
export function CategoryIcon({ category, className }: { category: string | null | undefined; className?: string }) {
  const props = { className, 'aria-hidden': true as const }
  switch (categoryKindOf(category)) {
    case 'security':
      return <ShieldCheck {...props} />
    case 'data':
      return <BrainCircuit {...props} />
    case 'infrastructure':
      return <Network {...props} />
    case 'engineering':
      return <CodeXml {...props} />
    case 'commercial':
      return <TrendingUp {...props} />
    case 'finance':
      return <Landmark {...props} />
    case 'health':
      return <HeartPulse {...props} />
    case 'people':
      return <Users {...props} />
    case 'science':
      return <FlaskConical {...props} />
    default:
      return <Boxes {...props} />
  }
}

/** Three small bars, filled up to the level: a difficulty at a glance, with the word beside it for anyone who cannot see the bars. */
export function DifficultyBars({ level, className }: { level: 1 | 2 | 3; className?: string }) {
  return (
    <span className={cn('inline-flex items-end gap-[2px]', className)} aria-hidden="true">
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={cn('w-[3px] rounded-[1px]', bar <= level ? 'bg-primary' : 'bg-border')}
          style={{ height: 4 + bar * 3 }}
        />
      ))}
    </span>
  )
}

/** One fact in the row under a card's summary: an icon, then the words. */
export function MetaItem({ icon: Icon, children, className }: { icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  )
}

const STATUS_STYLE: Record<Exclude<SimulationStatus, 'published'>, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'border-warning/40 bg-warning/15 text-foreground' },
  archived: { label: 'Archived', className: 'border-border bg-muted text-muted-foreground' },
}

/** "Draft" or "Archived" - a published simulation carries no badge, because that is the ordinary case. */
export function StatusPill({ status, className }: { status: SimulationStatus; className?: string }) {
  if (status === 'published') return null
  const style = STATUS_STYLE[status]
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none', style.className, className)}>
      {style.label}
    </span>
  )
}

/** Where this person stands in a simulation, as a chip. Nothing is drawn for someone who has not started it. */
export function ProgressPill({ progress, className }: { progress: SimulationCard['progress']; className?: string }) {
  if (!progress) return null
  if (progress.status === 'completed') {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/15 px-2 py-0.5 text-[11px] font-semibold leading-none text-foreground', className)}>
        <CheckCircle2 className="size-3 text-success" aria-hidden="true" />
        Completed
      </span>
    )
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold leading-none tabular-nums text-foreground', className)}>
      <span
        className="size-3 rounded-full"
        style={{ background: `conic-gradient(var(--primary) ${Math.min(100, progress.percent) * 3.6}deg, var(--border) 0)` }}
        aria-hidden="true"
      />
      {progress.percent}%
      <span className="sr-only"> done, in progress</span>
    </span>
  )
}
