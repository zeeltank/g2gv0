import { unzip, type Unzipped } from 'fflate'

/**
 * Turns whatever the user dropped or picked (loose files, folders, zips,
 * zips inside zips) into a flat list of plain files the upload endpoint will
 * accept, plus a list of per-file reasons for everything that was left out.
 *
 * Nothing in here throws for a bad input - a bad file goes to `skipped`.
 */

export interface ExpandedFile {
  file: File
  /** Folder / zip path shown to the user, e.g. `Archive/2026/notice.pdf`. Equals the name for a loose file. */
  path: string
}

export interface ExpandResult {
  files: ExpandedFile[]
  skipped: string[]
}

/** Mirrors config('documents.allowed_extensions') on the server - a file outside this list would only be rejected with a 422. */
const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  txt: 'text/plain',
  csv: 'text/csv',
  rtf: 'application/rtf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

const SUPPORTED_TEXT = 'PDF, Word, Excel, PowerPoint, text, CSV and images'
export const MAX_FILE_BYTES = 50 * 1024 * 1024
export const MAX_BATCH_FILES = 200
const MAX_UNPACKED_BYTES = 500 * 1024 * 1024
const MAX_ZIP_DEPTH = 6

function extOf(name: string): string {
  const base = name.split('/').pop() ?? name
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
}

function baseName(path: string): string {
  return path.split('/').pop() ?? path
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isJunk(path: string): boolean {
  const segments = path.split('/').filter(Boolean)
  if (segments.includes('__MACOSX')) return true
  const name = segments[segments.length - 1] ?? ''
  return name.startsWith('.') || name.toLowerCase() === 'thumbs.db' || name.startsWith('~$')
}

function isZip(name: string, mime?: string): boolean {
  return extOf(name) === 'zip' || mime === 'application/zip' || mime === 'application/x-zip-compressed'
}

/** Why a plain file cannot be uploaded, or null when it is fine. */
function rejectReason(name: string, size: number): string | null {
  const ext = extOf(name)
  if (!ext) {
    return `it has no file extension, so its type could not be identified. Supported types are ${SUPPORTED_TEXT}`
  }
  if (!MIME_BY_EXT[ext]) {
    return `.${ext} files are not supported. Supported types are ${SUPPORTED_TEXT}`
  }
  if (size === 0) return 'the file is empty (0 bytes)'
  if (size > MAX_FILE_BYTES) {
    return `the file is ${formatBytes(size)}, which is over the ${MAX_FILE_BYTES / 1024 / 1024} MB limit`
  }
  return null
}

function skipText(path: string, reason: string): string {
  return `${path}: could not be added because ${reason}.`
}

function extractFail(path: string, reason: string): string {
  return `${path}: could not be extracted because ${reason}.`
}

function describeUnzipError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? '')
  if (/encrypt|password/i.test(message)) return 'it is password protected'
  if (/invalid zip|unknown compression|unexpected|end of data|unterminated/i.test(message)) {
    return 'it is damaged or not a valid zip'
  }
  return `it could not be opened (${message || 'unknown error'})`
}

function unzipAsync(
  data: Uint8Array,
  filter: (entry: { name: string; size: number; originalSize: number }) => boolean,
): Promise<Unzipped> {
  return new Promise((resolve, reject) => {
    unzip(data, { filter }, (err, out) => (err ? reject(err) : resolve(out)))
  })
}

interface Budget {
  remaining: number
}

async function expandZip(
  zip: File | Uint8Array,
  label: string,
  depth: number,
  budget: Budget,
  out: ExpandedFile[],
  skipped: string[],
): Promise<void> {
  if (depth > MAX_ZIP_DEPTH) {
    skipped.push(skipText(label, `it is nested more than ${MAX_ZIP_DEPTH} zips deep`))
    return
  }

  let bytes: Uint8Array
  try {
    bytes = zip instanceof Uint8Array ? zip : new Uint8Array(await zip.arrayBuffer())
  } catch {
    skipped.push(skipText(label, 'the file could not be read. It may be open in another program, deleted, or blocked by permissions'))
    return
  }

  // Pass 1: list entries only (filter returns false) so nothing is inflated.
  const listing: Array<{ name: string; size: number; originalSize: number }> = []
  try {
    await unzipAsync(bytes, (entry) => {
      listing.push({ name: entry.name, size: entry.size, originalSize: entry.originalSize })
      return false
    })
  } catch (err) {
    skipped.push(extractFail(label, describeUnzipError(err)))
    return
  }

  // Decide per entry, never decompressing a rejected one.
  const approved = new Set<string>()
  for (const entry of listing) {
    if (entry.name.endsWith('/')) continue // directory marker
    if (isJunk(entry.name)) continue
    const path = `${label}/${entry.name}`
    const size = entry.originalSize

    if (isZip(entry.name)) {
      if (size === 0) {
        skipped.push(skipText(path, 'the nested zip is empty'))
        continue
      }
      if (size > MAX_FILE_BYTES) {
        skipped.push(skipText(path, `the nested zip is ${formatBytes(size)}, which is over the ${MAX_FILE_BYTES / 1024 / 1024} MB limit`))
        continue
      }
    } else {
      const reason = rejectReason(entry.name, size)
      if (reason) {
        skipped.push(skipText(path, reason))
        continue
      }
    }

    if (size > budget.remaining) {
      skipped.push(skipText(path, 'the archive budget was exceeded. A batch can unpack at most 500 MB across all zips'))
      continue
    }
    budget.remaining -= size
    approved.add(entry.name)
  }

  if (approved.size === 0) return

  // Pass 2: inflate only what was approved.
  let files: Unzipped
  try {
    files = await unzipAsync(bytes, (entry) => approved.has(entry.name))
  } catch (err) {
    skipped.push(extractFail(label, describeUnzipError(err)))
    return
  }

  for (const [name, data] of Object.entries(files)) {
    const path = `${label}/${name}`
    if (isZip(name)) {
      await expandZip(data, path.replace(/\.zip$/i, ''), depth + 1, budget, out, skipped)
      continue
    }
    const ext = extOf(name)
    const copy = new Uint8Array(data) // detach from fflate's shared buffer
    out.push({ file: new File([copy], baseName(name), { type: MIME_BY_EXT[ext] ?? '' }), path })
  }
}

/** Plain files pass through, zips are opened, everything else is validated. Returns only uploadable files. */
export async function expandForUpload(input: ExpandedFile[]): Promise<ExpandResult> {
  const files: ExpandedFile[] = []
  const skipped: string[] = []
  const budget: Budget = { remaining: MAX_UNPACKED_BYTES }

  for (const item of input) {
    if (isJunk(item.path)) continue

    if (isZip(item.file.name, item.file.type)) {
      await expandZip(item.file, item.path.replace(/\.zip$/i, ''), 1, budget, files, skipped)
      continue
    }

    const reason = rejectReason(item.file.name, item.file.size)
    if (reason) {
      skipped.push(skipText(item.path, reason))
      continue
    }

    // Browsers sometimes leave type empty (or wrong) - decide by extension.
    const ext = extOf(item.file.name)
    const file = item.file.type === MIME_BY_EXT[ext]
      ? item.file
      : new File([item.file], item.file.name, { type: MIME_BY_EXT[ext] })
    files.push({ file, path: item.path })
  }

  // Cap the batch, one message per file over the limit.
  if (files.length > MAX_BATCH_FILES) {
    const over = files.splice(MAX_BATCH_FILES)
    for (const f of over) {
      skipped.push(skipText(f.path, `a batch can hold at most ${MAX_BATCH_FILES} files. Upload the rest in another batch`))
    }
  }

  return { files, skipped }
}

export function collectFromInput(list: FileList): ExpandedFile[] {
  return Array.from(list).map((file) => ({
    file,
    path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }))
}

const FOLDER_UNREADABLE =
  'the folder could not be read. It may have been moved, or your browser may not have permission to open it'
const FILE_UNREADABLE =
  'the file could not be read. It may be open in another program, deleted, or blocked by permissions'

function readEntriesBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject))
}

function entryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject))
}

async function walkEntry(entry: FileSystemEntry, out: ExpandedFile[], skipped: string[]): Promise<void> {
  const path = entry.fullPath.replace(/^\//, '')

  if (entry.isFile) {
    try {
      out.push({ file: await entryFile(entry as FileSystemFileEntry), path })
    } catch {
      skipped.push(skipText(path, FILE_UNREADABLE))
    }
    return
  }

  try {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    // readEntries returns chunks - keep going until it returns an empty batch.
    for (;;) {
      const batch = await readEntriesBatch(reader)
      if (batch.length === 0) break
      for (const child of batch) await walkEntry(child, out, skipped)
    }
  } catch {
    skipped.push(skipText(path, FOLDER_UNREADABLE))
  }
}

/** Reads a drop, including folders. `dt.items` / `dt.files` are read synchronously before the first await - the browser empties the DataTransfer afterwards. */
export async function collectFromDrop(dt: DataTransfer): Promise<ExpandResult> {
  const entries: FileSystemEntry[] = []
  const looseFiles: File[] = []

  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== 'file') continue
    const entry = item.webkitGetAsEntry?.()
    if (entry) entries.push(entry)
    else {
      const f = item.getAsFile()
      if (f) looseFiles.push(f)
    }
  }
  const fallbackFiles = entries.length === 0 && looseFiles.length === 0 ? Array.from(dt.files ?? []) : []

  const files: ExpandedFile[] = []
  const skipped: string[] = []

  for (const entry of entries) await walkEntry(entry, files, skipped)
  for (const f of [...looseFiles, ...fallbackFiles]) files.push({ file: f, path: f.name })

  return { files, skipped }
}
