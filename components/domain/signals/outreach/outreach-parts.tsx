'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { createdText } from '@/lib/crm/people'
import { NOTICE_TONE } from '@/lib/org-accounts/tones'
import { chipCount, OUTREACH_CHIPS, type OutreachChip, type OutreachSortKey } from '@/lib/signals/outreach-model'
import type { OutreachSummary } from '@/services/signals/outreach-types'

/**
 * The small parts the Outreach lists and pages share: the words for a date, a failure and a message's status, the sortable column head, the search box, the filter chips,
 * the pager and the notice bar. They are drawn the way the Organizations list draws them so the two modules read as one.
 */

/** A date as a person reads it ("20 Nov 2026"), or `empty` when there is none. The date part is read as written, so it never slips a day with the viewer's time zone. */
export const dayText = (value: string | null | undefined, empty: string): string => (value ? createdText(value) : empty)

/** "Not yet", the answer to "when did we last write to them" for a row nobody has written to. */
export const lastContactedText = (value: string | null | undefined): string => dayText(value, 'Not yet')

export const NETWORK_TEXT = 'The request did not reach the server. Check your connection and try again.'

/**
 * A failed call in words. A refusal (403) and a missing row (404) get the same sentence wherever they happen; anything else keeps the server's own sentence when it gave
 * one, and a request that never arrived says so. No status code is ever shown.
 */
export function errorText(cause: unknown, fallback: string): string {
  const status = (cause as { status?: unknown } | null)?.status
  if (status === 403) return 'You are not allowed to do this. Ask an administrator if you need access.'
  if (status === 404) return 'This could not be found. It may have been removed.'
  const full = (cause as { fullMessage?: unknown } | null)?.fullMessage
  const message = (typeof full === 'string' && full.trim() !== '' ? full : cause instanceof Error ? cause.message : '').trim()
  if (typeof status === 'number') return message || fallback
  return cause instanceof TypeError ? NETWORK_TEXT : (message || fallback)
}

/** The per-field messages of a refused form (a 422), one sentence per field, so each can be shown under its own box. */
export function fieldErrors(cause: unknown): Record<string, string> {
  const errors = (cause as { errors?: unknown } | null)?.errors
  if (!errors || typeof errors !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [field, raw] of Object.entries(errors as Record<string, unknown>)) {
    const text = (Array.isArray(raw) ? raw : [raw]).filter((part): part is string => typeof part === 'string' && part !== '').join(' ')
    if (text) out[field] = text
  }
  return out
}

/** A link from the web is opened only when it really is one: a stored value such as `javascript:` is shown as text, never made clickable. */
export function webHref(value: string | null | undefined): string | null {
  const text = (value ?? '').trim()
  if (!text) return null
  if (/^https?:\/\/\S+$/i.test(text)) return text
  return /^[a-z][a-z0-9+.-]*:/i.test(text) ? null : `https://${text}`
}

const MESSAGE_STATUS_WORDS: Readonly<Record<string, string>> = {
  draft: 'Draft',
  pending_approval: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Not approved',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Could not be sent',
  cancelled: 'Cancelled',
}

/** A message's status in plain words; a status this screen does not know is still readable, never a raw code with underscores. */
export function messageStatusWord(status: string): string {
  const known = MESSAGE_STATUS_WORDS[status]
  if (known) return known
  const text = status.replace(/_/g, ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Unknown'
}

// ── The list controls ────────────────────────────────────────────────────────────

export function SortHead({ label, sortKey, activeKey, asc, onSort, className }: {
  label: string
  sortKey: OutreachSortKey
  activeKey: OutreachSortKey
  asc: boolean
  onSort: (key: OutreachSortKey) => void
  className?: string
}) {
  return (
    <TableHead className={className} aria-sort={activeKey === sortKey ? (asc ? 'ascending' : 'descending') : undefined}>
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 normal-case text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {label}
        {activeKey === sortKey && <ChevronDown className={cn('size-3.5 transition-transform', asc && 'rotate-180')} aria-hidden="true" />}
      </button>
    </TableHead>
  )
}

/** Waits for a pause in typing before the list is asked again, so one word is one request, not one per letter. */
export const SEARCH_DELAY_MS = 250

/**
 * The search box. What is typed shows at once; the list is asked for it only after a short pause (the company's People rail waits the same way), and the box starts with the
 * search the page already holds, so a list that is left and opened again still shows what was searched for.
 */
export function SearchBox({ value, onCommit, label, placeholder }: { value: string; onCommit: (text: string) => void; label: string; placeholder: string }) {
  const [typed, setTyped] = useState(value)
  const latest = useRef({ value, onCommit })
  useEffect(() => { latest.current = { value, onCommit } })
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = typed.trim()
      if (next !== latest.current.value.trim()) latest.current.onCommit(next)
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(handle)
  }, [typed])

  return (
    <div className="relative min-w-0 max-w-sm flex-1 basis-56">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input aria-label={label} value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
  )
}

/**
 * The filter chips, each with the number the server counted for the whole list. A chip asks for exactly its own filter, so they are exclusive. `only` names the few chips that make
 * sense for a short list that is filtered here in the page (one company's people), where "Mine" and the source chips would have nothing to count.
 */
export function OutreachChips({ active, summary, onPick, only }: { active: OutreachChip; summary: OutreachSummary | null; onPick: (chip: OutreachChip) => void; only?: readonly OutreachChip[] }) {
  return (
    <div role="group" aria-label="Show" className="flex flex-wrap items-center gap-1.5">
      {OUTREACH_CHIPS.filter((chip) => !only || only.includes(chip.id)).map((chip) => {
        const count = chipCount(chip.id, summary)
        return (
          <button
            key={chip.id}
            type="button"
            data-chip={chip.id}
            aria-pressed={active === chip.id}
            // The number sits in its own span with no space before it, so a screen reader would read "Ready to contact2". The name with the space is spelled out.
            aria-label={count === null ? undefined : `${chip.label} ${count}`}
            onClick={() => onPick(chip.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active === chip.id ? 'border-primary bg-muted font-semibold text-foreground' : 'border-border bg-card text-foreground',
            )}
          >
            {chip.label}
            {count !== null && <span className="ml-1.5 text-muted-foreground">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function Pager({ total, noun, nounPlural, page, lastPage, onPage }: { total: number; noun: string; nounPlural: string; page: number; lastPage: number; onPage: (page: number) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>{total} {total === 1 ? noun : nounPlural}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <span>Page {page} of {lastPage}</span>
        <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  )
}

// ── Notices ───────────────────────────────────────────────────────────────────────

/** What an action said when it finished: a confirmation or a refusal, with a link to the thing it made when there is one. */
export interface OutreachNotice {
  tone: 'success' | 'error'
  text: string
  href?: string
  linkText?: string
}

/** A refusal is announced at once (an alert); a confirmation is read when the screen is idle (a status). The word carries the meaning, the border only helps. */
export function NoticeBar({ notice, onDismiss }: { notice: OutreachNotice; onDismiss: () => void }) {
  return (
    <div role={notice.tone === 'error' ? 'alert' : 'status'} data-notice={notice.tone} className={cn('flex items-start justify-between gap-3 rounded-lg border p-3 text-sm', NOTICE_TONE[notice.tone])}>
      <p className="min-w-0 break-words">
        {notice.text}
        {notice.href && <> <Link href={notice.href} className="font-medium underline underline-offset-2 hover:no-underline">{notice.linkText ?? 'Open it'}</Link></>}
      </p>
      <button type="button" aria-label="Dismiss this message" onClick={onDismiss} className="shrink-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
