/**
 * The look of what the campaign screens gained with slice 9 (the funnel, the product and link lines, the form's Product box).
 *
 * The WORDS and NUMBERS carry the meaning ("Sent 30", "75% of targets", "No product chosen"); a bar only helps the eye and is hidden from a screen reader.
 * Every piece of text is `text-foreground` or `text-muted-foreground` on a SOLID theme surface, never a status colour as text and never a tint of one as a
 * surface: that is what a real browser's axe run found on the Organisation 360 and agent screens (1.89:1 to 4.31:1). The pairs below are solid tokens, so
 * lib/campaigns/contrast.test.ts computes the real ratios from app/globals.css, light and dark. Class names are written out in full so Tailwind finds them.
 */

/** The funnel bar: a solid fill on a solid track. It carries no meaning of its own (the number beside it does), but it must still be seen: 3:1 against the track. */
export const FUNNEL_BAR = {
  track: 'bg-muted',
  fill: 'bg-primary',
} as const

/** Every text / surface class pair the new parts put words on, for the contrast test (each has exactly one solid `text-` and one solid `bg-` token). */
export const TEXT_ON_SURFACE: ReadonlyArray<{ name: string; classes: string }> = [
  { name: 'a step\'s label and number on the page', classes: 'bg-background text-foreground' },
  { name: 'a step\'s share, the notes and the empty text on the page', classes: 'bg-background text-muted-foreground' },
  { name: 'a link line on the page (underlined body text)', classes: 'bg-background text-foreground' },
  { name: 'a label on a card', classes: 'bg-card text-muted-foreground' },
  { name: 'a value on a card', classes: 'bg-card text-foreground' },
]

/** Every pair of solid fills the new parts draw for the eye (not text), with the least contrast WCAG asks of a graphic that helps understanding (3:1). */
export const GRAPHIC_ON_SURFACE: ReadonlyArray<{ name: string; fill: string; surface: string }> = [
  { name: 'the funnel bar on its track', fill: FUNNEL_BAR.fill, surface: FUNNEL_BAR.track },
]

export const MIN_GRAPHIC = 3
