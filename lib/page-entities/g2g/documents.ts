/**
 * The Document Library as a page-entity provider: "show Rahul Patel's documents", "open my payslip",
 * "where is the budget file?", "open the Finance folder", "open the report in the Finance folder".
 *
 * Everything comes from the library's own APIs - `GET /api/documents` (which already decides what the
 * signed-in user may see) and `GET /api/documents/folders/tree` (the folders they may see) - so a name or
 * a folder can only ever narrow what the caller may already reach. Nothing here lists a document or a
 * folder; locations and paths are built from the folder tree the server returns.
 *
 * Reading the sentence is deliberately plain rules: the result decides whether a file opens, so it must
 * not depend on a model. A sentence that is not a "go and get / show me where" request is not recognised
 * and goes to the assistant as an ordinary question.
 */

import type { LaravelContext } from '@/lib/laravel-context'

import type { EntityClarify, EntityContext, EntityMatch, EntityProvider, EntityQuery, EntityTarget } from '../types'
import {
  descendantIds,
  extensionOf,
  fileKindIn,
  findFoldersByName,
  isFileKind,
  LIBRARY_ROOT_LABEL,
  locationOf,
  nameMatches,
  normalizeName,
  type FileKind,
  type FolderNode,
} from './document-folders'

export interface G2gEntityApp {
  laravel: LaravelContext
  /** The file the chat last opened or showed, so "where is this file?" has something to point at. */
  recent?: { id: number; title: string } | null
}

/** The route of the Document Library screen. A prefix, so its sub-routes count as the same page. */
export const DOCUMENT_LIBRARY_PAGE = '/documents'

/** The window event the Document Library listens for to show one document without reloading. */
export const OPEN_DOCUMENT_EVENT = 'g2g:open-document'

/** The window event that takes the library to a folder and, optionally, highlights one document in it. */
export const NAVIGATE_FOLDER_EVENT = 'g2g:library-navigate'

export interface DocumentHit {
  id: number
  title: string | null
  original_file_name: string | null
  mime_type?: string | null
  document_type: string | null
  document_date: string | null
  created_at: string | null
  visibility: string | null
  owner_id: number | null
  owner_name?: string | null
  folder_id?: number | null
  source_system?: string | null
}

export interface DocumentSearchResult {
  data: DocumentHit[]
  meta?: { total: number }
  document_types: { personnel: Record<string, string>; organization: Record<string, string> }
}

export interface DocumentProviderDeps {
  search: (
    context: LaravelContext,
    filters: { q?: string; owner_name?: string; owner_id?: number; document_type?: string; folder_id?: number; per_page?: number },
  ) => Promise<DocumentSearchResult>
  /** The folders the caller may see, nested. Optional: without it, locations and folder requests are unavailable. */
  folderTree?: (context: LaravelContext) => Promise<FolderNode[]>
}

/** How many matches one answer lists. More than this means the request should be narrowed. */
export const MAX_LISTED = 25

/** How many partial matches are offered when nothing matched the whole request. */
export const MAX_SIMILAR = 10

const SKIP_WORDS = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'doc', 'docs', 'document', 'documents', 'file', 'files'])

const LOOKUP_VERB = /\b(show|find|open|get|list|view|display|fetch|search|look\s*up|pull\s*up|where\s+is|give\s+me|bring\s+up|go\s*to|navigate\s+to|take\s+me\s+to|browse|switch\s+to|locate)\b/i
const FOLDER_QUESTION = /\b(where\s+(?:is|are|was|can\s+i\s+find|do\s+i\s+find|did\s+i\s+(?:put|save|upload|store))|which\s+folder|what\s+folder|in\s+which\s+folder|location\s+of|locate)\b/i
const FOLDER_WORDS = /\bfolders?\b|\bwhat'?s\s+in\b|\bcontents?\s+of\b/i
const DOCUMENT_NOUN = /\b(documents?|docs?|files?|papers?)\b/i
const THIS_FILE = /\b(this|that|the\s+same|it)\b/i
const THIS_PERSON = /\b(this|that|the\s+same)\s+(user|person|employee|member|candidate|colleague)\b|\b(him|her|them)\b/i
// "my documents", "documents for me". Not a bare "me": "show me Rahul's documents" is about Rahul.
const MINE = /\b(my|mine)\b|\b(?:for|of|by)\s+me\b/i
const QUESTION_START = /^(what|how|why|when|where|who|which|is|are|can|could|do|does)\b/i
const NOT_A_DOCUMENT = /\b(page|screen|menu|tab|module|dashboard|section|chat|assistant|settings?)\b/i
const LEAD_WORDS = new Set(['show', 'me', 'find', 'open', 'get', 'list', 'view', 'display', 'fetch', 'search', 'look', 'up', 'pull', 'where', 'is', 'are', 'was', 'give', 'bring', 'the', 'a', 'an', 'please', 'all', 'any', 'of', 'for', 'to', 'can', 'you', 'i', 'want', 'need', 'would', 'like', 'go', 'navigate', 'take', 'browse', 'switch', 'locate', 'in', 'inside', 'from', 'under', 'within', 'located', 'stored', 'saved', 'kept', 'do', 'did', 'put', 'upload', "what's", 'whats', 'what', 'contents', 'content', 'everything', 'items'])

function typeLabels(types: DocumentSearchResult['document_types']): Array<{ key: string; label: string }> {
  return [...Object.entries(types.personnel), ...Object.entries(types.organization)].map(([key, label]) => ({ key, label }))
}

function cleanName(raw: string): string {
  const words = raw
    .replace(/[?.!,]+$/g, '')
    .split(/\s+/)
    .filter(Boolean)

  while (words.length > 0 && LEAD_WORDS.has(words[0].toLowerCase())) words.shift()
  while (words.length > 0 && /^(documents?|docs?|files?|papers?|uploaded|please|folder)$/i.test(words[words.length - 1])) words.pop()

  return words.join(' ').trim()
}

type Parsed =
  | { kind: 'query'; terms: Record<string, string>; summary: string; onSingle?: 'open' | 'reveal' }
  | { kind: 'who' }
  | { kind: 'which' }
  | null

/**
 * What a sentence asks of the library. Pure, so it is tested without a network.
 *
 * `terms.mode` is `files` (find and open), `locate` ("where is...": say where, go there, highlight) or
 * `folder` (open a folder and show its contents).
 *
 * @param types  The library's own document types (key -> label), used to recognise "payslip".
 */
export function parseDocumentRequest(message: string, types: Array<{ key: string; label: string }>): Parsed {
  const text = message.trim()
  const typeHit = types.find((type) => new RegExp(`\\b${type.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i').test(text))

  // ---- 1. "Where is X?" - say where it is, go there, highlight it -------------------------------------
  if (FOLDER_QUESTION.test(text)) {
    const stripped = text.replace(FOLDER_QUESTION, ' ').replace(/\b(is|in|located|stored|saved|kept)\b/gi, ' ')
    const name = cleanName(stripped.replace(/\b(this|that|it)\b/gi, ' ').replace(DOCUMENT_NOUN, ' '))

    if (name.length >= 2) {
      return { kind: 'query', terms: { mode: 'locate', q: name }, summary: `documents matching "${name}"`, onSingle: 'reveal' }
    }

    // "Where is this file?" - about the last file the conversation was about, if there is one.
    return THIS_FILE.test(text) || DOCUMENT_NOUN.test(text) ? { kind: 'which' } : null
  }

  // ---- 2. A named folder ----------------------------------------------------------------------------
  const inFolder = /^(.*?)\b(?:in|inside|from|under|within)\s+(?:the\s+)?(.+?)\s+folder\b/i.exec(text)

  if (inFolder) {
    const folder = cleanName(inFolder[2])
    const kind = fileKindIn(inFolder[1])
    const prefix = cleanName((kind ? kind.rest : inFolder[1]).replace(DOCUMENT_NOUN, ' '))

    if (folder.length >= 2) {
      // "files in the Finance folder" names no file: it is the folder's contents.
      if (prefix === '' && !kind) {
        return { kind: 'query', terms: { mode: 'folder', folder }, summary: `folders named "${folder}"` }
      }

      const terms: Record<string, string> = { mode: 'files', folder }
      if (prefix !== '') terms.q = prefix
      if (kind) terms.fileKind = kind.kind

      return {
        kind: 'query',
        terms,
        summary: `${kind ? `${kind.kind} ` : ''}documents${prefix ? ` matching "${prefix}"` : ''} in the "${folder}" folder`,
      }
    }
  }

  const named =
    /(?:open|go\s*to|goto|navigate\s+to|take\s+me\s+to|show|display|browse|switch\s+to|view)\s+(?:me\s+)?(?:the\s+)?(?:folder\s+(?:called\s+|named\s+)?)?(.+?)\s+folder\b/i.exec(text) ??
    /\bfolder\s+(?:called\s+|named\s+)?["“']?(.+?)["”']?[?.!]*$/i.exec(text)

  if (named && FOLDER_WORDS.test(text)) {
    const folder = cleanName(named[1])

    if (folder.length >= 2 && !QUESTION_START.test(folder)) {
      return { kind: 'query', terms: { mode: 'folder', folder }, summary: `folders named "${folder}"` }
    }
  }

  // ---- 3. A plain "open <name>" on this page asks for a document -----------------------------------
  // Only "open"/"view", never a question, and never a request for a page, menu or tab of the app.
  const bare = /^\s*(?:please\s+)?(?:open|view)\s+(.+?)[?.!]*\s*$/i.exec(text)

  if (bare && !DOCUMENT_NOUN.test(text) && !typeHit && !fileKindIn(text)) {
    const name = cleanName(bare[1])

    if (name.length >= 2 && !QUESTION_START.test(name) && !NOT_A_DOCUMENT.test(name) && !text.includes('?')) {
      return { kind: 'query', terms: { mode: 'files', q: name }, summary: `documents matching "${name}"` }
    }

    return null
  }

  // ---- 4. Files: by person, type, kind, content or name ------------------------------------------------
  const kindHit = fileKindIn(text)

  // A request to go and get something - not a question about documents ("how many documents are there").
  if (!LOOKUP_VERB.test(text) || !(DOCUMENT_NOUN.test(text) || typeHit || kindHit)) return null

  const terms: Record<string, string> = { mode: 'files' }
  const parts: string[] = []

  if (typeHit) {
    terms.document_type = typeHit.key
    parts.push(typeHit.label)
  }

  let working = text

  if (kindHit) {
    terms.fileKind = kindHit.kind
    parts.push(kindHit.kind)
    working = kindHit.rest
  }

  // Content: "documents that mention project plan".
  const content = /\b(?:about|mentioning|mentions?|containing|contains|with\s+the\s+words?|that\s+say|saying)\s+(.+?)[?.!]*$/i.exec(working)
  if (content) {
    terms.q = content[1].trim()
    parts.push(`mentioning "${terms.q}"`)
  }

  // A person: "Rahul Patel's documents", "documents of/for/from Rahul Patel".
  let person: string | null = null
  const possessive = /([A-Za-z][A-Za-z0-9.'’\- ]*?)['’]s\s+(?:\w+\s+){0,2}?(?:documents?|docs?|files?|papers?|letters?|payslips?|resumes?)/i.exec(working)
  const preposition = !content
    ? /\b(?:of|for|from|by|belonging\s+to|owned\s+by|uploaded\s+by)\s+([A-Za-z][A-Za-z0-9.'’\- ]*?)(?:\s+(?:documents?|docs?|files?|uploaded)\b|[?.!]*$)/i.exec(working)
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
      working
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

function toMatch(hit: DocumentHit, labels: Map<string, string>, tree: FolderNode[], myId: number | null): EntityMatch {
  const details: EntityMatch['details'] = []
  const type = hit.document_type ? (labels.get(hit.document_type) ?? hit.document_type) : null
  const date = formatDate(hit.document_date ?? hit.created_at)

  if (type) details.push({ label: 'Type', value: type })
  if (hit.original_file_name && hit.original_file_name !== hit.title) details.push({ label: 'File', value: hit.original_file_name })
  if (date) details.push({ label: hit.document_date ? 'Dated' : 'Added', value: date })
  if (hit.visibility) details.push({ label: 'Visible to', value: hit.visibility })

  // Where it lives. A document filed in another feature (source_system) has no library folder.
  const federated = Boolean(hit.source_system)
  const known = locationOf(tree, hit.folder_id)
  const location = federated ? `Stored in ${hit.source_system}` : (known ?? `${LIBRARY_ROOT_LABEL} (a folder you cannot browse)`)

  return {
    id: String(hit.id),
    title: hit.title || hit.original_file_name || `Document ${hit.id}`,
    subtitle: hit.owner_name ?? undefined,
    details,
    kind: 'file',
    location,
    revealable: !federated && known !== null,
    meta: {
      folderId: hit.folder_id === null || hit.folder_id === undefined ? 'root' : String(hit.folder_id),
      // Whose it is, so the library opens the right view (mine / everything I can see).
      scope: hit.owner_id !== null && hit.owner_id === myId ? 'mine' : 'visible',
    },
  }
}

function folderMatch(flat: { node: FolderNode; path: string[] }, myId: number | null): EntityMatch {
  const subfolders = flat.node.children?.length ?? 0
  const details: EntityMatch['details'] = []
  if (subfolders > 0) details.push({ label: 'Contains', value: `${subfolders} subfolder${subfolders === 1 ? '' : 's'}` })
  if (flat.node.visibility) details.push({ label: 'Visible to', value: flat.node.visibility })

  const owner = flat.node.owner_id
  return {
    id: String(flat.node.id),
    title: flat.node.name.replace(/\s+/g, ' ').trim(),
    subtitle: flat.path.length > 1 ? flat.path.slice(0, -1).join(' › ') : undefined,
    details,
    kind: 'folder',
    location: [LIBRARY_ROOT_LABEL, ...flat.path].join(' › '),
    revealable: false,
    meta: { folderId: String(flat.node.id), scope: owner !== null && owner !== undefined && owner === myId ? 'mine' : 'visible' },
  }
}

function onPage(pathname: string): boolean {
  return pathname === DOCUMENT_LIBRARY_PAGE || pathname.startsWith(`${DOCUMENT_LIBRARY_PAGE}/`)
}

function libraryTarget(pathname: string, folderId: string, highlight: string | null, scope: string): EntityTarget {
  if (onPage(pathname)) {
    return {
      kind: 'event',
      name: NAVIGATE_FOLDER_EVENT,
      detail: { folderId: folderId === 'root' ? null : Number(folderId), highlightDocumentId: highlight === null ? undefined : Number(highlight), scope },
    }
  }

  const params = new URLSearchParams({ folder: folderId, scope })
  if (highlight !== null) params.set('highlight', highlight)

  return { kind: 'navigate', href: `${DOCUMENT_LIBRARY_PAGE}?${params.toString()}` }
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

  // The folder tree is small and changes rarely; kept for half a minute so a conversation does not refetch it.
  let treeCache: { at: number; tree: FolderNode[] } | null = null
  const folderTree = async (context: EntityContext<G2gEntityApp>): Promise<FolderNode[]> => {
    if (!deps.folderTree) return []
    if (treeCache && Date.now() - treeCache.at < 30_000) return treeCache.tree

    try {
      const tree = await deps.folderTree(context.app.laravel)
      treeCache = { at: Date.now(), tree }
      return tree
    } catch {
      return []
    }
  }

  const myIdOf = (context: EntityContext<G2gEntityApp>): number | null => (context.app.laravel.userId ? Number(context.app.laravel.userId) : null)

  /**
   * One name, tried the ways people actually type it. A file called `C10_2026-27_SSM_Science-33-40` is
   * what someone calls "SSM Science 33 40", so spaces are also tried as underscores and hyphens. When a
   * document's NAME fits the request that is the file asked for, and the broader content matches that
   * came with it are dropped.
   */
  const searchName = async (
    context: EntityContext<G2gEntityApp>,
    base: { owner_name?: string; owner_id?: number; document_type?: string; folder_id?: number },
    name: string | undefined,
    // How many to read. A request for one KIND of file has no name to narrow by, so it reads the most the API gives.
    perPage: number = MAX_LISTED,
  ): Promise<DocumentHit[]> => {
    const variants = name ? [...new Set([name, name.replace(/\s+/g, '_'), name.replace(/\s+/g, '-')])] : [undefined]
    const found = new Map<number, DocumentHit>()

    for (const q of variants) {
      const result = await deps.search(context.app.laravel, { ...base, q, per_page: perPage })
      learn(result.document_types)
      for (const hit of result.data) found.set(hit.id, hit)
    }

    const all = [...found.values()]
    const byName = name ? all.filter((hit) => nameMatches(hit, name)) : []

    return byName.length > 0 ? byName : all
  }

  return {
    key: 'documents',
    noun: 'documents',
    appliesTo: (context) => onPage(context.pathname),

    parse: async (message, context): Promise<EntityQuery | EntityClarify | null> => {
      // Only a sentence that could be a request for a file or folder needs the type list.
      if (!LOOKUP_VERB.test(message) && !FOLDER_QUESTION.test(message) && !FOLDER_WORDS.test(message)) return null
      await ensureTypes(context)

      const parsed = parseDocumentRequest(message, known)
      if (parsed === null) return null

      if (parsed.kind === 'which') {
        // "Where is this file?" - the file the conversation was last about, when there is one.
        const recent = context.app.recent
        if (recent) {
          return { terms: { mode: 'locate', q: recent.title, id: String(recent.id) }, summary: `"${recent.title}"`, onSingle: 'reveal' }
        }

        const latest = await deps.search(context.app.laravel, { per_page: 5 })
        return {
          question: 'Which file? Tell me its name, for example "Where is <file name>?".',
          choices: latest.data.slice(0, 5).map((hit) => {
            const title = hit.title || hit.original_file_name || `Document ${hit.id}`
            return { label: title, message: `Where is ${title}?` }
          }),
        }
      }

      if (parsed.kind === 'who') {
        // Real people who own documents the user can see, so "this user" can be answered by picking.
        const recent = await deps.search(context.app.laravel, { per_page: 50 })
        const owners = [...new Set(recent.data.map((hit) => hit.owner_name).filter((name): name is string => Boolean(name)))].slice(0, 5)

        return {
          question: 'Whose documents? Tell me a name, for example "Show documents for <name>".',
          choices: owners.map((name) => ({ label: name, message: `Show documents for ${name}` })),
        }
      }

      return { terms: parsed.terms, summary: parsed.summary, onSingle: parsed.onSingle }
    },

    search: async (query, context) => {
      const tree = await folderTree(context)
      const myId = myIdOf(context)
      const mode = query.terms.mode ?? 'files'

      // ---- a folder, by name --------------------------------------------------------------------------
      if (mode === 'folder') {
        return findFoldersByName(tree, query.terms.folder ?? '').map((flat) => folderMatch(flat, myId))
      }

      // ---- files ---------------------------------------------------------------------------------------
      const base = {
        owner_name: query.terms.owner_name,
        owner_id: query.terms.mine === '1' && myId !== null ? myId : undefined,
        document_type: query.terms.document_type,
      }

      // Filtering by file kind happens after the search, so read the most the API allows when there is no name to narrow by.
      const readCount = query.terms.fileKind && !query.terms.q ? 100 : MAX_LISTED
      let hits: DocumentHit[]

      if (query.terms.folder) {
        // "the report in the Finance folder": only inside the folder(s) that name fits, subfolders included.
        const folders = findFoldersByName(tree, query.terms.folder)
        const ids = [...new Set(folders.flatMap((flat) => descendantIds(tree, flat.node.id)))].slice(0, 25)
        const inside = new Map<number, DocumentHit>()

        for (const folderId of ids) {
          for (const hit of await searchName(context, { ...base, folder_id: folderId }, query.terms.q, readCount)) inside.set(hit.id, hit)
        }
        hits = [...inside.values()]
      } else {
        hits = await searchName(context, base, query.terms.q, readCount)

        // "documents for Triz Website Project": no such person, but a document may carry that name.
        if (hits.length === 0 && query.terms.owner_name && !query.terms.q) {
          hits = await searchName(context, { ...base, owner_name: undefined }, query.terms.owner_name)
        }
      }

      if (query.terms.id) hits = hits.filter((hit) => String(hit.id) === query.terms.id)

      const kind = query.terms.fileKind as FileKind | undefined
      if (kind) hits = hits.filter((hit) => isFileKind(hit, kind))

      return hits.map((hit) => toMatch(hit, labels, tree, myId))
    },

    // "artificial intelligence" matched nothing as a whole: documents that contain SOME of the words,
    // those matching the most words first, with the matching words shown so the user can judge.
    similar: async (query, context) => {
      const phrase = query.terms.q
      if (!phrase || query.terms.mode === 'folder') return []

      const words = [...new Set(phrase.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && !SKIP_WORDS.has(word)))].slice(0, 5)
      if (words.length < 2) return []

      const tree = await folderTree(context)
      const myId = myIdOf(context)
      const found = new Map<number, { hit: DocumentHit; matched: string[] }>()

      for (const word of words) {
        const result = await deps.search(context.app.laravel, {
          q: word,
          document_type: query.terms.document_type,
          per_page: MAX_LISTED,
        })
        learn(result.document_types)

        for (const hit of result.data) {
          const entry = found.get(hit.id) ?? { hit, matched: [] }
          entry.matched.push(word)
          found.set(hit.id, entry)
        }
      }

      return [...found.values()]
        .sort((a, b) => b.matched.length - a.matched.length || b.hit.id - a.hit.id)
        .slice(0, MAX_SIMILAR)
        .map(({ hit, matched }) => {
          const match = toMatch(hit, labels, tree, myId)
          return { ...match, details: [{ label: 'Contains', value: matched.join(', ') }, ...match.details] }
        })
    },

    suggestions: async (context) => {
      const result = await deps.search(context.app.laravel, { per_page: 50 })
      learn(result.document_types)
      const tree = await folderTree(context)

      const me = myIdOf(context)
      const out: string[] = []

      if (result.data.some((hit) => hit.owner_id === me)) out.push('Show my documents')

      // The library's own top-level folders, by their real names.
      for (const folder of tree.slice(0, 2)) out.push(`Open the ${folder.name.replace(/\s+/g, ' ').trim()} folder`)

      const others = [...new Set(result.data.filter((hit) => hit.owner_id !== me).map((hit) => hit.owner_name).filter((name): name is string => Boolean(name)))]
      for (const name of others.slice(0, 1)) out.push(`Show documents for ${name}`)

      const typesPresent = [...new Set(result.data.map((hit) => hit.document_type).filter((type): type is string => Boolean(type)))]
      for (const type of typesPresent.slice(0, 1)) out.push(`Show ${labels.get(type) ?? type} documents`)

      const newest = result.data[0]
      if (newest?.title) {
        out.push(`Where is ${newest.title}?`)
        out.push(`Open the document ${newest.title}`)
      }

      return out.slice(0, 6)
    },

    open: (match, context) => {
      if (match.kind === 'folder') return libraryTarget(context.pathname, match.meta?.folderId ?? 'root', null, match.meta?.scope ?? 'visible')

      return onPage(context.pathname)
        ? { kind: 'event', name: OPEN_DOCUMENT_EVENT, detail: { id: Number(match.id) } }
        : { kind: 'navigate', href: `${DOCUMENT_LIBRARY_PAGE}?open=${encodeURIComponent(match.id)}` }
    },

    reveal: (match, context) => libraryTarget(context.pathname, match.meta?.folderId ?? 'root', match.id, match.meta?.scope ?? 'visible'),
  }
}

export { extensionOf, normalizeName }
