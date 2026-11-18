'use client'

/**
 * Sales & Marketing gap-closure, Wave 5: "Send Campaign" - the one real,
 * list-based email capability this whole CRM gap analysis found entirely
 * absent (Campaigns was previously a tag/ROI-tracking list only). Same
 * template-picker shape as SendEmailDialog (its 1:1 sibling), plus the two
 * things a BATCH send specifically needs that a single send doesn't: a
 * summary of who's already been reached before committing to another send,
 * and an honest breakdown of what actually happened afterward (not just
 * "sent" or "failed" - a campaign send has several legitimate non-failure
 * outcomes: opted out, no email on file, sending switched off tenant-wide).
 */

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Textarea } from '@/components/ui/textarea'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmCampaignSendResult, CrmCampaignSendSummary, CrmEmailTemplate } from '@/types/crm'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSent: () => void
  campaignId: string
}

export function SendCampaignDialog({ isOpen, onClose, onSent, campaignId }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const [seeded, setSeeded] = useState(false)
  const [summary, setSummary] = useState<CrmCampaignSendSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [templates, setTemplates] = useState<CrmEmailTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CrmCampaignSendResult | null>(null)

  if (isOpen && !seeded) {
    setSeeded(true)
    setTemplateId(''); setSubject(''); setBody(''); setError(''); setResult(null); setSummary(null); setSummaryLoading(true)
  } else if (!isOpen && seeded) {
    setSeeded(false)
  }

  // Every setState below happens after an await (or in .finally), so nothing is set
  // synchronously while this effect body runs - setSummaryLoading(true) lives in the
  // synchronous reset above instead, which already resets the dialog's other fields on open.
  useEffect(() => {
    if (!isOpen || !isLaravelContextReady(context)) return
    crmService.getCampaignSendSummary(context, campaignId)
      .then((response) => setSummary(response.data))
      .catch(() => { /* the dialog still works, just without the preview numbers */ })
      .finally(() => setSummaryLoading(false))
    crmService.getEmailTemplates(context, { perPage: 100, sortBy: 'name', sortDir: 'asc' })
      .then((response) => setTemplates(response.data.items))
      .catch(() => { /* the dialog still works with no template picker */ })
  }, [isOpen, context, campaignId])

  const applyTemplate = (id: string) => {
    setTemplateId(id)
    const template = templates.find((t) => t.id === id)
    if (template) {
      setSubject(template.subject)
      setBody(template.body)
    }
  }

  const submit = async () => {
    if (!subject.trim() || !body.trim()) {
      setError('A subject and body are both required.')
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = await crmService.sendCampaign(context, campaignId, {
        subject: subject.trim(), body: body.trim(), templateId: templateId || undefined,
      })
      setResult(response.data)
      onSent()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to send this campaign.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Send className="size-4" aria-hidden="true" />
            </div>
            <DialogTitle>Send Campaign</DialogTitle>
          </div>
          <DialogDescription>One message to every target who hasn&apos;t already received this campaign.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          {!summaryLoading && summary && !result && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                <span><strong className="text-foreground">{summary.totalTargets}</strong> target{summary.totalTargets === 1 ? '' : 's'}</span>
                <span><strong className="text-foreground">{summary.sentCount}</strong> already sent</span>
                {summary.pendingCount > 0 && <span><strong className="text-foreground">{summary.pendingCount}</strong> pending</span>}
                <span><strong className="text-foreground">{summary.remainingCount}</strong> not yet attempted</span>
              </div>
              {!summary.sendingEnabled && (
                <p className="flex items-start gap-1.5 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  Email sending is currently switched off for this organisation - this send will queue every message but deliver nothing until an admin turns it on.
                </p>
              )}
            </div>
          )}

          {!result && (
            <>
              {templates.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Start from a Template</Label>
                  <SearchableSelect
                    value={templateId}
                    onChange={applyTemplate}
                    options={templates.map((t) => ({ value: t.id, label: t.name }))}
                    placeholder="None — write from scratch"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="campaign-send-subject">Subject *</Label>
                <Input id="campaign-send-subject" value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="campaign-send-body">Body *</Label>
                <Textarea id="campaign-send-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
            </>
          )}

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

          {result && (
            <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
              <p className="font-medium text-foreground">{result.sent} sent</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><dt>Queued (not yet delivered)</dt><dd className="text-foreground">{result.notSent}</dd></div>
                <div className="flex justify-between"><dt>Failed</dt><dd className="text-foreground">{result.failed}</dd></div>
                <div className="flex justify-between"><dt>Already sent before</dt><dd className="text-foreground">{result.alreadyHandled}</dd></div>
                <div className="flex justify-between"><dt>No email on file</dt><dd className="text-foreground">{result.skippedNoEmail}</dd></div>
                <div className="flex justify-between"><dt>Opted out</dt><dd className="text-foreground">{result.skippedOptedOut}</dd></div>
              </dl>
              {result.truncated && (
                <p className="text-xs text-warning">
                  Only {result.batchLimit} new target(s) are processed per send - more remain. Click Send Campaign again to continue.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          {result ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => void submit()} disabled={submitting || !subject.trim() || !body.trim()}>
                {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />}
                Send Campaign
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
