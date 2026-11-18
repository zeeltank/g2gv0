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

/** The record on screen, or null when the page is not one record's page. The id must be a plain positive whole number. */
export function recordContextFromPath(pathname: string | null | undefined): AskContext | null {
  if (typeof pathname !== 'string') return null
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
