/**
 * The look of the chips, the notices and the links of the Product Portfolio pages (the Sub-product page, the Product page and the form), and the colour a readiness state is drawn in.
 *
 * Found in a real browser (axe, 4 Nov 2026), not by the jsdom tests, which compute no colour: the shared StatusBadge draws the status colour as TEXT on a tint of
 * itself (`text-success` on `bg-success/10` is 2.03:1, `text-warning` 1.89:1, `text-primary` 4.31:1), and the scope switch's active state was `text-primary` on
 * `bg-primary/10` (4.31:1). So the look is the Organisation 360 parts' (lib/org-accounts/tones.ts): the WORD carries the meaning, the text is `text-foreground`
 * on a SOLID theme surface, and only the border takes the status colour. lib/product-master/contrast.test.ts computes the real ratios from app/globals.css,
 * light and dark. (The Catalogue | Product lines switch these looks were first written for was removed with the old Products screens, slice 15, WPD.)
 *
 * Class names are written out in full so Tailwind finds them.
 */
import { CHIP_BASE, CHIP_TONE, FIELD_ERROR_TEXT, NOTICE_TONE, type ChipTone } from '@/lib/org-accounts/tones'

export { CHIP_BASE, FIELD_ERROR_TEXT, NOTICE_TONE }

/** The tone names the readiness and ICP rules already use, mapped to a chip look. */
export function chipClass(tone: 'success' | 'primary' | 'pending' | 'inactive' | 'default'): string {
  const map: Record<typeof tone, ChipTone> = { success: 'positive', primary: 'info', pending: 'caution', inactive: 'muted', default: 'neutral' }
  return `${CHIP_BASE} ${CHIP_TONE[map[tone]]}`
}

/** A link inside a card: body text with an underline (`text-primary` on a card is 4.16:1 in the dark theme). */
export const LINK_TEXT = 'text-foreground underline underline-offset-2 hover:no-underline'

/** Every text / surface class pair the Portfolio pages put words on, for the contrast test (each has exactly one solid `text-` and one solid `bg-` token). */
export const TEXT_ON_SURFACE: ReadonlyArray<{ name: string; classes: string }> = [
  ...Object.entries(CHIP_TONE).map(([name, classes]) => ({ name: `chip ${name}`, classes })),
  ...Object.entries(NOTICE_TONE).map(([name, classes]) => ({ name: `notice ${name}`, classes })),
  { name: 'a link inside a card', classes: 'bg-card text-foreground' },
  { name: 'secondary text on a card', classes: 'bg-card text-muted-foreground' },
]

/** The tone names the readiness and ICP rules use. */
export type ReadinessTone = 'success' | 'primary' | 'pending' | 'inactive' | 'default'

/** The colour a readiness state is drawn in: live and proven read as good, in progress as pending, concept and deferred as quiet. */
export function readinessTone(readiness: string | null | undefined): ReadinessTone {
  switch (readiness) {
    case 'Live – with client':
    case 'Proven on real client data (pilot)':
      return 'success'
    case 'Built – no production client':
      return 'primary'
    case 'In development':
    case 'Pilot planned':
    case 'Prototype':
      return 'pending'
    case 'Proposal / concept':
    case 'Deferred':
      return 'inactive'
    default:
      return 'default'
  }
}
