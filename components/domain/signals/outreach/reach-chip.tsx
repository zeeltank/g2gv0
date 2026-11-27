'use client'

import { cn } from '@/lib/utils'
import { CHIP_BASE, CHIP_TONE } from '@/lib/org-accounts/tones'
import { CONSENT_LABEL, CONSENT_TONE, REACH_HELP, REACH_LABEL, REACH_TONE, type Tone } from '@/lib/signals/outreach-model'
import type { ConsentStatus, OutreachReach } from '@/services/signals/outreach-types'

/**
 * The model's five tones as theme surfaces. Every chip is `text-foreground` on the solid `bg-card` and only the border takes the status colour, the way the Organizations chips
 * are drawn, so the word is what carries the meaning and the pair stays readable in light and dark (lib/org-accounts/contrast.test.ts measures the shared pairs;
 * `border-destructive bg-card text-foreground` is the pair the notices already use).
 */
export const TONE_CLASS: Readonly<Record<Tone, string>> = {
  success: CHIP_TONE.positive,
  info: CHIP_TONE.info,
  warning: CHIP_TONE.caution,
  danger: 'border-destructive bg-card text-foreground',
  neutral: CHIP_TONE.neutral,
}

/**
 * What can be done with a row, in a word. The sentence that says what the word means is the chip's tooltip, so a person who is unsure only has to point at it; the same
 * sentences are written out on the person's page, because a tooltip is no help on a phone.
 */
export function ReachChip({ reach, className }: { reach: OutreachReach; className?: string }) {
  return (
    <span data-reach={reach} title={REACH_HELP[reach]} className={cn(CHIP_BASE, TONE_CLASS[REACH_TONE[reach]], className)}>
      {REACH_LABEL[reach]}
    </span>
  )
}

/** Whether the person agreed to hear from us. Drawn only where it says something: "No answer yet" is the usual case, so the lists leave it out. */
export function ConsentChip({ status, className }: { status: ConsentStatus; className?: string }) {
  return (
    <span data-consent={status} className={cn(CHIP_BASE, TONE_CLASS[CONSENT_TONE[status]], className)}>
      {CONSENT_LABEL[status]}
    </span>
  )
}
