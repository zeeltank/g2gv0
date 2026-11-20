'use client'

import React, { useMemo, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Mail,
  MessageCircle,
  MessageSquareText,
  Phone,
  Send,
  Sparkles,
  Users,
  X,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import {
  dispatchCommunicationNotice,
  extractPhoneAndName,
  isValidEmail,
  normalizePhoneNumber,
} from '@/lib/communication/dispatch-store'

type Channel = 'whatsapp' | 'sms' | 'email'

interface Template {
  id: string
  name: string
  channel: Channel
  subject: string
  body: string
  tag: string
}

interface RecipientItem {
  id: string
  name: string
  contact: string
  email?: string
  role?: string
}

const TEMPLATES: Template[] = [
  {
    id: 'workflow-reminder',
    name: 'Scheduled Workflow & Approval Advisory',
    channel: 'whatsapp',
    subject: 'Action Required: Pending Platform Approval',
    body: 'Dear {name}, your approval is required for the pending workflow transition in {company}. Please review and approve the request before {date}.',
    tag: 'Workflow',
  },
  {
    id: 'system-alert',
    name: 'Urgent Operational & Status Advisory',
    channel: 'sms',
    subject: 'Urgent G2G Platform Alert',
    body: 'G2G Alert: Scheduled maintenance and integration sync will occur on {date}. Workflows and data pipelines will resume immediately afterward.',
    tag: 'Advisory',
  },
  {
    id: 'executive-digest',
    name: 'Executive Operations Digest & Summary',
    channel: 'email',
    subject: 'Weekly Executive Operations Digest - {company}',
    body: 'Dear {name},\n\nPlease find the summary of organizational workflows and system performance for {company}.\n\n- Active Workflows: 100% on schedule\n- Integration Gateways: Online and healthy\n- Audit Trail: Clean, zero critical discrepancies\n\nWarm regards,\nG2G Platform Operations',
    tag: 'Digest',
  },
  {
    id: 'client-followup',
    name: 'Stakeholder Follow-up & Next Steps',
    channel: 'whatsapp',
    subject: 'Follow-up on Recent Consultation',
    body: 'Hi {name}, following up on our recent strategic roadmap session. All action items and deliverables have been uploaded to your dashboard.',
    tag: 'Follow-up',
  },
  {
    id: 'onboarding-welcome',
    name: 'New Organization Member Welcome',
    channel: 'email',
    subject: 'Welcome to G2G - Access & Onboarding Instructions',
    body: 'Dear {name},\n\nWelcome to our platform workspace! Your profile has been assigned the role of {role}. Please sign in to verify your account credentials and security settings.\n\nWarm regards,\nAdministrative Team',
    tag: 'Onboarding',
  },
]

const PRESET_AUDIENCE: RecipientItem[] = [
  {
    id: '1',
    name: 'Rajesh Patel',
    role: 'Managing Director',
    contact: '+91 98250 12345',
    email: 'rajesh.patel@enterprise.corp',
  },
  {
    id: '2',
    name: 'Nitin Shah',
    role: 'Operations Head',
    contact: '+91 98251 12345',
    email: 'nitin.shah@enterprise.corp',
  },
  {
    id: '3',
    name: 'Priya Mehta',
    role: 'HR & Talent Lead',
    contact: '+91 98795 67890',
    email: 'priya.mehta@enterprise.corp',
  },
]

interface Props {
  moduleKey?: string | null
}

export function CommunicationBroadcastNotice({ moduleKey }: Props) {
  const [selectedChannel, setSelectedChannel] = useState<Channel>('whatsapp')
  const [targetAudience, setTargetAudience] = useState<'custom' | 'system'>('custom')
  const [customMobile, setCustomMobile] = useState('')
  const [customEmail, setCustomEmail] = useState('')
  const [customRecipientName, setCustomRecipientName] = useState('')
  const [subject, setSubject] = useState(TEMPLATES[0].subject)
  const [message, setMessage] = useState(TEMPLATES[0].body)
  const [isSending, setIsSending] = useState(false)
  const [sendSuccess, setSendSuccess] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  const isEmail = selectedChannel === 'email'
  const isWhatsapp = selectedChannel === 'whatsapp'
  const isSms = selectedChannel === 'sms'

  // Parse 10-digit Indian mobile numbers for WhatsApp / SMS
  const parsedCustomNumbers = useMemo(() => {
    if (targetAudience !== 'custom' || isEmail) return []
    const rawTokens = customMobile.split(/[\n,; ]+/).map((t) => t.trim()).filter(Boolean)
    const valid: string[] = []
    for (const token of rawTokens) {
      const cleaned = token.replace(/[^0-9+]/g, '')
      const digits = cleaned.replace(/\D/g, '')
      const last10 = digits.length >= 10 ? digits.slice(-10) : digits
      if (last10.length === 10 && /^[6-9]\d{9}$/.test(last10)) {
        if (!valid.includes(last10)) {
          valid.push(last10)
        }
      }
    }
    return valid
  }, [customMobile, targetAudience, isEmail])

  // Parse email addresses for Email
  const parsedCustomEmails = useMemo(() => {
    if (targetAudience !== 'custom' || !isEmail) return []
    const rawTokens = customEmail.split(/[\n,; ]+/).map((t) => t.trim()).filter(Boolean)
    const valid: string[] = []
    for (const token of rawTokens) {
      const lower = token.toLowerCase()
      if (isValidEmail(lower) && !valid.includes(lower)) {
        valid.push(lower)
      }
    }
    return valid
  }, [customEmail, targetAudience, isEmail])

  const activeRecipients: RecipientItem[] = useMemo(() => {
    if (targetAudience === 'custom') {
      if (isEmail) {
        if (parsedCustomEmails.length === 0) return []
        return parsedCustomEmails.map((email, idx) => ({
          id: `custom-email-${idx}`,
          name: customRecipientName.trim() || `Recipient ${idx + 1}`,
          contact: email,
          email,
          role: 'Custom Email',
        }))
      } else {
        if (parsedCustomNumbers.length === 0) return []
        return parsedCustomNumbers.map((num, idx) => ({
          id: `custom-num-${idx}`,
          name: customRecipientName.trim() || `Recipient ${idx + 1}`,
          contact: `+91 ${num}`,
          role: 'Custom Mobile',
        }))
      }
    }

    // System preset
    if (isEmail) {
      return PRESET_AUDIENCE.map((r) => ({
        ...r,
        contact: r.email || `${r.name.toLowerCase().replace(/\s+/g, '.')}@enterprise.corp`,
      }))
    }
    return PRESET_AUDIENCE
  }, [targetAudience, isEmail, parsedCustomEmails, parsedCustomNumbers, customRecipientName])

  const handleApplyTemplate = (tmpl: Template) => {
    setSelectedChannel(tmpl.channel)
    setSubject(tmpl.subject)
    setMessage(tmpl.body)
    setSendSuccess(null)
    setSendError(null)
    toast(`Loaded template: "${tmpl.name}" with ${tmpl.channel.toUpperCase()} channel.`)
  }

  const handleInsertVariable = (v: string) => {
    setMessage((prev) => `${prev} ${v}`)
  }

  const getReplacedPreview = (text: string) => {
    const customName = customRecipientName.trim()
    const samplePerson = activeRecipients[0] || PRESET_AUDIENCE[0]
    const effectiveName = customName || samplePerson?.name || 'Partner'

    return text
      .replace(/{name}/g, effectiveName)
      .replace(/{company}/g, 'Global Enterprise')
      .replace(/{role}/g, samplePerson?.role || 'Organization Lead')
      .replace(/{date}/g, 'Tomorrow, 5:00 PM')
  }

  const channelLimit = isEmail ? 20000 : isWhatsapp ? 1024 : 1000

  const handleSendNotice = async () => {
    setSendSuccess(null)
    setSendError(null)

    if (targetAudience === 'custom') {
      if (isEmail && parsedCustomEmails.length === 0) {
        setSendError('Please enter at least one valid email address.')
        return
      }
      if (!isEmail && parsedCustomNumbers.length === 0) {
        setSendError('Please enter at least one valid 10-digit Indian mobile number.')
        return
      }
    }

    if (isEmail && !subject.trim()) {
      setSendError('Email subject is required.')
      return
    }

    if (!message.trim()) {
      setSendError('Please enter message content or choose a template.')
      return
    }

    setIsSending(true)

    try {
      const recipientList = activeRecipients.map((r) => {
        if (isEmail) {
          return {
            id: r.id,
            name: r.name,
            phone: r.contact,
            email: r.email || r.contact,
            contact: r.contact,
          }
        }
        const rawDigits = r.contact.replace(/\D/g, '')
        const phone10 = rawDigits.length >= 10 ? rawDigits.slice(-10) : rawDigits
        return {
          id: r.id,
          name: r.name,
          phone: phone10,
          contact: r.contact,
        }
      })

      const effectiveMessage = getReplacedPreview(message)

      const result = await dispatchCommunicationNotice({
        module: moduleKey || 'platform',
        event_key: `${moduleKey || 'platform'}.notice`,
        channel: selectedChannel,
        subject: isEmail ? subject.trim() : subject.trim() || undefined,
        message: effectiveMessage,
        recipients: recipientList,
      })

      if (result.success) {
        const successText = `Notice broadcasted to ${result.dispatchedCount} recipient(s) via ${selectedChannel.toUpperCase()} successfully!`
        setSendSuccess(successText)
        toast(successText)
      } else {
        const err = result.errors[0] || result.message || 'Unable to deliver message.'
        setSendError(err)
        toast(err)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Communication dispatch failed'
      setSendError(msg)
      toast(msg)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Send Communication Notices & Updates
          </h2>
          <p className="text-sm text-muted-foreground">
            Broadcast messages, announcements, advisories, and workflow reminders via WhatsApp, SMS & Email.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1">
            Active Module: <span className="ml-1 text-primary capitalize">{moduleKey || 'All Platform'}</span>
          </Badge>
        </div>
      </div>

      {/* Success Alert Banner */}
      {sendSuccess && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-950 dark:text-emerald-200 shadow-sm animate-in fade-in duration-300">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-emerald-900 dark:text-emerald-100">Notice Dispatched Successfully</p>
            <p className="mt-0.5 text-emerald-800 dark:text-emerald-300">{sendSuccess}</p>
          </div>
          <button
            onClick={() => setSendSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error Alert Banner */}
      {sendError && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive shadow-sm animate-in fade-in duration-300">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Dispatch Alert / Error</p>
            <p className="mt-0.5 leading-relaxed">{sendError}</p>
          </div>
          <button onClick={() => setSendError(null)} className="opacity-80 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Quick Notice Templates Grid */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Quick Communication Templates
          </label>
          <span className="text-xs text-muted-foreground">Click any card to auto-populate</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => handleApplyTemplate(tmpl)}
              className="group flex flex-col justify-between rounded-xl border border-border bg-card p-3.5 text-left transition hover:border-primary hover:shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {tmpl.tag}
                  </span>
                  <span className="text-[11px] font-medium uppercase text-muted-foreground">
                    {tmpl.channel}
                  </span>
                </div>
                <h4 className="mt-2 text-sm font-semibold text-foreground group-hover:text-primary">
                  {tmpl.name}
                </h4>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                  {tmpl.body}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-primary">
                <Sparkles className="h-3 w-3" />
                <span>Use this template</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main 2-Column Composer & Live Preview Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Form (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          <Card className="border-border shadow-sm">
            <CardContent className="space-y-5 p-5">
              {/* Step 1: Delivery Channel Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Delivery Channel *
                </label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedChannel('whatsapp')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${
                      selectedChannel === 'whatsapp'
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/30'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedChannel('sms')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${
                      selectedChannel === 'sms'
                        ? 'border-sky-500 bg-sky-500/15 text-sky-800 dark:text-sky-300 ring-2 ring-sky-500/30'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <MessageSquareText className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    <span>SMS Gateway</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedChannel('email')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${
                      selectedChannel === 'email'
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 ring-2 ring-indigo-500/30'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Mail className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Email (SMTP)</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Target Audience */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-foreground">
                    2. Target Recipients *
                  </label>
                  <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 text-xs bg-muted/40">
                    <button
                      type="button"
                      onClick={() => setTargetAudience('custom')}
                      className={`rounded-md px-2.5 py-1 font-medium transition ${
                        targetAudience === 'custom'
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Custom Numbers / Emails
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetAudience('system')}
                      className={`rounded-md px-2.5 py-1 font-medium transition ${
                        targetAudience === 'system'
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Organization Audience ({PRESET_AUDIENCE.length})
                    </button>
                  </div>
                </div>

                {targetAudience === 'custom' ? (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Recipient Name (Optional)</label>
                      <Input
                        value={customRecipientName}
                        onChange={(e) => setCustomRecipientName(e.target.value)}
                        placeholder="e.g. John Doe or Partner Name"
                        className="mt-1"
                      />
                    </div>

                    {isEmail ? (
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-muted-foreground">
                            Recipient Email Address(es) *
                          </label>
                          {parsedCustomEmails.length > 0 && (
                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 text-[11px]">
                              ✓ {parsedCustomEmails.length} valid email(s) detected
                            </Badge>
                          )}
                        </div>
                        <Textarea
                          rows={2}
                          value={customEmail}
                          onChange={(e) => setCustomEmail(e.target.value)}
                          placeholder="e.g. contact@enterprise.com, team@partner.corp (separated by commas or newlines)"
                          className="mt-1 font-mono text-xs"
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-muted-foreground">
                            10-Digit Mobile Number(s) *
                          </label>
                          {parsedCustomNumbers.length > 0 && (
                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 text-[11px]">
                              ✓ {parsedCustomNumbers.length} valid 10-digit number(s) detected
                            </Badge>
                          )}
                        </div>
                        <Textarea
                          rows={2}
                          value={customMobile}
                          onChange={(e) => setCustomMobile(e.target.value)}
                          placeholder="e.g. 9825012345, 9825112345 (separated by commas or newlines)"
                          className="mt-1 font-mono text-xs"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Preset Audience Members:</p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {PRESET_AUDIENCE.map((member) => (
                        <div key={member.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-card border border-border/50">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{member.name}</span>
                            <span className="text-muted-foreground">({member.role})</span>
                          </div>
                          <span className="font-mono text-primary">{isEmail ? member.email : member.contact}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Message Details */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground">
                  3. Notice Content & Composition *
                </label>

                {/* Subject (required for Email, supported for all) */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Subject Line {isEmail ? '*' : '(Optional for SMS/WhatsApp)'}
                  </label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter message subject"
                    className="mt-1 text-sm"
                  />
                </div>

                {/* Message Body */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Message Body *</label>
                    <span
                      className={`text-[11px] font-mono ${
                        message.length > channelLimit ? 'text-destructive font-bold' : 'text-muted-foreground'
                      }`}
                    >
                      {message.length} / {channelLimit} characters
                    </span>
                  </div>
                  <Textarea
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Compose your message here..."
                    className="mt-1 text-sm leading-relaxed"
                  />
                </div>

                {/* Variable Chips */}
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Insert Placeholders:
                  </span>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {['{name}', '{company}', '{role}', '{date}'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleInsertVariable(v)}
                        className="rounded-md border border-border bg-muted/30 px-2 py-0.5 text-xs font-mono text-primary transition hover:bg-primary/10 hover:border-primary/40"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Send Button */}
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={handleSendNotice}
                  disabled={isSending || activeRecipients.length === 0}
                  className={`w-full gap-2 text-sm font-semibold shadow-sm ${
                    isWhatsapp
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : isSms
                        ? 'bg-sky-600 hover:bg-sky-700 text-white'
                        : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  }`}
                >
                  <Send className="h-4 w-4" />
                  {isSending
                    ? 'Dispatching via Gateway...'
                    : `Send to ${activeRecipients.length} Recipient(s) via ${selectedChannel.toUpperCase()}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Preview Card (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="border-border shadow-sm sticky top-4">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Live Dispatch Preview
                </span>
                <Badge variant="outline" className="text-xs uppercase font-mono">
                  {selectedChannel}
                </Badge>
              </div>

              {/* Visual Channel Previews */}
              {isWhatsapp && (
                <div className="rounded-2xl border border-emerald-500/30 bg-[#EFEAE2] dark:bg-emerald-950/20 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-emerald-950 dark:text-emerald-300 font-medium">
                    <div className="flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4 text-emerald-600" />
                      <span>WhatsApp Business Channel</span>
                    </div>
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div className="max-w-[95%] rounded-2xl rounded-tl-sm bg-white dark:bg-card p-3.5 shadow-sm space-y-2 border border-black/5 dark:border-white/10">
                    {subject && (
                      <p className="text-xs font-bold text-emerald-900 dark:text-emerald-400 border-b border-border/40 pb-1">
                        {subject}
                      </p>
                    )}
                    <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                      {getReplacedPreview(message) || 'Compose a message to preview...'}
                    </p>
                    <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground pt-1">
                      <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-emerald-600 font-bold">✓✓</span>
                    </div>
                  </div>
                </div>
              )}

              {isSms && (
                <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-sky-950 dark:text-sky-300 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4 text-sky-600" />
                      <span>SMS Gateway Preview</span>
                    </div>
                    <span>Carrier Network</span>
                  </div>

                  <div className="max-w-[95%] rounded-2xl rounded-tl-sm bg-white dark:bg-card p-3.5 shadow-sm space-y-1.5 border border-sky-500/20">
                    <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                      {getReplacedPreview(message) || 'Compose an SMS message to preview...'}
                    </p>
                    <div className="flex items-center justify-end text-[10px] text-muted-foreground">
                      <span>Delivered via SMS</span>
                    </div>
                  </div>
                </div>
              )}

              {isEmail && (
                <div className="rounded-2xl border border-indigo-500/30 bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-indigo-950 dark:text-indigo-300 font-medium border-b border-border pb-2">
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-4 w-4 text-indigo-600" />
                      <span>SMTP Email Letterhead</span>
                    </div>
                    <span>Outgoing Mail</span>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-lg border border-border/50">
                    <div>
                      <span className="font-semibold text-foreground">From: </span>
                      <span>Configured SMTP Sender Profile</span>
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">To: </span>
                      <span>{activeRecipients[0]?.email || activeRecipients[0]?.contact || 'Recipient'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Subject: </span>
                      <span className="text-foreground font-medium">{subject || '(No subject provided)'}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                    {getReplacedPreview(message) || 'Compose email body content to preview...'}
                  </div>
                </div>
              )}

              {/* Recipient summary in preview */}
              <div className="pt-2 text-xs text-muted-foreground space-y-1 border-t border-border">
                <div className="flex items-center justify-between">
                  <span>Selected recipients:</span>
                  <span className="font-semibold text-foreground">{activeRecipients.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Gateway type:</span>
                  <span className="font-medium capitalize text-primary">{selectedChannel}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
