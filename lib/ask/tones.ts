/**
 * The colours of the CRM chat.
 *
 * The same rules as the agent screens (lib/agent/tones.ts), found the hard way in a real browser: the WORD carries the meaning, the text is `text-foreground` (or
 * `text-muted-foreground` on a surface that was measured) on a SOLID theme surface, and only the BORDER takes a status colour. Never a status colour as text on
 * a tint of itself, never the shared Badge / StatusBadge. lib/ask/contrast.test.ts computes the real ratios from app/globals.css, light and dark, and from the
 * Tailwind palette for the two fixed purple pairs (the header and the person's own bubble), and scans the chat's components for the patterns that failed.
 *
 * Class names are written out in full so Tailwind finds them.
 */
import { CHIP_TONE, FIELD_ERROR_TEXT, NOTICE_TONE } from '@/lib/org-accounts/tones'

export { FIELD_ERROR_TEXT }

/** The status word above a non-answer: "Nothing found", "I cannot see that" (caution), "Unavailable right now" (error). */
export const STATUS_STRIP_BASE = 'mb-1.5 inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium'

export const STATUS_STRIP_TONE: Record<'caution' | 'error', string> = {
  caution: CHIP_TONE.caution,
  error: NOTICE_TONE.error,
}

/** A failure, or the day's cap, above the box: a boxed line on the page surface. */
export const NOTICE_BASE = 'mx-3 mb-2 rounded-lg border px-3 py-2 text-xs'

export const NOTICE_LOOK = NOTICE_TONE.error

/** The two purple surfaces the chat has always had (Tailwind purple-600 and purple-700), with the white text on them. Fixed colours, the same in both themes. */
export const PURPLE = { 'purple-600': '#9333ea', 'purple-700': '#7e22ce', white: '#ffffff' } as const

export const HEADER = 'bg-purple-600 text-white'
export const HEADER_BUTTON = 'text-white hover:bg-purple-700'
export const OWN_BUBBLE = 'bg-purple-600 text-white'

/** The answer's bubble, the places a person's eye rests on it, and the box. */
export const ANSWER_BUBBLE = 'bg-muted text-foreground'

/** Every text / surface class pair of the chat that is drawn from the theme (each has exactly one solid `text-` and one solid `bg-` token), for the contrast test. */
export const TEXT_ON_SURFACE: ReadonlyArray<{ name: string; classes: string }> = [
  { name: 'an answer', classes: ANSWER_BUBBLE },
  { name: '"Based on:" and the kind of a cited record, inside an answer', classes: 'bg-muted text-muted-foreground' },
  { name: 'a citation link, inside an answer (underlined body text)', classes: 'bg-muted text-foreground' },
  { name: 'status word: caution', classes: STATUS_STRIP_TONE.caution },
  { name: 'status word: error', classes: STATUS_STRIP_TONE.error },
  { name: 'a notice (a failure, the cap on the day\'s questions)', classes: NOTICE_LOOK },
  { name: 'body text on the panel', classes: 'bg-background text-foreground' },
  { name: 'secondary text on the panel (the greeting, the counter, the hints)', classes: 'bg-background text-muted-foreground' },
  { name: 'the box and its placeholder', classes: 'bg-muted text-foreground' },
  { name: 'a conversation in the list, a suggestion, a button', classes: 'bg-card text-foreground' },
  { name: 'secondary text on a card (a conversation\'s details)', classes: 'bg-card text-muted-foreground' },
]
