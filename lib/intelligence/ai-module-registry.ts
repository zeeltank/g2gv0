'use client'

/**
 * Client for `GET /api/ai/modules/resolve?menu_id=` - the AI Stack's description of the module
 * behind a menu row.
 *
 * Used for a module the front end has no hand-written descriptor for. The backend registers the
 * module on first sight (from the menu tree) and answers with what it can actually read for this
 * organisation, which of those sources were discovered from the database rather than written by
 * hand, and what it cannot do. Nothing here is a default: when the answer is "not a module" or
 * "nothing readable", the types say so and the screen shows that instead of a made-up stack.
 */

import { aiRequest } from './client'

export interface ResolvedModuleSource {
  key: string
  label: string
  description: string
  /** Read straight from a table by schema discovery, not written for this module. */
  discovered: boolean
  /** Records the caller's organisation has in it right now; null when it could not be read. */
  rows: number | null
  readable: boolean
}

export interface ResolvedModuleDiscoveryTable {
  source: string
  table: string
  columns: string[]
  withheld_columns: string[]
  relationships: Array<{ column: string; references: string; shown_as: string }>
}

export interface ResolvedModule {
  registered: true
  newly_registered: boolean
  newly_enabled: boolean
  key: string
  label: string
  menu_id: number
  route: string | null
  menu_slug: string | null
  sources: ResolvedModuleSource[]
  primary_source: string | null
  discovery: {
    discovered: boolean
    prefixes: string[]
    fingerprint: string | null
    tables: ResolvedModuleDiscoveryTable[]
    skipped: Array<{ table: string; reason: string }>
  }
  support: {
    /** full = hand-written sources only; partial = some or all discovered; none = nothing readable. */
    level: 'full' | 'partial' | 'none'
    can: string[]
    cannot: string[]
    needs_configuration: string[]
  }
}

export interface UnresolvedModule {
  registered: false
  reason: string | null
}

export type ModuleResolution = ResolvedModule | UnresolvedModule

export function resolveModule(menuId: string | number): Promise<ModuleResolution> {
  return aiRequest<ModuleResolution>(`/modules/resolve?menu_id=${encodeURIComponent(String(menuId))}`)
}
