import { sourceLinkProblem } from '@/lib/source-link'

/**
 * Adding an opportunity by hand on the Company Opportunities screen: the form's rules, the request it sends, and which day the screen then shows.
 * Pure (no React, no network), so each rule can be tested on its own.
 *
 * Two dates are never mixed up here: the day the record is SAVED (decided by the server, and what the record is listed under) and the date of the
 * source post (optional, typed by the person, kept as the source's publication date). The form can send the second; it cannot send the first.
 */

export interface ManualForm {
  company_name: string
  summary: string
  source_url: string
  source_title: string
  /** YYYY-MM-DD of the post (optional). */
  source_published_at: string
  contact: string
  website: string
  location: string
}

export const emptyManualForm = (): ManualForm => ({
  company_name: '', summary: '', source_url: '', source_title: '', source_published_at: '', contact: '', website: '', location: '',
})

/** The problems with what was typed, keyed by field (empty = fine). `today` is YYYY-MM-DD in the signals timezone, for the "not in the future" rule. */
export function validateManual(f: ManualForm, today: string | null): Partial<Record<keyof ManualForm, string>> {
  const e: Partial<Record<keyof ManualForm, string>> = {}
  const name = f.company_name.trim()
  if (name.length < 2) e.company_name = 'Enter the company name.'
  else if (name.length > 191) e.company_name = 'Keep the company name under 191 characters.'
  const summary = f.summary.trim()
  if (summary.length < 10) e.summary = 'Say what happened and why it is an opportunity (at least 10 characters).'
  else if (summary.length > 600) e.summary = 'Keep this under 600 characters.'
  // The source can be from ANY website or platform: a real http(s) address, nothing unsafe (the server applies the same rules, and never opens it).
  const linkProblem = sourceLinkProblem(f.source_url)
  if (linkProblem) e.source_url = linkProblem
  if (f.website.trim() !== '' && sourceLinkProblem(f.website) !== null) e.website = 'Enter a full web link starting with https://'
  const published = f.source_published_at.trim()
  if (published !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(published) || Number.isNaN(Date.parse(published))) e.source_published_at = 'Enter the date the post was published.'
    else if (today && published > today) e.source_published_at = 'The post cannot have been published in the future.'
  }

  return e
}

/** What is sent: the typed text trimmed, empty optional fields left out, and the product / sub-product / customer type the screen is on. Never a saved-on date. */
export function toManualPayload(f: ManualForm, scope: { productKey: string; offerId: string | null; customerModel: 'b2b' | 'b2c' | 'b2g' }) {
  const opt = (v: string) => (v.trim() === '' ? undefined : v.trim())

  return {
    product: scope.productKey,
    customer_model: scope.customerModel,
    ...(scope.offerId ? { offer_id: scope.offerId } : {}),
    company_name: f.company_name.trim(),
    summary: f.summary.trim(),
    source_url: f.source_url.trim(),
    ...(opt(f.source_title) ? { source_title: opt(f.source_title) } : {}),
    ...(opt(f.source_published_at) ? { source_published_at: opt(f.source_published_at) } : {}),
    ...(opt(f.contact) ? { contact: opt(f.contact) } : {}),
    ...(opt(f.website) ? { website: opt(f.website) } : {}),
    ...(opt(f.location) ? { location: opt(f.location) } : {}),
  }
}

/**
 * Which day the screen shows after a save. A record is listed under the day it was saved, so someone looking at a day gets the day it was saved
 * (they would not see it otherwise); someone on "All Signals" stays there, where it appears anyway.
 */
export function viewAfterManualSave(current: { picked: string | null; allSignals: boolean }, capturedOn: string): { picked: string | null; allSignals: boolean } {
  return current.allSignals ? current : { picked: capturedOn, allSignals: false }
}
