'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, MessageSquareText, Search, Send } from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmSmsLogEntry, CrmSmsStatus } from '@/types/crm'
import { CrmSavedViews } from './crm-saved-views'
import { SendSmsDialog } from './send-sms-dialog'
import { employeeName, useAssignableEmployees } from './lead-employees'

const PAGE_SIZE = 20

const STATUS_BADGE: Record<CrmSmsStatus, BadgeProps['variant']> = {
  sent: 'success', failed: 'destructive', queued: 'warning',
}

/**
 * The log for every SMS this tenant has attempted to send, through any
 * record's "Send SMS" action or the stand-alone one here - append-only,
 * no edit/delete, matching crm_sms_log's own no-deleted_at design (no
 * Recycle Bin link on this screen for that reason).
 */
export function SmsLogListView() {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, true)

  const [items, setItems] = useState<CrmSmsLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<CrmSmsStatus | ''>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sendOpen, setSendOpen] = useState(false)

  const load = useCallback(async () => {
    if (! isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getSmsLog(context, {
        page, perPage: PAGE_SIZE, search: search || undefined, status: status || undefined,
      })
      setItems(response.data.items)
      setTotal(response.data.pagination.total)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load the SMS log.')
    } finally {
      setIsLoading(false)
    }
  }, [context, page, search, status])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleApplyView = (conditions: Record<string, unknown>) => {
    if (typeof conditions.search === 'string') setSearch(conditions.search)
    if (typeof conditions.status === 'string') setStatus(conditions.status as CrmSmsStatus | '')
    setPage(1)
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">SMS Notifier</h1>
          <p className="text-sm text-muted-foreground">Every SMS sent from a CRM record, and whether the gateway accepted it.</p>
        </div>
        <Button onClick={() => setSendOpen(true)}>
          <Send className="mr-1.5 size-4" aria-hidden="true" />
          Send SMS
        </Button>
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }} placeholder="Search phone number…" className="pl-9" />
        </div>
        <Select
          value={status || 'all'}
          onChange={(v) => { setPage(1); setStatus(v === 'all' ? '' : (v as CrmSmsStatus)) }}
          options={[
            { label: 'All statuses', value: 'all' },
            { label: 'Sent', value: 'sent' },
            { label: 'Failed', value: 'failed' },
            { label: 'Queued', value: 'queued' },
          ]}
          className="w-40"
        />
        <CrmSavedViews module="sms_log" currentConditions={{ search, status }} onApply={handleApplyView} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone Number</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent By</TableHead>
              <TableHead>Sent At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 size-5 animate-spin" aria-hidden="true" />Loading SMS log…
              </TableCell></TableRow>
            )}
            {! isLoading && items.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                <MessageSquareText className="mx-auto mb-2 size-6 text-muted-foreground/50" aria-hidden="true" />
                No messages sent yet.
              </TableCell></TableRow>
            )}
            {! isLoading && items.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium text-foreground">{entry.toNumber}</TableCell>
                <TableCell className="max-w-sm truncate" title={entry.message}>{entry.message}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[entry.status]}>{entry.status}</Badge>
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

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} message{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <SendSmsDialog isOpen={sendOpen} onClose={() => setSendOpen(false)} onSent={(message) => { setNotice(message); void load() }} />
    </div>
  )
}
