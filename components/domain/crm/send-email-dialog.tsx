'use client'

/**
 * Reusable "Compose Email" action - opened from CrmEmailTab on any of the 5
 * hot detail pages (Lead/Contact/Organization/Opportunity/Ticket), and
 * reusable standalone too (no default template) the same way
 * SendSmsDialog already is for SMS. The template picker is optional - typing
 * straight into Subject/Body works with no template at all, same as legacy
 * vtiger's own "compose blank or start from a template" choice.
 *
 * Every attempt is logged by the backend, sent or not - see
 * CrmEmailController::compose()'s own docblock for the sending gate this
 * dialog has no opinion on; it just surfaces whichever message compose()
 * returns ("Email queued." while CRM_EMAIL_SENDING_ENABLED is off, or the
 * real send outcome once it is on).
 */

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Textarea } from '@/components/ui/textarea'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmEmailLinkedType, CrmEmailTemplate } from '@/types/crm'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSent: (message: string) => void
  linkedType: CrmEmailLinkedType
  linkedId: string
  defaultToAddress?: string | null
}

export function SendEmailDialog({ isOpen, onClose, onSent, linkedType, linkedId, defaultToAddress }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const [seeded, setSeeded] = useState(false)
  const [templates, setTemplates] = useState<CrmEmailTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [toAddress, setToAddress] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && !seeded) {
    setSeeded(true)
    setTemplateId('')
    setToAddress(defaultToAddress ?? '')
    setSubject('')
    setBody('')
    setError('')
  } else if (!isOpen && seeded) {
    setSeeded(false)
  }

  useEffect(() => {
    if (!isOpen || !isLaravelContextReady(context)) return
    crmService.getEmailTemplates(context, { perPage: 100, sortBy: 'name', sortDir: 'asc' })
      .then((response) => setTemplates(response.data.items))
      .catch(() => { /* the dialog still works with no template picker */ })
  }, [isOpen, context])

  const applyTemplate = (id: string) => {
    setTemplateId(id)
    const template = templates.find((t) => t.id === id)
    if (template) {
      setSubject(template.subject)
      setBody(template.body)
    }
  }

  const submit = async () => {
    if (!toAddress.trim() || !subject.trim() || !body.trim()) {
      setError('A recipient address, subject, and body are all required.')
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = await crmService.composeEmail(context, {
        subject: subject.trim(),
        body: body.trim(),
        toAddress: toAddress.trim(),
        templateId: templateId || undefined,
        linkedType,
        linkedId,
      })
      onSent(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to send this email.')
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
              <Mail className="size-4" aria-hidden="true" />
            </div>
            <DialogTitle>Compose Email</DialogTitle>
          </div>
          <DialogDescription>Every attempt is logged, whether or not it is actually sent.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
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
            <Label htmlFor="email-to">To *</Label>
            <Input id="email-to" type="email" value={toAddress} onChange={(e) => setToAddress(e.target.value)} placeholder="name@example.com" autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email-subject">Subject *</Label>
            <Input id="email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email-body">Body *</Label>
            <Textarea id="email-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !toAddress.trim() || !subject.trim() || !body.trim()}>
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
