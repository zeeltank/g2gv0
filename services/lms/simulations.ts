/**
 * Simulation Learning - the gallery, the player's data and what an administrator may add, change and remove.
 *
 * Backed by `App\Http\Controllers\Api\LmsSimulationController` (hp_erp). Every call is scoped on the server to the CALLER'S organisation, which
 * comes from the Bearer token and never from anything sent here, so none of these functions take a tenant. A simulation is DATA - a
 * `g2g.sim/1` specification stored per organisation (or a platform simulation an organisation has switched on) - and one generic runtime plays
 * every one of them. Nothing in this module, or in the screens built on it, knows which simulations exist.
 *
 * WHO MAY DO WHAT is the rights matrix on the `Simulation Learning` menu row (/module/lms/simulation-learning), plus the administrator and HR
 * roles. The list response carries the caller's rights as `can`, so the screen shows exactly the actions the server will accept.
 */

import { SHA256_PATTERN, assetByteLimit, knownAssetMime, resolveAssetKind, type AssetFile, type AssetKind } from '@/lib/simulation-host'
import { readLimits, type SimulationLimits, type UploadMeta } from '@/lib/simulation-package-plan'
import { apiClient } from '@/services/core'

export interface SimulationEnvelope<T> {
  status: boolean
  message?: string
  data: T
}

export type SimulationStatus = 'draft' | 'published' | 'archived'
/** `tenant` = this organisation's own; `platform` = one the platform offers and this organisation has switched on. */
export type SimulationScope = 'tenant' | 'platform'
export type SimulationDifficulty = 'intro' | 'intermediate' | 'advanced'
export type SimulationProgressStatus = 'in_progress' | 'completed'

export interface SimulationProgress {
  status: SimulationProgressStatus
  percent: number
  step: number
  completed_at: string | null
  /** Where the runtime left the learner (phase, mission, stars...). Only on the single-simulation response; opaque to this screen. */
  snapshot?: unknown
}

/** One gallery card: everything the list needs and none of the specification. */
export interface SimulationCard {
  id: number
  slug: string
  title: string
  subtitle: string | null
  summary: string | null
  category: string | null
  /** The key of this card's filter chip, exactly as the server counted it (the same function builds both); older servers omit it. */
  category_key?: string
  tags: string[]
  audience: string | null
  minutes: number | null
  difficulty: SimulationDifficulty | string | null
  cover_url: string | null
  status: SimulationStatus
  version: number
  missions: number
  scope: SimulationScope
  updated_at: string | null
  progress: SimulationProgress | null
}

/** A filter chip, made on the server from the categories in use. */
export interface SimulationCategory {
  key: string
  label: string
  count: number
}

export interface SimulationRights {
  view: boolean
  add: boolean
  edit: boolean
  delete: boolean
}

export interface SimulationListData {
  simulations: SimulationCard[]
  categories: SimulationCategory[]
  total: number
  can: SimulationRights
}

/**
 * The parts of a specification this screen reads to describe a simulation before it is played. Deliberately lenient: the full contract is the
 * runtime's own zod schema, and a specification that lacks any of these still plays - the detail view just shows less.
 */
export interface SimulationSpecPreview {
  id?: string
  title?: string
  subtitle?: string
  summary?: string
  meta?: {
    minutes?: number
    audience?: string
    authors?: string[]
    competencies?: number[]
    category?: string
    tags?: string[]
    difficulty?: string
  }
  lesson?: {
    intro?: string
    missions?: { id?: string; kind?: string; title?: string; brief?: string }[]
  }
  [key: string]: unknown
}

/**
 * The credit of one 3D model or image a specification names (`data.assets[]` of GET /lms/simulations/{id}; `SimulationStore::assetCredits`
 * in hp_erp). One entry per file the server has registered for the simulation's owner or the platform, in the order the specification names
 * them; a name with no registered file is left out, and the storage path is never sent.
 */
export interface SimulationAssetCredit {
  /** SHA-256 of the file: what the specification names and what the file is fetched by. */
  sha256: string
  /** A 3D model or an image. A server that predates images does not send it; the screen then treats the file as a model. */
  kind?: AssetKind
  name: string
  bytes: number
  licence: string | null
  /** The attribution line (who made it). */
  credit: string | null
  /** Where it came from. Not trusted to be a web address: the screen links it only when it is https. */
  source_url: string | null
}

export interface SimulationDetail extends SimulationCard {
  spec: SimulationSpecPreview
  /** Credits of the models and images `spec.assets` names. A server that predates 3D models does not send it. */
  assets?: SimulationAssetCredit[]
  can: SimulationRights
}

export interface SimulationVersionRow {
  version: number
  sha256?: string
  note?: string | null
  created_at?: string | null
  created_by?: number | null
}

export interface SimulationVersionsData {
  current: number
  versions: SimulationVersionRow[]
}

/** The card fields a manager may set alongside (or instead of) a specification. */
export interface SimulationCardFields {
  status?: SimulationStatus
  category?: string | null
  tags?: string[] | string | null
  cover_url?: string | null
  difficulty?: string | null
  sort_order?: number
}

export interface CreateSimulationInput extends SimulationCardFields {
  /** The parsed `g2g.sim/1` specification. Sent as received: an empty object stays an empty object. */
  spec: unknown
  note?: string
}

export interface UpdateSimulationInput extends SimulationCardFields {
  /** A new specification becomes a new version. Omit it to change only the card. */
  spec?: unknown
  note?: string
}

/** What the runtime reports from the page. Recorded as reported; it is not a verified score. */
export interface SimulationProgressReport {
  percent: number
  step: number
  status: SimulationProgressStatus
  /** The runtime's resume snapshot. The server keeps at most 4,000 characters of it. */
  result?: unknown
}

const BASE = '/lms/simulations'

/**
 * GET /lms/simulations/{id}/assets/{sha256} - the file (a .glb model or an image) the simulation's current specification names, from the
 * private bucket, with what it is. Sent with the caller's Bearer token like every other call here (the organisation is the token's). The
 * server answers 404 for any hash the specification does not name.
 *
 * At most 25 MB is read for a model and 3 MB for an image - checked against Content-Length and against what actually arrives. It is an image
 * when `kind` (the registered kind, from the credits) says so or the response's Content-Type is `image/*`, so a wrong hint cannot lift the
 * limit. Anything other than a 200 is an error (an ApiError carrying the status, or a ResponseTooLargeError with `code: 'too_large'`).
 * `mime` is the response's type only when it is a known image or model type.
 */
export async function fetchSimulationAssetFile(
  simulationId: number,
  sha256: string,
  { kind, signal }: { kind?: AssetKind; signal?: AbortSignal } = {},
): Promise<AssetFile> {
  if (!Number.isInteger(simulationId) || simulationId <= 0 || !SHA256_PATTERN.test(sha256)) {
    throw new Error('That is not a file of a simulation.')
  }
  const { bytes, contentType } = await apiClient.getFile(`${BASE}/${simulationId}/assets/${sha256}`, {
    accept: 'model/gltf-binary, image/*',
    maxBytes: (type) => assetByteLimit(kind, type),
    signal,
  })
  return { bytes, kind: resolveAssetKind(kind, contentType), mime: knownAssetMime(contentType) }
}

/** The bytes alone of fetchSimulationAssetFile, for a caller that does not need to know what the file is. */
export async function fetchSimulationAsset(simulationId: number, sha256: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  return (await fetchSimulationAssetFile(simulationId, sha256, { signal })).bytes
}

/** What POST /lms/simulations/assets answers for a stored file (CONTRACT-v3 section 7). */
export interface UploadedAsset {
  /** SHA-256 of the stored bytes, which the server worked out itself. */
  sha256: string
  kind: AssetKind
  mime: string | null
  bytes: number
  /** False when the organisation already held this file (an upload is idempotent per owner). */
  created: boolean
}

/**
 * POST /lms/simulations/assets - add right: stores one 3D model or image for the caller's organisation (multipart `file`, `licence`, `credit`,
 * and optionally `source` and `name`). What the file is comes from its bytes on the server; the licence and credit are mandatory there. The
 * answer is read leniently: with or without the `{ status, data }` envelope. A failure is an ApiError with the server's message and reasons.
 */
export async function uploadSimulationAsset(file: File, meta: UploadMeta): Promise<UploadedAsset> {
  const form = new FormData()
  form.append('file', file, file.name)
  form.append('licence', meta.licence)
  form.append('credit', meta.credit)
  if (meta.source) form.append('source', meta.source)
  if (meta.name) form.append('name', meta.name)
  if (meta.attested) form.append('attested', '1')
  const response = await apiClient.postForm<Record<string, unknown>>(`${BASE}/assets`, form)
  const inner = response && typeof response === 'object' && response.data && typeof response.data === 'object' ? (response.data as Record<string, unknown>) : response
  const sha256 = inner?.sha256
  if (typeof sha256 !== 'string' || !SHA256_PATTERN.test(sha256)) throw new Error('The server did not say which file it stored. Try again.')
  return {
    sha256,
    kind: inner.kind === 'image' ? 'image' : 'model',
    mime: typeof inner.mime === 'string' ? inner.mime : null,
    bytes: typeof inner.bytes === 'number' && Number.isFinite(inner.bytes) ? inner.bytes : file.size,
    created: inner.created !== false,
  }
}

/** GET /lms/simulations/limits - what a specification, a file and the organisation's storage may hold, and how much of it is used. */
export async function fetchSimulationLimits(): Promise<SimulationLimits> {
  return readLimits(await apiClient.get<unknown>(`${BASE}/limits`))
}

export const simulationService = {
  /** POST /lms/simulations/assets - see uploadSimulationAsset. */
  uploadAsset: uploadSimulationAsset,

  /** GET /lms/simulations/limits - see fetchSimulationLimits. */
  limits: fetchSimulationLimits,

  /** GET /lms/simulations - what this person may see: the organisation's own plus the platform ones it has switched on. */
  list: (search?: string) =>
    apiClient.get<SimulationEnvelope<SimulationListData>>(BASE, search ? { search } : undefined),

  /** GET /lms/simulations/{id} - the card and the current specification, for the player. A manager may ask for another `version`. */
  show: (id: number, version?: number) =>
    apiClient.get<SimulationEnvelope<SimulationDetail>>(
      `${BASE}/${id}`,
      version ? { version: String(version) } : undefined,
    ),

  /** GET /lms/simulations/{id}/assets/{sha256} - the bytes of one file the specification names. See fetchSimulationAssetFile. */
  asset: fetchSimulationAsset,

  /** The same, with what the file is (model or image) and its known type. */
  assetFile: fetchSimulationAssetFile,

  /** GET /lms/simulations/{id}/versions - edit right. */
  versions: (id: number) => apiClient.get<SimulationEnvelope<SimulationVersionsData>>(`${BASE}/${id}/versions`),

  /** GET /lms/simulations/catalogue - add right: platform simulations this organisation has not switched on yet. */
  catalogue: () => apiClient.get<SimulationEnvelope<{ simulations: SimulationCard[] }>>(`${BASE}/catalogue`),

  /** POST /lms/simulations - add right. */
  create: (input: CreateSimulationInput) => apiClient.post<SimulationEnvelope<SimulationCard>>(BASE, input),

  /** PUT /lms/simulations/{id} - edit right. */
  update: (id: number, input: UpdateSimulationInput) =>
    apiClient.put<SimulationEnvelope<SimulationCard>>(`${BASE}/${id}`, input),

  /** DELETE /lms/simulations/{id} - delete right. Removes it from every gallery; `restore` undoes it. */
  remove: (id: number) => apiClient.delete<SimulationEnvelope<{ id: number; deleted: boolean }>>(`${BASE}/${id}`),

  /** POST /lms/simulations/{id}/restore - delete right: the undo of `remove`. */
  restore: (id: number) => apiClient.post<SimulationEnvelope<SimulationCard>>(`${BASE}/${id}/restore`, {}),

  /** POST /lms/simulations/{id}/enable - add right: adds a platform simulation to this organisation's gallery. */
  enable: (id: number) => apiClient.post<SimulationEnvelope<{ id: number; enabled: boolean }>>(`${BASE}/${id}/enable`, {}),

  /** POST /lms/simulations/{id}/disable - delete right: takes a platform simulation out of this organisation's gallery. */
  disable: (id: number) => apiClient.post<SimulationEnvelope<{ id: number; enabled: boolean }>>(`${BASE}/${id}/disable`, {}),

  /** POST /lms/simulations/{id}/progress - view right. Only ever about the caller. */
  progress: (id: number, report: SimulationProgressReport) =>
    apiClient.post<SimulationEnvelope<Pick<SimulationProgress, 'status' | 'percent' | 'step' | 'completed_at'>>>(
      `${BASE}/${id}/progress`,
      report,
    ),
}
