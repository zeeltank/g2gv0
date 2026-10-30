/**
 * Simulation Learning - the specification of a package, completed from its files (CONTRACT-v3 section 6).
 *
 * `simulation.json` lists the models and images it uses under `assets.models` by id, and may leave out each one's `sha256`: this page works it
 * out from the file the manifest names for that id (SubtleCrypto SHA-256) and writes it in. A `sha256` the author did write must be the file's.
 * Nothing here talks to the network; the fingerprint is the only thing computed from a file's bytes.
 */

import type { PackageAsset } from './simulation-package'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** One thing wrong or worth fixing in a specification: where (a dotted path, null when it is about the whole) and what, in a sentence. */
export interface SpecIssue {
  path: string | null
  message: string
}

/**
 * The runtime reports each problem as one line, "view3d.asset: "x" is not in assets.models", or just the message when it has no place to point at.
 * A path is letters, digits and ". _ - [ ]" with no space, so a message that merely contains a colon is not cut.
 */
export function splitIssue(text: string): SpecIssue {
  const parts = /^([A-Za-z_][\w.[\]-]*): ([\s\S]+)$/.exec(text.trim())
  return parts ? { path: parts[1], message: parts[2] } : { path: null, message: text.trim() }
}

/**
 * The problems this page found and the ones the runtime reported, as one list: ours first, and a runtime line about a place we already
 * reported is dropped (it would say the same thing twice, in other words).
 */
export function combineIssues(ours: readonly SpecIssue[], runtime: readonly string[]): SpecIssue[] {
  const taken = new Set(ours.map((issue) => issue.path).filter((path): path is string => path !== null))
  return [...ours, ...runtime.map(splitIssue).filter((issue) => issue.path === null || !taken.has(issue.path))]
}

/* ------------------------------------------------------------------------------------------------------------------- fingerprints */

/** The SHA-256 of some bytes, as 64 lower-case hex digits. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('This browser cannot compute file fingerprints on this connection. Open the site over https and try again.')
  const digest = new Uint8Array(await subtle.digest('SHA-256', bytes as BufferSource))
  let hex = ''
  for (const byte of digest) hex += byte.toString(16).padStart(2, '0')
  return hex
}

/** The fingerprint of every asset, by its manifest id, one file at a time (a 25 MB model is held once). `onEach` reports how many are done. */
export async function hashAssets(
  assets: readonly Pick<PackageAsset, 'id' | 'bytes'>[],
  onEach?: (done: number, total: number) => void,
  digest: (bytes: Uint8Array) => Promise<string> = sha256Hex,
): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {}
  let done = 0
  for (const asset of assets) {
    hashes[asset.id] = await digest(asset.bytes)
    done += 1
    onEach?.(done, assets.length)
  }
  return hashes
}

/* ------------------------------------------------------------------------------------------------------------------- the filler */

export interface FillResult {
  /** A copy of the specification with each package file's `sha256` (and, for an image or an HDR sky, its `kind`) written in. The original is untouched. */
  spec: Record<string, unknown>
  problems: SpecIssue[]
  /** Files the manifest lists that the specification never names: they are not uploaded. */
  unusedIds: string[]
  /** The ids the specification names that are package files, in the order the specification lists them. */
  usedIds: string[]
}

const short = (hash: string): string => `${hash.slice(0, 10)}...`

/**
 * Writes each package file's fingerprint into the specification's `assets.models` entry of the same id.
 *
 *  - an entry with no `sha256` gets the file's; one with the file's (in any case) is kept; one with another is a problem, said in words;
 *  - an image or an HDR sky the specification lists without `kind` gets `"kind": "image"` or `"kind": "hdr"` (a missing kind means a model), and a kind that disagrees with
 *    the manifest is a problem;
 *  - an entry that names no package file but carries a well-formed `sha256` is left alone - it may name a file already registered for
 *    the organisation or the platform, which the server checks on save; with no `sha256` either, it is a problem.
 */
export function fillAssetHashes(
  spec: Record<string, unknown>,
  assets: readonly Pick<PackageAsset, 'id' | 'file' | 'kind'>[],
  hashes: Readonly<Record<string, string>>,
): FillResult {
  const filled = JSON.parse(JSON.stringify(spec)) as Record<string, unknown>
  const problems: SpecIssue[] = []
  const byId = new Map(assets.map((asset) => [asset.id, asset] as const))
  const used = new Set<string>()
  const usedIds: string[] = []

  let models: unknown[] = []
  const block = filled.assets
  if (block !== undefined) {
    if (!isRecord(block)) problems.push({ path: 'assets', message: 'must be an object like { "models": [ ... ] }' })
    else if (block.models !== undefined) {
      if (Array.isArray(block.models)) models = block.models
      else problems.push({ path: 'assets.models', message: 'must be a list of the models and images the simulation uses' })
    }
  }

  models.forEach((entry, index) => {
    const at = `assets.models.${index}`
    if (!isRecord(entry)) {
      problems.push({ path: at, message: 'must be an object with an "id" (and a "sha256" that is filled in for package files)' })
      return
    }
    const id = typeof entry.id === 'string' ? entry.id : null
    const asset = id === null ? undefined : byId.get(id)
    const given = entry.sha256

    if (!asset) {
      if (given === undefined || given === null || given === '') {
        problems.push({
          path: `${at}.sha256`,
          message: `"${id ?? 'this entry'}" has no sha256 and is not in manifest.json. Add it to the manifest with its file, or give the sha256 of a file that is already registered.`,
        })
      }
      return
    }

    used.add(asset.id)
    usedIds.push(asset.id)
    const fingerprint = hashes[asset.id]
    if (given === undefined || given === null || given === '') {
      entry.sha256 = fingerprint
    } else if (typeof given === 'string' && given.toLowerCase() === fingerprint) {
      entry.sha256 = fingerprint
    } else {
      problems.push({
        path: `${at}.sha256`,
        message: `does not match the file "${asset.file}": the simulation says ${typeof given === 'string' ? short(given) : String(given)} but the file is ${short(fingerprint)}. Delete the "sha256" line and it is filled in for you.`,
      })
    }

    if (entry.kind === undefined) {
      if (asset.kind === 'image' || asset.kind === 'hdr') entry.kind = asset.kind
    } else if (entry.kind !== asset.kind) {
      problems.push({ path: `${at}.kind`, message: `is "${String(entry.kind)}" but manifest.json lists "${asset.file}" as ${asset.kind === 'image' ? 'an image' : asset.kind === 'hdr' ? 'an HDR sky' : 'a model'}.` })
    }
  })

  return { spec: filled, problems, unusedIds: assets.filter((asset) => !used.has(asset.id)).map((asset) => asset.id), usedIds }
}
