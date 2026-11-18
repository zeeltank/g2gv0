/**
 * The look of the chips and notes the Leads screen gained with slice 6 (consent, "from a signal", the product).
 *
 * The WORD carries the meaning ("Blocked: opted out", "Opted in", "From a signal"); the colour of a border only helps. The text is `text-foreground` (or
 * `text-muted-foreground`) on a SOLID theme surface, never a status colour on a tint of itself: that is what made the first Organisation 360 chips 1.89:1 to
 * 4.31:1 and what a real browser's axe run found. The pairs come from lib/org-accounts/tones.ts, so lib/leads/contrast.test.ts computes the real ratios
 * from app/globals.css, light and dark, and scans the new components for the patterns that failed.
 */
import { CHIP_BASE, CHIP_TONE } from '@/lib/org-accounts/tones'

export { CHIP_BASE }

export const LEAD_CHIP = {
  /** Email is blocked (opted out, suppressed): an amber border and the word "Blocked". */
  blocked: CHIP_TONE.caution,
  /** Email is allowed or the lead opted in. */
  allowed: CHIP_TONE.positive,
  /** "From a signal". */
  signal: CHIP_TONE.info,
  /** The product, and anything with no state to show. */
  neutral: CHIP_TONE.neutral,
} as const

/** Every text / surface class pair the new parts put words on, for the contrast test (each has exactly one solid `text-` and one solid `bg-` token). */
export const TEXT_ON_SURFACE: ReadonlyArray<{ name: string; classes: string }> = [
  ...Object.entries(LEAD_CHIP).map(([name, classes]) => ({ name: `chip ${name}`, classes })),
  { name: 'body text on a card', classes: 'bg-card text-foreground' },
  { name: 'secondary text on a card', classes: 'bg-card text-muted-foreground' },
  { name: 'secondary text on the page (the header lines)', classes: 'bg-background text-muted-foreground' },
  { name: 'body text on the page (the header lines)', classes: 'bg-background text-foreground' },
  // A source link is body text with an underline: `text-primary` on a card is 4.16:1 in the dark theme.
  { name: 'a source link on a card (underlined body text)', classes: 'bg-card text-foreground' },
]
