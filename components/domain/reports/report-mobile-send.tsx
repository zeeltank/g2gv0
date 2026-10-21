'use client'

/**
 * "Send by SMS / WhatsApp" for the Reports section's Share dialog.
 *
 * Same behaviour as the chat's Send report dialog: pick real people of the organisation, choose SMS, WhatsApp or
 * both, and the server sends through the organisation's own SMS gateway and WhatsApp Business account (the numbers
 * are read from the person's own record on the server, never typed or held here). Each channel is attempted on its
 * own and reported on its own line. "Sent" means the provider accepted the message - never that it was delivered.
 * With no WhatsApp Business account connected the server sends nothing and returns a click-to-chat link per person.
 */

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  reportBuilderService,
  type MobileChannel,
  type ReportDetail,
  type ReportMobileRecipient,
  type ReportMobileResult,
} from '@/services/reports'

const CHANNELS: Array<{ key: MobileChannel; label: string }> = [
  { key: 'sms', label: 'SMS' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'both', label: 'SMS + WhatsApp' },
]

const CHANNEL_LABEL = { sms: 'SMS', whatsapp: 'WhatsApp' } as const

const message = (reason: unknown, fallback: string) => (reason instanceof Error && reason.message ? reason.message : fallback)

export function ReportMobileSend({ report }: { report: ReportDetail }) {
  const context = getLaravelContext()

  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<ReportMobileRecipient[]>([])
  const [max, setMax] = useState(20)
  const [smsConfigured, setSmsConfigured] = useState(true)
  const [whatsappConfigured, setWhatsappConfigured] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState<Record<number, ReportMobileRecipient>>({})
  const [channel, setChannel] = useState<MobileChannel>('sms')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<ReportMobileResult[] | null>(null)
  const [summary, setSummary] = useState('')
  // One key per mounted dialog (plus channel): a double click or retry cannot send twice server-side.
  const [requestKey] = useState(() => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`))

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      reportBuilderService
        .mobileRecipients(context, report.id, query)
        .then((response) => {
          if (cancelled) return
          setPeople(response.data.recipients)
          setMax(response.data.max_recipients)
          setSmsConfigured(response.data.sms_configured)
          setWhatsappConfigured(response.data.whatsapp_configured)
          setLoadError('')
        })
        .catch((reason) => { if (!cancelled) setLoadError(message(reason, 'The list of people could not be loaded.')) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 250)

    return () => { cancelled = true; window.clearTimeout(timer) }
    // `context` is rebuilt every render; the report and the search text are what the list depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, report.id])

  const chosen = useMemo(() => Object.values(selected), [selected])
  const lacking = chosen.filter((person) => !person.has_mobile)
  const smsBlocked = channel === 'sms' && !smsConfigured

  const toggle = (person: ReportMobileRecipient) =>
    setSelected((current) => {
      const next = { ...current }
      if (next[person.id]) delete next[person.id]
      else if (Object.keys(next).length < max) next[person.id] = person
      return next
    })

  async function send() {
    if (sending || chosen.length === 0 || lacking.length > 0 || smsBlocked) return
    setSending(true); setError(''); setResults(null)
    try {
      const response = await reportBuilderService.sendMobile(context, report.id, {
        recipientIds: chosen.map((person) => person.id),
        channel,
        note: note.trim() || undefined,
        requestKey: `${requestKey}:${channel}`,
        reportUrl: window.location.href,
      })
      setResults(response.data.results)
      setSummary(response.message)
    } catch (reason) {
      setError(message(reason, 'The report could not be sent.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="space-y-2 border-t border-border pt-3">
      <Label className="text-xs font-medium text-muted-foreground">Send by SMS or WhatsApp (sent now, to people in your organisation)</Label>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search people by name"
        aria-label="Search people to send to"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />

      <div className="max-h-40 overflow-auto rounded-md border border-border">
        {loading && people.length === 0 ? (
          <p className="flex items-center gap-2 p-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Loading people…</p>
        ) : loadError ? (
          <p className="p-2 text-xs text-destructive">{loadError}</p>
        ) : people.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">No one matches.</p>
        ) : (
          people.map((person) => (
            <label key={person.id} className="flex cursor-pointer items-center gap-2 border-b border-border/60 px-2 py-1.5 text-sm last:border-b-0 hover:bg-muted/40">
              <input type="checkbox" checked={Boolean(selected[person.id])} onChange={() => toggle(person)} />
              <span className="min-w-0 flex-1 truncate">{person.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {person.has_mobile ? person.mobile_hint : <span className="text-amber-600">No mobile</span>}
              </span>
            </label>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {chosen.length} selected (up to {max}). {chosen.length > 0 ? chosen.map((person) => person.name).join(', ') : 'Choose at least one person.'}
      </p>

      <div className="flex gap-2" role="radiogroup" aria-label="Send report by">
        {CHANNELS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="radio"
            aria-checked={channel === item.key}
            onClick={() => setChannel(item.key)}
            className={`flex-1 rounded-md border px-2 py-1.5 text-sm font-medium transition ${channel === item.key ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {smsBlocked ? (
        <p className="text-xs text-amber-700" role="alert">SMS is not set up for this organisation, so nothing can be sent by SMS. An administrator can add a gateway under Platform Services → Integration.</p>
      ) : lacking.length > 0 ? (
        <p className="text-xs text-amber-700" role="alert">{lacking.map((person) => person.name).join(', ')} {lacking.length === 1 ? 'has' : 'have'} no mobile number on record. Deselect them to send.</p>
      ) : channel === 'both' ? (
        <p className="text-xs text-muted-foreground">
          Each channel is attempted on its own and reported separately, so one failing never stops the other.
          {!smsConfigured ? ' SMS is not set up for this organisation, so it will be reported as failed.' : ''}
          {!whatsappConfigured ? ' WhatsApp Business is not connected, so you get a link to open it from your own WhatsApp.' : ''}
        </p>
      ) : channel === 'whatsapp' && !whatsappConfigured ? (
        <p className="text-xs text-amber-700">WhatsApp Business is not connected for this organisation, so nothing is sent automatically. You get a link per person that opens your own WhatsApp with the message ready.</p>
      ) : (
        <p className="text-xs text-muted-foreground">A short message with a link to this report (recipients sign in to open it) is sent through your organisation&apos;s own {channel === 'sms' ? 'SMS gateway' : 'WhatsApp Business number'}.</p>
      )}

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
        maxLength={500}
        placeholder="Optional note to include"
        aria-label="Note"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />

      {error && <p className="flex items-start gap-2 text-xs text-destructive" role="alert"><AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {error}</p>}

      {results && (
        <div className="space-y-1 text-sm" role="status">
          <p className="font-medium">{summary}</p>
          <ul className="max-h-40 space-y-1 overflow-auto">
            {results.map((row) => (
              <li key={`${row.recipient_user_id}:${row.channel}`} className="flex items-start gap-2">
                {row.status === 'sent' || row.status === 'prepared'
                  ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  : <AlertCircle className={`mt-0.5 size-4 shrink-0 ${row.status === 'failed' ? 'text-destructive' : 'text-amber-600'}`} aria-hidden="true" />}
                <span>
                  {row.name} <span className="text-muted-foreground">{CHANNEL_LABEL[row.channel]}</span> - {row.status === 'prepared' ? 'ready to send' : row.status}
                  {row.link && (
                    <a href={row.link} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex rounded-md border border-border px-2 py-0.5 text-xs font-medium text-primary hover:bg-muted">Open WhatsApp</a>
                  )}
                  {row.error && <span className="block text-xs text-muted-foreground">{row.error}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button size="sm" variant="outline" disabled={sending || chosen.length === 0 || lacking.length > 0 || smsBlocked} onClick={() => void send()}>
        {sending ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : <Send className="mr-1.5 size-4" aria-hidden="true" />}
        {channel === 'whatsapp' && !whatsappConfigured ? 'Prepare WhatsApp' : 'Send now'}
      </Button>
    </section>
  )
}
