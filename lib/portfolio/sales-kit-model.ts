import type { KitCounts, KitItem, KitKind, KitLibraryHit, KitLimits } from '@/services/product-master/kit-types'

/*
 * What the Sales Kit tab of a Product shows, as plain functions: the filter chips and their counts, the words for a kind and a file, the sizes, the one featured presentation and the
 * quiet rest, which action each entry gets, the words of an empty shelf for a person who only looks and for one who manages, the upload rules and the forms' checks. No React, so
 * every rule is tested without a browser. Words: Sales Kit, Demo presentation, Document, Video, Image. Never the words the vocabulary scan bans for Portfolio screens.
 */

export type KitFilter = 'all' | KitKind

export const KIT_KINDS: readonly KitKind[] = ['presentation', 'document', 'video', 'image']

/** One entry's kind, in the singular. */
export const KIND_WORD: Record<KitKind, string> = { presentation: 'Demo presentation', document: 'Document', video: 'Video', image: 'Image' }
/** A kind, in the plural, for the filter chips. */
export const KIND_PLURAL: Record<KitKind, string> = { presentation: 'Demo presentations', document: 'Documents', video: 'Videos', image: 'Images' }

/** A video bigger than this is offered as a download, not played: the player holds the whole file in memory. */
export const VIDEO_PLAY_LIMIT_BYTES = 100 * 1024 * 1024
/** A picture bigger than this gets the file glyph instead of a thumbnail: the thumbnail is the whole file read into the page. */
export const THUMBNAIL_LIMIT_BYTES = 12 * 1024 * 1024

export const MISSING_TEXT = 'File no longer in the Document Library'

/** The extensions of a server that did not send its list. */
export const DEFAULT_EXTENSIONS: readonly string[] = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'csv', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov']

// ---------------------------------------------------------------------------------------------------------------------------- chips, filter, sort

export interface KitChip { id: KitFilter; label: string; count: number }

/** All, then each kind, each with how many there are. A kind with none is still drawn: it tells a manager what the shelf can hold. */
export function kitChips(counts: KitCounts): KitChip[] {
  return [{ id: 'all', label: 'All', count: counts.all }, ...KIT_KINDS.map((kind) => ({ id: kind, label: KIND_PLURAL[kind], count: counts[kind] }))]
}

export const isKitFilter = (value: string | null | undefined): value is KitFilter => value === 'all' || (KIT_KINDS as readonly string[]).includes(value ?? '')

export function filterItems(items: readonly KitItem[], filter: KitFilter): KitItem[] {
  return filter === 'all' ? [...items] : items.filter((item) => item.kind === filter)
}

/** The order a person is told: the manager's order first, then the newest. The server sends it this way; this keeps it so after a change made on the page. */
export function sortItems(items: readonly KitItem[]): KitItem[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
}

export interface Shelf {
  /** The first presentation, drawn large with its main action. Only on All and on Demo presentations, and never a file that is gone. */
  featured: KitItem | null
  rest: KitItem[]
}

export function shelfOf(items: readonly KitItem[], filter: KitFilter): Shelf {
  const sorted = sortItems(filterItems(items, filter))
  const featured = filter === 'all' || filter === 'presentation' ? sorted.find((item) => item.kind === 'presentation' && !item.missing) ?? null : null
  return { featured, rest: featured ? sorted.filter((item) => item !== featured) : sorted }
}

// ---------------------------------------------------------------------------------------------------------------------------- files

export function extensionOf(fileName: string | null | undefined): string {
  const name = (fileName ?? '').trim()
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}

export type FileFamily = 'powerpoint' | 'pdf' | 'word' | 'excel' | 'text' | 'image' | 'video' | 'other'

export function fileFamily(file: { fileName: string | null; mimeType: string | null }): FileFamily {
  const ext = extensionOf(file.fileName)
  const mime = (file.mimeType ?? '').toLowerCase()
  if (['ppt', 'pptx'].includes(ext) || mime.includes('presentation') || mime === 'application/vnd.ms-powerpoint') return 'powerpoint'
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) || mime.startsWith('image/')) return 'image'
  if (['mp4', 'webm', 'mov'].includes(ext) || mime.startsWith('video/')) return 'video'
  if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) return 'word'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel'
  if (ext === 'txt') return 'text'
  return 'other'
}

/** "54.7 MB", "480 KB", "12 B"; null when the size is not known. One megabyte is 1,048,576 bytes, as everywhere else in the app. */
export function sizeText(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/** The upload limit in words, from the server's kilobytes: 102400 is "100 MB". */
export function uploadLimitText(maxUploadKb: number): string {
  if (maxUploadKb >= 1024) {
    const mb = maxUploadKb / 1024
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`
  }

  return `${maxUploadKb} KB`
}

/** "PDF, DOC and MP4": the extensions the server takes, in its order, upper case, each once. */
export function acceptedExtensionsText(extensions: readonly string[] | null | undefined): string {
  const list = [...new Set((extensions && extensions.length > 0 ? extensions : DEFAULT_EXTENSIONS).map((e) => e.replace(/^\./, '').toUpperCase()))]
  return list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

/** For the file box's `accept`: ".pdf,.doc,...". */
export const acceptAttribute = (extensions: readonly string[] | null | undefined): string => (extensions && extensions.length > 0 ? extensions : DEFAULT_EXTENSIONS).map((e) => `.${e.replace(/^\./, '')}`).join(',')

/** Why a file cannot be added, in a sentence a person can act on; null when it can. The server checks the same rules again. */
export function checkFile(file: { name: string; size: number }, limits: KitLimits): string | null {
  const allowed = (limits.extensions.length > 0 ? limits.extensions : DEFAULT_EXTENSIONS).map((e) => e.toLowerCase())
  if (!allowed.includes(extensionOf(file.name))) return `"${file.name}" is not a type the Sales Kit takes. It takes ${acceptedExtensionsText(limits.extensions)}.`
  if (file.size <= 0) return `"${file.name}" is empty.`
  if (file.size > limits.maxUploadKb * 1024) return `"${file.name}" is ${sizeText(file.size)}, over the ${uploadLimitText(limits.maxUploadKb)} limit.`

  return null
}

/** The kind the server gives a file from its extension. */
export function defaultKindForFile(fileName: string): KitKind {
  const family = fileFamily({ fileName, mimeType: null })
  return family === 'powerpoint' ? 'presentation' : family === 'image' ? 'image' : family === 'video' ? 'video' : 'document'
}

/** The kinds a person may choose for a file: a PDF or a PowerPoint is a presentation or a document, any other file has the one kind its type says. */
export function kindChoicesForFile(fileName: string): KitKind[] {
  const family = fileFamily({ fileName, mimeType: null })
  return family === 'pdf' || family === 'powerpoint' ? ['presentation', 'document'] : [defaultKindForFile(fileName)]
}

/** The title a file gets when nobody types one: its name without the extension. */
export function titleFromFileName(fileName: string): string {
  const name = fileName.trim()
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

// ---------------------------------------------------------------------------------------------------------------------------- words and tiles

/** What the entry is, in the words a person uses for it. */
export function typeWord(item: KitItem): string {
  if (item.source === 'link') return item.kind === 'presentation' ? 'Interactive deck' : item.kind === 'video' ? 'Video link' : 'Link'
  const family = fileFamily(item)
  switch (family) {
    case 'powerpoint': return 'PowerPoint'
    case 'pdf': return 'PDF'
    case 'word': return 'Word document'
    case 'excel': return 'Spreadsheet'
    case 'text': return 'Text file'
    case 'image': return 'Image'
    case 'video': return 'Video'
    default: return KIND_WORD[item.kind]
  }
}

export type TileKind = 'thumbnail' | 'file' | 'link' | 'video' | 'missing'

/** What a tile draws on its left: a picture for an image, the file glyph for a file, a play tile for a video, a link tile for an address, a plain note for a file that is gone. */
export function tileOf(item: KitItem): TileKind {
  if (item.missing) return 'missing'
  if (item.source === 'link') return 'link'
  const family = fileFamily(item)
  if (family === 'image') return item.size !== null && item.size > THUMBNAIL_LIMIT_BYTES ? 'file' : 'thumbnail'
  return family === 'video' ? 'video' : 'file'
}

/** An address that is safe to put in a link: an `https://` address or an app path that starts with one `/`. Anything else gets no link. */
export function linkHref(url: string | null | undefined): string | null {
  const value = (url ?? '').trim()
  if (/^https:\/\/\S+$/i.test(value)) return value
  return /^\/(?!\/)\S*$/.test(value) ? value : null
}

export type KitActionId = 'open-link' | 'download' | 'preview' | 'play'
export interface KitAction { id: KitActionId; label: string }

/**
 * The one main action of an entry. An address opens in a new tab (the interactive deck is called so), a PowerPoint is downloaded, a PDF or a picture is previewed, a video is played unless it
 * is too big to hold in the page, and any other file is downloaded. A file that is gone, and an address that is not safe to open, have none.
 */
export function primaryAction(item: KitItem): KitAction | null {
  if (item.missing) return null
  if (item.source === 'link') return linkHref(item.url) === null ? null : { id: 'open-link', label: item.kind === 'presentation' ? 'Open interactive deck' : 'Open link' }
  switch (fileFamily(item)) {
    case 'powerpoint': return { id: 'download', label: 'Download PowerPoint' }
    case 'pdf': return { id: 'preview', label: 'Preview PDF' }
    case 'image': return { id: 'preview', label: 'Preview image' }
    case 'video': return item.size !== null && item.size > VIDEO_PLAY_LIMIT_BYTES ? { id: 'download', label: 'Download video' } : { id: 'play', label: 'Play video' }
    default: return { id: 'download', label: 'Download' }
  }
}

/** A file that is previewed or played can also be saved. */
export function secondaryAction(item: KitItem): KitAction | null {
  const main = primaryAction(item)
  return main && (main.id === 'preview' || main.id === 'play') ? { id: 'download', label: 'Download' } : null
}

/** "Added by Asha Rao on 20 Nov 2026"; the date alone when nobody is named. */
export function addedText(item: Pick<KitItem, 'createdAt' | 'createdByName'>): string {
  const day = new Date(`${(item.createdAt || '').slice(0, 10)}T00:00:00`)
  const date = Number.isNaN(day.getTime()) ? null : day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  if (!date) return item.createdByName ? `Added by ${item.createdByName}` : ''

  return item.createdByName ? `Added by ${item.createdByName} on ${date}` : `Added on ${date}`
}

/** The name a saved file gets. */
export const downloadName = (item: KitItem): string => item.fileName || item.title || 'file'

// ---------------------------------------------------------------------------------------------------------------------------- the empty shelf

export interface EmptyText { title: string; description: string }

/**
 * What an empty shelf says. A person who only looks is told what will appear here and that the team adds it; a person who manages is told how to add the first, and which way each of the
 * three works. A kind with nothing in it says so and points back to All.
 */
export function emptyText({ filter, canAdd, total }: { filter: KitFilter; canAdd: boolean; total: number }): EmptyText {
  if (total === 0) {
    return canAdd
      ? { title: 'Start the Sales Kit', description: 'Upload a deck, a PDF, a video or a picture, add a link to a web deck, or pick a document that is already in the Document Library. Everyone who may open this Sales Kit sees it.' }
      : { title: 'The Sales Kit is empty', description: 'Demo presentations, documents, videos and images for this product will appear here once your team adds them.' }
  }
  const what = filter === 'all' ? 'anything' : KIND_PLURAL[filter].toLowerCase()
  return canAdd
    ? { title: `No ${what} yet`, description: 'Use Add to Sales Kit to put one here, or choose All to see the rest.' }
    : { title: `No ${what} yet`, description: 'Your team has not added any to this product. Choose All to see what is here.' }
}

// ---------------------------------------------------------------------------------------------------------------------------- forms

export const TITLE_MAX = 191
export const DESCRIPTION_MAX = 500

export const LINK_RULE = 'Use an address that starts with https:// or a path that starts with /.'

export interface EntryFormErrors { title?: string; url?: string; description?: string }

/** The checks the server makes on a title, an address and a description, so the form says so before it asks. `url` is checked only when given (a link). */
export function entryFormErrors(form: { title: string; description?: string; url?: string }): EntryFormErrors {
  const errors: EntryFormErrors = {}
  if (form.title.trim() === '') errors.title = 'Give it a title.'
  else if (form.title.trim().length > TITLE_MAX) errors.title = `Keep the title under ${TITLE_MAX} characters.`
  if ((form.description ?? '').trim().length > DESCRIPTION_MAX) errors.description = `Keep this under ${DESCRIPTION_MAX} characters.`
  if (form.url !== undefined) {
    const url = form.url.trim()
    if (url === '') errors.url = 'Paste the address.'
    else if (linkHref(url) === null) errors.url = LINK_RULE
    else if (url.length > 500) errors.url = 'Keep the address under 500 characters.'
  }

  return errors
}

// ---------------------------------------------------------------------------------------------------------------------------- from the Document Library

/** Who can open a library document, in words. */
export function visibilityText(hit: Pick<KitLibraryHit, 'visibility' | 'ownedByMe'>): string {
  if (hit.visibility === 'organization') return 'Shared with your organisation'
  return hit.ownedByMe ? 'Only you can open it' : 'Not shared with your organisation'
}

export interface ShareDecision {
  /** The document can be added now (given the answer to the sharing question, if there is one). */
  canAdd: boolean
  /** The caller must say yes to sharing it with the organisation first. */
  needsAgreement: boolean
  /** Send `makeShared: true` with the add. */
  makeShared: boolean
  /** A sentence under the choice, or null. */
  note: string | null
}

/**
 * A colleague who cannot open a document would see "no access" on a card, so a document that is not shared with the organisation is added only when its owner agrees to share it. Anybody
 * else's document that is not shared cannot be added at all: only its owner can share it.
 */
export function shareDecision(hit: Pick<KitLibraryHit, 'visibility' | 'ownedByMe'>, agreed: boolean): ShareDecision {
  if (hit.visibility === 'organization') return { canAdd: true, needsAgreement: false, makeShared: false, note: null }
  if (hit.ownedByMe) return { canAdd: agreed, needsAgreement: true, makeShared: agreed, note: 'Only you can open this document now. Share it with your organisation so colleagues can open it from the Sales Kit.' }

  return { canAdd: false, needsAgreement: false, makeShared: false, note: 'Only its owner can share it with your organisation. Ask them to share it, then add it here.' }
}
