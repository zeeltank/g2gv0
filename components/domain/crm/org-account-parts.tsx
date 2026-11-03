'use client'

import { forwardRef, useId, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { NativeSelect } from '@/components/shared/scaffolds/form-field'
import { headerSources, lifecycleLabel, lifecycleTone, NO_VALUE, sourceBadges } from '@/lib/org-accounts/display'
import type { Choice, Tile } from '@/lib/org-accounts/list-model'
import { cn } from '@/lib/utils'
import type { Org360, OrgAccountItem, OrgLifecycle } from '@/services/org-accounts/types'

const CHIP = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium'

/** The lifecycle in words. The colour only helps: the word is always there. */
export function LifecycleChip({ lifecycle }: { lifecycle: OrgLifecycle }) {
  return <StatusBadge variant={lifecycleTone(lifecycle)} size="sm" data-lifecycle={lifecycle}>{lifecycleLabel(lifecycle)}</StatusBadge>
}

/** One chip for each source the organisation has a row in (CRM, GTM, Signals with its open signals), and none for a source it lacks. */
export function SourceChips({ item }: { item: Pick<OrgAccountItem, 'sources'> }) {
  const badges = sourceBadges(item)
  if (badges.length === 0) return <span className="text-muted-foreground">{NO_VALUE}</span>
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Known in">
      {badges.map((badge) => (
        <li key={badge.key} data-source={badge.key} className={cn(CHIP, 'border-primary/30 bg-primary/10 text-primary')}>
          <span>{badge.label}</span>
          {badge.detail && <span className="font-normal text-foreground">{badge.detail}</span>}
        </li>
      ))}
    </ul>
  )
}

/** The detail header's badges: each source the identity points at, with the reason in words. */
export function HeaderSources({ links }: { links: Org360['identity']['links'] }) {
  const sources = headerSources(links)
  if (sources.length === 0) return <p className="text-sm text-muted-foreground">This organisation is not linked to any record yet.</p>
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Where this organisation is known">
      {sources.map((source) => (
        <li key={source.key} data-source={source.key} className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className={cn(CHIP, 'border-primary/30 bg-primary/10 text-primary')}>{source.label}</span>
          <span className="text-muted-foreground">{source.basis}</span>
        </li>
      ))}
    </ul>
  )
}

export function SummaryTiles({ tiles }: { tiles: readonly Tile[] }) {
  return (
    <div role="group" aria-label="Summary" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-xl font-semibold leading-tight text-foreground">{tile.value}</p>
          <p className="text-xs text-muted-foreground">{tile.label}</p>
        </div>
      ))}
    </div>
  )
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
  tone: 'success' | 'error'
  text: string
}

const NOTICE_TONES: Record<ScreenNotice['tone'], string> = {
  success: 'border-success/30 bg-success/5 text-success',
  error: 'border-destructive/30 bg-destructive/5 text-destructive',
}

/**
 * A result shown above the list or the page. An error is announced at once (alert); a success politely (status). It can take focus, so a page that
 * has just removed the button the person pressed can put the focus here instead of losing it.
 */
export const NoticeBar = forwardRef<HTMLDivElement, { notice: ScreenNotice; onDismiss: () => void; children?: ReactNode }>(
  ({ notice, onDismiss, children }, ref) => (
    <div
      ref={ref}
      tabIndex={-1}
      role={notice.tone === 'error' ? 'alert' : 'status'}
      className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring', NOTICE_TONES[notice.tone])}
    >
      <span>{notice.text}</span>
      <span className="flex items-center gap-2">
        {children}
        <Button size="sm" variant="ghost" onClick={onDismiss} aria-label="Dismiss">Dismiss</Button>
      </span>
    </div>
  ),
)
NoticeBar.displayName = 'NoticeBar'
