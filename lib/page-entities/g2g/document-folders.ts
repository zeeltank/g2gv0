/**
 * Folder and file-kind helpers for the Document Library entity provider.
 *
 * Pure functions over the folder tree the server returns (`GET /api/documents/folders/tree`, which is
 * already limited to the folders the signed-in user may see) and over the fields of a search hit. No
 * folder, name or extension is named here; everything is read from the data it is handed.
 */

export interface FolderNode {
  id: number
  name: string
  parent_id: number | null
  owner_id?: number | null
  department_id?: number | null
  visibility?: string | null
  children: FolderNode[]
}

export interface FlatFolder {
  node: FolderNode
  /** Names from the top-level folder down to this one. */
  path: string[]
}

/** The label for the top level of the library, used in locations. */
export const LIBRARY_ROOT_LABEL = 'Document Library'

/** Lower case, with every run of spaces, underscores, hyphens and dots read as one space. */
export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_\-.\s]+/g, ' ')
    .trim()
}

export function flattenFolders(nodes: FolderNode[], parentPath: string[] = []): FlatFolder[] {
  const out: FlatFolder[] = []

  for (const node of nodes) {
    const path = [...parentPath, node.name.replace(/\s+/g, ' ').trim()]
    out.push({ node, path })
    out.push(...flattenFolders(node.children ?? [], path))
  }

  return out
}

/** "Document Library › Finance › 2026" for a folder id, or the top level for null. Null when unknown. */
export function locationOf(tree: FolderNode[], folderId: number | null | undefined): string | null {
  if (folderId === null || folderId === undefined) return `${LIBRARY_ROOT_LABEL} (top level)`

  const found = flattenFolders(tree).find((flat) => flat.node.id === folderId)

  return found ? [LIBRARY_ROOT_LABEL, ...found.path].join(' › ') : null
}

/** The folder and everything beneath it, as ids. */
export function descendantIds(tree: FolderNode[], folderId: number): number[] {
  const start = flattenFolders(tree).find((flat) => flat.node.id === folderId)?.node
  if (!start) return []

  const ids: number[] = []
  const walk = (node: FolderNode) => {
    ids.push(node.id)
    for (const child of node.children ?? []) walk(child)
  }
  walk(start)

  return ids
}

/**
 * Folders whose name fits what the user said. Names are compared the way a person reads them
 * ("artificial intelligence" = "Artificial  intelligence", "ilovepdf split range" = "ilovepdf_split-range").
 *
 * Exact name matches win outright; otherwise every word of the request must appear in the name.
 */
export function findFoldersByName(tree: FolderNode[], requested: string): FlatFolder[] {
  const wanted = normalizeName(requested)
  if (wanted === '') return []

  const all = flattenFolders(tree)
  const exact = all.filter((flat) => normalizeName(flat.node.name) === wanted)
  if (exact.length > 0) return exact

  const words = wanted.split(' ')

  return all.filter((flat) => {
    const name = normalizeName(flat.node.name)
    return words.every((word) => name.includes(word))
  })
}

// ---- file kinds -----------------------------------------------------------------------------------

export type FileKind = 'spreadsheet' | 'word' | 'pdf' | 'presentation' | 'image' | 'text'

const KIND_WORDS: Array<{ kind: FileKind; words: RegExp }> = [
  { kind: 'spreadsheet', words: /\b(excel|spreadsheets?|sheets?|xlsx|xls|csv|ods)\b/i },
  { kind: 'presentation', words: /\b(powerpoint|presentations?|slides?|pptx?)\b/i },
  { kind: 'pdf', words: /\bpdfs?\b/i },
  { kind: 'word', words: /\b(word\s+(?:documents?|docs?|files?)|docx)\b/i },
  { kind: 'image', words: /\b(images?|pictures?|photos?|png|jpe?g)\b/i },
  { kind: 'text', words: /\b(text\s+files?|txt)\b/i },
]

const KIND_EXTENSIONS: Record<FileKind, string[]> = {
  spreadsheet: ['xlsx', 'xls', 'csv', 'ods'],
  presentation: ['ppt', 'pptx', 'odp'],
  pdf: ['pdf'],
  word: ['doc', 'docx', 'odt', 'rtf'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
  text: ['txt', 'md'],
}

/** The kind of file a sentence asks for ("the excel file"), and the sentence with those words removed. */
export function fileKindIn(text: string): { kind: FileKind; rest: string } | null {
  for (const { kind, words } of KIND_WORDS) {
    if (words.test(text)) return { kind, rest: text.replace(new RegExp(words.source, 'gi'), ' ').replace(/\s+/g, ' ').trim() }
  }

  return null
}

export function extensionOf(fileName: string | null | undefined): string {
  const match = /\.([A-Za-z0-9]{1,6})$/.exec(fileName ?? '')
  return match ? match[1].toLowerCase() : ''
}

/** Whether a search hit is of the kind asked for, by its real file name and mime type. */
export function isFileKind(hit: { original_file_name: string | null; mime_type?: string | null }, kind: FileKind): boolean {
  if (KIND_EXTENSIONS[kind].includes(extensionOf(hit.original_file_name))) return true

  const mime = (hit.mime_type ?? '').toLowerCase()
  if (kind === 'image') return mime.startsWith('image/')
  if (kind === 'pdf') return mime === 'application/pdf'
  if (kind === 'spreadsheet') return mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv'
  if (kind === 'word') return mime.includes('wordprocessingml') || mime === 'application/msword'
  if (kind === 'presentation') return mime.includes('presentation') || mime.includes('powerpoint')

  return false
}

/** Whether a document's name matches what was typed, ignoring case and the spacing/underscore/hyphen differences. */
export function nameMatches(hit: { title: string | null; original_file_name: string | null }, requested: string): boolean {
  const wanted = normalizeName(requested)
  if (wanted === '') return false

  return [hit.title, hit.original_file_name].some((name) => normalizeName(name ?? '').includes(wanted))
}
