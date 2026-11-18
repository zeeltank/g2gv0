/**
 * The look of the Checks section on the GTM Outreach screen.
 *
 * The WORD carries the meaning ("Passed", "Failed", "3 of 8 checks failed"); the colour of a border only helps, and an icon beside it is aria-hidden. Every
 * piece of text is `text-foreground` or `text-muted-foreground` on a SOLID theme surface, never a status colour as text and never a tint of one as a
 * surface: that is what a real browser's axe run found on the Organisation 360 and agent screens (1.89:1 to 4.31:1). The pairs below are solid tokens, so
 * lib/outreach/contrast.test.ts computes the real ratios from app/globals.css, light and dark. Class names are written out in full so Tailwind finds them.
 */

/** One check's box: the border is the only thing that takes the status colour. */
export const CHECK_TONE = {
  failed: 'border-destructive bg-card text-foreground',
  passed: 'border-success bg-card text-foreground',
} as const

/** The line over the list, and the notice that a send was refused. */
export const SUMMARY_TONE = {
  failed: 'border-destructive bg-card text-foreground',
  passed: 'border-success bg-card text-foreground',
  neutral: 'border-border bg-card text-foreground',
} as const

/** A notice that is neither a pass nor a fail (out of date, unsaved changes, the section is not available). */
export const NOTE_TONE = 'border-border bg-card text-foreground'

/** Every text / surface class pair the section puts words on, for the contrast test (each has exactly one solid `text-` and one solid `bg-` token). */
export const TEXT_ON_SURFACE: ReadonlyArray<{ name: string; classes: string }> = [
  { name: 'a failed check', classes: CHECK_TONE.failed },
  { name: 'a passed check', classes: CHECK_TONE.passed },
  { name: 'the summary of a failed run', classes: SUMMARY_TONE.failed },
  { name: 'the summary of a passed run', classes: SUMMARY_TONE.passed },
  { name: 'the summary of a run that came back empty', classes: SUMMARY_TONE.neutral },
  { name: 'a note (out of date, unsaved changes, not available)', classes: NOTE_TONE },
  { name: 'a check\'s detail on its card', classes: 'bg-card text-muted-foreground' },
  // The message dialog's own surface is `bg-card` (components/ui/dialog.tsx), so the section's loose text sits on that.
  { name: 'the section\'s notes and the empty text on the dialog', classes: 'bg-card text-muted-foreground' },
  { name: 'the section\'s heading and sentences on the dialog', classes: 'bg-card text-foreground' },
]
