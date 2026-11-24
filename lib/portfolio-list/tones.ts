/**
 * The look of the Product Portfolio list's chips, notices, and its bulk bar (slice 15, track P3-A).
 *
 * The method is the Organisation 360 parts' and Signal Review's (lib/org-accounts/tones.ts, lib/signals/tones.ts): the WORD carries the meaning, the text is
 * `text-foreground` (or `text-muted-foreground` on the muted surface) on a SOLID theme surface, and only the border takes the status colour. A real browser's axe
 * run measured `text-success` on `bg-success/10` at 2.03:1; jsdom computes no colour, so lib/portfolio-list/contrast.test.ts computes the real ratios from
 * app/globals.css, light and dark, and scans the components of this screen for the patterns that failed.
 *
 * Class names are written out in full so Tailwind finds them.
 */
import { CHIP_BASE, CHIP_TONE, NOTICE_TONE, type ChipTone } from '@/lib/org-accounts/tones'

export { CHIP_BASE, NOTICE_TONE }

/** The tone names the readiness, state and ICP rules use, mapped to a chip look. */
export function chipClass(tone: 'success' | 'primary' | 'pending' | 'inactive' | 'default'): string {
  const map: Record<typeof tone, ChipTone> = { success: 'positive', primary: 'info', pending: 'caution', inactive: 'muted', default: 'neutral' }
  return `${CHIP_BASE} ${CHIP_TONE[map[tone]]}`
}

/** A confirmation or a refusal in words, where the person is looking. */
export const BANNER_TONE: Record<'success' | 'error' | 'info', string> = {
  success: NOTICE_TONE.success,
  error: NOTICE_TONE.error,
  info: 'border-primary bg-card text-foreground',
}

/**
 * The group header row of a Product: a solid muted band (the Sub-product rows under it stay on the card), a 4 px accent on its left edge, a heavier rule above it and
 * more air in its cells, so each Product reads as a section and its Sub-products as the rows of that section. Body text on a solid theme surface only.
 */
export const GROUP_ROW = 'border-t-2 border-t-border bg-muted hover:bg-muted [&>td]:pb-3 [&>td]:pt-5 [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-primary'

/** A link inside the list: body text with an underline (`text-primary` on a card is 4.16:1 in the dark theme). */
export const LINK_TEXT = 'text-foreground underline underline-offset-2 hover:no-underline'

/** Every text / surface class pair this screen puts words on, for the contrast test (each has exactly one solid `text-` and one solid `bg-` token). */
export const TEXT_ON_SURFACE: ReadonlyArray<{ name: string; classes: string }> = [
  ...Object.entries(CHIP_TONE).map(([name, classes]) => ({ name: `chip ${name}`, classes })),
  ...Object.entries(BANNER_TONE).map(([name, classes]) => ({ name: `banner ${name}`, classes })),
  { name: 'a link inside the list', classes: 'bg-card text-foreground' },
  { name: 'secondary text on a card', classes: 'bg-card text-muted-foreground' },
  { name: 'secondary text on the muted surface', classes: 'bg-muted text-muted-foreground' },
]
