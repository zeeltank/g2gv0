/**
 * Simulation Learning - from a read package to a saved draft: what has to be uploaded, whether it may be, and doing it one file at a time.
 *
 *   planUploads   the manifest + what the customer typed (licence, credit, source, the attestation) -> the ordered uploads, or what is missing
 *   runUploads    one file after another through an `upload` function, with per-file status, a pause when the server says "slow down"
 *                 (429) and the safe retry of only the files that failed (the server stores a file once per owner, so repeating one is harmless)
 *   readLimits    GET /lms/simulations/limits, tolerant of the exact shape (see the note on it)
 *   saveTarget    a new draft, a new version of the draft that already has this id, or a refusal (a published simulation is never replaced here)
 *
 * No network, no page, no clock of its own: everything that talks to the outside is passed in, so it is tested with a mock service.
 */

import { PACKAGE_LIMITS, baseNameOf, formatBytes, type PackageAsset, type PackageAssetKind } from './simulation-package'
import { httpsUrl } from './simulation-host'

/* ------------------------------------------------------------------------------------------------------------------ the plan */

/** What the customer typed for one file; everything starts as the manifest had it. */
export interface AssetEdit {
  licence: string
  credit: string
  source: string
}

/** The text fields of the upload request (the file itself is the multipart `file`). */
export interface UploadMeta {
  licence: string
  credit: string
  name: string
  source?: string
  /**
   * The customer ticked "I may use these files under the licences above". CONTRACT-v3 section 10 says the attestation is stored, but section 7
   * lists no field for it: it is sent as `attested=1` (an additive field the server may read; until it does, it is ignored).
   */
  attested?: boolean
}

export interface UploadStep {
  /** The manifest id. */
  id: string
  file: string
  filename: string
  kind: PackageAssetKind
  sha256: string
  size: number
  bytes: Uint8Array
  meta: UploadMeta
}

export interface UploadPlan {
  steps: UploadStep[]
  /** Reasons the draft cannot be saved yet, each a sentence for the customer. Empty = ready. */
  blockers: string[]
  /** Things worth knowing that do not stop anything. */
  notes: string[]
  bytes: number
}

export const ATTESTATION_TEXT = 'I may use these files under the licences above.'

/** Everything wrong with what was typed for one file, one sentence each (empty when it is fine). */
export function editProblems(edit: AssetEdit, label: string): string[] {
  const problems: string[] = []
  const licence = edit.licence.trim()
  const credit = edit.credit.trim()
  const source = edit.source.trim()
  if (licence === '') problems.push(`${label}: say which licence it is used under (for example CC0 or CC BY 4.0).`)
  else if (licence.length > PACKAGE_LIMITS.licenceChars) problems.push(`${label}: the licence is longer than ${PACKAGE_LIMITS.licenceChars} characters.`)
  if (credit === '') problems.push(`${label}: say who made it (the credit shown to learners).`)
  else if (credit.length > PACKAGE_LIMITS.creditChars) problems.push(`${label}: the credit is longer than ${PACKAGE_LIMITS.creditChars} characters.`)
  if (source !== '' && (httpsUrl(source) === null || source.length > PACKAGE_LIMITS.sourceChars)) {
    problems.push(`${label}: the source must be a web address that starts with https:// (or leave it empty).`)
  }
  return problems
}

/** The first problem with what was typed for one file, or null. */
export function editProblem(edit: AssetEdit, label: string): string | null {
  return editProblems(edit, label)[0] ?? null
}

/**
 * The uploads for the files the specification actually uses, in the order it lists them, and what stops them being made. A file the
 * manifest lists but the specification never names is not uploaded (it would only use up the organisation's space). Two ids that are the
 * same file are uploaded once.
 */
export function planUploads({
  assets,
  usedIds,
  hashes,
  edits,
  attested,
  serverUploadBytes = null,
}: {
  assets: readonly PackageAsset[]
  usedIds: readonly string[]
  hashes: Readonly<Record<string, string>>
  edits: Readonly<Record<string, AssetEdit>>
  attested: boolean
  /** The largest request the server takes (from the limits route); a file over it never reaches the server, so it is said in advance. */
  serverUploadBytes?: number | null
}): UploadPlan {
  const byId = new Map(assets.map((asset) => [asset.id, asset] as const))
  const steps: UploadStep[] = []
  const blockers: string[] = []
  const notes: string[] = []
  const seen = new Set<string>()

  for (const id of usedIds) {
    const asset = byId.get(id)
    const sha256 = hashes[id]
    if (!asset || !sha256 || seen.has(sha256)) continue
    seen.add(sha256)
    const edit = edits[id] ?? { licence: asset.licence, credit: asset.credit, source: asset.source }
    blockers.push(...editProblems(edit, asset.file))
    if (serverUploadBytes !== null && asset.size > serverUploadBytes) {
      blockers.push(
        `${asset.file} is ${formatBytes(asset.size)}, but this server accepts uploads of at most ${formatBytes(serverUploadBytes)}. Use a smaller file, or ask your administrator to raise the server's upload limit.`,
      )
    }
    steps.push({
      id,
      file: asset.file,
      filename: baseNameOf(asset.file),
      kind: asset.kind,
      sha256,
      size: asset.size,
      bytes: asset.bytes,
      meta: {
        licence: edit.licence.trim(),
        credit: edit.credit.trim(),
        name: asset.name,
        ...(edit.source.trim() !== '' ? { source: edit.source.trim() } : {}),
        ...(attested ? { attested: true } : {}),
      },
    })
  }

  if (steps.length > 0 && !attested) blockers.push('Tick the box to confirm you may use these files under the licences above.')
  const unused = assets.filter((asset) => !usedIds.includes(asset.id))
  if (unused.length > 0) {
    notes.push(`${unused.length === 1 ? `"${unused[0].file}" is` : `${unused.length} files are`} in the package but not used by the simulation, so ${unused.length === 1 ? 'it' : 'they'} will not be uploaded.`)
  }
  return { steps, blockers, notes, bytes: steps.reduce((sum, step) => sum + step.size, 0) }
}

/* ---------------------------------------------------------------------------------------------------------------- the uploads */

export type StepStatus =
  | { state: 'waiting' }
  | { state: 'uploading' }
  /** The server asked for a pause (429); the upload is tried again after `seconds`. */
  | { state: 'slow'; seconds: number }
  | { state: 'done'; created: boolean }
  | { state: 'failed'; message: string }

/** What the upload route answers (CONTRACT-v3 section 7). */
export interface UploadedFile {
  sha256: string
  created: boolean
}

/** A sentence for a failure, from whatever the call threw: the server's own message and the first reasons it listed. */
export function describeUploadError(error: unknown, label: string): string {
  const failure = error && typeof error === 'object' ? (error as { message?: unknown; status?: unknown; errors?: unknown; detail?: unknown }) : {}
  if (failure.status === 413) return `${label} is larger than the server accepts.`
  if (failure.status === 401) return 'Your session has expired. Sign in again.'
  if (failure.status === 403) return 'You do not have the right to upload models and images.'
  const reasons: string[] = []
  if (failure.errors && typeof failure.errors === 'object') {
    for (const value of Object.values(failure.errors as Record<string, unknown>)) {
      for (const reason of Array.isArray(value) ? value : [value]) if (typeof reason === 'string' && reason.trim() !== '') reasons.push(reason.trim())
    }
  }
  const message = typeof failure.message === 'string' && failure.message.trim() !== '' ? failure.message.trim() : 'The upload did not go through.'
  const unique = reasons.filter((reason, index) => reasons.indexOf(reason) === index && !message.includes(reason)).slice(0, 3)
  return [message, ...unique].join(' ')
}

const pause = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

/**
 * Uploads the steps one by one, in order. A file that fails does not stop the others (so the customer sees every problem at once), and the
 * result says whether all went through. `previous` carries the statuses of an earlier run: a file already done is not sent again, which is
 * what makes "try again" send only what failed. A 429 is waited out (`throttleMs`, up to `retries` times) rather than reported.
 */
export async function runUploads({
  steps,
  upload,
  onStatus,
  previous = {},
  sleep = pause,
  isCancelled = () => false,
  throttleMs = 15_000,
  retries = 4,
}: {
  steps: readonly UploadStep[]
  upload: (step: UploadStep) => Promise<UploadedFile>
  onStatus: (id: string, status: StepStatus) => void
  previous?: Readonly<Record<string, StepStatus>>
  sleep?: (milliseconds: number) => Promise<void>
  isCancelled?: () => boolean
  throttleMs?: number
  retries?: number
}): Promise<{ ok: boolean; failed: number; finished: boolean }> {
  let failed = 0
  for (const step of steps) {
    const before = previous[step.id]
    if (before?.state === 'done') continue
    onStatus(step.id, { state: 'waiting' })
  }
  for (const step of steps) {
    if (previous[step.id]?.state === 'done') continue
    if (isCancelled()) return { ok: false, failed, finished: false }
    let attempt = 0
    for (;;) {
      onStatus(step.id, { state: 'uploading' })
      try {
        const answer = await upload(step)
        if (answer.sha256 !== step.sha256) {
          throw new Error(`The server stored a file with a different fingerprint than "${step.file}" has here. Try again.`)
        }
        onStatus(step.id, { state: 'done', created: answer.created !== false })
        break
      } catch (error) {
        const status = error && typeof error === 'object' ? (error as { status?: unknown }).status : undefined
        if (status === 429 && attempt < retries) {
          attempt += 1
          onStatus(step.id, { state: 'slow', seconds: Math.round(throttleMs / 1000) })
          await sleep(throttleMs)
          if (isCancelled()) return { ok: false, failed, finished: false }
          continue
        }
        failed += 1
        onStatus(step.id, { state: 'failed', message: describeUploadError(error, step.file) })
        break
      }
    }
  }
  return { ok: failed === 0, failed, finished: true }
}

/* ---------------------------------------------------------------------------------------------------------------------- limits */

/** The limits as the screen uses them. A figure the server did not send is the contract's own (CONTRACT-v3 section 8). */
export interface SimulationLimits {
  specBytes: number
  modelBytes: number
  imageBytes: number
  assetsPerSimulation: number
  quotaFiles: number
  quotaBytes: number
  /** What this organisation has used so far; null when the server did not say. */
  usedFiles: number | null
  usedBytes: number | null
  uploadsPerMinute: number
  /** The largest request the server will take (PHP's upload and post limits); null when it does not say or is not limited. */
  serverUploadBytes: number | null
  /** True when the figures came from the server, false when they are the defaults. */
  fromServer: boolean
}

export const DEFAULT_LIMITS: SimulationLimits = {
  specBytes: PACKAGE_LIMITS.specBytes,
  modelBytes: PACKAGE_LIMITS.modelBytes,
  imageBytes: PACKAGE_LIMITS.imageBytes,
  assetsPerSimulation: PACKAGE_LIMITS.assets,
  quotaFiles: 200,
  quotaBytes: 500 * 1024 * 1024,
  usedFiles: null,
  usedBytes: null,
  uploadsPerMinute: 30,
  serverUploadBytes: null,
  fromServer: false,
}

function dig(root: unknown, path: readonly string[]): unknown {
  let at: unknown = root
  for (const key of path) {
    if (typeof at !== 'object' || at === null) return undefined
    at = (at as Record<string, unknown>)[key]
  }
  return at
}

function figure(root: unknown, paths: readonly (readonly string[])[]): number | null {
  for (const path of paths) {
    const value = dig(root, path)
    const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
    if (typeof number === 'number' && Number.isFinite(number) && number >= 0) return number
  }
  return null
}

/**
 * The limits from GET /lms/simulations/limits. The route returns "the limits as data (spec, asset, quota and this tenant's use)"; its exact
 * keys are the backend's to fix, so each figure is looked for under the names it most likely has (the envelope's `data` is optional) and the
 * contract's own number is used for any that is missing. The figures only inform the screen; the server enforces them on every request.
 *
 * The backend's answer (LmsSimulationController::limits) is `{ status, data: { schemas, engines, spec: { bytes, assets, ... }, asset: { modelBytes,
 * imageBytes, ... }, quota: { files, bytes, uploadsPerMinute }, use: { files, bytes }, server: { uploadMaxBytes } } }`; those are the first names tried.
 */
export function readLimits(payload: unknown): SimulationLimits {
  const root = dig(payload, ['data']) ?? payload
  const read = (paths: readonly (readonly string[])[], fallback: number | null) => figure(root, paths) ?? fallback
  const specBytes = read([['spec', 'max_bytes'], ['spec', 'maxBytes'], ['spec', 'bytes'], ['spec_max_bytes'], ['specBytes']], null)
  const modelBytes = read([['asset', 'model_max_bytes'], ['asset', 'model', 'max_bytes'], ['asset', 'models', 'max_bytes'], ['asset', 'modelBytes'], ['assets', 'model_max_bytes'], ['model_max_bytes'], ['modelBytes']], null)
  const imageBytes = read([['asset', 'image_max_bytes'], ['asset', 'image', 'max_bytes'], ['asset', 'images', 'max_bytes'], ['asset', 'imageBytes'], ['assets', 'image_max_bytes'], ['image_max_bytes'], ['imageBytes']], null)
  const perSimulation = read([['spec', 'max_assets'], ['spec', 'assets'], ['asset', 'max_per_simulation'], ['asset', 'per_simulation'], ['assets_per_simulation'], ['max_assets']], null)
  const quotaFiles = read([['quota', 'files'], ['quota', 'max_files'], ['quota', 'maxFiles'], ['quota_files']], null)
  const quotaBytes = read([['quota', 'bytes'], ['quota', 'max_bytes'], ['quota', 'maxBytes'], ['quota_bytes']], null)
  const usedFiles = read([['use', 'files'], ['usage', 'files'], ['used', 'files'], ['quota', 'used_files'], ['quota', 'usedFiles'], ['used_files']], null)
  const usedBytes = read([['use', 'bytes'], ['usage', 'bytes'], ['used', 'bytes'], ['quota', 'used_bytes'], ['quota', 'usedBytes'], ['used_bytes']], null)
  const perMinute = read([['quota', 'uploadsPerMinute'], ['throttle', 'per_minute'], ['throttle', 'uploads_per_minute'], ['quota', 'uploads_per_minute'], ['uploads_per_minute'], ['uploadsPerMinute']], null)
  const serverUploadBytes = read([['server', 'uploadMaxBytes'], ['server', 'upload_max_bytes']], null)
  const found = [specBytes, modelBytes, imageBytes, perSimulation, quotaFiles, quotaBytes, usedFiles, usedBytes, perMinute, serverUploadBytes].some((value) => value !== null)
  return {
    specBytes: specBytes ?? DEFAULT_LIMITS.specBytes,
    modelBytes: modelBytes ?? DEFAULT_LIMITS.modelBytes,
    imageBytes: imageBytes ?? DEFAULT_LIMITS.imageBytes,
    assetsPerSimulation: perSimulation ?? DEFAULT_LIMITS.assetsPerSimulation,
    quotaFiles: quotaFiles ?? DEFAULT_LIMITS.quotaFiles,
    quotaBytes: quotaBytes ?? DEFAULT_LIMITS.quotaBytes,
    usedFiles,
    usedBytes,
    uploadsPerMinute: perMinute ?? DEFAULT_LIMITS.uploadsPerMinute,
    serverUploadBytes,
    fromServer: found,
  }
}

/**
 * "You have used 12 of 200 files and 41 MB of 500 MB." and, when the package could take the organisation past a limit, a warning. Uploading a
 * file the organisation already holds adds nothing, so the figure for the package is an upper bound and a warning never blocks.
 */
export function describeUse(limits: SimulationLimits, plan: Pick<UploadPlan, 'steps' | 'bytes'> | null): { use: string | null; warning: string | null } {
  const use =
    limits.usedFiles !== null || limits.usedBytes !== null
      ? `Your organisation has used ${limits.usedFiles ?? '?'} of ${limits.quotaFiles} files and ${limits.usedBytes === null ? '?' : formatBytes(limits.usedBytes)} of ${formatBytes(limits.quotaBytes)}.`
      : `Your organisation may keep up to ${limits.quotaFiles} files and ${formatBytes(limits.quotaBytes)} of models and images.`
  const over =
    plan !== null &&
    plan.steps.length > 0 &&
    ((limits.usedFiles !== null && limits.usedFiles + plan.steps.length > limits.quotaFiles) || (limits.usedBytes !== null && limits.usedBytes + plan.bytes > limits.quotaBytes))
  return {
    use,
    warning: over ? `Uploading all ${plan?.steps.length} files (${formatBytes(plan?.bytes ?? 0)}) could take you past your organisation's limit. Files it already holds add nothing; the server will say if the limit is reached.` : null,
  }
}

/* ------------------------------------------------------------------------------------------------------------------- saving */

export interface ExistingSimulation {
  id: number
  slug: string
  title: string
  status: string
  scope: string
}

export type SaveTarget =
  | { kind: 'new' }
  /** The organisation already has a DRAFT with this id: the save adds a new version to it. */
  | { kind: 'new-version'; id: number; title: string }
  /** A published (or archived) simulation has this id: never replaced from here. */
  | { kind: 'refused'; message: string }

/**
 * Where a save goes. The id of the specification is the simulation's identity, so the same id as one the organisation already has is a new
 * version of it - allowed for a draft (the customer's own edit-preview-fix loop), refused for one learners may be using. Platform
 * simulations have their own ids and do not clash.
 */
export function saveTarget(specId: unknown, existing: readonly ExistingSimulation[]): SaveTarget {
  if (typeof specId !== 'string' || specId === '') return { kind: 'new' }
  const same = existing.find((item) => item.scope === 'tenant' && item.slug === specId)
  if (!same) return { kind: 'new' }
  if (same.status === 'draft') return { kind: 'new-version', id: same.id, title: same.title }
  return {
    kind: 'refused',
    message: `Your organisation already has a ${same.status === 'published' ? 'published' : same.status} simulation called "${same.title}" with the id "${specId}". Change the "id" in simulation.json to something new so it is saved as a new simulation.`,
  }
}
