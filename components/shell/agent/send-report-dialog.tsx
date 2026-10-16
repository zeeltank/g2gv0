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
  type DeliveryChannel,
  type ReportRecipient,
  type SendReportResult,
} from '@/lib/intelligence/ai-chat-artifacts'

const CHANNELS: Array<{ key: DeliveryChannel; label: string; contact: 'email' | 'mobile'; missing: string }> = [
  { key: 'email', label: 'Email', contact: 'email', missing: 'no email address' },
  { key: 'sms', label: 'SMS', contact: 'mobile', missing: 'no mobile number' },
  { key: 'whatsapp', label: 'WhatsApp', contact: 'mobile', missing: 'no mobile number' },
]

const field =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'

/**
 * Pick real people of the organisation and send them a saved report by Email, SMS or WhatsApp.
 *
 * Each person is listed with the e-mail and mobile number on their own record (read by the backend,
 * never typed here). A method a chosen person has no contact for is named and blocks Confirm.
 * Email and SMS are sent by the server through the organisation's own integrations; WhatsApp has no
 * server-side integration in this product, so the result is a click-to-chat link per person that
 * opens the prepared message in the sender's WhatsApp.
 *
 * Flow: search recipients (backend list, tenant-scoped) -> select -> method -> optional note ->
 * Confirm send -> per-recipient result. The backend re-checks everything
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
  // Unknown (undefined) is treated as available; the server still refuses if it is not.
  const [smsConfigured, setSmsConfigured] = useState(true)
  // Whether the organisation's own WhatsApp Business account is connected (else click-to-chat links).
  const [whatsappConfigured, setWhatsappConfigured] = useState(false)
  const [loadingPeople, setLoadingPeople] = useState(false)
  const [peopleError, setPeopleError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<number, ReportRecipient>>({})
  const [note, setNote] = useState('')
  const [channel, setChannel] = useState<DeliveryChannel>('email')
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
          setSmsConfigured(data.sms_configured !== false)
          setWhatsappConfigured(data.whatsapp_configured === true)
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

  const channelInfo = CHANNELS.find((item) => item.key === channel) ?? CHANNELS[0]
  /** Chosen people with nothing on file for each method, so the dialog can say exactly who blocks it. */
  const lacking = useMemo(() => {
    const out = {} as Record<DeliveryChannel, ReportRecipient[]>
    for (const item of CHANNELS) out[item.key] = chosen.filter((person) => !person[item.contact])
    return out
  }, [chosen])
  const blocked = lacking[channel]
  const smsUnavailable = channel === 'sms' && !smsConfigured

  const toggle = (person: ReportRecipient) =>
    setSelected((current) => {
      const next = { ...current }
      if (next[person.id]) delete next[person.id]
      else if (Object.keys(next).length < max) next[person.id] = person
      return next
    })

  const send = useCallback(async () => {
    if (sending || chosen.length === 0 || blocked.length > 0 || smsUnavailable) return
    setSending(true)
    setError(null)
    try {
      const outcome = await sendChatReport(
        reportId,
        chosen.map((person) => person.id),
        {
          note,
          requestKey: `${requestKey}:${channel}`,
          channel,
          reportUrl: typeof window !== 'undefined' ? new URL(previewHref, window.location.origin).toString() : undefined,
        },
      )
      setResult(outcome)
      onSent?.(outcome)
    } catch (caught) {
      setError(describeAiError(caught, 'The report could not be sent.'))
    } finally {
      setSending(false)
    }
  }, [sending, chosen, blocked, smsUnavailable, reportId, note, onSent, requestKey, channel, previewHref])

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
              {result.prepared
                ? `${result.prepared} WhatsApp message${result.prepared === 1 ? '' : 's'} ready - open each one to send it from your WhatsApp.`
                : `${result.sent} sent${result.failed ? `, ${result.failed} failed` : ''}${result.duplicate ? `, ${result.duplicate} already sent a moment ago` : ''}.`}
            </p>
            <ul className="max-h-60 space-y-1 overflow-auto">
              {result.results.map((row) => (
                <li key={row.recipient_user_id} className="flex items-start gap-2">
                  {row.status === 'sent' || row.status === 'prepared' ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <AlertCircle className={`mt-0.5 size-4 shrink-0 ${row.status === 'failed' ? 'text-destructive' : 'text-amber-600'}`} aria-hidden />
                  )}
                  <span>
                    {row.name}{' '}
                    <span className="text-muted-foreground">
                      {row.channel && row.channel !== 'email' ? row.mobile : `<${row.email}>`}
                    </span>{' '}
                    - {row.status === 'prepared' ? 'ready to send' : row.status}
                    {row.link ? (
                      <a
                        href={row.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 inline-flex rounded-lg border border-border px-2 py-0.5 text-xs font-medium text-primary hover:bg-muted"
                      >
                        Open WhatsApp
                      </a>
                    ) : null}
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
              placeholder="Search people by name, e-mail or mobile"
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
                <p className="p-3 text-muted-foreground">No one matches.</p>
              ) : (
                people.map((person) => (
                  <label key={person.id} className="flex cursor-pointer items-start gap-2 border-b border-border/60 px-3 py-2 last:border-b-0 hover:bg-muted/40">
                    <input type="checkbox" className="mt-1" checked={Boolean(selected[person.id])} onChange={() => toggle(person)} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{person.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {person.email ?? <span className="text-amber-600">No email</span>}
                        {' · '}
                        {person.mobile ?? <span className="text-amber-600">No mobile</span>}
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

            <fieldset className="space-y-1.5">
              <legend className="text-xs font-medium text-foreground">Send by</legend>
              <div className="flex gap-2" role="radiogroup" aria-label="Delivery method">
                {CHANNELS.map((item) => {
                  const active = channel === item.key
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setChannel(item.key)}
                      className={`flex-1 rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
                        active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50'
                      } ${lacking[item.key].length > 0 ? 'opacity-70' : ''}`}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
              {smsUnavailable ? (
                <p className="text-xs text-amber-700" role="alert">
                  SMS is not set up for this organisation, so nothing can be sent by SMS. An administrator can add a gateway under Settings → Integrations. Use Email or WhatsApp meanwhile.
                </p>
              ) : blocked.length > 0 ? (
                <p className="text-xs text-amber-700" role="alert">
                  Cannot send by {channelInfo.label}: {blocked.map((person) => person.name).join(', ')}{' '}
                  {blocked.length === 1 ? 'has' : 'have'} {channelInfo.missing} on record. Choose another method or deselect them.
                </p>
              ) : channel === 'whatsapp' && whatsappConfigured ? (
                <p className="text-xs text-muted-foreground">
                  Sent from this organisation&apos;s WhatsApp Business number using its approved message template.
                </p>
              ) : channel === 'whatsapp' ? (
                <p className="text-xs text-amber-700">
                  WhatsApp Business is not connected for this organisation, so nothing is sent automatically. You get a link per person that opens your own WhatsApp with the message ready. An administrator can connect it under Settings → Integrations.
                </p>
              ) : channel === 'sms' ? (
                <p className="text-xs text-muted-foreground">SMS carries a short message with the report link (recipients sign in to open it).</p>
              ) : null}
            </fieldset>

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
              <Button type="button" onClick={() => void send()} disabled={sending || chosen.length === 0 || blocked.length > 0 || smsUnavailable}>
                {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                {channel === 'whatsapp' && !whatsappConfigured ? 'Prepare WhatsApp for' : 'Confirm send to'} {chosen.length || '…'}
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
