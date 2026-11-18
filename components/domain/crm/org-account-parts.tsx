'use client'

import { forwardRef, useId, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/shared/scaffolds/form-field'
import { lifecycleLabel, NO_VALUE, sourceBadges } from '@/lib/org-accounts/display'
import type { Choice } from '@/lib/org-accounts/scope-model'
import { CHIP_BASE, CHIP_TONE, DATE_BASE, DATE_TONE, LIFECYCLE_TONE, NOTICE_TONE, type ChipTone, type NoticeTone } from '@/lib/org-accounts/tones'
import { dateBadge, statusChip, type StatusChipTone } from '@/lib/signal-review/signal-display'
import { cn } from '@/lib/utils'
import type { OrgAccountItem, OrgLifecycle, OrgSignalLine } from '@/services/org-accounts/types'

/** The lifecycle in words. The border colour only helps: the word is always there, and its text is `text-foreground` (see lib/org-accounts/tones.ts). */
export function LifecycleChip({ lifecycle }: { lifecycle: OrgLifecycle }) {
  return <span data-lifecycle={lifecycle} className={cn(CHIP_BASE, CHIP_TONE[LIFECYCLE_TONE[lifecycle] ?? 'neutral'])}>{lifecycleLabel(lifecycle)}</span>
}

/** One chip for each source the organisation has a row in (CRM, GTM, Signals with its open signals), and none for a source it lacks. */
export function SourceChips({ item }: { item: Pick<OrgAccountItem, 'sources'> }) {
  const badges = sourceBadges(item)
  if (badges.length === 0) return <span className="text-muted-foreground">{NO_VALUE}</span>
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Known in">
      {badges.map((badge) => (
        <li key={badge.key} data-source={badge.key} className={cn(CHIP_BASE, CHIP_TONE.neutral)}>
          <span className="font-semibold">{badge.label}</span>
          {badge.detail && <span className="font-normal">{badge.detail}</span>}
        </li>
      ))}
    </ul>
  )
}

/** A source tag on a contact or a deal line ("CRM", "GTM"). */
export function SourceTag({ source }: { source: 'crm' | 'gtm' }) {
  return <span data-source={source} className={cn(CHIP_BASE, CHIP_TONE.neutral)}>{source === 'crm' ? 'CRM' : 'GTM'}</span>
}

const SIGNAL_CHIP_TONE: Record<StatusChipTone, ChipTone> = { neutral: 'info', warning: 'caution', success: 'positive', destructive: 'muted' }

/** A signal's review status in the words Signal Review uses ("Needs decision", "Contacted", "Reviewed", "Not relevant"). */
export function SignalStateChip({ status }: { status: OrgSignalLine['review_status'] }) {
  const chip = statusChip(status)
  return <span data-status={status} className={cn(CHIP_BASE, CHIP_TONE[SIGNAL_CHIP_TONE[chip.tone]])}>{chip.label}</span>
}

/** The date of a signal, and what kind of date it is. A signal with no date says "Date unknown" in a dashed outline. */
export function SignalDatePill({ info }: { info: OrgSignalLine['date_info'] | null | undefined }) {
  const badge = dateBadge(info)
  return <span data-date-kind={badge.kind} className={cn(DATE_BASE, DATE_TONE[badge.kind])}>{badge.text}</span>
}

/** A labelled native select: it takes the label wiring, and the lists here are short. */
export function Facet({ label, value, choices, onChange }: { label: string; value: string; choices: readonly Choice[]; onChange: (value: string) => void }) {
  const id = useId()
  return (
    <div className="flex min-w-[9rem] flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      </NativeSelect>
    </div>
  )
}

export interface ScreenNotice {
  tone: NoticeTone
  text: string
}

/**
 * A result shown above a list or a tab. An error is announced at once (alert); a success politely (status). It can take focus, so a page that has
 * just removed the button the person pressed can put the focus here instead of losing it. The text is `text-foreground` on the surface with a coloured
 * border and an icon: the words and the icon say what happened, the colour only helps.
 */
export const NoticeBar = forwardRef<HTMLDivElement, { notice: ScreenNotice; onDismiss: () => void; children?: ReactNode }>(
  ({ notice, onDismiss, children }, ref) => {
    const Icon = notice.tone === 'error' ? AlertCircle : CheckCircle2
    return (
      <div
        ref={ref}
        tabIndex={-1}
        role={notice.tone === 'error' ? 'alert' : 'status'}
        className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring', NOTICE_TONE[notice.tone])}
      >
        <span className="flex items-center gap-2">
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span>{notice.text}</span>
        </span>
        <span className="flex items-center gap-2">
          {children}
          <Button size="sm" variant="ghost" onClick={onDismiss} aria-label="Dismiss">Dismiss</Button>
        </span>
      </div>
    )
  },
)
NoticeBar.displayName = 'NoticeBar'
