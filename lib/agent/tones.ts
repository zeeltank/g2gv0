/**
 * The colours of the Organisation agent's pills, notices and error lines.
 *
 * Found in a real browser (axe, 3 Nov 2026), not by the jsdom tests, which compute no colour: a status colour used as TEXT on a tint of itself reads far below
 * 4.5:1 (`text-primary` on `bg-primary/10` is 4.31:1, `text-success` about 2:1, the shared `text-destructive` 3.97:1). So the look is the Organisation 360
 * parts' own (lib/org-accounts/tones.ts): the WORD carries the meaning, the text is `text-foreground` (or `text-muted-foreground` on the muted surface) on a
 * SOLID theme surface, and only the border takes the status colour. lib/agent/contrast.test.ts computes the real ratios from app/globals.css, light and dark,
 * and scans the four agent components for the patterns that failed.
 *
 * Class names are written out in full so Tailwind finds them.
 */
import { CHIP_BASE, CHIP_TONE, FIELD_ERROR_TEXT, NOTICE_TONE } from '@/lib/org-accounts/tones'
import type { Tone } from './model'

export { CHIP_BASE, FIELD_ERROR_TEXT }

/** One look per state a pill can say. */
export const STATE_TONE: Record<Tone, string> = {
  success: CHIP_TONE.positive,
  pending: CHIP_TONE.caution,
  error: NOTICE_TONE.error,
  inactive: CHIP_TONE.muted,
  processing: CHIP_TONE.info,
}

/** The mark on whatever the agent did itself. */
export const AGENT_MARK_TONE = CHIP_TONE.info

/** A banner: a result in the panel, an error with Retry. */
export const BANNER_TONE: Record<'success' | 'error', string> = {
  success: NOTICE_TONE.success,
  error: NOTICE_TONE.error,
}

/** Every text / surface class pair this screen puts words on, for the contrast test (each has exactly one solid `text-` and one solid `bg-` token). */
export const TEXT_ON_SURFACE: ReadonlyArray<{ name: string; classes: string }> = [
  ...Object.entries(STATE_TONE).map(([name, classes]) => ({ name: `pill ${name}`, classes })),
  { name: 'agent mark', classes: AGENT_MARK_TONE },
  ...Object.entries(BANNER_TONE).map(([name, classes]) => ({ name: `banner ${name}`, classes })),
  { name: 'body text on a card', classes: 'bg-card text-foreground' },
  { name: 'secondary text on a card', classes: 'bg-card text-muted-foreground' },
  { name: 'secondary text on the page', classes: 'bg-background text-muted-foreground' },
  { name: 'secondary text on the muted surface (table heads, the reason form)', classes: 'bg-muted text-muted-foreground' },
  { name: 'body text on the muted surface (the run message)', classes: 'bg-muted text-foreground' },
  // An evidence link is body text with an underline: `text-primary` on a card is 4.16:1 in the dark theme.
  { name: 'an evidence link on a card (underlined body text)', classes: 'bg-card text-foreground' },
]
