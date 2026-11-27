/**
 * The look of the chips and notices of the Automations and Runs tabs.
 *
 * It is the Organisation 360 look (lib/org-accounts/tones.ts) and nothing new: the WORD carries the meaning ("On", "Paused", "Waiting for you"), the text
 * of every chip and notice is `text-foreground` (or `text-muted-foreground` on the muted surface) on a SOLID theme surface, and only the border takes the
 * status colour, never the status colour as text on a tint of itself. lib/workflows/contrast.test.ts computes the real ratios from app/globals.css, light
 * and dark, and scans the Automations components for the patterns that failed elsewhere.
 *
 * Class names are written out in full so Tailwind finds them.
 */
import { CHIP_BASE, CHIP_TONE, FIELD_ERROR_TEXT, NOTICE_TONE, type ChipTone } from '@/lib/org-accounts/tones'

export { CHIP_BASE, FIELD_ERROR_TEXT, NOTICE_TONE }

export type StatusTone = ChipTone

/** The tone of a workflow's status. */
export const WORKFLOW_STATUS_TONE: Readonly<Record<string, ChipTone>> = {
  draft: 'neutral',
  active: 'positive',
  paused: 'caution',
  archived: 'muted',
}

/** The tone of a run's (or a step's) status. */
export const RUN_STATUS_TONE: Readonly<Record<string, ChipTone | 'problem'>> = {
  queued: 'info',
  running: 'info',
  succeeded: 'positive',
  failed: 'problem',
  skipped: 'muted',
  pending_approval: 'caution',
  retry_wait: 'caution',
  rejected: 'muted',
  cancelled: 'muted',
}

/** A chip that needs a problem look: a red border on a solid surface, the word still in the foreground colour. */
const PROBLEM_CHIP = 'border-destructive bg-card text-foreground'

export function chipClass(tone: ChipTone | 'problem'): string {
  return tone === 'problem' ? PROBLEM_CHIP : CHIP_TONE[tone]
}

/** A short note on the page: a confirmation, a caution, or plain information. */
export const NOTE_TONE = {
  success: NOTICE_TONE.success,
  error: NOTICE_TONE.error,
  caution: 'border-amber-500 bg-card text-foreground',
  info: 'border-border bg-muted text-foreground',
} as const

export type NoteTone = keyof typeof NOTE_TONE

/** Every text / surface class pair this file defines, for the contrast test. */
export const TEXT_ON_SURFACE: ReadonlyArray<{ name: string; classes: string }> = [
  ...Object.entries(CHIP_TONE).map(([name, classes]) => ({ name: `chip ${name}`, classes })),
  { name: 'chip problem', classes: PROBLEM_CHIP },
  ...Object.entries(NOTE_TONE).map(([name, classes]) => ({ name: `note ${name}`, classes })),
  { name: 'secondary text on a card', classes: 'bg-card text-muted-foreground' },
  { name: 'secondary text on the muted surface', classes: 'bg-muted text-muted-foreground' },
]
