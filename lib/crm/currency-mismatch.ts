import { ApiError } from '@/services/core'

/**
 * The refusal a document gives when a Sub-product that is priced in one currency is put on a document in another (S16, 25 Nov 2026; hp_erp contract section 4, item (a)).
 * The three documents (quote, sales order, invoice) answer a save of their lines with a 422 and ONE plain sentence:
 *
 *   "<Sub-product> is priced in <CUR>, this document is in <CUR>."
 *
 * and save nothing. The sentence is already in words a person can act on, so it is shown as it came, on the line table (components/domain/crm/line-table-error.tsx).
 *
 * The answer is read by what it SAYS, from wherever the server put it: the `message`, the `detail`, or any field message of `errors` (a `currency_mismatch` key, or a line
 * key). Only a 422 counts, and only a text that has the sentence's own two halves ("is priced in X, this document is in Y"): every other failure keeps going to the page's
 * notice, as before, and a 500 or a 403 that happens to mention a currency is never dressed up as this one.
 */
const SENTENCE = /\bis priced in\s+\S+?,\s*this document is in\s+\S+/i

function candidates(error: ApiError): string[] {
  const fromFields = Object.values(error.errors ?? {}).flatMap((messages) => (Array.isArray(messages) ? messages : [messages]))
  return [error.message, error.detail, ...fromFields].filter((text): text is string => typeof text === 'string' && text.trim() !== '')
}

/** The sentence of a `currency_mismatch` refusal, or null when this failure is something else. */
export function currencyMismatchSentence(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null

  return candidates(error).find((text) => SENTENCE.test(text))?.trim() ?? null
}
