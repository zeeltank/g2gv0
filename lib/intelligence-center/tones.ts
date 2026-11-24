/**
 * The look of the Intelligence screens' chips, notices and card edges, on the light theme and in dark.
 *
 * Same discipline as lib/org-accounts/tones.ts and lib/agent/tones.ts: the WORD carries the meaning ("High priority", "AI estimate"); the text is
 * `text-foreground` (or `text-muted-foreground`) on a SOLID theme surface, and only the BORDER takes the status colour. A status colour used as text on a tint
 * of itself failed contrast (2:1 to 4.3:1) in this product before, so it is not used here.
 *
 * Measured, rule-based and AI-estimate differ by more than colour: the estimate has a DASHED border and sits on the muted surface, so it cannot be mistaken
 * for a measured figure by someone who cannot tell the colours apart.
 *
 * Class names are written out in full so Tailwind finds them.
 */
import { CHIP_BASE, CHIP_TONE } from '../org-accounts/tones'
import type { InsightConfidence, InsightSeverity } from '../../services/intelligence/types'
import type { Condition } from './derive'
import type { DomainAccent } from './domains'

export { CHIP_BASE }

export const SEVERITY_CHIP: Record<InsightSeverity, string> = {
  info: CHIP_TONE.neutral,
  attention: CHIP_TONE.caution,
  high: 'border-orange-500 bg-card text-foreground',
  critical: 'border-destructive border-2 bg-card text-foreground font-semibold',
}

/** The coloured edge of an insight card (a hint only; the severity word is always printed). */
export const SEVERITY_EDGE: Record<InsightSeverity, string> = {
  info: 'border-l-border',
  attention: 'border-l-amber-500',
  high: 'border-l-orange-500',
  critical: 'border-l-destructive',
}

export const CONFIDENCE_CHIP: Record<InsightConfidence, string> = {
  measured: CHIP_TONE.positive,
  rule_based: CHIP_TONE.info,
  ai_estimate: 'border-dashed border-amber-500 bg-muted text-foreground',
}

/** The chip of a statement kind; a kind this screen does not know is neutral: not styled as measured, and not as an estimate. */
export function confidenceChip(confidence: string): string {
  return (CONFIDENCE_CHIP as Record<string, string>)[confidence] ?? CHIP_TONE.muted
}

export const COVERAGE_CHIP = {
  enough: CHIP_TONE.neutral,
  thin: 'border-dashed border-amber-500 bg-muted text-foreground',
} as const

export const STATE_CHIP: Record<'ok' | 'insufficient_data' | 'not_applicable' | 'data_unavailable' | 'access_restricted' | 'error' | 'unrecognised', string> = {
  ok: CHIP_TONE.positive,
  insufficient_data: 'border-dashed border-amber-500 bg-muted text-foreground',
  not_applicable: CHIP_TONE.muted,
  data_unavailable: 'border-destructive border-dashed bg-card text-foreground',
  access_restricted: 'border-slate-500 border-double border-4 bg-card text-foreground',
  error: 'border-destructive bg-card text-foreground',
  unrecognised: 'border-dotted border-border bg-muted text-muted-foreground',
}

export const NOTICE = {
  provisional: 'rounded-lg border border-dashed border-border bg-muted px-3 py-2 text-xs text-muted-foreground',
  info: 'rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground',
} as const

/* -- the premium surface: layered elevation, hover lift, press feedback -- */

/**
 * A layered card: a 1px refined border, an inner top highlight, and two soft shadows (a tight contact shadow and a wide ambient one).
 * The Intelligence screens are a light theme only: there is no dark variant here.
 */
export const SURFACE =
  'rounded-xl border border-border bg-card text-foreground ' +
  'shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_1px_2px_rgb(15_23_42/0.06),0_10px_28px_-14px_rgb(15_23_42/0.22)]'

/** What a clickable card adds: a lift on hover and a small press, both switched off for people who ask for reduced motion. */
export const SURFACE_LIFT =
  'transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 ' +
  'hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_2px_4px_rgb(15_23_42/0.08),0_16px_36px_-14px_rgb(15_23_42/0.3)] ' +
  'active:translate-y-0 active:duration-100 focus-within:ring-2 focus-within:ring-ring/40 ' +
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0'

/** The quiet band the page header sits on: a restrained blue/indigo wash. Text on it stays text-foreground. */
export const HEADER_BAND =
  'rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-card to-blue-50 ' +
  'shadow-[inset_0_1px_0_rgb(255_255_255/0.8),0_1px_2px_rgb(15_23_42/0.05),0_12px_32px_-18px_rgb(67_56_202/0.35)]'

/** The small tile behind a domain icon (decorative: the icon is aria-hidden and the title is always printed). */
export const ACCENT_TILE: Record<DomainAccent, string> = {
  indigo: 'bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-700',
  blue: 'bg-gradient-to-br from-blue-100 to-blue-50 text-blue-700',
  violet: 'bg-gradient-to-br from-violet-100 to-violet-50 text-violet-700',
  sky: 'bg-gradient-to-br from-sky-100 to-sky-50 text-sky-800',
  cyan: 'bg-gradient-to-br from-cyan-100 to-cyan-50 text-cyan-800',
  slate: 'bg-gradient-to-br from-slate-200 to-slate-100 text-slate-700',
}

/** A condition is a WORD in a chip; the border colour only helps. */
export const CONDITION_CHIP: Record<Condition, string> = {
  needs_attention: 'border-destructive border-2 bg-card text-foreground font-semibold',
  watch: CHIP_TONE.caution,
  healthy: CHIP_TONE.positive,
  no_findings: CHIP_TONE.neutral,
  not_enough_data: 'border-dashed border-amber-500 bg-muted text-foreground',
  not_available: CHIP_TONE.muted,
  not_connected: 'border-dashed border-border bg-muted text-muted-foreground',
  partial: 'border-sky-500 border-dashed bg-card text-foreground',
  data_unavailable: 'border-destructive border-dashed bg-card text-foreground',
  access_restricted: 'border-slate-500 border-double border-4 bg-card text-foreground',
  not_assessed: 'border-dotted border-border bg-muted text-muted-foreground',
  excluded: 'border-slate-700 border-2 bg-muted text-foreground font-medium',
}

/** The left ribbon of a domain/area card, from its condition (the word is always printed too). */
export const CONDITION_EDGE: Record<Condition, string> = {
  needs_attention: 'border-l-destructive',
  watch: 'border-l-amber-500',
  healthy: 'border-l-success',
  no_findings: 'border-l-border',
  not_enough_data: 'border-l-amber-500',
  not_available: 'border-l-border',
  not_connected: 'border-l-border',
  partial: 'border-l-sky-500',
  data_unavailable: 'border-l-destructive',
  access_restricted: 'border-l-slate-500',
  not_assessed: 'border-l-border',
  excluded: 'border-l-slate-700',
}

export const LINK_CLASS =
  'inline-flex items-center gap-1 rounded-sm text-sm font-medium text-foreground underline underline-offset-4 hover:no-underline ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** A link that looks like a button. */
export const LINK_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground ' +
  'shadow-[0_1px_2px_rgb(15_23_42/0.08)] transition-colors hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'motion-reduce:transition-none'

/** The small caps line above a page title (decorative hierarchy: the title below it says the same in full words). */
export const KICKER = 'text-xs font-semibold uppercase tracking-widest text-indigo-700'

/** A quiet inset panel inside a card (progressive disclosure bodies, notes). */
export const PANEL_QUIET = 'rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm'

/** A bordered tile that carries one figure; no shadow, so a row of them stays calm. */
export const TILE = 'rounded-lg border border-border bg-card px-3 py-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.7)]'

/** Every text/surface class pair defined here, for the contrast scan. */
export const TEXT_ON_SURFACE: ReadonlyArray<{ name: string; classes: string }> = [
  ...Object.entries(SEVERITY_CHIP).map(([name, classes]) => ({ name: `severity ${name}`, classes })),
  ...Object.entries(CONFIDENCE_CHIP).map(([name, classes]) => ({ name: `confidence ${name}`, classes })),
  ...Object.entries(COVERAGE_CHIP).map(([name, classes]) => ({ name: `coverage ${name}`, classes })),
  ...Object.entries(STATE_CHIP).map(([name, classes]) => ({ name: `state ${name}`, classes })),
  ...Object.entries(CONDITION_CHIP).map(([name, classes]) => ({ name: `condition ${name}`, classes })),
  { name: 'provisional notice', classes: NOTICE.provisional },
  { name: 'info notice', classes: NOTICE.info },
]
