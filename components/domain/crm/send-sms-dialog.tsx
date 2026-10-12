'use client'

/**
 * Reusable "Send SMS" action - wired onto Organization/Contact/Opportunity
 * detail pages wherever a phone number exists, and also available stand-
 * alone (no relatedType/relatedId) from the SMS Notifier log screen itself
 * for an ad-hoc send. Every attempt - success or failure - is logged by
 * the backend; this dialog just surfaces whichever message it returns.
 */

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSent: (message: string) => void
  defaultToNumber?: string | null
  relatedType?: 'organization' | 'contact' | 'opportunity'
  relatedId?: string
}

export function SendSmsDialog({ isOpen, onClose, onSent, defaultToNumber, relatedType, relatedId }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const [seeded, setSeeded] = useState(false)
  const [toNumber, setToNumber] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && ! seeded) {
    setSeeded(true)
    setToNumber(defaultToNumber ?? '')
    setMessage('')
    setError('')
  } else if (! isOpen && seeded) {
    setSeeded(false)
  }

  const submit = async () => {
    if (! toNumber.trim() || ! message.trim()) {
      setError('A phone number and message are both required.')
      return
    }
    if (! isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = await crmService.sendSms(context, {
        toNumber: toNumber.trim(), message: message.trim(), relatedType, relatedId,
      })
      onSent(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to send this message.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (! open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send SMS</DialogTitle>
          <DialogDescription>Every attempt is logged, whether or not the gateway accepts it.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sms-to">Phone Number *</Label>
            <Input id="sms-to" value={toNumber} onChange={(e) => setToNumber(e.target.value)} placeholder="+1 555 123 4567" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sms-message">Message *</Label>
            <Textarea id="sms-message" rows={4} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
            <p className="text-right text-xs text-muted-foreground">{message.length}/1000</p>
          </div>
          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || ! toNumber.trim() || ! message.trim()}>
            {submitting && <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
