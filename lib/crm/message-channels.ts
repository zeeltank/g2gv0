export type MessageChannel = 'email' | 'sms' | 'whatsapp'

/**
 * Per-channel limits, shared by the composer (counter), the AI draft route (length it may
 * generate) and the send route (what it will actually deliver), so the three cannot disagree.
 *
 * WhatsApp is delivered as an approved Meta template whose single body variable is the
 * message. Meta caps that variable at 1024 characters and rejects newlines, tabs and runs of
 * four or more spaces inside it (error 132018) — hence toWhatsappTemplateText().
 */
export const CHANNEL_LIMITS: Record<MessageChannel, { body: number; subject?: number }> = {
  email: { body: 20000, subject: 200 },
  sms: { body: 1000 },
  whatsapp: { body: 1024 },
}

/** Flattens a message into text Meta accepts as one template variable. */
export function toWhatsappTemplateText(text: string): string {
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {4,}/g, '   ')
    .trim()
    .slice(0, CHANNEL_LIMITS.whatsapp.body)
}

/** What the person is trying to achieve. Sent to the AI as context, never turned into a canned message. */
export const MESSAGE_PURPOSES = [
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'introduction', label: 'Introduction' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'business_inquiry', label: 'Business inquiry' },
] as const

export type MessagePurpose = (typeof MESSAGE_PURPOSES)[number]['value']

export interface MessageDraft {
  id: string
  name: string
  subject?: string
  body: string
  error?: string
}
