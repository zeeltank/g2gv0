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
