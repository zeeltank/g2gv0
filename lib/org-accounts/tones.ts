/**
 * The look of the chips and notices of the Organisation 360 parts.
 *
 * The WORD always carries the meaning ("Engaged", "Needs decision", "Saved."); the colour of a border only helps. The text of every chip and notice is
 * `text-foreground` (or `text-muted-foreground` on the muted surface) on a SOLID theme surface, never the status colour on a tint of itself: that is what
 * made the first version 1.89:1 to 4.31:1 (`text-primary` on `bg-primary/10`, `text-success`, the shared StatusBadge `pending` and `processing`).
 * Because the pairs are solid tokens, lib/org-accounts/contrast.test.ts computes the real ratios from app/globals.css, light and dark, and fails below 4.5:1.
 *
 * Class names are written out in full so Tailwind finds them.
 */
import type { OrgLifecycle } from '@/services/org-accounts/types'

export const CHIP_BASE = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium'

export type ChipTone = 'neutral' | 'info' | 'caution' | 'positive' | 'muted'

export const CHIP_TONE: Record<ChipTone, string> = {
  neutral: 'border-border bg-card text-foreground',
  info: 'border-primary bg-card text-foreground',
  caution: 'border-amber-500 bg-card text-foreground',
  positive: 'border-success bg-card text-foreground',
  muted: 'border-border bg-muted text-muted-foreground',
}

/** Which tone each lifecycle takes. The label is always drawn next to it. */
export const LIFECYCLE_TONE: Record<OrgLifecycle, ChipTone> = {
  discovered: 'neutral',
  target: 'info',
  engaged: 'caution',
  customer: 'positive',
  archived: 'muted',
}

export type NoticeTone = 'success' | 'error'

export const NOTICE_TONE: Record<NoticeTone, string> = {
  success: 'border-success bg-card text-foreground',
  error: 'border-destructive bg-card text-foreground',
}

/** The small boxed date of a signal ("Event 12 Oct 2026", "Published ...", "Date unknown"). */
export const DATE_BASE = 'inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[0.7rem]'

export type DateTone = 'event' | 'published' | 'unknown'

export const DATE_TONE: Record<DateTone, string> = {
  event: 'border-success bg-card text-foreground',
  published: 'border-primary bg-card text-foreground',
  unknown: 'border-dashed border-border bg-card text-muted-foreground',
}

/** The error under a form field: a dark red on the surface (the shared Field's `text-destructive` is 3.97:1). */
export const FIELD_ERROR_TEXT = 'text-red-700 dark:text-red-300'

/** Every text/surface class pair this file defines, for the contrast test. */
export const TEXT_ON_SURFACE: ReadonlyArray<{ name: string; classes: string }> = [
  ...Object.entries(CHIP_TONE).map(([name, classes]) => ({ name: `chip ${name}`, classes })),
  ...Object.entries(NOTICE_TONE).map(([name, classes]) => ({ name: `notice ${name}`, classes })),
  ...Object.entries(DATE_TONE).map(([name, classes]) => ({ name: `date ${name}`, classes })),
]
