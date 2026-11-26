import type { AskContext, AskContextType } from '@/services/agent/ask-types'

/**
 * The record the person is looking at, read from the address.
 *
 * The widget is mounted by the shell on every /module/crm page and, before this, did not know which page it was on. The record pages are the app's own routes
 * (app/module/crm/**): leads, contacts, organizations and opportunities each have a `[id]` page, and the id in the address is the same id the Ask API takes as
 * `context.id`. Anything else (a list, a quote, a sub-page, a lookalike) is no record, so the chat offers nothing it cannot back.
 */

const ROUTES: ReadonlyArray<{ type: AskContextType; pattern: RegExp }> = [
  { type: 'lead', pattern: /^\/module\/crm\/marketing\/leads\/([^/]+)\/?$/ },
  { type: 'contact', pattern: /^\/module\/crm\/(?:marketing|support)\/contacts\/([^/]+)\/?$/ },
  { type: 'organization', pattern: /^\/module\/crm\/(?:marketing|support)\/organizations\/([^/]+)\/?$/ },
  { type: 'opportunity', pattern: /^\/module\/crm\/sales\/opportunities\/([^/]+)\/?$/ },
]

/** The words for a kind of record, as the chat says them (the app's British spelling for organisation). */
export const CONTEXT_WORD: Record<AskContextType, string> = {
  lead: 'lead',
  contact: 'contact',
  organization: 'organisation',
  opportunity: 'opportunity',
}

/**
 * A person open on a company's page or in All people (S18, 25 Nov 2026: Contacts were merged into Organizations): the organisation pages carry `?person=<id>`, and a person on
 * screen is the record to ask about. The old /contacts/{id} address above still reads as a person, for the moment a visit to it is being redirected.
 */
const PERSON_PAGES = /^\/module\/crm\/(?:marketing|support)\/organizations(?:\/[^/]+)?\/?$/

/** The record on screen, or null when the page is not one record's page. The id must be a plain positive whole number. `search` is the address's query, when the caller has it. */
export function recordContextFromPath(pathname: string | null | undefined, search?: string | null): AskContext | null {
  if (typeof pathname !== 'string') return null
  if (typeof search === 'string' && PERSON_PAGES.test(pathname)) {
    const person = new URLSearchParams(search).get('person')
    if (person !== null && /^[1-9]\d{0,14}$/.test(person)) return { type: 'contact', id: Number(person) }
  }
  for (const { type, pattern } of ROUTES) {
    const match = pattern.exec(pathname)
    if (!match) continue
    return /^[1-9]\d{0,14}$/.test(match[1]) ? { type, id: Number(match[1]) } : null
  }
  return null
}

/** A key that changes when the record on screen changes, so "ask about this record" is switched on for one record and not carried to the next. */
export function contextKey(context: AskContext | null): string | null {
  return context ? `${context.type}:${context.id}` : null
}
