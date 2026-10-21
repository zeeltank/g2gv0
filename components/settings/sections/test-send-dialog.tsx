'use client'

/**
 * WHERE TO SEND THE TEST — now a choice, not always "yourself".
 *
 * The Test button used to mail only the caller's own address, deliberately:
 * mailing an arbitrary address on demand from the organisation's mailbox
 * reads as a relay with a login screen. The admin asked for the address
 * back, so it is collected here and validated (a real email shape, not just
 * non-empty) rather than trusted blindly - the backend still only ever
 * sends the same fixed test message, never a caller-chosen one, and the
 * `throttle:4,1` on the endpoint is the remaining guard against using this
 * to spam one address.
 */

import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Props {
  isOpen: boolean
  onClose: () => void
  onSend: (address: string) => void
  profileLabel: string
  sending: boolean
}

export function TestSendDialog({ isOpen, onClose, onSend, profileLabel, sending }: Props) {
  const [address, setAddress] = useState('')

  /*
   * A fresh box every time it opens - this component stays mounted between
   * uses (same pattern as SenderProfileModal's own `seededFrom`), so without
   * this a second test would silently reopen with whatever address was
   * typed for the first one. Reset during render, not in an effect: an
   * effect would paint the stale value for one frame before clearing it.
   */
  const [wasOpen, setWasOpen] = useState(false)

  if (isOpen && !wasOpen) {
    setWasOpen(true)
    setAddress('')
  } else if (!isOpen && wasOpen) {
    setWasOpen(false)
  }

  // Blank is valid too - it means "send it to me instead", handled server-side.
  const trimmed = address.trim()
  const valid = trimmed === '' || EMAIL_PATTERN.test(trimmed)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Send a test email</DialogTitle>
          <DialogDescription>
            Sent through &ldquo;{profileLabel}&rdquo;, with a fixed message that just proves the mailbox works.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="test-send-address">Send to</Label>
          <Input
            id="test-send-address"
            type="email"
            autoFocus
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && valid && !sending) onSend(trimmed)
            }}
            placeholder="you@yourcompany.com"
            aria-invalid={!valid}
          />
          {valid ? (
            <p className="text-xs text-muted-foreground">Leave this blank to send it to your own email address instead.</p>
          ) : (
            <p className="text-xs text-destructive">That doesn’t look like a valid email address.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={() => onSend(trimmed)} disabled={sending || !valid}>
            {sending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
            {sending ? 'Sending…' : 'Send test'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
