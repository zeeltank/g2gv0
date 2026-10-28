/**
 * How this page talks to the Simulation Runtime that plays a simulation inside an iframe.
 *
 * The runtime is a separate, generic page (the `g2g-sim-runtime` build served from /sim-runtime/) that plays whatever `g2g.sim/1`
 * specification it is handed. It is embedded in a sandboxed frame WITHOUT `allow-same-origin`, so it runs on an opaque origin: it cannot read
 * this page's localStorage (where the login token lives), its cookies or its DOM, and it has no credentials of its own. The only thing that
 * crosses is a message, and each side checks it:
 *
 *   runtime -> host   { src: 'g2g-course', lesson, type: 'ready' }                                      listening, send me the specification
 *                     { src: 'g2g-course', lesson, type: 'spec', ok, issues[] }                          the verdict on a specification I was sent
 *                     { src: 'g2g-course', lesson, type: 'progress' | 'completed', step, percent, snapshot? }
 *                     { src: 'g2g-course', lesson, type: 'event', name, seq, payload, ts }               (not stored yet)
 *                     { src: 'g2g-course', lesson, type: 'assets-needed', models: [{ id, sha256 }] }    send me these 3D model files
 *   host -> runtime   { src: 'g2g-host', type: 'init', spec, resume? }                                   play this
 *                     { src: 'g2g-host', type: 'pause' | 'resume' }
 *                     { src: 'g2g-host', type: 'asset', sha256, bytes: ArrayBuffer, credit?, kind?, mime? }  one file (the buffer is transferred)
 *                     { src: 'g2g-host', type: 'asset-missing', sha256, reason? }                      a file that cannot be provided
 *
 * 3D MODELS AND IMAGES. They are private objects behind the API, which the frame (no login, opaque origin) can never call. A specification
 * names its files in `assets.models` ([{ id, sha256, name? }]); the runtime asks for them by hash, in requests of at most 8 and when it needs
 * them, and the host fetches ONLY a hash that the specification it holds names - never one the frame makes up - then hands the bytes over.
 * `kind` is 'model' or 'image' and `mime` the response's type when it is a known one. The runtime checks the SHA-256 of what it gets.
 * Downloads are limited to 3 at a time for the whole player (not per request), 25 MB for a model and 3 MB for an image.
 *
 * AUTHENTICATING A MESSAGE. A sandboxed frame's origin is "null", so the origin cannot tell one frame from another; the host therefore accepts
 * a message only when `event.source` is the very window of the iframe IT created, and only when it carries the lesson id it asked for. The
 * host's messages go to the frame with target origin "*" because an opaque origin cannot be named - safe here because the window is a reference
 * to our own frame and what is sent is the simulation specification the person is about to play and the model files it names, never a token. The runtime, in turn, is told
 * this page's origin (`from=`) and posts only to it.
 */

export const SIM_RUNTIME_URL = process.env.NEXT_PUBLIC_SIM_RUNTIME_URL || '/sim-runtime/index.html'

/** Sandbox flags for the frame. No `allow-same-origin`, no top navigation, no forms; popups only so a model-credit link can open. */
export const SIM_FRAME_SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox'

/** A 3D model file is named by the SHA-256 of its bytes, in lower-case hex. */
export const SHA256_PATTERN = /^[a-f0-9]{64}$/
/** The most models one `assets-needed` request may name; a longer one is ignored whole. */
export const MAX_MODELS_PER_REQUEST = 8
/** How many model files are downloaded at the same time. */
export const MAX_ASSET_DOWNLOADS_IN_PARALLEL = 3
/** The largest 3D model file this page will download (the server holds them to far less). */
export const MAX_ASSET_BYTES = 25 * 1024 * 1024
/** The largest image (photograph or diagram) this page will download. */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024
/** The largest HDR sky (a Radiance .hdr: the light of a place) this page will download; the server holds one to 8 MB. */
export const MAX_HDR_BYTES = 8 * 1024 * 1024
const MAX_MODEL_ID_CHARS = 200

/** What a registered file is: a 3D model (`.glb`), a picture, or an HDR sky (a Radiance `.hdr`). A file whose kind is not said is a model. */
export type AssetKind = 'model' | 'image' | 'hdr'

/** The file types handed to the runtime with a `mime`: the ones the API serves for models and images. Any other type is not passed on. */
const KNOWN_MODEL_MIMES: ReadonlySet<string> = new Set(['model/gltf-binary'])
const KNOWN_IMAGE_MIMES: ReadonlySet<string> = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'])
const KNOWN_HDR_MIMES: ReadonlySet<string> = new Set(['image/vnd.radiance'])

/** The media type of a Content-Type value, lower-case and without parameters ("Image/PNG; charset=x" -> "image/png"); null when there is none. */
export function mediaType(contentType: string | null | undefined): string | null {
  if (typeof contentType !== 'string') return null
  const type = contentType.split(';')[0].trim().toLowerCase()
  return type === '' ? null : type
}

/** The media type of a response when it is a known image or model type, otherwise null (nothing is guessed from an unfamiliar type). */
export function knownAssetMime(contentType: string | null | undefined): string | null {
  const type = mediaType(contentType)
  return type !== null && (KNOWN_MODEL_MIMES.has(type) || KNOWN_IMAGE_MIMES.has(type) || KNOWN_HDR_MIMES.has(type)) ? type : null
}

/**
 * What a file is, from what is known of it. A file that either the registered kind or the type of the response says is an HDR sky is one (Radiance's own type is
 * `image/vnd.radiance`, which is also why it must be asked before the pictures); one that says it is an image is an image (so it gets the stricter size limit);
 * everything else is a model, which is also what a file with no kind recorded has always been.
 */
export function resolveAssetKind(kind: AssetKind | null | undefined, contentType?: string | null): AssetKind {
  if (kind === 'hdr') return 'hdr'
  if (kind === 'image') return 'image'
  const type = mediaType(contentType)
  if (type !== null && KNOWN_HDR_MIMES.has(type)) return 'hdr'
  return type?.startsWith('image/') ? 'image' : 'model'
}

/** The most bytes this page will read for a file: 8 MB for an HDR sky, 3 MB for an image, 25 MB for a model. `contentType` is the response's, `kind` the registered one. */
export function assetByteLimit(kind: AssetKind | null | undefined, contentType?: string | null): number {
  const resolved = resolveAssetKind(kind, contentType)
  return resolved === 'hdr' ? MAX_HDR_BYTES : resolved === 'image' ? MAX_IMAGE_BYTES : MAX_ASSET_BYTES
}

/** One file the runtime asks for: the specification's own id for it, and the hash of its file. */
export interface AssetModelRef {
  id: string
  sha256: string
}

export type RuntimeMessage =
  | { type: 'ready' }
  | { type: 'spec'; ok: boolean; issues: string[] }
  | { type: 'progress' | 'completed'; step: number; percent: number; snapshot?: unknown }
  | { type: 'event'; name: string; seq: number }
  | { type: 'assets-needed'; models: AssetModelRef[] }

const finite = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)

/**
 * The models of an `assets-needed` request, or null when the request is not acceptable: not a list, empty, longer than
 * MAX_MODELS_PER_REQUEST, or any entry that is not `{ id: text, sha256: 64 lower-case hex digits }`. A request is taken whole or not at all - a
 * half-valid one says the sender is not the runtime this page knows - and a hash named twice is asked for once.
 */
export function readAssetRequest(value: unknown): AssetModelRef[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MODELS_PER_REQUEST) return null
  const models: AssetModelRef[] = []
  const seen = new Set<string>()
  for (const entry of value as unknown[]) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
    const { id, sha256 } = entry as Record<string, unknown>
    if (typeof id !== 'string' || id.length > MAX_MODEL_ID_CHARS) return null
    if (typeof sha256 !== 'string' || !SHA256_PATTERN.test(sha256)) return null
    if (seen.has(sha256)) continue
    seen.add(sha256)
    models.push({ id, sha256 })
  }
  return models
}

/**
 * A message from the runtime, or null when it is not one: not an object, not ours, for another lesson, or a type nobody here handles.
 * Callers must already have checked `event.source`; this checks the shape and the lesson.
 */
export function parseRuntimeMessage(data: unknown, lessonId: string): RuntimeMessage | null {
  if (!data || typeof data !== 'object') return null
  const message = data as Record<string, unknown>
  if (message.src !== 'g2g-course') return null
  // The runtime echoes the lesson id it was opened with (`?lesson=`) on every message, so one that names no lesson, or another, is not ours.
  if (message.lesson === undefined || String(message.lesson) !== lessonId) return null

  switch (message.type) {
    case 'ready':
      return { type: 'ready' }
    case 'spec':
      return {
        type: 'spec',
        ok: message.ok === true,
        issues: Array.isArray(message.issues) ? message.issues.filter((i): i is string => typeof i === 'string').slice(0, 30) : [],
      }
    case 'progress':
    case 'completed':
      return {
        type: message.type,
        step: Math.max(0, Math.round(finite(message.step))),
        percent: Math.max(0, Math.min(100, Math.round(finite(message.percent)))),
        snapshot: message.snapshot,
      }
    case 'event':
      return { type: 'event', name: typeof message.name === 'string' ? message.name : '', seq: finite(message.seq) }
    case 'assets-needed': {
      const models = readAssetRequest(message.models)
      return models ? { type: 'assets-needed', models } : null
    }
    default:
      return null
  }
}

/** The address of the runtime for one simulation: play it (`host`) or only check a specification (`validate`). */
export function runtimeFrameUrl({ lessonId, validate = false }: { lessonId: string; validate?: boolean }): string {
  const params = new URLSearchParams()
  params.set(validate ? 'validate' : 'host', '1')
  params.set('lesson', lessonId)
  if (typeof window !== 'undefined') params.set('from', window.location.origin)
  return `${SIM_RUNTIME_URL}?${params.toString()}`
}

/** The credit the runtime may show next to a model. Every part is optional; none is ever markup. */
export interface RuntimeAssetCredit {
  title?: string
  author?: string
  licence?: string
  source?: string
}

export type HostMessage =
  | { type: 'init'; spec: unknown; resume?: unknown }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'asset'; sha256: string; bytes: ArrayBuffer; credit?: RuntimeAssetCredit; kind?: AssetKind; mime?: string }
  | { type: 'asset-missing'; sha256: string; reason?: string }

/**
 * Sends a message to the frame and says whether it went. `transfer` lists buffers handed over rather than copied (a model file is up to
 * 25 MB, an image up to 3 MB): they are unusable on this side afterwards. A frame that went away, or a buffer that cannot be transferred, is `false` - never a throw.
 */
export function postToRuntime(frame: HTMLIFrameElement | null, message: HostMessage, transfer: Transferable[] = []): boolean {
  try {
    const target = frame?.contentWindow
    if (!target) return false
    target.postMessage({ src: 'g2g-host', ...message }, '*', transfer)
    return true
  } catch {
    /* a frame that went away must not break the page */
    return false
  }
}

/* ----------------------------------------------------------------------------------------------------------------- 3D model files */

/**
 * The files a specification names, in order: the entries of `assets.models` (3D models, and the pictures that are listed with them) and of
 * `assets.images` where a specification keeps them apart. Only entries with a well-formed hash count. Never throws, whatever `spec` is.
 */
export function specAssetModels(spec: unknown): { id: string; sha256: string }[] {
  if (!spec || typeof spec !== 'object') return []
  const assets = (spec as Record<string, unknown>).assets
  if (!assets || typeof assets !== 'object') return []
  const named: { id: string; sha256: string }[] = []
  for (const list of [(assets as Record<string, unknown>).models, (assets as Record<string, unknown>).images]) {
    if (!Array.isArray(list)) continue
    for (const entry of list as unknown[]) {
      if (!entry || typeof entry !== 'object') continue
      const { id, sha256 } = entry as Record<string, unknown>
      if (typeof sha256 === 'string' && SHA256_PATTERN.test(sha256)) named.push({ id: typeof id === 'string' ? id : '', sha256 })
    }
  }
  return named
}

/**
 * Splits what the runtime asked for into the hashes this page will fetch and the ones it refuses. A hash is allowed ONLY when the
 * specification the page holds names it (see specAssetModels): the frame is untrusted, so it cannot ask for a file the simulation does not
 * use. Each hash appears once, in the order asked.
 */
export function partitionAssetRequest(spec: unknown, requested: readonly AssetModelRef[]): { allowed: string[]; refused: string[] } {
  const named = new Set(specAssetModels(spec).map((model) => model.sha256))
  const allowed: string[] = []
  const refused: string[] = []
  const seen = new Set<string>()
  for (const { sha256 } of requested) {
    if (seen.has(sha256)) continue
    seen.add(sha256)
    if (named.has(sha256)) allowed.push(sha256)
    else refused.push(sha256)
  }
  return { allowed, refused }
}

const MAX_CREDIT_TEXT = 200
const MAX_CREDIT_URL = 2048

const creditText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const text = value.replace(/\s+/g, ' ').trim()
  return text === '' ? null : text.slice(0, MAX_CREDIT_TEXT)
}

/** The address, only when it is a plain https link (no `javascript:`, `data:`, `http:`, and no login embedded in it). */
export function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_CREDIT_URL) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' && url.username === '' && url.password === '' && url.hostname !== '' ? url.href : null
  } catch {
    return null
  }
}

/** One file's credit as the API gives it (`data.assets[]` of GET /lms/simulations/{id}), cleaned: every part is text or null. */
export interface AssetCredit {
  sha256: string
  /** A 3D model, an image or an HDR sky (`kind`); a credit from a server that does not say is a model. */
  kind: AssetKind
  /** The file's name (`name`). */
  name: string | null
  /** Who made it, as the credit line to show (`credit`). */
  credit: string | null
  /** The licence it is used under (`licence`). */
  licence: string | null
  /** Where it came from (`source_url`): a link only when it is https, otherwise it is just text. */
  source: string | null
}

/** The credits of a detail response, tolerant of anything: an older server sends none, and an entry without a proper hash is dropped. */
export function readAssetCredits(value: unknown): AssetCredit[] {
  if (!Array.isArray(value)) return []
  const credits: AssetCredit[] = []
  for (const entry of value as unknown[]) {
    if (!entry || typeof entry !== 'object') continue
    const item = entry as Record<string, unknown>
    if (typeof item.sha256 !== 'string' || !SHA256_PATTERN.test(item.sha256)) continue
    const source = typeof item.source_url === 'string' ? item.source_url.trim().slice(0, MAX_CREDIT_URL) : null
    credits.push({
      sha256: item.sha256,
      kind: item.kind === 'image' ? 'image' : item.kind === 'hdr' ? 'hdr' : 'model',
      name: creditText(item.name),
      credit: creditText(item.credit),
      licence: creditText(item.licence),
      source: source === '' ? null : source,
    })
  }
  return credits
}

/** The runtime refuses a whole `asset` message if any part of its credit is longer than this, so nothing longer is sent (cut text, or a cut link, would be wrong). */
const MAX_RUNTIME_CREDIT_CHARS = 200

/**
 * What goes to the runtime as `credit`: `name` is the title, `credit` the author, and a source only when it is an https link short enough
 * for the runtime to accept.
 */
export function runtimeCredit(credit: AssetCredit | undefined): RuntimeAssetCredit | undefined {
  if (!credit) return undefined
  const out: RuntimeAssetCredit = {}
  if (credit.name) out.title = credit.name.slice(0, MAX_RUNTIME_CREDIT_CHARS)
  if (credit.credit) out.author = credit.credit.slice(0, MAX_RUNTIME_CREDIT_CHARS)
  if (credit.licence) out.licence = credit.licence.slice(0, MAX_RUNTIME_CREDIT_CHARS)
  const source = httpsUrl(credit.source)
  if (source && source.length <= MAX_RUNTIME_CREDIT_CHARS) out.source = source
  return Object.keys(out).length > 0 ? out : undefined
}

/** The registered kind of a hash, from the credits a detail response lists; undefined when the credits do not list it. */
export function creditKindFor(assets: unknown, sha256: string): AssetKind | undefined {
  return readAssetCredits(assets).find((credit) => credit.sha256 === sha256)?.kind
}

/**
 * `{ type: 'asset' }`: the file of one model or image. `bytes` is meant to be transferred, so pass a buffer nobody else keeps.
 * `kind` is always sent: 'hdr' or 'image' when `kind`, the credit or the response's type says so, otherwise 'model'. `mime` is sent only for a known
 * image or model type (`knownAssetMime` of the response's Content-Type) - never a type the API did not say or one this page does not recognise.
 */
export function buildAssetMessage(
  sha256: string,
  bytes: ArrayBuffer,
  { credit, kind, contentType }: { credit?: AssetCredit; kind?: AssetKind; contentType?: string | null } = {},
): Extract<HostMessage, { type: 'asset' }> {
  const forRuntime = runtimeCredit(credit)
  const mime = knownAssetMime(contentType)
  return {
    type: 'asset',
    sha256,
    bytes,
    ...(forRuntime ? { credit: forRuntime } : {}),
    kind: resolveAssetKind(kind ?? credit?.kind, contentType),
    ...(mime ? { mime } : {}),
  }
}

/** `{ type: 'asset-missing' }`: this file cannot be provided. The reason is a short sentence for a person, never an error dump. */
export function buildAssetMissingMessage(sha256: string, reason?: string): Extract<HostMessage, { type: 'asset-missing' }> {
  return reason ? { type: 'asset-missing', sha256, reason } : { type: 'asset-missing', sha256 }
}

/** A short, non-technical reason a file could not be provided, from whatever the download threw. `kind` only chooses the word: model or image. */
export function assetFailureReason(error: unknown, kind: AssetKind = 'model'): string {
  const failure = error && typeof error === 'object' ? (error as { code?: unknown; status?: unknown }) : {}
  const noun = kind === 'image' ? 'image' : 'model'
  if (failure.code === 'too_large') return `This ${noun} is too large to load.`
  if (failure.status === 401 || failure.status === 403) return `You do not have access to this ${noun}.`
  if (failure.status === 404) return `This ${noun} is not available.`
  return `The ${noun} could not be loaded.`
}

/** The reason given for a hash the specification does not name. It says "file" because nothing is known of what the frame asked for. */
export const ASSET_NOT_IN_SPEC_REASON = 'This file is not part of this simulation.'

/** One line of credit under the player. `text` is plain text; `href` is set only for an https source; any other source is `sourceText`. */
export interface AssetCreditLine {
  key: string
  kind: AssetKind
  /** "3D model: Eye - Author (CC BY 4.0)" or "Image: Retina - Author (CC0)" - the parts that are known, in that order. */
  text: string
  /** The file's name, for naming the source link to a screen reader. */
  name: string | null
  href: string | null
  sourceText: string | null
}

/** Shown with the credit of each kind of file. */
export const ASSET_KIND_LABEL: Readonly<Record<AssetKind, string>> = { model: '3D model', image: 'Image', hdr: 'Sky light' }

/** With this many credits or fewer the list under the player is open; with more it starts closed. */
export const CREDITS_OPEN_BY_DEFAULT_MAX = 3

/** Whether the credits list starts open: only when it is short. */
export const creditsOpenByDefault = (count: number): boolean => count <= CREDITS_OPEN_BY_DEFAULT_MAX

/** The title of the list of credits: "3D model and image credits (N)". */
export const creditsSummary = (count: number): string => `3D model and image credits (${count})`

/** "3D model: <name> - <credit> (<licence>)" or "Image: ...", leaving out what is not known, plus the source as a link (https only) or as plain text. */
export function formatAssetCredit(credit: AssetCredit): AssetCreditLine {
  const label = ASSET_KIND_LABEL[credit.kind === 'image' ? 'image' : credit.kind === 'hdr' ? 'hdr' : 'model']
  const who = [credit.name, credit.credit].filter((part): part is string => Boolean(part)).join(' - ')
  const body = [who, credit.licence ? `(${credit.licence})` : ''].filter(Boolean).join(' ')
  const href = httpsUrl(credit.source)
  return {
    key: credit.sha256,
    kind: credit.kind === 'image' ? 'image' : 'model',
    text: body ? `${label}: ${body}` : label,
    name: credit.name,
    href,
    sourceText: href ? null : creditText(credit.source),
  }
}

/** The credit lines for everything a detail response lists (see readAssetCredits). */
export function assetCreditLines(assets: unknown): AssetCreditLine[] {
  return readAssetCredits(assets).map(formatAssetCredit)
}

/* ------------------------------------------------------------------------------------------------------------ downloading the files */

/** A downloaded file: its bytes, what it is, and the response's media type when that is a known image or model type (null otherwise). */
export interface AssetFile {
  bytes: ArrayBuffer
  kind: AssetKind
  mime: string | null
}

export interface AssetLoader {
  /**
   * One file. Each call gets a buffer of its own, so the caller may transfer it (which empties it) without touching what is kept for the
   * next request. A hash already loaded is answered from memory, one being fetched (or waiting for a free download slot) is shared, and a
   * failure is not remembered.
   */
  load(sha256: string): Promise<AssetFile>
}

/**
 * Downloads files through `fetchFile`, once per hash and at most `maxParallel` at a time - across ALL requests, not per request: a second
 * request for other hashes is accepted while the first is still downloading, and its files take the next free slots in the order they were
 * asked for. One loader belongs to one player.
 */
export function createAssetLoader(fetchFile: (sha256: string) => Promise<AssetFile>, maxParallel = MAX_ASSET_DOWNLOADS_IN_PARALLEL): AssetLoader {
  const loaded = new Map<string, AssetFile>()
  const inFlight = new Map<string, Promise<AssetFile>>()
  const waiting: (() => void)[] = []
  let active = 0

  const acquire = (): Promise<void> => {
    if (active < maxParallel) {
      active += 1
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      waiting.push(() => {
        active += 1
        resolve()
      })
    })
  }
  const release = () => {
    active -= 1
    waiting.shift()?.()
  }

  const fetchOnce = (sha256: string): Promise<AssetFile> => {
    const shared = inFlight.get(sha256)
    if (shared) return shared
    const started = (async () => {
      await acquire()
      try {
        const file = await fetchFile(sha256)
        loaded.set(sha256, file)
        return file
      } finally {
        release()
      }
    })()
    const tracked = started.finally(() => {
      inFlight.delete(sha256)
    })
    inFlight.set(sha256, tracked)
    return tracked
  }

  return {
    load: async (sha256) => {
      const kept = loaded.get(sha256) ?? (await fetchOnce(sha256))
      return { bytes: kept.bytes.slice(0), kind: kept.kind, mime: kept.mime }
    },
  }
}

/**
 * Answers one `assets-needed` request, and settles (never rejects) once every answer has been sent. A hash the specification does not name is
 * answered "missing" at once and never fetched; the others are loaded through `loader` and sent one message each, as they arrive, so a
 * slow file does not hold up a fast one and a later request is served while an earlier one is still downloading. A file that cannot be
 * loaded, or cannot be posted, is answered "missing" with a short reason.
 *
 * `reply` sends a message and says whether it went (see postToRuntime); `assets` is the credits list of the detail response.
 */
export function answerAssetRequest({
  spec,
  assets,
  models,
  loader,
  reply,
  onFailure,
}: {
  spec: unknown
  assets: unknown
  models: readonly AssetModelRef[]
  loader: AssetLoader | null
  reply: (message: HostMessage, transfer?: Transferable[]) => boolean
  onFailure?: (error: unknown) => void
}): Promise<void> {
  const send = (message: HostMessage, transfer?: Transferable[]): boolean => {
    try {
      return reply(message, transfer)
    } catch {
      return false
    }
  }
  const { allowed, refused } = partitionAssetRequest(spec, models)
  for (const sha256 of refused) send(buildAssetMissingMessage(sha256, ASSET_NOT_IN_SPEC_REASON))
  if (!loader) return Promise.resolve()

  const credits = readAssetCredits(assets)
  const one = async (sha256: string): Promise<void> => {
    const credit = credits.find((candidate) => candidate.sha256 === sha256)
    try {
      const file = await loader.load(sha256)
      if (!send(buildAssetMessage(sha256, file.bytes, { credit, kind: file.kind, contentType: file.mime }), [file.bytes])) {
        send(buildAssetMissingMessage(sha256, assetFailureReason(null, file.kind)))
      }
    } catch (error) {
      try {
        onFailure?.(error)
      } catch {
        /* reporting a failure must not become one */
      }
      send(buildAssetMissingMessage(sha256, assetFailureReason(error, credit?.kind)))
    }
  }
  return Promise.all(allowed.map(one)).then(() => undefined)
}

export interface SpecVerdict {
  ok: boolean
  issues: string[]
  /** The checker could not run at all (the runtime did not answer): nothing is known about the specification. */
  unavailable?: boolean
}

/**
 * Asks the runtime whether a specification is valid, in a hidden, sandboxed frame that draws nothing and loads no 3D. The runtime's own
 * validator is the authority, so the same rules that will play the simulation are the ones that vet it.
 */
export function checkSpecWithRuntime(spec: unknown, timeoutMs = 15000): { result: Promise<SpecVerdict>; cancel: () => void } {
  const lessonId = 'check'
  const frame = document.createElement('iframe')
  frame.setAttribute('sandbox', 'allow-scripts')
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  frame.title = 'Simulation check'
  Object.assign(frame.style, { position: 'fixed', width: '0', height: '0', border: '0', opacity: '0', pointerEvents: 'none' })

  let finish: (verdict: SpecVerdict) => void = () => undefined
  const result = new Promise<SpecVerdict>((resolve) => {
    let done = false
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return
      const message = parseRuntimeMessage(event.data, lessonId)
      if (!message) return
      if (message.type === 'ready') postToRuntime(frame, { type: 'init', spec })
      if (message.type === 'spec') finish({ ok: message.ok, issues: message.issues })
    }
    const timer = window.setTimeout(() => finish({ ok: false, issues: [], unavailable: true }), timeoutMs)
    finish = (verdict) => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      frame.remove()
      resolve(verdict)
    }
    window.addEventListener('message', onMessage)
    frame.src = runtimeFrameUrl({ lessonId, validate: true })
    document.body.appendChild(frame)
  })

  return { result, cancel: () => finish({ ok: false, issues: [], unavailable: true }) }
}
