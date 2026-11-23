/**
 * The look of the shared product picker: its box, its list, its rows, the group headings and the messages under the list.
 *
 * The method is the Signals screens' (lib/signals/tones.ts) and the Organisation 360 parts': the WORD carries the meaning, the text is `text-foreground` (or
 * `text-muted-foreground` on a surface it passes on) on a SOLID theme surface, and only a border takes a status colour. A status colour as text on a tint of
 * itself failed in a real browser's axe run (2.03:1); jsdom computes no colour, so lib/product-picker/contrast.test.ts computes the real ratios from
 * app/globals.css, light and dark, and scans the picker's files for the patterns that failed. Class names are written out in full so Tailwind finds them.
 */
import { NOTICE_TONE } from '@/lib/org-accounts/tones'

export const BOX = 'flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40'
export const BOX_EMPTY = 'text-muted-foreground'
export const POPOVER = 'absolute z-50 w-full min-w-[16rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover text-foreground shadow-xl'
export const LIST = 'max-h-64 overflow-y-auto p-1'
export const GROUP_HEADING = 'px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground'
export const ROW = 'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground'
export const ROW_ACTIVE = 'bg-muted'
export const ROW_QUIET = 'block truncate text-[11px] text-muted-foreground'
export const MESSAGE = 'px-3 py-6 text-center text-xs text-muted-foreground'
export const FOOTER = 'border-t border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground'
export const FAILURE = `${NOTICE_TONE.error} m-2 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs`
export const RETRY = 'rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted'
export const STATE_WORD = 'shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] text-foreground'

/** Every text / surface class pair the picker puts words on, for the contrast test (each has exactly one solid `text-` and one solid `bg-` token). */
export const TEXT_ON_SURFACE: ReadonlyArray<{ name: string; classes: string }> = [
  { name: 'the chosen name in the box', classes: 'bg-background text-foreground' },
  { name: 'the placeholder in the box', classes: 'bg-background text-muted-foreground' },
  { name: 'a row in the list', classes: 'bg-popover text-foreground' },
  { name: 'the highlighted row', classes: 'bg-muted text-foreground' },
  { name: 'a group heading in the list', classes: 'bg-popover text-muted-foreground' },
  { name: 'the SKU under a name', classes: 'bg-popover text-muted-foreground' },
  { name: 'the SKU under the highlighted name', classes: 'bg-muted text-muted-foreground' },
  { name: 'a message under the list', classes: 'bg-popover text-muted-foreground' },
  { name: 'the failure notice', classes: NOTICE_TONE.error },
  { name: 'the Retry button', classes: 'bg-background text-foreground' },
  { name: 'a state word (Paused, Not sold)', classes: 'bg-muted text-foreground' },
]
