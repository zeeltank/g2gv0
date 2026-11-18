/**
 * The colours of the facts screens' pills, notices and error lines.
 *
 * The method is the Organisation 360 parts' and the Organisation agent's (lib/org-accounts/tones.ts, lib/agent/tones.ts), paid for in a real browser's axe run:
 * a status colour used as TEXT on a tint of itself reads far below 4.5:1 (`text-primary` on `bg-primary/10` is 4.31:1, `text-success` about 2:1, the shared
 * `text-destructive` 3.97:1). So the WORD carries the meaning (Verified, Probable, Waiting for you, Allowed, Not allowed), the text is `text-foreground` (or
 * `text-muted-foreground` on the muted surface) on a SOLID theme surface, and only the border takes the status colour. lib/facts/contrast.test.ts computes the
 * real ratios from app/globals.css, light and dark, and scans the facts components for the patterns that failed.
 *
 * Class names are written out in full (in lib/org-accounts/tones.ts) so Tailwind finds them.
 */
import { CHIP_BASE, CHIP_TONE, FIELD_ERROR_TEXT, NOTICE_TONE } from '@/lib/org-accounts/tones'
import type { ChipTone } from '@/lib/org-accounts/tones'

export { CHIP_BASE, FIELD_ERROR_TEXT }

/** One look per tone a pill can take. The label is always drawn next to it. */
export const PILL_TONE: Record<ChipTone, string> = CHIP_TONE

/** A banner: a result of a decision, an error with Retry. */
export const NOTICE_LOOK: Record<'success' | 'error', string> = {
  success: NOTICE_TONE.success,
  error: NOTICE_TONE.error,
}

/** Every text / surface class pair the facts screens put words on, for the contrast test (each has exactly one solid `text-` and one solid `bg-` token). */
export const TEXT_ON_SURFACE: ReadonlyArray<{ name: string; classes: string }> = [
  ...Object.entries(PILL_TONE).map(([name, classes]) => ({ name: `pill ${name}`, classes })),
  ...Object.entries(NOTICE_LOOK).map(([name, classes]) => ({ name: `banner ${name}`, classes })),
  { name: 'body text on a card', classes: 'bg-card text-foreground' },
  { name: 'secondary text on a card', classes: 'bg-card text-muted-foreground' },
  { name: 'secondary text on the page', classes: 'bg-background text-muted-foreground' },
  { name: 'secondary text on the muted surface (the reason form)', classes: 'bg-muted text-muted-foreground' },
  { name: 'body text on the muted surface (the reason form)', classes: 'bg-muted text-foreground' },
  // A source link is body text with an underline: `text-primary` on a card is 4.16:1 in the dark theme.
  { name: 'a source link on a card (underlined body text)', classes: 'bg-card text-foreground' },
]
