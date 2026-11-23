'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Mail, MessageCircle, MessageSquare, Send, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { CHANNEL_LIMITS, type MessageChannel, type MessageDraft } from '@/lib/crm/message-channels'
import { crmService } from '@/services/crm'
import type { CrmEmailTemplate, CrmRecipientMessages } from '@/types/crm'
import { MessageDraftPanel } from './message-draft-panel'

export type { MessageChannel }

const CHANNEL_OPTIONS: { label: string; value: string }[] = [
  { label: 'Email (SMTP / Outlook)', value: 'email' },
  { label: 'SMS (SMS Gateway)', value: 'sms' },
  { label: 'WhatsApp (Meta Cloud API)', value: 'whatsapp' },
]

export interface RecipientInfo {
  id: string
  name?: string
  email?: string | null
  phone?: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSent: (message: string) => void
  relatedType: 'lead' | 'organization' | 'contact'
  ids: string[]
  recipients?: RecipientInfo[]
  initialChannel?: MessageChannel
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function hasContactFor(channel: MessageChannel, r: RecipientInfo): boolean {
  if (channel === 'email') return EMAIL_PATTERN.test((r.email || '').trim())
  return (r.phone || '').replace(/\D/g, '').length >= 10
}

export function BulkSendMessageDialog({
  isOpen,
  onClose,
  onSent,
  relatedType,
  ids,
  recipients,
  initialChannel = 'email',
}: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const [channel, setChannel] = useState<MessageChannel>(initialChannel)

  // Email state
  const [subject, setSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [templates, setTemplates] = useState<CrmEmailTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  // SMS state
  const [smsMessage, setSmsMessage] = useState('')

  // WhatsApp state
  const [waMessage, setWaMessage] = useState('')

  // AI drafts for several recipients, one reviewed message each. Null = one shared message.
  const [drafts, setDrafts] = useState<MessageDraft[] | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [prevOpen, setPrevOpen] = useState(false)

  const [directWaLink, setDirectWaLink] = useState<string | null>(null)

  // Sync state on open
  if (isOpen && !prevOpen) {
    setPrevOpen(true)
    setChannel(initialChannel)
    setError('')
    setDirectWaLink(null)
    setDrafts(null)
  } else if (!isOpen && prevOpen) {
    setPrevOpen(false)
  }

  // Pre-calculate recipient contact readiness for the active channel
  const recipientSummary = useMemo(() => {
    if (!recipients || recipients.length === 0) {
      return { total: ids.length, valid: ids.length, invalid: 0, missingContact: false }
    }
    const validCount = recipients.filter((r) => hasContactFor(channel, r)).length
    return {
      total: recipients.length,
      valid: validCount,
      invalid: recipients.length - validCount,
      missingContact: validCount === 0,
    }
  }, [recipients, ids.length, channel])

  // Records the AI can draft for: those reachable on this channel.
  const draftableIds = useMemo(() => {
    if (!recipients || recipients.length === 0) return ids
    return recipients.filter((r) => hasContactFor(channel, r)).map((r) => String(r.id))
  }, [recipients, ids, channel])

  const limit = CHANNEL_LIMITS[channel].body
  const singleText = channel === 'email' ? emailBody : channel === 'sms' ? smsMessage : waMessage

  // Load email templates when channel is email
  useEffect(() => {
    if (!isOpen || channel !== 'email' || !isLaravelContextReady(context)) return
    let active = true
    crmService
      .getEmailTemplates(context, { perPage: 100, sortBy: 'name', sortDir: 'asc' })
      .then((res) => {
        if (active) setTemplates(res.data.items || [])
      })
      .catch(() => {
        // Optional template picker falls back silently
      })
    return () => {
      active = false
    }
  }, [isOpen, channel, context])

  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const t = templates.find((item) => item.id === templateId)
    if (t) {
      setSubject(t.subject || '')
      setEmailBody(t.body || '')
    }
  }

  const setSingleText = (value: string) => {
    if (channel === 'email') setEmailBody(value)
    else if (channel === 'sms') setSmsMessage(value)
    else setWaMessage(value)
  }

  const changeChannel = (next: MessageChannel) => {
    setChannel(next)
    setError('')
    // Drafts are written for one channel's format and limits, so they do not carry over.
    setDrafts(null)
  }

  const handleDrafts = (generated: MessageDraft[]) => {
    setError('')
    if (draftableIds.length === 1) {
      // One recipient: the draft goes straight into the normal fields to be edited.
      const only = generated[0]
      if (only?.error) {
        setError(only.error)
        return
      }
      if (channel === 'email' && only?.subject) setSubject(only.subject)
      setSingleText(only?.body ?? '')
      setDrafts(null)
      return
    }
    setDrafts(generated)
  }

  const updateDraft = (id: string, patch: Partial<MessageDraft>) =>
    setDrafts((current) => current?.map((d) => (d.id === id ? { ...d, ...patch } : d)) ?? current)

  // What Regenerate should improve rather than restart from.
  const existingText = useMemo<Record<string, string>>(() => {
    if (drafts) return Object.fromEntries(drafts.filter((d) => d.body).map((d) => [d.id, d.body]))
    return draftableIds.length === 1 && singleText.trim() ? { [draftableIds[0]]: singleText } : {}
  }, [drafts, draftableIds, singleText])

  // Drafts that are complete enough to send for this channel.
  const sendableDrafts = useMemo(
    () => (drafts ?? []).filter((d) => d.body.trim() && (channel !== 'email' || (d.subject || '').trim())),
    [drafts, channel],
  )

  const validate = (): string | null => {
    if (!isLaravelContextReady(context)) {
      return 'Your ERP session is unavailable. Please sign in again.'
    }
    if (ids.length === 0) {
      return 'No recipients selected.'
    }
    if (recipientSummary.missingContact) {
      const channelDesc = channel === 'email' ? 'registered email address' : 'registered mobile number'
      return `Selected recipient(s) do not have a ${channelDesc} on file. Please select a record with contact information or edit the record to add it.`
    }
    if (drafts) {
      if (sendableDrafts.length === 0) {
        return channel === 'email'
          ? 'Each message needs a subject and a body. Edit the drafts or generate them again.'
          : 'No message is ready to send. Edit the drafts or generate them again.'
      }
      return null
    }
    if (channel === 'email') {
      if (!subject.trim()) return 'An email subject is required.'
      if (!emailBody.trim()) return 'Email message content is required.'
    } else if (channel === 'sms') {
      if (!smsMessage.trim()) return 'An SMS message is required.'
    } else if (channel === 'whatsapp') {
      if (!waMessage.trim()) return 'A WhatsApp message is required.'
    }
    return null
  }

  const handleSubmit = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError('')
    setDirectWaLink(null)

    // With reviewed per-recipient drafts, only those recipients are sent to, each with their own text.
    const targetIds = drafts ? sendableDrafts.map((d) => d.id) : ids
    const targetRecipients = drafts ? recipients?.filter((r) => targetIds.includes(String(r.id))) : recipients
    const messages: CrmRecipientMessages | undefined = drafts
      ? Object.fromEntries(sendableDrafts.map((d) => [d.id, { subject: d.subject?.trim(), body: d.body.trim() }]))
      : undefined

    try {
      let res: any = null
      if (channel === 'email') {
        res = await crmService.bulkSendEmail(context, {
          relatedType,
          ids: targetIds,
          recipients: targetRecipients,
          subject: subject.trim(),
          body: emailBody.trim(),
          templateId: selectedTemplateId || undefined,
          messages,
        })
      } else if (channel === 'sms') {
        res = await crmService.bulkSendSms(context, relatedType, targetIds, smsMessage.trim(), targetRecipients, messages)
      } else if (channel === 'whatsapp') {
        res = await crmService.bulkSendWhatsapp(context, relatedType, targetIds, waMessage.trim(), targetRecipients, messages)
      }

      if (res?.data?.sent > 0) {
        onSent(res.message)
        onClose()
      } else if (res?.data?.failed > 0 || (res?.data?.skipped > 0 && res?.data?.sent === 0)) {
        setError(res.message)
        const firstDirectLink = res?.data?.results?.find((r: any) => r.directLink)?.directLink
        if (firstDirectLink) {
          setDirectWaLink(firstDirectLink)
        }
      } else {
        onSent(res?.message || 'Message dispatch completed.')
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send messages. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const channelLabel = channel === 'email' ? 'Email' : channel === 'sms' ? 'SMS' : 'WhatsApp'
  const sendCount = drafts ? sendableDrafts.length : ids.length

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {channel === 'email' && <Mail className="size-4" aria-hidden="true" />}
              {channel === 'sms' && <MessageSquare className="size-4" aria-hidden="true" />}
              {channel === 'whatsapp' && <MessageCircle className="size-4 text-emerald-600" aria-hidden="true" />}
            </div>
            <div>
              <DialogTitle>Send Message</DialogTitle>
              <DialogDescription>
                Select your preferred delivery channel and dispatch messages directly to selected records.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Channel Selector Dropdown */}
          <div className="space-y-1.5">
            <Label htmlFor="delivery-channel">Delivery Channel *</Label>
            <Select
              id="delivery-channel"
              value={channel}
              onChange={(val) => changeChannel(val as MessageChannel)}
              options={CHANNEL_OPTIONS}
            />
          </div>

          {/* Recipient Count & Readiness Badges */}
          <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Users className="size-3.5" aria-hidden="true" />
                <span>
                  {ids.length} {ids.length === 1 ? 'recipient' : 'recipients'} selected
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {recipientSummary.valid > 0 && (
                  <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20">
                    ✓ {recipientSummary.valid} ready to send
                  </Badge>
                )}
                {recipientSummary.invalid > 0 && (
                  <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
                    ⚠ {recipientSummary.invalid} missing {channel === 'email' ? 'email' : 'mobile'}
                  </Badge>
                )}
              </div>
            </div>

            {recipientSummary.missingContact ? (
              <p className="text-destructive font-medium">
                ⚠️ None of the selected recipient(s) have a registered {channel === 'email' ? 'email address' : 'mobile number'}. Please select records with registered contact details or edit the record to add them.
              </p>
            ) : (
              <p className="text-muted-foreground">
                {channel === 'email' && 'Emails are dispatched via your configured SMTP / Outlook mailbox.'}
                {channel === 'sms' && 'SMS messages are delivered to registered mobile numbers via your configured SMS Gateway.'}
                {channel === 'whatsapp' && 'WhatsApp messages are delivered via the Meta WhatsApp Cloud API.'}
              </p>
            )}
          </div>

          {/* AI drafting: produces text for review, never sends */}
          {isLaravelContextReady(context) && !recipientSummary.missingContact && (
            <MessageDraftPanel
              context={context}
              channel={channel}
              relatedType={relatedType}
              ids={draftableIds}
              existing={existingText}
              hasDrafts={drafts !== null || Object.keys(existingText).length > 0}
              disabled={submitting}
              onDrafts={handleDrafts}
            />
          )}

          {/* ── PER-RECIPIENT DRAFTS (several recipients) ── */}
          {drafts && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">
                  Review each message ({sendableDrafts.length} of {drafts.length} ready)
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDrafts(null)}>
                  Write one message for all
                </Button>
              </div>
              {drafts.map((d) => (
                <div key={d.id} className="space-y-1.5 rounded-lg border border-border/60 p-2.5">
                  <p className="text-xs font-medium">{d.name}</p>
                  {d.error ? (
                    <p className="text-xs text-destructive">{d.error}</p>
                  ) : null}
                  {channel === 'email' && (
                    <Input
                      aria-label={`Subject for ${d.name}`}
                      value={d.subject || ''}
                      maxLength={CHANNEL_LIMITS.email.subject}
                      onChange={(e) => updateDraft(d.id, { subject: e.target.value, error: undefined })}
                      placeholder="Subject"
                    />
                  )}
                  <Textarea
                    aria-label={`Message for ${d.name}`}
                    rows={channel === 'email' ? 5 : 3}
                    maxLength={limit}
                    value={d.body}
                    onChange={(e) => updateDraft(d.id, { body: e.target.value, error: undefined })}
                    placeholder="Write a message for this recipient, or leave it empty to skip them."
                  />
                  {channel !== 'email' && (
                    <p className="text-right text-xs text-muted-foreground">{d.body.length}/{limit}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── CHANNEL SPECIFIC FIELDS (one shared message, or the single recipient's draft) ── */}
          {!drafts && channel === 'email' && (
            <div className="space-y-3">
              {templates.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="email-template-picker">Template (Optional)</Label>
                  <Select
                    id="email-template-picker"
                    value={selectedTemplateId || 'none'}
                    onChange={(v) => applyTemplate(v === 'none' ? '' : v)}
                    options={[
                      { label: '(Blank email - no template)', value: 'none' },
                      ...templates.map((tpl) => ({ label: tpl.name, value: tpl.id })),
                    ]}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email-subject">Subject *</Label>
                <Input
                  id="email-subject"
                  value={subject}
                  maxLength={CHANNEL_LIMITS.email.subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email-body">Email Body *</Label>
                <Textarea
                  id="email-body"
                  rows={5}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Type your email message..."
                />
              </div>
            </div>
          )}

          {!drafts && channel === 'sms' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sms-message">SMS Message *</Label>
                <Textarea
                  id="sms-message"
                  rows={4}
                  maxLength={limit}
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  placeholder="Type your text message..."
                  autoFocus
                />
                <p className="text-right text-xs text-muted-foreground">{smsMessage.length}/{limit}</p>
              </div>
            </div>
          )}

          {!drafts && channel === 'whatsapp' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="wa-message">WhatsApp Message *</Label>
                <Textarea
                  id="wa-message"
                  rows={4}
                  maxLength={limit}
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                  placeholder="Type your WhatsApp message..."
                  autoFocus
                />
                <p className="text-right text-xs text-muted-foreground">{waMessage.length}/{limit}</p>
                <p className="text-xs text-muted-foreground">
                  Sent through your approved WhatsApp template, so line breaks are joined into one paragraph.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="space-y-2">
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </p>
              {directWaLink && (
                <a
                  href={directWaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium underline"
                >
                  <MessageCircle className="size-3.5" /> Open in WhatsApp Web / App to send directly
                </a>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting || recipientSummary.missingContact}
          >
            {submitting ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="mr-2 size-3.5" aria-hidden="true" />
            )}
            {drafts && sendCount > 1 ? `Send ${sendCount} ${channelLabel} messages` : `Send ${channelLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
