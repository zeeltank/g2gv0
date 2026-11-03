import type {
  AskAnswer, AskCitation, AskConversation, AskConversationRow, AskConversationsPage, AskEnvelope, AskMessage,
} from '../../services/agent/ask-types'

/** Data for the chat's tests, shaped exactly as hp_erp's AskConversations writes it (read in source, 4 Nov 2026). */

export const NOW = '2026-11-04T09:30:00+00:00'

export const LEAD: AskCitation = { type: 'lead', id: '201', label: 'Rahul Sharma (L-0201)', url: '/module/crm/marketing/leads/201' }
export const ORG: AskCitation = { type: 'organization', id: '135', label: 'Tapovan Vidya Vihar', url: '/module/crm/marketing/organizations/135' }
export const SIGNAL: AskCitation = { type: 'signal', id: '39', label: 'Tapovan is opening a new CBSE campus', url: '/module/crm/signal-review?status=all&q=Tapovan' }

export function message(over: Partial<AskMessage> = {}): AskMessage {
  return { id: 11, role: 'assistant', text: 'Tapovan has one open opportunity.', status: 'answered', citations: [ORG], created_at: NOW, ...over }
}

export const asked = (over: Partial<AskMessage> = {}) => message({ id: 10, role: 'user', text: 'What is open for Tapovan?', status: null, citations: [], ...over })

export function answer(over: { conversation_id?: number; message?: Partial<AskMessage> } = {}): AskEnvelope<AskAnswer> {
  return { status: 1, data: { conversation_id: over.conversation_id ?? 5, message: message(over.message) } }
}

export function row(over: Partial<AskConversationRow> = {}): AskConversationRow {
  return { id: 5, title: 'What is open for Tapovan?', context: null, message_count: 2, created_at: NOW, updated_at: NOW, ...over }
}

export function page(rows: AskConversationRow[] = [row()], over: Partial<AskConversationsPage['pagination']> = {}): AskEnvelope<AskConversationsPage> {
  return { status: 1, data: { rows, pagination: { page: 1, per_page: 20, total: rows.length, last_page: 1, ...over } } }
}

export function conversation(over: Partial<AskConversation> = {}): AskEnvelope<AskConversation> {
  return { status: 1, data: { ...row(), messages: [asked(), message()], ...over } }
}

/** Plain text that looks like markup: it must be drawn as the characters it is. */
export const MARKUP = '<img src=x onerror="window.__owned=1"> <b>bold</b> <script>window.__owned=2</script>'
