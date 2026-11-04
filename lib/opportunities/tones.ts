/**
 * The look of what the opportunity screens gained with slice 11b (the loss-reason dialog and field, the product line and column, the Reason Lost card).
 *
 * The WORDS carry the meaning ("Price too high", "No product chosen", "Choose why this opportunity was lost"); a border only helps. Every piece of text is
 * `text-foreground` or `text-muted-foreground` on a SOLID theme surface, never a status colour as text and never a tint of one as a surface: that is what a
 * real browser's axe run found on the Organisation 360 and agent screens (1.89:1 to 4.31:1). The shared Field's error text is `text-destructive`, which is
 * 3.97:1 on the page, so an error under a field takes the dark red of lib/org-accounts/tones.ts. The pairs below are solid tokens, so
 * lib/opportunities/contrast.test.ts computes the real ratios from app/globals.css, light and dark. Class names are written out in full so Tailwind finds them.
 */
import { FIELD_ERROR_TEXT, NOTICE_TONE } from '@/lib/org-accounts/tones'

export { FIELD_ERROR_TEXT, NOTICE_TONE }

/** Every text / surface class pair the new parts put words on, for the contrast test (each has exactly one solid `text-` and one solid `bg-` token). */
export const TEXT_ON_SURFACE: ReadonlyArray<{ name: string; classes: string }> = [
  { name: 'the product line under the title, on the page', classes: 'bg-background text-muted-foreground' },
  { name: 'the product under a name in the list, on the page', classes: 'bg-background text-muted-foreground' },
  { name: 'a label on a card', classes: 'bg-card text-muted-foreground' },
  { name: 'a value on a card (the reason in words)', classes: 'bg-card text-foreground' },
  { name: 'a hint or note in the dialog', classes: 'bg-card text-muted-foreground' },
  { name: 'a field label in the dialog', classes: 'bg-card text-foreground' },
  { name: 'the server\'s refusal in the dialog', classes: NOTICE_TONE.error },
]
