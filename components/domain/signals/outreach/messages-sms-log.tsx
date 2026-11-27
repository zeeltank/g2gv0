'use client'

import { useEffect, useMemo, useState } from 'react'
import { MessageSquareText, Search } from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import { crmService } from '@/services/crm'
import type { CrmSmsLogEntry, CrmSmsStatus } from '@/types/crm'
import { CrmExportButton } from '@/components/domain/crm/crm-export-button'
import { employeeName, useAssignableEmployees } from '@/components/domain/crm/lead-employees'

const PAGE_SIZE = 20
/** How long a person may pause typing before the list is asked for; every keystroke would otherwise be a request of its own. */
const SEARCH_PAUSE_MS = 300

const STATUS_BADGE: Record<CrmSmsStatus, BadgeProps['variant']> = {
  sent: 'success', failed: 'destructive', queued: 'warning',
}

/** The words a person reads for each state. */
const STATUS_LABEL: Record<CrmSmsStatus, string> = { sent: 'Sent', failed: 'Failed', queued: 'Waiting to send' }

interface Loaded {
  /** The page, search and status this answer is for, so a stale answer is never drawn. */
  key: string
  items: CrmSmsLogEntry[]
  total: number
}

type Failure = { key: string; message: string; forbidden: boolean }

/**
 * The SMS log section of the Messages view: every text message this organisation has tried to send, whichever record it came from. It is the old SMS Notifier list, read only:
 * the "Send SMS" button is not here, because SMS cannot be sent from the Outreach tab yet (the owner's safeguard). The Send SMS dialogs of an organisation, an opportunity and a
 * person still send, and are the rows this list shows. The log is append-only (no edit, no delete), as `crm_sms_log` itself is.
 */
export function SmsLogSection() {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, true)

  const [page, setPage] = useState(1)
  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<CrmSmsStatus | ''>('')
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)

  const key = `${page}|${search}|${status}|${attempt}`

  // A pause in typing is what asks for the list; going back to page one belongs to the new search, not to each keystroke.
  useEffect(() => {
    if (typed.trim() === search) return
    const timer = setTimeout(() => { setPage(1); setSearch(typed.trim()) }, SEARCH_PAUSE_MS)

    return () => clearTimeout(timer)
  }, [typed, search])

  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    let live = true
    crmService.getSmsLog(context, { page, perPage: PAGE_SIZE, search: search || undefined, status: status || undefined })
      .then((response) => {
        if (live) setLoaded({ key, items: response.data.items, total: response.data.pagination.total })
      })
      .catch((reason: unknown) => {
        if (!live) return
        const forbidden = reason instanceof ApiError && reason.status === 403
        setFailure({ key, forbidden, message: forbidden ? 'You do not have access to the SMS log.' : reason instanceof Error ? reason.message : 'Unable to load the SMS log.' })
      })

    return () => { live = false }
  }, [context, page, search, status, key])

  const sessionLost = !isLaravelContextReady(context)
  const failed = failure?.key === key ? failure : null
  const current = loaded?.key === key ? loaded : null
  // The previous page stays on screen, dimmed, while the next one is on its way, so the table does not jump.
  const shown = current ?? loaded
  const total = shown?.total ?? 0
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const filtered = search !== '' || status !== ''

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Every text message sent from a record in Sales &amp; Marketing, and whether the SMS service accepted it. SMS cannot be sent from here yet: this list only shows what other screens sent.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Search phone number…" aria-label="Search phone number" className="pl-9" />
        </div>
        <Select
          aria-label="Status"
          value={status || 'all'}
          onChange={(v) => { setPage(1); setStatus(v === 'all' ? '' : (v as CrmSmsStatus)) }}
          options={[
            { label: 'All statuses', value: 'all' },
            { label: STATUS_LABEL.sent, value: 'sent' },
            { label: STATUS_LABEL.failed, value: 'failed' },
            { label: STATUS_LABEL.queued, value: 'queued' },
          ]}
          className="w-40"
        />
        <CrmExportButton href={crmService.smsLogExportUrl(context, { search: search || undefined, status: status || undefined })} />
      </div>

      {sessionLost ? (
        <ErrorState title="Could not load the SMS log" description="Your ERP session is unavailable. Please sign in again." />
      ) : failed ? (
        <ErrorState title="Could not load the SMS log" description={failed.message} retry={failed.forbidden ? undefined : () => { setFailure(null); setAttempt((n) => n + 1) }} />
      ) : !shown ? (
        <Skeleton className="h-40" />
      ) : shown.items.length === 0 ? (
        <div className="rounded-lg border border-border p-10 text-center text-sm text-muted-foreground">
          <MessageSquareText className="mx-auto mb-2 size-6 text-muted-foreground/50" aria-hidden="true" />
          {filtered ? 'No text messages match. Clear the search or the status to see them all.' : 'No text messages have been sent yet. Messages sent from an organisation, an opportunity or a person will be listed here.'}
        </div>
      ) : (
        <div className={`overflow-x-auto rounded-lg border border-border ${current ? '' : 'opacity-60'}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone number</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent by</TableHead>
                <TableHead>Sent at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.items.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium text-foreground">{entry.toNumber}</TableCell>
                  <TableCell className="max-w-sm truncate" title={entry.message}>{entry.message}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[entry.status]}>{STATUS_LABEL[entry.status]}</Badge>
                    {entry.status === 'failed' && entry.errorReason && (
                      <span className="ml-2 text-xs text-muted-foreground" title={entry.errorReason}>{entry.errorReason}</span>
                    )}
                  </TableCell>
                  <TableCell>{entry.sentBy ? employeeName(employees, entry.sentBy) : '—'}</TableCell>
                  <TableCell>{entry.createdAt ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!sessionLost && !failed && shown && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{total} message{total === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span>Page {page} of {lastPage}</span>
            <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}
