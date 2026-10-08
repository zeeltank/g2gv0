'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { describeAiError } from '@/lib/intelligence/client'
import {
  searchReportRecipients,
  sendChatReport,
  type ReportRecipient,
  type SendReportResult,
} from '@/lib/intelligence/ai-chat-artifacts'

const field =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'

/**
 * Pick real people of the organisation and send them a saved report by e-mail.
 *
 * Flow: search recipients (backend list, tenant-scoped, only people with an e-mail) -> select ->
 * optional note -> Confirm send -> per-recipient result. The backend re-checks everything
 * (administrator only, organisation, mail enabled), so a refusal is shown as the error, never
 * hidden. A fresh request key per open dialog makes a double click a no-op on the server.
 */
function SendReportDialogBody({
  onOpenChange,
  reportId,
  title,
  previewHref,
  onSent,
}: {
  onOpenChange: (open: boolean) => void
  reportId: number
  title: string
  /** The saved report page, so the sender can look at exactly what goes out. */
  previewHref: string
  onSent?: (result: SendReportResult) => void
}) {
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<ReportRecipient[]>([])
  const [max, setMax] = useState(20)
  const [loadingPeople, setLoadingPeople] = useState(false)
  const [peopleError, setPeopleError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<number, ReportRecipient>>({})
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SendReportResult | null>(null)
  // One key per opened dialog: the body is mounted fresh each time, so a double click is a no-op server-side.
  const [requestKey] = useState(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  )

  // Search the real list (debounced); an empty query lists the first people alphabetically.
  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoadingPeople(true)
      searchReportRecipients(query)
        .then((data) => {
          if (cancelled) return
          setPeople(data.recipients)
          setMax(data.max_recipients)
          setPeopleError(null)
        })
        .catch((caught) => {
          if (!cancelled) setPeopleError(describeAiError(caught, 'The list of people could not be loaded.'))
        })
        .finally(() => {
          if (!cancelled) setLoadingPeople(false)
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  const chosen = useMemo(() => Object.values(selected), [selected])

  const toggle = (person: ReportRecipient) =>
    setSelected((current) => {
      const next = { ...current }
      if (next[person.id]) delete next[person.id]
      else if (Object.keys(next).length < max) next[person.id] = person
      return next
    })

  const send = useCallback(async () => {
    if (sending || chosen.length === 0) return
    setSending(true)
    setError(null)
    try {
      const outcome = await sendChatReport(
        reportId,
        chosen.map((person) => person.id),
        { note, requestKey },
      )
      setResult(outcome)
      onSent?.(outcome)
    } catch (caught) {
      setError(describeAiError(caught, 'The report could not be sent.'))
    } finally {
      setSending(false)
    }
  }, [sending, chosen, reportId, note, onSent, requestKey])

  return (
    <Dialog open onOpenChange={(next) => (sending ? undefined : onOpenChange(next))}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send report</DialogTitle>
          <DialogDescription>
            {title} ·{' '}
            <Link href={previewHref} target="_blank" className="underline">
              preview what is sent
            </Link>
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-2 text-sm" role="status">
            <p className="font-medium">
              {result.sent} sent{result.failed ? `, ${result.failed} failed` : ''}
              {result.duplicate ? `, ${result.duplicate} already sent a moment ago` : ''}.
            </p>
            <ul className="max-h-60 space-y-1 overflow-auto">
              {result.results.map((row) => (
                <li key={row.recipient_user_id} className="flex items-start gap-2">
                  {row.status === 'sent' ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <AlertCircle className={`mt-0.5 size-4 shrink-0 ${row.status === 'failed' ? 'text-destructive' : 'text-amber-600'}`} aria-hidden />
                  )}
                  <span>
                    {row.name} <span className="text-muted-foreground">&lt;{row.email}&gt;</span> - {row.status}
                    {row.error ? <span className="block text-xs text-muted-foreground">{row.error}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <input
              className={field}
              type="search"
              placeholder="Search people by name or e-mail"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search recipients"
            />

            <div className="max-h-52 overflow-auto rounded-xl border border-border">
              {loadingPeople && people.length === 0 ? (
                <p className="flex items-center gap-2 p-3 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Loading people…
                </p>
              ) : peopleError ? (
                <p className="p-3 text-destructive">{peopleError}</p>
              ) : people.length === 0 ? (
                <p className="p-3 text-muted-foreground">No one with an e-mail address matches.</p>
              ) : (
                people.map((person) => (
                  <label key={person.id} className="flex cursor-pointer items-start gap-2 border-b border-border/60 px-3 py-2 last:border-b-0 hover:bg-muted/40">
                    <input type="checkbox" className="mt-1" checked={Boolean(selected[person.id])} onChange={() => toggle(person)} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{person.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {person.email}
                        {person.role ? ` · ${person.role}` : ''}
                        {person.department ? ` · ${person.department}` : ''}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {chosen.length} selected (up to {max}).{' '}
              {chosen.length > 0 ? chosen.map((person) => person.name).join(', ') : 'Choose at least one person.'}
            </p>

            <textarea
              className={field}
              rows={2}
              maxLength={500}
              placeholder="Optional note to include"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              aria-label="Note"
            />

            {error ? (
              <p className="flex items-start gap-2 text-destructive" role="alert">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void send()} disabled={sending || chosen.length === 0}>
                {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                Confirm send to {chosen.length || '…'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Mounts the dialog fresh on every open, so each send starts clean with its own request key. */
export function SendReportDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  reportId: number
  title: string
  /** The saved report page, so the sender can look at exactly what goes out. */
  previewHref: string
  onSent?: (result: SendReportResult) => void
}) {
  const { open, ...rest } = props

  return open ? <SendReportDialogBody {...rest} /> : null
}
