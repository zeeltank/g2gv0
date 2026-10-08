/**
 * The Document Library as a page-entity provider: "show Rahul Patel's documents", "open my
 * payslip", "find documents that mention Form 16".
 *
 * Everything comes from the library's own API (`GET /api/documents`), which already decides what
 * the signed-in user may see - an employee gets their own and organisation-visible documents, HR
 * gets the tenant - so a name can only ever narrow that set. Nothing here lists a document.
 *
 * Reading the sentence is deliberately plain rules: the result decides whether a document opens,
 * so it must not depend on a model. A sentence that is not a "go and get me a document" request is
 * not recognised and goes to the assistant as an ordinary question.
 */

import type { LaravelContext } from '@/lib/laravel-context'

import type { EntityClarify, EntityContext, EntityMatch, EntityProvider, EntityQuery } from '../types'

export interface G2gEntityApp {
  laravel: LaravelContext
}

/** The route of the Document Library screen. A prefix, so its sub-routes count as the same page. */
export const DOCUMENT_LIBRARY_PAGE = '/documents'

/** The window event the Document Library listens for to show one document without reloading. */
export const OPEN_DOCUMENT_EVENT = 'g2g:open-document'

export interface DocumentHit {
  id: number
  title: string | null
  original_file_name: string | null
  document_type: string | null
  document_date: string | null
  created_at: string | null
  visibility: string | null
  owner_id: number | null
  owner_name?: string | null
}

export interface DocumentSearchResult {
  data: DocumentHit[]
  meta?: { total: number }
  document_types: { personnel: Record<string, string>; organization: Record<string, string> }
}

export interface DocumentProviderDeps {
  search: (
    context: LaravelContext,
    filters: { q?: string; owner_name?: string; owner_id?: number; document_type?: string; per_page?: number },
  ) => Promise<DocumentSearchResult>
}

/** How many matches one answer lists. More than this means the request should be narrowed. */
export const MAX_LISTED = 25

const LOOKUP_VERB = /\b(show|find|open|get|list|view|display|fetch|search|look\s*up|pull\s*up|where\s+is|give\s+me|bring\s+up)\b/i
const DOCUMENT_NOUN = /\b(documents?|docs?|files?|papers?)\b/i
const THIS_PERSON = /\b(this|that|the\s+same)\s+(user|person|employee|member|candidate|colleague)\b|\b(him|her|them)\b/i
const MINE = /\b(my|mine|me)\b/i
const LEAD_WORDS = new Set(['show', 'me', 'find', 'open', 'get', 'list', 'view', 'display', 'fetch', 'search', 'look', 'up', 'pull', 'where', 'is', 'give', 'bring', 'the', 'a', 'an', 'please', 'all', 'any', 'of', 'for', 'to', 'can', 'you', 'i', 'want', 'need', 'would', 'like'])

function typeLabels(types: DocumentSearchResult['document_types']): Array<{ key: string; label: string }> {
  return [...Object.entries(types.personnel), ...Object.entries(types.organization)].map(([key, label]) => ({ key, label }))
}

function cleanName(raw: string): string {
  const words = raw
    .replace(/[?.!,]+$/g, '')
    .split(/\s+/)
    .filter(Boolean)

  while (words.length > 0 && LEAD_WORDS.has(words[0].toLowerCase())) words.shift()
  while (words.length > 0 && /^(documents?|docs?|files?|papers?|uploaded|please)$/i.test(words[words.length - 1])) words.pop()

  return words.join(' ').trim()
}

type Parsed =
  | { kind: 'query'; terms: Record<string, string>; summary: string }
  | { kind: 'who' }
  | null

/**
 * What a sentence asks of the library. Pure, so it is tested without a network.
 *
 * @param types  The library's own document types (key -> label), used to recognise "payslip".
 */
export function parseDocumentRequest(message: string, types: Array<{ key: string; label: string }>): Parsed {
  const text = message.trim()
  const typeHit = types.find((type) => new RegExp(`\\b${type.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i').test(text))

  // A request to go and get something - not a question about documents ("how many documents are there").
  if (!LOOKUP_VERB.test(text) || !(DOCUMENT_NOUN.test(text) || typeHit)) return null

  const terms: Record<string, string> = {}
  const parts: string[] = []

  if (typeHit) {
    terms.document_type = typeHit.key
    parts.push(typeHit.label)
  }

  // Content: "documents that mention project plan".
  const content = /\b(?:about|mentioning|mentions?|containing|contains|with\s+the\s+words?|that\s+say|saying)\s+(.+?)[?.!]*$/i.exec(text)
  if (content) {
    terms.q = content[1].trim()
    parts.push(`mentioning "${terms.q}"`)
  }

  // A person: "Rahul Patel's documents", "documents of/for/from Rahul Patel".
  let person: string | null = null
  const possessive = /([A-Za-z][A-Za-z.'’\- ]*?)['’]s\s+(?:\w+\s+){0,2}?(?:documents?|docs?|files?|papers?|letters?|payslips?|resumes?)/i.exec(text)
  const preposition = !content
    ? /\b(?:of|for|from|by|belonging\s+to|owned\s+by|uploaded\s+by)\s+([A-Za-z][A-Za-z.'’\- ]*?)(?:\s+(?:documents?|docs?|files?|uploaded)\b|[?.!]*$)/i.exec(text)
    : null

  if (possessive) person = cleanName(possessive[1])
  else if (preposition) person = cleanName(preposition[1])

  if (person && !THIS_PERSON.test(person) && !MINE.test(person) && person.length >= 2) {
    terms.owner_name = person
    parts.push(`of ${person}`)
  } else if (THIS_PERSON.test(text) && !terms.owner_name) {
    // "this user's document" names no one the library can know.
    return { kind: 'who' }
  } else if (MINE.test(text)) {
    terms.mine = '1'
    parts.push('mine')
  }

  // Anything left after the verbs, nouns and recognised parts reads as a title: "open design system project".
  if (!terms.owner_name && !terms.mine && !terms.q) {
    const leftover = cleanName(
      text
        .replace(typeHit ? new RegExp(typeHit.label, 'i') : /$^/, ' ')
        .replace(/\b(documents?|docs?|files?|papers?)\b/gi, ' ')
        .replace(LOOKUP_VERB, ' '),
    )

    if (leftover.length >= 2) {
      terms.q = leftover
      parts.push(`matching "${leftover}"`)
    }
  }

  return { kind: 'query', terms, summary: `documents ${parts.join(' ')}`.replace(/\s+/g, ' ').trim() }
}

function formatDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value.replace(' ', 'T'))

  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function toMatch(hit: DocumentHit, labels: Map<string, string>): EntityMatch {
  const details: EntityMatch['details'] = []
  const type = hit.document_type ? (labels.get(hit.document_type) ?? hit.document_type) : null
  const date = formatDate(hit.document_date ?? hit.created_at)

  if (type) details.push({ label: 'Type', value: type })
  if (hit.original_file_name && hit.original_file_name !== hit.title) details.push({ label: 'File', value: hit.original_file_name })
  if (date) details.push({ label: hit.document_date ? 'Dated' : 'Added', value: date })
  if (hit.visibility) details.push({ label: 'Visible to', value: hit.visibility })

  return {
    id: String(hit.id),
    title: hit.title || hit.original_file_name || `Document ${hit.id}`,
    subtitle: hit.owner_name ?? undefined,
    details,
  }
}

export function documentLibraryProvider(deps: DocumentProviderDeps): EntityProvider<G2gEntityApp> {
  // The library's own type labels, learned from its own responses and reused for parsing.
  let known: Array<{ key: string; label: string }> = []
  let labels = new Map<string, string>()

  const learn = (types: DocumentSearchResult['document_types']) => {
    known = typeLabels(types)
    labels = new Map(known.map((type) => [type.key, type.label]))
  }

  const ensureTypes = async (context: EntityContext<G2gEntityApp>) => {
    if (known.length > 0) return
    try {
      learn((await deps.search(context.app.laravel, { per_page: 1 })).document_types)
    } catch {
      // Types only sharpen the reading of a sentence; if they cannot be read, the search itself reports why.
    }
  }

  return {
    key: 'documents',
    noun: 'documents',
    appliesTo: (context) => context.pathname === DOCUMENT_LIBRARY_PAGE || context.pathname.startsWith(`${DOCUMENT_LIBRARY_PAGE}/`),

    parse: async (message, context): Promise<EntityQuery | EntityClarify | null> => {
      // Only a sentence that could be a document request needs the type list.
      if (!LOOKUP_VERB.test(message)) return null
      await ensureTypes(context)

      const parsed = parseDocumentRequest(message, known)
      if (parsed === null) return null

      if (parsed.kind === 'who') {
        // Real people who own documents the user can see, so "this user" can be answered by picking.
        const recent = await deps.search(context.app.laravel, { per_page: 50 })
        const owners = [...new Set(recent.data.map((hit) => hit.owner_name).filter((name): name is string => Boolean(name)))].slice(0, 5)

        return {
          question: 'Whose documents? Tell me a name, for example "Show documents for <name>".',
          choices: owners.map((name) => ({ label: name, message: `Show documents for ${name}` })),
        }
      }

      return { terms: parsed.terms, summary: parsed.summary }
    },

    search: async (query, context) => {
      const base = { per_page: MAX_LISTED, document_type: query.terms.document_type, q: query.terms.q }
      const mine = query.terms.mine === '1' && context.app.laravel.userId ? Number(context.app.laravel.userId) : undefined

      let result = await deps.search(context.app.laravel, { ...base, owner_name: query.terms.owner_name, owner_id: mine })
      learn(result.document_types)

      // "documents for Triz Website Project": no such person, but a document may carry that name.
      if (result.data.length === 0 && query.terms.owner_name && !query.terms.q) {
        result = await deps.search(context.app.laravel, { ...base, q: query.terms.owner_name })
      }

      return result.data.map((hit) => toMatch(hit, labels))
    },

    suggestions: async (context) => {
      const result = await deps.search(context.app.laravel, { per_page: 50 })
      learn(result.document_types)

      const me = context.app.laravel.userId ? Number(context.app.laravel.userId) : null
      const out: string[] = []

      if (result.data.some((hit) => hit.owner_id === me)) out.push('Show my documents')

      const others = [...new Set(result.data.filter((hit) => hit.owner_id !== me).map((hit) => hit.owner_name).filter((name): name is string => Boolean(name)))]
      for (const name of others.slice(0, 2)) out.push(`Show documents for ${name}`)

      const typesPresent = [...new Set(result.data.map((hit) => hit.document_type).filter((type): type is string => Boolean(type)))]
      for (const type of typesPresent.slice(0, 2)) out.push(`Show ${labels.get(type) ?? type} documents`)

      const newest = result.data[0]
      if (newest?.title) out.push(`Open the document ${newest.title}`)

      return out.slice(0, 6)
    },

    open: (match, context) =>
      context.pathname === DOCUMENT_LIBRARY_PAGE || context.pathname.startsWith(`${DOCUMENT_LIBRARY_PAGE}/`)
        ? { kind: 'event', name: OPEN_DOCUMENT_EVENT, detail: { id: Number(match.id) } }
        : { kind: 'navigate', href: `${DOCUMENT_LIBRARY_PAGE}?open=${encodeURIComponent(match.id)}` },
  }
}
