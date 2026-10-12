'use client'

import { MessageSquareText } from 'lucide-react'
import { ComingSoonView } from './coming-soon-view'

/** Placeholder for Phase 4 - replaced by the real sent-message log. */
export function SmsLogListView() {
  return (
    <ComingSoonView
      title="SMS Notifier"
      description="A log of SMS messages sent from CRM records, and a reusable Send SMS action."
      icon={MessageSquareText}
    />
  )
}
