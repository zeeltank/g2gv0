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

export interface SimulationDetail extends SimulationCard {
  spec: SimulationSpecPreview
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

export const simulationService = {
  /** GET /lms/simulations - what this person may see: the organisation's own plus the platform ones it has switched on. */
  list: (search?: string) =>
    apiClient.get<SimulationEnvelope<SimulationListData>>(BASE, search ? { search } : undefined),

  /** GET /lms/simulations/{id} - the card and the current specification, for the player. A manager may ask for another `version`. */
  show: (id: number, version?: number) =>
    apiClient.get<SimulationEnvelope<SimulationDetail>>(
      `${BASE}/${id}`,
      version ? { version: String(version) } : undefined,
    ),

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
