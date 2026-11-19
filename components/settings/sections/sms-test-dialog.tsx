'use client'

/**
 * SMS Gateway Test Dialog.
 *
 * Runs a connectivity test against the configured SMS gateway.
 * When a mobile number is entered, sends an actual test SMS;
 * when left blank, runs a safe reachability check to verify DNS, TLS, and endpoint connectivity without sending priced messages.
 */

import { useState } from 'react'
import { Loader2, RadioTower, Send } from 'lucide-react'
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

interface Props {
  isOpen: boolean
  onClose: () => void
  onSend: (testMobile: string) => void
  sending: boolean
  defaultMobile?: string
}

export function SmsTestDialog({
  isOpen,
  onClose,
  onSend,
  sending,
  defaultMobile = '',
}: Props) {
  const [mobile, setMobile] = useState('')
  const [wasOpen, setWasOpen] = useState(false)

  if (isOpen && !wasOpen) {
    setWasOpen(true)
    setMobile(defaultMobile)
  } else if (!isOpen && wasOpen) {
    setWasOpen(false)
  }

  const trimmed = mobile.trim()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RadioTower className="size-4" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle>Test SMS Gateway</DialogTitle>
              <DialogDescription>
                Test your SMS gateway configuration and connection.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="sms-test-number">Recipient mobile number (optional)</Label>
            <Input
              id="sms-test-number"
              type="tel"
              autoFocus
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !sending) onSend(trimmed)
              }}
              placeholder="+91 98765 43210"
            />
            <p className="text-xs text-muted-foreground">
              {trimmed ? (
                <span className="font-medium text-primary">
                  A real test SMS will be dispatched to {trimmed}.
                </span>
              ) : (
                'Leave blank for a reachability-only check (validates connection without dispatching a message).'
              )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={() => onSend(trimmed)} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />
                Testing…
              </>
            ) : (
              <>
                <Send className="mr-1.5 size-4" aria-hidden="true" />
                {trimmed ? 'Send test SMS' : 'Test reachability'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
