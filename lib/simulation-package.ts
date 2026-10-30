/**
 * Simulation Learning - reading a simulation PACKAGE (CONTRACT-v3 section 6) in the browser.
 *
 *   my-simulation.zip
 *     manifest.json    {"schema":"g2g.sim.package/2","spec":"simulation.json","assets":[{id,file,kind,name,licence,credit,source}]}
 *     simulation.json  the specification (g2g.sim/1 or g2g.sim/2)
 *     assets/...       only the files the manifest names
 *     README.md        optional, never read
 *
 * THE SERVER NEVER PARSES AN ARCHIVE; this page does, and a zip is hostile input. So nothing is inflated until the whole table of contents has
 * passed every check, and an entry is inflated only up to the size the contents table declared for it (an entry that expands past that is
 * refused, whatever the table claimed). The rules, all tested with hostile archives in simulation-package.test.ts:
 *
 *   - at most 60 entries (folders and hidden system files count), at most 100 MB declared in all, no ZIP64, no encryption, no links;
 *   - forward-slash relative paths only: no "..", no leading slash or drive letter, no empty or "." folder, no control characters;
 *   - no archive inside the archive (by name, and by the first bytes of every file);
 *   - only manifest.json, simulation.json, README.md and the files the manifest names - anything else is refused (except the hidden
 *     files Mac and Windows add by themselves, which are skipped and reported, never read);
 *   - a model is at most 25 MB and an image 2 MB, and each is what its name and the manifest say it is, by its first bytes.
 *
 * Every refusal is a plain sentence for a customer, with the file it is about. Nothing here touches the network or the page.
 */

import { Inflate } from 'fflate'

export const PACKAGE_SCHEMA = 'g2g.sim.package/2'
export const MANIFEST_FILE = 'manifest.json'
export const SPEC_FILE = 'simulation.json'
export const README_FILE = 'README.md'

const MB = 1024 * 1024

/** The caps of CONTRACT-v3 section 6 (and the field lengths the server holds a file's description to). */
export const PACKAGE_LIMITS = {
  entries: 60,
  assets: 40,
  packageBytes: 100 * MB,
  modelBytes: 25 * MB,
  imageBytes: 2 * MB,
  /** An HDR sky (a Radiance .hdr: the light of a place); a 1K one is about 1.5 MB and a 2K one about 5 MB. */
  hdrBytes: 8 * MB,
  /** The server's cap on a specification (see MAX_SPEC_BYTES in the Add dialog). */
  specBytes: 1_000_000,
  manifestBytes: 256 * 1024,
  readmeBytes: 256 * 1024,
  jsonDepth: 64,
  pathChars: 200,
  segmentChars: 120,
  nameChars: 120,
  licenceChars: 80,
  creditChars: 300,
  sourceChars: 500,
} as const

export type PackageAssetKind = 'model' | 'image' | 'hdr'

export type PackageProblemCode =
  | 'not-a-zip'
  | 'too-big'
  | 'too-many-files'
  | 'unsafe-path'
  | 'nested-archive'
  | 'unsupported'
  | 'duplicate'
  | 'oversize'
  | 'damaged'
  | 'missing'
  | 'unlisted'
  | 'manifest'
  | 'spec'
  | 'asset'

/** One thing wrong with a package, in a sentence a customer can act on. `path` is the file (or the place in a JSON file) it is about. */
export interface PackageProblem {
  code: PackageProblemCode
  message: string
  path?: string
}

/** One file of the package, as the manifest describes it, with its bytes. The licence, credit and source are the manifest's, to be completed on screen. */
export interface PackageAsset {
  id: string
  /** Its path inside the zip. */
  file: string
  kind: PackageAssetKind
  name: string
  licence: string
  credit: string
  source: string
  size: number
  bytes: Uint8Array
}

export interface ReadPackage {
  /** The specification exactly as written in simulation.json (its asset hashes are filled in later). */
  spec: Record<string, unknown>
  assets: PackageAsset[]
  hasReadme: boolean
  /** Hidden system files (Mac, Windows) that were in the zip and were skipped without being read. */
  ignored: string[]
  entryCount: number
  declaredBytes: number
}

export type ReadResult = { ok: true; package: ReadPackage } | { ok: false; problems: PackageProblem[] }

/* ----------------------------------------------------------------------------------------------------------------------- small helpers */

const ID_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/
const ARCHIVE_EXTENSIONS = new Set(['zip', 'jar', 'war', '7z', 'rar', 'gz', 'tgz', 'tar', 'bz2', 'xz', 'lzma', 'z', 'cab', 'iso', 'apk', 'dmg'])
const MODEL_EXTENSIONS = new Set(['glb'])
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp'])
const HDR_EXTENSIONS = new Set(['hdr'])
/** The cap on a file of this kind (the server holds a model to 25 MB, a picture to 2 MB and an HDR sky to 8 MB). */
const capFor = (kind: PackageAssetKind): number => (kind === 'hdr' ? PACKAGE_LIMITS.hdrBytes : kind === 'image' ? PACKAGE_LIMITS.imageBytes : PACKAGE_LIMITS.modelBytes)
const kindWords = (kind: PackageAssetKind): string => (kind === 'hdr' ? 'an HDR sky' : kind === 'image' ? 'an image' : 'a model')

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** "12.4 MB", "340 KB", "92 B": sizes in the words a customer reads. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < MB) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`
}

/** Control characters, and the invisible or direction-changing ones that can make a name read as something it is not. */
const HIDDEN_CHARACTERS = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/

/** A path for a sentence: shortened, so a hostile 10,000-character name cannot fill the screen, and with the hidden characters shown as "?". */
function shown(path: string): string {
  const clean = path.replace(new RegExp(HIDDEN_CHARACTERS.source, 'g'), '?')
  return clean.length > 80 ? `${clean.slice(0, 77)}...` : clean
}

export function extensionOf(path: string): string {
  const base = path.split('/').pop() ?? path
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
}

export function baseNameOf(path: string): string {
  return path.split('/').pop() ?? path
}

/** A fault stops the read at once; it carries the problem to report. */
class Fault extends Error {
  constructor(readonly problem: PackageProblem) {
    super(problem.message)
  }
}

/** Hidden files the operating systems add on their own. They are skipped and reported, never read. */
function isSystemJunk(path: string): boolean {
  const segments = path.split('/')
  const last = (segments[segments.length - 1] ?? '').toLowerCase()
  return segments[0] === '__MACOSX' || last === '.ds_store' || last === 'thumbs.db' || last === 'desktop.ini' || last.startsWith('._')
}

/**
 * Why a path inside the zip cannot be used, or null when it can. `isDirectory` paths have lost their trailing slash already.
 */
export function pathProblem(path: string): string | null {
  if (path === '') return 'has no name'
  if (path.includes('\\')) return 'uses a backslash (\\) in its path; paths in the zip must use forward slashes (/)'
  if (path.startsWith('/')) return 'is an absolute path; files must sit inside the package folder'
  if (/^[A-Za-z]:/.test(path)) return 'starts with a drive letter (such as C:); files must sit inside the package folder'
  if (HIDDEN_CHARACTERS.test(path)) return 'contains a hidden or control character'
  if (/[:*?"<>|]/.test(path)) return 'contains a character that is not allowed in a file name (: * ? " < > |)'
  if (path.length > PACKAGE_LIMITS.pathChars) return `has a path longer than ${PACKAGE_LIMITS.pathChars} characters`
  const segments = path.split('/')
  for (const segment of segments) {
    if (segment === '..') return 'tries to climb out of the package folder with ".."'
    if (segment === '.') return 'has a "." folder in its path'
    if (segment === '') return 'has an empty folder name in its path ("//")'
    if (segment.length > PACKAGE_LIMITS.segmentChars) return `has a file or folder name longer than ${PACKAGE_LIMITS.segmentChars} characters`
  }
  if (ARCHIVE_EXTENSIONS.has(extensionOf(path))) return 'is an archive inside the archive; nested zip files are not allowed'
  return null
}

/* ------------------------------------------------------------------------------------------------------------------------- the zip */

interface ZipEntry {
  /** The path as stored, without a trailing slash for a folder. */
  name: string
  isDirectory: boolean
  flags: number
  method: number
  compressed: number
  size: number
  offset: number
}

const SIG_END = 0x06054b50
const SIG_CENTRAL = 0x02014b50
const SIG_LOCAL = 0x04034b50

/** The first thing a zip must be: its closing record, which sits in the last 22 bytes + a comment of at most 65,535. */
function findEnd(bytes: Uint8Array, view: DataView): number {
  const lowest = Math.max(0, bytes.length - 22 - 0xffff)
  for (let at = bytes.length - 22; at >= lowest; at--) {
    if (view.getUint32(at, true) === SIG_END && at + 22 + view.getUint16(at + 20, true) === bytes.length) return at
  }
  return -1
}

/** The table of contents, checked entry by entry. Nothing is inflated here. Problems are collected so a customer sees them all at once. */
function readContents(bytes: Uint8Array, problems: PackageProblem[]): { entries: ZipEntry[]; dataEnd: number } {
  if (bytes.length < 22) throw new Fault({ code: 'not-a-zip', message: 'That file is not a zip archive. Choose the .zip file of your simulation package.' })
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = findEnd(bytes, view)
  if (end < 0) throw new Fault({ code: 'not-a-zip', message: 'That file is not a zip archive (or it is damaged). Choose the .zip file of your simulation package.' })

  const disk = view.getUint16(end + 4, true)
  const directoryDisk = view.getUint16(end + 6, true)
  const onThisDisk = view.getUint16(end + 8, true)
  const total = view.getUint16(end + 10, true)
  const directorySize = view.getUint32(end + 12, true)
  const directoryOffset = view.getUint32(end + 16, true)

  if (total === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
    throw new Fault({ code: 'unsupported', message: 'This zip uses the ZIP64 format, which is for archives far larger than a simulation package. Zip the files again normally.' })
  }
  if (disk !== 0 || directoryDisk !== 0 || onThisDisk !== total) {
    throw new Fault({ code: 'unsupported', message: 'This zip is split over several files. Zip the package into one file.' })
  }
  if (total > PACKAGE_LIMITS.entries) {
    throw new Fault({
      code: 'too-many-files',
      message: `This zip holds ${total} files and folders; a simulation package may hold at most ${PACKAGE_LIMITS.entries} (the manifest, the simulation, a README and up to ${PACKAGE_LIMITS.assets} models and images).`,
    })
  }
  if (directoryOffset + directorySize > end) throw new Fault({ code: 'damaged', message: 'The zip is damaged: its list of files is cut short. Zip the package again.' })

  const decoder = new TextDecoder('utf-8', { fatal: true })
  const entries: ZipEntry[] = []
  const seen = new Set<string>()
  let declared = 0
  let at = directoryOffset

  for (let index = 0; index < total; index++) {
    if (at + 46 > end || view.getUint32(at, true) !== SIG_CENTRAL) throw new Fault({ code: 'damaged', message: 'The zip is damaged: its list of files cannot be read. Zip the package again.' })
    const madeBy = view.getUint16(at + 4, true)
    const flags = view.getUint16(at + 8, true)
    const method = view.getUint16(at + 10, true)
    const compressed = view.getUint32(at + 20, true)
    const size = view.getUint32(at + 24, true)
    const nameLength = view.getUint16(at + 28, true)
    const extraLength = view.getUint16(at + 30, true)
    const commentLength = view.getUint16(at + 32, true)
    const attributes = view.getUint32(at + 38, true)
    const offset = view.getUint32(at + 42, true)
    const next = at + 46 + nameLength + extraLength + commentLength
    if (next > end) throw new Fault({ code: 'damaged', message: 'The zip is damaged: its list of files runs past its end. Zip the package again.' })

    let raw: string
    try {
      raw = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength))
    } catch {
      problems.push({ code: 'unsafe-path', message: 'A file in the zip has a name that is not readable text. Rename it with plain letters and digits and zip again.' })
      at = next
      continue
    }
    at = next

    const isDirectory = raw.endsWith('/')
    const name = isDirectory ? raw.slice(0, -1) : raw
    const label = shown(raw)
    declared += size

    if ((madeBy >> 8) === 3 && ((attributes >>> 16) & 0o170000) === 0o120000) {
      problems.push({ code: 'unsupported', path: raw, message: `"${label}" is a link; links are not allowed in a package.` })
      continue
    }
    if (isSystemJunk(name)) {
      entries.push({ name, isDirectory, flags, method, compressed, size, offset })
      continue
    }
    const bad = pathProblem(name)
    if (bad) {
      problems.push({ code: /archive inside/.test(bad) ? 'nested-archive' : 'unsafe-path', path: raw, message: `"${label}" ${bad}.` })
      continue
    }
    const key = name.toLowerCase()
    if (seen.has(key)) {
      problems.push({ code: 'duplicate', path: raw, message: `"${label}" appears more than once in the zip (names are compared without capital letters). Keep one.` })
      continue
    }
    seen.add(key)
    if (flags & 1) {
      problems.push({ code: 'unsupported', path: raw, message: `"${label}" is password-protected. Zip the package again without a password.` })
      continue
    }
    if (method !== 0 && method !== 8) {
      problems.push({ code: 'unsupported', path: raw, message: `"${label}" is packed with a method this page cannot read (code ${method}). Zip the package again with the normal setting.` })
      continue
    }
    entries.push({ name, isDirectory, flags, method, compressed, size, offset })
  }

  if (declared > PACKAGE_LIMITS.packageBytes) {
    problems.push({
      code: 'too-big',
      message: `The files in this zip add up to ${formatBytes(declared)} once unpacked; a package may hold at most ${formatBytes(PACKAGE_LIMITS.packageBytes)}.`,
    })
  }
  return { entries, dataEnd: directoryOffset }
}

/** The bytes of one file. A file is inflated only as far as the size the contents table declared for it: more than that is refused. */
function extract(bytes: Uint8Array, entry: ZipEntry, dataEnd: number, ceiling: number): Uint8Array {
  const label = shown(entry.name)
  if (entry.size > ceiling) {
    throw new Fault({ code: 'oversize', path: entry.name, message: `"${label}" is ${formatBytes(entry.size)} once unpacked; the limit for this file is ${formatBytes(ceiling)}.` })
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (entry.offset + 30 > dataEnd || view.getUint32(entry.offset, true) !== SIG_LOCAL) {
    throw new Fault({ code: 'damaged', path: entry.name, message: `"${label}" is damaged inside the zip. Zip the package again.` })
  }
  const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true)
  const finish = start + entry.compressed
  if (finish > dataEnd) throw new Fault({ code: 'damaged', path: entry.name, message: `"${label}" is cut short inside the zip. Zip the package again.` })
  const packed = bytes.subarray(start, finish)

  if (entry.method === 0) {
    if (entry.compressed !== entry.size) throw new Fault({ code: 'damaged', path: entry.name, message: `"${label}" does not match the size the zip declares for it. Zip the package again.` })
    return packed.slice()
  }

  // Deflate, pushed in small pieces so a file that expands without end is stopped after one piece, not after it has filled the memory.
  const parts: Uint8Array[] = []
  let produced = 0
  let overrun = false
  const inflater = new Inflate((chunk) => {
    produced += chunk.length
    if (produced > entry.size) overrun = true
    else parts.push(chunk)
  })
  try {
    const piece = 32 * 1024
    for (let from = 0; from < packed.length && !overrun; from += piece) {
      inflater.push(packed.subarray(from, from + piece), from + piece >= packed.length)
    }
    if (packed.length === 0) inflater.push(new Uint8Array(0), true)
  } catch {
    throw new Fault({ code: 'damaged', path: entry.name, message: `"${label}" cannot be unpacked; the zip is damaged. Zip the package again.` })
  }
  if (overrun) {
    throw new Fault({
      code: 'oversize',
      path: entry.name,
      message: `"${label}" unpacks to more than the ${formatBytes(entry.size)} the zip says it holds. It is refused (the limit for this file is ${formatBytes(ceiling)}).`,
    })
  }
  if (produced !== entry.size) throw new Fault({ code: 'damaged', path: entry.name, message: `"${label}" does not unpack to the size the zip declares for it. Zip the package again.` })
  const out = new Uint8Array(produced)
  let cursor = 0
  for (const part of parts) {
    out.set(part, cursor)
    cursor += part.length
  }
  return out
}

/* ------------------------------------------------------------------------------------------------------------------ what a file is */

export interface Sniffed {
  kind: PackageAssetKind
  mime: string
  /** "a binary glTF 3D model", "a PNG image" */
  label: string
}

/**
 * What a file is, from its first bytes (never its name): a binary glTF 2 model whose header length is the file's own, or a PNG, JPEG or
 * WebP image. `archive` is a zip, gzip, 7z or rar header; null is anything else. A broken model header comes back as `broken`.
 */
export function sniffAsset(bytes: Uint8Array): Sniffed | { archive: true } | { broken: string } | null {
  const at = (...values: number[]) => values.every((value, index) => bytes[index] === value)
  if (at(0x50, 0x4b, 0x03, 0x04) || at(0x50, 0x4b, 0x05, 0x06) || at(0x50, 0x4b, 0x07, 0x08) || at(0x1f, 0x8b) || at(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c) || at(0x52, 0x61, 0x72, 0x21)) {
    return { archive: true }
  }
  if (at(0x67, 0x6c, 0x54, 0x46)) {
    if (bytes.length < 12) return { broken: 'is a 3D model that is cut short' }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const version = view.getUint32(4, true)
    if (version !== 2) return { broken: `is a glTF version ${version} model; only glTF 2 is accepted` }
    if (view.getUint32(8, true) !== bytes.length) return { broken: 'is a 3D model that is cut short, or has something added after its end' }
    return { kind: 'model', mime: 'model/gltf-binary', label: 'a binary glTF (.glb) 3D model' }
  }
  if (at(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { kind: 'image', mime: 'image/png', label: 'a PNG image' }
  if (at(0xff, 0xd8, 0xff)) return { kind: 'image', mime: 'image/jpeg', label: 'a JPEG image' }
  if (at(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return { kind: 'image', mime: 'image/webp', label: 'a WebP image' }
  // a Radiance HDR: "#?RADIANCE" or "#?RGBE" and a newline
  const radiance = [0x23, 0x3f, 0x52, 0x41, 0x44, 0x49, 0x41, 0x4e, 0x43, 0x45, 0x0a]
  const rgbe = [0x23, 0x3f, 0x52, 0x47, 0x42, 0x45, 0x0a]
  if (at(...radiance) || at(...rgbe)) return { kind: 'hdr', mime: 'image/vnd.radiance', label: 'a Radiance HDR image' }
  return null
}

/** How deep a parsed JSON value goes (an object or list holding a value is one deeper), counted without recursion. */
export function jsonDepth(value: unknown): number {
  let deepest = 0
  const stack: [unknown, number][] = [[value, 1]]
  while (stack.length > 0) {
    const [item, depth] = stack.pop() as [unknown, number]
    if (typeof item !== 'object' || item === null) continue
    if (depth > deepest) deepest = depth
    if (depth > PACKAGE_LIMITS.jsonDepth + 1) return deepest
    for (const child of Array.isArray(item) ? item : Object.values(item)) stack.push([child, depth + 1])
  }
  return deepest
}

function parseJsonFile(bytes: Uint8Array, file: string, code: 'manifest' | 'spec'): Record<string, unknown> {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Fault({ code, path: file, message: `${file} is not plain text (UTF-8). Save it as UTF-8 text.` })
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Fault({ code, path: file, message: `${file} is not valid JSON: ${error instanceof Error ? error.message : 'it could not be read'}.` })
  }
  if (!isRecord(parsed)) throw new Fault({ code, path: file, message: `${file} must hold one JSON object ({ ... }).` })
  if (jsonDepth(parsed) > PACKAGE_LIMITS.jsonDepth) {
    throw new Fault({ code, path: file, message: `${file} is nested more than ${PACKAGE_LIMITS.jsonDepth} levels deep, which is more than a simulation needs.` })
  }
  return parsed
}

/* ------------------------------------------------------------------------------------------------------------------- the manifest */

export interface ManifestAsset {
  id: string
  file: string
  kind: PackageAssetKind
  name: string
  licence: string
  credit: string
  source: string
}

/**
 * The manifest, checked. The licence, credit and source may be empty here - they are completed on screen before anything is saved - but every
 * text must be text and within its length. Extra keys are ignored; a missing or wrong documented one is reported by its place in the file.
 */
export function readManifest(manifest: Record<string, unknown>): { assets: ManifestAsset[]; problems: PackageProblem[] } {
  const problems: PackageProblem[] = []
  const bad = (path: string, message: string) => problems.push({ code: 'manifest', path: `${MANIFEST_FILE}: ${path}`, message: `${MANIFEST_FILE}, ${path}: ${message}` })

  if (manifest.schema !== PACKAGE_SCHEMA) {
    bad('"schema"', typeof manifest.schema === 'string' ? `this is "${shown(manifest.schema)}", but this page reads "${PACKAGE_SCHEMA}"` : `must be "${PACKAGE_SCHEMA}"`)
  }
  if (manifest.spec !== SPEC_FILE) bad('"spec"', `must be "${SPEC_FILE}"`)

  const list = manifest.assets === undefined ? [] : manifest.assets
  if (!Array.isArray(list)) {
    bad('"assets"', 'must be a list of the models and images (it can be empty: [])')
    return { assets: [], problems }
  }
  if (list.length > PACKAGE_LIMITS.assets) {
    bad('"assets"', `lists ${list.length} files; a simulation may use at most ${PACKAGE_LIMITS.assets}`)
    return { assets: [], problems }
  }

  const assets: ManifestAsset[] = []
  const ids = new Set<string>()
  const files = new Set<string>()
  const text = (entry: Record<string, unknown>, key: string, max: number, at: string): string => {
    const value = entry[key]
    if (value === undefined || value === null) return ''
    if (typeof value !== 'string') {
      bad(`${at}.${key}`, 'must be text')
      return ''
    }
    const clean = value.trim()
    if (clean.length > max) bad(`${at}.${key}`, `is ${clean.length} characters; the most is ${max}`)
    return clean
  }

  list.forEach((entry, index) => {
    const at = `assets[${index}]`
    if (!isRecord(entry)) {
      bad(at, 'must be an object with id, file, kind, name, licence, credit and source')
      return
    }
    const id = typeof entry.id === 'string' ? entry.id : ''
    if (!ID_PATTERN.test(id)) bad(`${at}.id`, 'must be lowercase letters, digits, "-" and "_", starting with a letter (32 characters at most)')
    else if (ids.has(id)) bad(`${at}.id`, `"${id}" is used twice`)
    ids.add(id)

    const file = typeof entry.file === 'string' ? entry.file : ''
    const fileProblem = file === '' ? 'must name the file inside the zip' : pathProblem(file)
    const reserved = [MANIFEST_FILE, SPEC_FILE, README_FILE].includes(file)
    if (fileProblem) bad(`${at}.file`, `"${shown(file)}" ${fileProblem}`)
    else if (reserved) bad(`${at}.file`, `"${file}" is one of the package's own files, not a model or image`)
    else if (files.has(file.toLowerCase())) bad(`${at}.file`, `"${shown(file)}" is listed twice`)
    files.add(file.toLowerCase())

    const kind = entry.kind
    if (kind !== 'model' && kind !== 'image' && kind !== 'hdr') bad(`${at}.kind`, 'must be "model", "image" or "hdr"')
    else if (file !== '' && !fileProblem) {
      const extension = extensionOf(file)
      const fits = kind === 'model' ? MODEL_EXTENSIONS.has(extension) : kind === 'hdr' ? HDR_EXTENSIONS.has(extension) : IMAGE_EXTENSIONS.has(extension)
      if (!fits) bad(`${at}.kind`, kind === 'model' ? `"${shown(file)}" is listed as a model, but a model file ends in .glb` : kind === 'hdr' ? `"${shown(file)}" is listed as an HDR sky, but an HDR file ends in .hdr` : `"${shown(file)}" is listed as an image, but an image file ends in .png, .jpg or .webp`)
    }

    const name = text(entry, 'name', PACKAGE_LIMITS.nameChars, at) || baseNameOf(file).replace(/\.[^.]*$/, '')
    assets.push({
      id,
      file,
      kind: kind === 'image' ? 'image' : kind === 'hdr' ? 'hdr' : 'model',
      name,
      licence: text(entry, 'licence', PACKAGE_LIMITS.licenceChars, at),
      credit: text(entry, 'credit', PACKAGE_LIMITS.creditChars, at),
      source: text(entry, 'source', PACKAGE_LIMITS.sourceChars, at),
    })
  })
  return { assets, problems }
}

/* --------------------------------------------------------------------------------------------------------------------- the reader */

/** Gives the page a turn between two big files so it stays responsive while a large package unpacks. */
const yieldToPage = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

const startOfFolder = (names: string[]): string | null => {
  const tops = new Set(names.map((name) => (name.includes('/') ? name.split('/')[0] : '')))
  return tops.size === 1 && !tops.has('') ? [...tops][0] : null
}

/**
 * Reads a package. Never throws and never returns half of one: either the whole package, with every file checked, or the list of what is
 * wrong. `bytes` is the zip file as it was chosen.
 */
export async function readPackage(input: Uint8Array | ArrayBuffer): Promise<ReadResult> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  const problems: PackageProblem[] = []
  try {
    if (bytes.length > PACKAGE_LIMITS.packageBytes) {
      throw new Fault({ code: 'too-big', message: `This zip is ${formatBytes(bytes.length)}; a simulation package may be at most ${formatBytes(PACKAGE_LIMITS.packageBytes)}.` })
    }
    const { entries, dataEnd } = readContents(bytes, problems)
    const files = entries.filter((entry) => !entry.isDirectory && !isSystemJunk(entry.name))
    const ignored = entries.filter((entry) => isSystemJunk(entry.name) && !entry.isDirectory).map((entry) => entry.name)
    const byName = new Map(files.map((entry) => [entry.name, entry] as const))

    if (!byName.has(MANIFEST_FILE) && problems.length === 0) {
      const folder = startOfFolder(files.map((entry) => entry.name))
      const nested = folder && byName.has(`${folder}/${MANIFEST_FILE}`)
      problems.push({
        code: 'missing',
        path: MANIFEST_FILE,
        message: nested
          ? `The package files are inside a folder named "${shown(folder)}" in the zip. Open that folder, select the files inside it (manifest.json, simulation.json, assets) and zip those instead.`
          : 'The zip has no manifest.json. A package needs manifest.json and simulation.json at the top level of the zip; start from the sample package.',
      })
    }
    if (!byName.has(SPEC_FILE) && byName.has(MANIFEST_FILE) && problems.length === 0) {
      problems.push({ code: 'missing', path: SPEC_FILE, message: 'The zip has no simulation.json, the file that holds the simulation itself.' })
    }
    // Anything wrong with the table of contents ends the read here, before one byte of any file is unpacked.
    if (problems.length > 0) return { ok: false, problems }

    const manifestEntry = byName.get(MANIFEST_FILE) as ZipEntry
    const manifestFile = parseJsonFile(extract(bytes, manifestEntry, dataEnd, PACKAGE_LIMITS.manifestBytes), MANIFEST_FILE, 'manifest')
    const { assets: listed, problems: manifestProblems } = readManifest(manifestFile)
    problems.push(...manifestProblems)

    // Only the files the manifest names (and the package's own three) may be present.
    const named = new Map(listed.map((asset) => [asset.file, asset] as const))
    for (const entry of files) {
      if (entry.name === MANIFEST_FILE || entry.name === SPEC_FILE || entry.name === README_FILE || named.has(entry.name)) continue
      problems.push({ code: 'unlisted', path: entry.name, message: `"${shown(entry.name)}" is in the zip but manifest.json does not name it. Add it to the manifest, or take it out of the zip.` })
    }
    for (const asset of listed) {
      if (asset.file === '' || byName.has(asset.file) || pathProblem(asset.file) !== null) continue
      const lookalike = files.find((entry) => entry.name.toLowerCase() === asset.file.toLowerCase())
      problems.push({
        code: 'missing',
        path: asset.file,
        message: lookalike
          ? `manifest.json names "${shown(asset.file)}", but the zip has "${shown(lookalike.name)}". Check the capital letters.`
          : `manifest.json names "${shown(asset.file)}" (${asset.id}), but that file is not in the zip.`,
      })
    }
    // Declared sizes are held to their caps now, before anything is unpacked.
    for (const asset of listed) {
      const entry = byName.get(asset.file)
      const cap = capFor(asset.kind)
      if (entry && entry.size > cap) {
        problems.push({ code: 'oversize', path: asset.file, message: `"${shown(asset.file)}" is ${formatBytes(entry.size)}; ${kindWords(asset.kind)} may be at most ${formatBytes(cap)}.` })
      }
    }
    const readme = byName.get(README_FILE)
    if (readme && readme.size > PACKAGE_LIMITS.readmeBytes) {
      problems.push({ code: 'oversize', path: README_FILE, message: `README.md is ${formatBytes(readme.size)}; it may be at most ${formatBytes(PACKAGE_LIMITS.readmeBytes)}.` })
    }
    const specEntry = byName.get(SPEC_FILE) as ZipEntry
    if (specEntry.size > PACKAGE_LIMITS.specBytes) {
      problems.push({ code: 'oversize', path: SPEC_FILE, message: `simulation.json is ${formatBytes(specEntry.size)}; a simulation specification may be at most ${formatBytes(PACKAGE_LIMITS.specBytes)}.` })
    }
    if (problems.length > 0) return { ok: false, problems }

    await yieldToPage()
    const spec = parseJsonFile(extract(bytes, specEntry, dataEnd, PACKAGE_LIMITS.specBytes), SPEC_FILE, 'spec')

    const assets: PackageAsset[] = []
    for (const asset of listed) {
      await yieldToPage()
      const cap = capFor(asset.kind)
      const data = extract(bytes, byName.get(asset.file) as ZipEntry, dataEnd, cap)
      const found = sniffAsset(data)
      const label = shown(asset.file)
      if (found && 'archive' in found) {
        problems.push({ code: 'nested-archive', path: asset.file, message: `"${label}" is itself an archive (a zip, gzip, 7z or rar file); nested archives are not allowed.` })
      } else if (found && 'broken' in found) {
        problems.push({ code: 'asset', path: asset.file, message: `"${label}" ${found.broken}.` })
      } else if (!found) {
        problems.push({ code: 'asset', path: asset.file, message: `"${label}" is not a model, image or HDR sky this system takes. Use a binary glTF (.glb) for a model, a PNG, JPEG or WebP for an image and a Radiance .hdr for an HDR sky.` })
      } else if (found.kind !== asset.kind) {
        problems.push({ code: 'asset', path: asset.file, message: `"${label}" is ${found.label}, but manifest.json lists it as ${kindWords(asset.kind)}.` })
      } else {
        assets.push({ ...asset, size: data.length, bytes: data })
      }
    }
    if (problems.length > 0) return { ok: false, problems }

    return {
      ok: true,
      package: {
        spec,
        assets,
        hasReadme: byName.has(README_FILE),
        ignored,
        entryCount: entries.length,
        declaredBytes: entries.reduce((sum, entry) => sum + entry.size, 0),
      },
    }
  } catch (error) {
    if (error instanceof Fault) return { ok: false, problems: [...problems, error.problem] }
    return { ok: false, problems: [...problems, { code: 'damaged', message: 'The zip could not be read. Zip the package again and choose it once more.' }] }
  }
}
