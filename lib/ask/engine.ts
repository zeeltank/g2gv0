/**
 * Which engine answers the CRM chat.
 *
 * `ask` is the new one: answers that cite the records they rest on, stored conversations, an optional "about this record" (hp_erp `POST /api/agent/ask`).
 * `legacy` is the old one, exactly as it was (hp_erp `POST /api/crm/ai-chat`, `CrmAgentController::aiChat`): no citations, no stored history, no record context.
 *
 * ONE constant switches back, by the owner's decision of 4 Nov 2026 (the old endpoint stays until the owner decides otherwise): change it to `'legacy'` and the
 * widget talks to the old endpoint only and never calls the new one. Whatever this says, a server that does not have the new chat yet (the new route answers
 * 404) makes the widget fall back to the old endpoint by itself, without a word to the person.
 */
export type ChatEngine = 'ask' | 'legacy'

export const CHAT_ENGINE: ChatEngine = 'ask'
