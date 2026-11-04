/**
 * The colours of Signal Review's chips, date pills and notices.
 *
 * A real browser's axe run on 4 Nov 2026 measured the date pills at 2.03:1: the status colour as TEXT on a tint of itself (`text-success` on `bg-success/10`,
 * `text-primary` on `bg-primary/10`) reads far below 4.5:1, and the same pattern was in the status chips, the product chip, three notices and the danger
 * button. The look is the Organisation 360 parts' own (lib/org-accounts/tones.ts): the WORD carries the meaning, the text is `text-foreground` (or
 * `text-muted-foreground` on the muted surface) on a SOLID theme surface, and only the border takes the status colour. lib/signal-review/contrast.test.ts
 * computes the real ratios from app/globals.css, light and dark, and scans the Signal Review components for the patterns that failed.
 *
 * Class names are written out in full so Tailwind finds them.
 */
import { CHIP_TONE, DATE_BASE, DATE_TONE, NOTICE_TONE } from '@/lib/org-accounts/tones'
import type { DateBadgeKind, StatusChipTone } from './signal-display'

export { DATE_BASE }

export const STATUS_TONE: Record<StatusChipTone, string> = {
  neutral: 'border-border bg-muted text-foreground',
  warning: CHIP_TONE.caution,
  success: CHIP_TONE.positive,
  destructive: NOTICE_TONE.error,
}

export const DATE_LOOK: Record<DateBadgeKind, string> = {
  event: DATE_TONE.event,
  published: DATE_TONE.published,
  unknown: DATE_TONE.unknown,
}

/** The product a signal is matched to. */
export const PRODUCT_CHIP_TONE = CHIP_TONE.info

/** A result message in the drawer or under a button. */
export const BANNER_TONE: Record<'success' | 'error', string> = { success: NOTICE_TONE.success, error: NOTICE_TONE.error }

/** Every text / surface class pair this file defines, for the contrast test. */
export const TEXT_ON_SURFACE: ReadonlyArray<{ name: string; classes: string }> = [
  ...Object.entries(STATUS_TONE).map(([name, classes]) => ({ name: `status chip ${name}`, classes })),
  ...Object.entries(DATE_LOOK).map(([name, classes]) => ({ name: `date pill ${name}`, classes })),
  { name: 'product chip', classes: PRODUCT_CHIP_TONE },
  ...Object.entries(BANNER_TONE).map(([name, classes]) => ({ name: `banner ${name}`, classes })),
  { name: 'secondary text on a card', classes: 'bg-card text-muted-foreground' },
  { name: 'secondary text on the muted surface', classes: 'bg-muted text-muted-foreground' },
]
