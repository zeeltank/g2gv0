/**
 * Client-side discovery for a recursive folder upload — walking a dropped or
 * picked folder's structure, and mapping the result onto resolved
 * `document_folders` ids.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TWO BROWSER APIS, ONE OUTPUT SHAPE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A folder picked via `<input type="file" webkitdirectory>` already carries
 * `webkitRelativePath` on every `File` — no walking needed, just read it off.
 * A folder DROPPED onto the page does not: `DataTransferItem.webkitGetAsEntry()`
 * hands back a `FileSystemEntry` tree that has to be walked by hand
 * (`FileSystemDirectoryReader.readEntries()` must be called repeatedly until
 * it returns empty — a single call is not guaranteed to return everything
 * for a large directory, a well-known gotcha with this API). Both paths
 * converge on the same `DiscoveredFile[]` shape so the upload flow after
 * this point doesn't care which one produced it.
 */

export interface DiscoveredFile {
  /** Relative to the dropped/picked root, e.g. "Payroll/2024/Jan.pdf". No leading slash. */
  relativePath: string
  file: File
}

/** A folder (or files) picked via `<input webkitdirectory multiple>` — each File already knows its own path. */
export function filesFromFileList(fileList: FileList): DiscoveredFile[] {
  return Array.from(fileList).map((file) => ({
    relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    file,
  }))
}

/** A drop — may be plain files, a folder, or a mix. Falls back to flat files if the File System Access API isn't available (older Safari). */
export async function filesFromDataTransfer(dataTransfer: DataTransfer): Promise<DiscoveredFile[]> {
  const items = dataTransfer.items

  if (!items || items.length === 0 || typeof items[0]?.webkitGetAsEntry !== 'function') {
    return Array.from(dataTransfer.files).map((file) => ({ relativePath: file.name, file }))
  }

  const entries: FileSystemEntry[] = []
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry()
    if (entry) entries.push(entry)
  }

  const out: DiscoveredFile[] = []
  await Promise.all(entries.map((entry) => walkEntry(entry, '', out)))

  return out
}

async function walkEntry(entry: FileSystemEntry, prefix: string, out: DiscoveredFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      ;(entry as FileSystemFileEntry).file(resolve, reject)
    })
    out.push({ relativePath: prefix + entry.name, file })
    return
  }

  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    const children = await readAllEntries(reader)
    await Promise.all(children.map((child) => walkEntry(child, `${prefix}${entry.name}/`, out)))
  }
}

function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = []

    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(all)
          return
        }
        all.push(...batch)
        readBatch()
      }, reject)
    }

    readBatch()
  })
}

/** Every distinct directory a set of discovered files touches (not the files themselves) — what `resolveFolderPaths` needs. A file sitting at the root (no "/" in its path) contributes nothing here. */
export function distinctDirectoryPaths(files: DiscoveredFile[]): string[] {
  const dirs = new Set<string>()

  for (const { relativePath } of files) {
    const parts = relativePath.split('/')
    parts.pop() // drop the filename itself
    if (parts.length > 0) dirs.add(parts.join('/'))
  }

  return Array.from(dirs)
}

/**
 * A dropped/picked `.zip` is expanded client-side into the same
 * `DiscoveredFile[]` shape a dropped folder produces — the archive's own
 * internal paths become `relativePath`, so everything downstream (folder
 * resolution, per-file sequential upload) is identical code to the
 * recursive-folder flow above. No new backend endpoint: this is "unzip,
 * then it's just a folder upload."
 *
 * JSZip loads the whole archive into memory to read its central directory,
 * which is the standard client-side approach and fine at the "a user drops
 * one zip of documents" scale this is for — not meant for multi-GB archives.
 * Directory entries (`entry.dir`) and macOS's `__MACOSX/` junk are skipped;
 * everything else is inflated to a `File` so the rest of the pipeline never
 * has to know it came from an archive instead of a real filesystem folder.
 */
export async function filesFromZip(zipFile: File): Promise<DiscoveredFile[]> {
  const JSZip = (await import('jszip')).default
  const archive = await JSZip.loadAsync(zipFile)
  const out: DiscoveredFile[] = []

  const entries = Object.values(archive.files).filter((entry) => !entry.dir && !entry.name.startsWith('__MACOSX/'))

  for (const entry of entries) {
    const blob = await entry.async('blob')
    const name = entry.name.split('/').pop() || entry.name
    out.push({ relativePath: entry.name, file: new File([blob], name, { lastModified: entry.date?.getTime() }) })
  }

  return out
}

/** True for anything the browser or the server would recognise as a zip archive by name or type. */
export function isZipFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed'
}

/**
 * Drop-in replacement for a raw discovered-file list that transparently
 * inlines any `.zip` entries — a zip dropped alongside normal files, a zip
 * nested inside a dropped folder, or just a zip on its own all come out the
 * other end as plain files with no further handling required by the caller.
 * Each zip's own contents are nested under `<its containing dir>/<zip name
 * minus .zip>/...` so two zips with overlapping internal paths (e.g. both
 * contain "Payroll/Jan.pdf") never collide, and so the archive's name is
 * still visible as a folder in the resulting upload (matching what a user
 * would expect from "unzip here").
 */
export async function expandZipFiles(files: DiscoveredFile[]): Promise<DiscoveredFile[]> {
  const out: DiscoveredFile[] = []

  for (const entry of files) {
    if (!isZipFile(entry.file)) {
      out.push(entry)
      continue
    }

    const parts = entry.relativePath.split('/')
    const zipName = parts.pop() as string
    const prefix = [...parts, zipName.replace(/\.zip$/i, '')].join('/')
    const inner = await filesFromZip(entry.file)

    for (const innerEntry of inner) {
      out.push({ relativePath: `${prefix}/${innerEntry.relativePath}`, file: innerEntry.file })
    }
  }

  return out
}

/** Pairs each discovered file with the folder_id its containing directory resolved to (root-level files get `rootFolderId` directly — no lookup needed). */
export function assignFolderIds(
  files: DiscoveredFile[],
  pathToFolderId: Record<string, number>,
  rootFolderId: number | null,
): Array<DiscoveredFile & { folderId: number | null }> {
  return files.map((entry) => {
    const parts = entry.relativePath.split('/')
    parts.pop()
    const dir = parts.join('/')

    return { ...entry, folderId: dir === '' ? rootFolderId : (pathToFolderId[dir] ?? rootFolderId) }
  })
}
