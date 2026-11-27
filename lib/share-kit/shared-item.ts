import { resolveApiBaseUrl } from '@/lib/api-config'
import { CLIENT_PRESENTATION_KEYS } from '@/lib/client-presentation/link'

/*
 * The public side of the Sales Kit share link (app/share/kit/[token]): what the page asks of the server, how it checks the answer, and how each answer is shown. NOTHING here signs anybody in
 * or reads anything from the person's browser: no session, no cookie, no storage, no authenticated API. The one request is `GET <api>/public/sales-kit/<token>` with no credentials, and EVERY
 * refusal (an unknown, stopped or expired link, a wrong answer, a server that does not answer) comes back here as the same `null`, which the page turns into the same plain 404.
 */

/** A link is 48 letters and digits. Anything else is not one, and is not worth a request. */
export const TOKEN_PATTERN = /^[A-Za-z0-9]{48}$/

export type SharedKind = 'presentation' | 'document' | 'video' | 'image'

/** What the server says about a shared entry, and nothing it did not say: no tenant, no person, no document id is ever carried through, even if one were sent. */
export interface SharedKitItem {
  title: string
  description: string | null
  kind: SharedKind
  source: 'file' | 'link'
  productName: string
  fileName: string | null
  mimeType: string | null
  size: number | null
  /** An external `https://` address (a link item), else null. */
  url: string | null
  /** The deck key (`scholarclone`) for the interactive deck, else null. */
  deck: string | null
  expiresAt: string | null
}

const KINDS: readonly string[] = ['presentation', 'document', 'video', 'image']

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null)
const textOrNull = (value: unknown): string | null | undefined => (value === null || value === undefined ? null : typeof value === 'string' ? value : undefined)
const sizeOrNull = (value: unknown): number | null | undefined => (value === null || value === undefined ? null : typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined)

/**
 * The answer, checked. Anything that is not exactly what the contract says is `null`: a status that is not 1, a missing title, a kind or a source that is not one of ours, a file that carries an
 * address, a link with no address and no deck (or both), an address that is not `https://`, a deck key that is not a plain key.
 */
export function parseSharedItem(payload: unknown): SharedKitItem | null {
  if (typeof payload !== 'object' || payload === null) return null
  const envelope = payload as { status?: unknown; data?: unknown }
  if (envelope.status !== 1 || typeof envelope.data !== 'object' || envelope.data === null) return null
  const data = envelope.data as Record<string, unknown>

  const title = text(data.title)?.trim()
  const productName = text(data.productName)
  const description = textOrNull(data.description)
  const fileName = textOrNull(data.fileName)
  const mimeType = textOrNull(data.mimeType)
  const size = sizeOrNull(data.size)
  const url = textOrNull(data.url)
  const deck = textOrNull(data.deck)
  const expiresAt = textOrNull(data.expiresAt)
  const source = data.source === 'file' || data.source === 'link' ? data.source : null
  if (!title || productName === null || source === null || typeof data.kind !== 'string' || !KINDS.includes(data.kind)) return null
  if ([description, fileName, mimeType, size, url, deck, expiresAt].some((value) => value === undefined)) return null

  const address = url as string | null
  const deckKey = deck as string | null

  if (source === 'file') {
    if (address !== null || deckKey !== null) return null
  } else {
    // exactly one of the two: an address on the web, or the deck
    if ((address === null) === (deckKey === null)) return null
    if (address !== null && !/^https:\/\/\S+$/i.test(address)) return null
    if (deckKey !== null && !/^[a-z0-9-]{1,40}$/.test(deckKey)) return null
  }

  return {
    title,
    description: description?.trim() ? description : null,
    kind: data.kind as SharedKind,
    source,
    productName,
    fileName: fileName as string | null,
    mimeType: mimeType as string | null,
    size: size as number | null,
    url: address,
    deck: deckKey,
    expiresAt: expiresAt as string | null,
  }
}

export interface SharedFetchDeps {
  /** The `fetch` to use; a test hands in its own. */
  fetchImpl?: typeof fetch
  /** The API's address, ending in `/api`; read from the environment when not given. */
  apiBase?: string
}

/** How long the page waits for the server before it gives up and answers the same plain 404. */
const WAIT_MS = 8000

/**
 * Asks the server for the shared entry. Returns it, or `null` for EVERY other outcome: a token of the wrong shape (nothing is asked at all), any status that is not 200, a body that is not JSON
 * or not the right shape, a request that fails or runs out of time. A caller cannot, and so a visitor cannot, tell one refusal from another.
 */
export async function fetchSharedItem(token: string, deps: SharedFetchDeps = {}): Promise<SharedKitItem | null> {
  if (!TOKEN_PATTERN.test(token)) return null
  const fetchImpl = deps.fetchImpl ?? fetch
  try {
    const response = await fetchImpl(`${deps.apiBase ?? resolveApiBaseUrl()}/public/sales-kit/${token}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // no cookie, no Authorization, nothing cached, and no redirect to somewhere else
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(WAIT_MS),
    })
    if (!response.ok) return null
    return parseSharedItem(await response.json())
  } catch {
    return null
  }
}

/** The address of the file itself, on the API: shown in the page when `inline`, saved when not. */
export const sharedFileUrl = (apiBase: string, token: string, inline: boolean): string => `${apiBase}/public/sales-kit/${token}/file${inline ? '?inline=1' : ''}`

const SHOWN_IN_PAGE: Readonly<Record<string, 'image' | 'pdf' | 'video'>> = {
  'application/pdf': 'pdf',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
}
const SHOWN_BY_EXTENSION: Readonly<Record<string, 'image' | 'pdf' | 'video'>> = {
  pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', gif: 'image', mp4: 'video', webm: 'video', mov: 'video',
}

export type SharedView =
  | { mode: 'deck'; deck: string }
  | { mode: 'link'; url: string }
  | { mode: 'image' | 'pdf' | 'video' | 'download' }

/**
 * How the entry is shown. The deck is the player, but only for a deck this site really has (`CLIENT_PRESENTATION_KEYS`): any other key is `null`, which is a 404, never a page that tries. An
 * address is a button, not a redirect. A PDF, a picture or a video is shown in the page (the server sends those inline and nothing else); every other file is a download. The type is the
 * server's own `mimeType`; only a file that has none falls back to its extension.
 */
export function viewOf(item: SharedKitItem): SharedView | null {
  if (item.source === 'link') {
    if (item.deck !== null) return (CLIENT_PRESENTATION_KEYS as readonly string[]).includes(item.deck) ? { mode: 'deck', deck: item.deck } : null
    return item.url !== null ? { mode: 'link', url: item.url } : null
  }
  const mime = (item.mimeType ?? '').toLowerCase()
  const byType = SHOWN_IN_PAGE[mime]
  if (byType) return { mode: byType }
  if (mime === '' || mime === 'application/octet-stream') {
    const dot = (item.fileName ?? '').lastIndexOf('.')
    const byName = dot < 0 ? undefined : SHOWN_BY_EXTENSION[(item.fileName ?? '').slice(dot + 1).toLowerCase()]
    if (byName) return { mode: byName }
  }

  return { mode: 'download' }
}

/** "54.7 MB", "480 KB": the size of a file, 1 MB being 1,048,576 bytes as everywhere in the app. Null when it is not known. */
export function sizeWords(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/** The site an address goes to, for the words "Opens example.com" under the button, so a visitor sees where the button leads before pressing it. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

/** What a file is called to a visitor who sees only its name: "PowerPoint", "Word document", ... or just "File". */
export function fileWord(fileName: string | null, mimeType: string | null): string {
  const dot = (fileName ?? '').lastIndexOf('.')
  const ext = dot < 0 ? '' : (fileName ?? '').slice(dot + 1).toLowerCase()
  if (['ppt', 'pptx'].includes(ext) || (mimeType ?? '').includes('presentation')) return 'PowerPoint'
  if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) return 'Word document'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'Spreadsheet'
  if (ext === 'txt') return 'Text file'

  return 'File'
}
