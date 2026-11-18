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

/** The gaps in the glyph are cut in the chip's own colour: the project's primary blue. */
const MARK_CUT = 'var(--primary)'

/** A gear: `teeth` trapezoid teeth between a root circle and a tip circle, as one closed path. */
function gearPath(cx: number, cy: number, tip: number, root: number, teeth: number): string {
  const pitch = (Math.PI * 2) / teeth
  const pt = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`
  const parts: string[] = []
  for (let i = 0; i < teeth; i++) {
    const a = i * pitch
    parts.push(`${i === 0 ? 'M' : 'L'}${pt(root, a - pitch * 0.3)}`, `L${pt(tip, a - pitch * 0.17)}`, `L${pt(tip, a + pitch * 0.17)}`, `L${pt(root, a + pitch * 0.3)}`)
  }
  return `${parts.join(' ')} Z`
}

const GEAR_PATH = gearPath(35.5, 34.5, 9.4, 7.2, 8)

/** The experiment glyph: a laboratory flask and test tube with a gear, solid, in the colour of the text, with its gaps cut in the chip's blue. Same drawing as the runtime's own title chip. */
function ExperimentGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="currentColor" aria-hidden="true" focusable="false">
      <g transform="rotate(16 31 17)">
        <rect x="27.6" y="3" width="6.8" height="25" rx="3.4" />
        <rect x="26.4" y="2.4" width="9.2" height="2.6" rx="1.3" />
        <path d="M27.6 17.5h6.8" style={{ stroke: MARK_CUT }} strokeWidth="1.8" fill="none" />
      </g>
      <rect x="9" y="4" width="13" height="3.4" rx="1.7" />
      <path d="M11.4 7.4h8.2v8.8l9.2 16.7c1.4 2.6-.4 5.8-3.3 5.8H5.5c-2.9 0-4.7-3.2-3.3-5.8l9.2-16.7z" />
      <path d="M7.4 28.6h16.4" style={{ stroke: MARK_CUT }} strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="11.6" cy="33.3" r="1.5" style={{ fill: MARK_CUT }} />
      <circle cx="17.4" cy="34.6" r="1.1" style={{ fill: MARK_CUT }} />
      <path d={GEAR_PATH} style={{ stroke: MARK_CUT }} strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="35.5" cy="34.5" r="2.9" style={{ fill: MARK_CUT }} />
    </svg>
  )
}

/**
 * The chip beside every simulation's title, whatever its topic: the experiment icon, white on the project's primary blue. It is the same mark the runtime draws in its
 * own header, so a simulation reads as one thing from the gallery card to the lesson.
 */
export function ExperimentMark({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const box = size === 'lg' ? 'size-11 rounded-xl' : size === 'md' ? 'size-9 rounded-lg' : 'size-7 rounded-md'
  const glyph = size === 'lg' ? 'size-8' : size === 'md' ? 'size-6' : 'size-[18px]'
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center bg-primary text-primary-foreground shadow-sm', box, className)} aria-hidden="true">
      <ExperimentGlyph className={glyph} />
    </span>
  )
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
