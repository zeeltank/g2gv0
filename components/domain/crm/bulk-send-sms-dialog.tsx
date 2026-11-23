'use client'

import { BulkSendMessageDialog } from './bulk-send-message-dialog'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSent: (message: string) => void
  relatedType: 'lead' | 'organization' | 'contact'
  ids: string[]
}

/**
 * Backward-compatible wrapper around the multi-channel BulkSendMessageDialog
 * allowing existing list views to seamlessly support Email, SMS, and WhatsApp.
 */
export function BulkSendSmsDialog({ isOpen, onClose, onSent, relatedType, ids }: Props) {
  return (
    <BulkSendMessageDialog
      isOpen={isOpen}
      onClose={onClose}
      onSent={onSent}
      relatedType={relatedType}
      ids={ids}
      initialChannel="sms"
    />
  )
}
