'use client'

/**
 * Bulk "Send SMS" - vtiger's own SMSNotifier list-view mass action (select
 * N records, send one message to all of them). Unlike SendSmsDialog
 * (single recipient, explicit phone number), the recipient's phone is
 * resolved server-side per record - a rep picking 50 Leads shouldn't have
 * to see or edit 50 phone numbers to send one message.
 */

import { useMemo, useState } from 'react'
import { Loader2, MessageSquareText, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSent: (message: string) => void
  relatedType: 'lead' | 'organization' | 'contact'
  ids: string[]
}

export function BulkSendSmsDialog({ isOpen, onClose, onSent, relatedType, ids }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (! message.trim()) {
      setError('A message is required.')
      return
    }
    if (! isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = await crmService.bulkSendSms(context, relatedType, ids, message.trim())
      onSent(response.message)
      setMessage('')
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to send these messages.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (! open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MessageSquareText className="size-4" aria-hidden="true" />
            </div>
            <DialogTitle>Send SMS</DialogTitle>
          </div>
          <DialogDescription>Every attempt is logged, including any record with no phone number on file.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Badge variant="outline" className="gap-1.5">
            <Users className="size-3.5" aria-hidden="true" />
            {ids.length} {ids.length === 1 ? 'recipient' : 'recipients'} selected
          </Badge>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-sms-message">Message *</Label>
            <Textarea id="bulk-sms-message" rows={4} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} autoFocus />
            <p className="text-right text-xs text-muted-foreground">{message.length}/1000</p>
          </div>
          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || ! message.trim()}>
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
