/**
 * CATALOGUE ADOPT — the customer takes shared content instead of being given it.
 *
 * ── WHAT THIS REPLACES ──────────────────────────────────────────────────────
 *
 * Signup used to copy the entire shared catalogue into every new organisation.
 * On live that was 98.3% and 99.1% of every row written at signup for the two
 * real customers — tenant 14 received 276 job roles, 5,876 tasks, 482 skills and
 * 98 departments for ONE employee, none of it asked for, every role name
 * colliding with another organisation's.
 *
 * That copy is gone. This is the replacement, and the difference is consent.
 *
 * ── WHY `browse` EXISTS ─────────────────────────────────────────────────────
 *
 * `preview` and `commit` both take catalogue ids, and until `browse` was added
 * there was no way for a client to LEARN one — the seed-library preview returns
 * counts with no rows, and the only other reader of the job-role catalogue
 * selects the name and drops the id. The feature was complete on the server and
 * unreachable from the product. Do not remove `browse` thinking it is a
 * convenience: it is the only discovery path.
 *
 * ── ALWAYS PREVIEW BEFORE COMMITTING ────────────────────────────────────────
 *
 * Both endpoints run the SAME server-side code path; `written` is the only
 * difference. So the preview genuinely predicts the write rather than
 * approximating it, and showing it before committing is not ceremony.
 *
 * ── A NAME MATCH IS NOT A RELATIONSHIP ──────────────────────────────────────
 *
 * If the tenant already has a "Staff Nurse", the server does NOT assume it is
 * the catalogue's "Staff Nurse" and does NOT create a second one. It reports
 * `NAME_COLLISION` and skips the row. The UI must say so in words — a silent
 * skip reads as a failure, and deciding whether two things sharing a name are
 * the same thing is the customer's call.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/** The two catalogues that can be adopted from. Roles and skills only. */
export type CatalogueKind = 'role' | 'skill'

/**
 * What adopting one row would do.
 *
 * `NEW`               — will be created
 * `ALREADY_ADOPTED`   — this tenant adopted this catalogue row before; skipped
 * `NAME_COLLISION`    — a row of the same name already exists here; skipped
 * `NOT_IN_CATALOGUE`  — the id does not exist in the catalogue at all
 */
export type AdoptRowState = 'NEW' | 'ALREADY_ADOPTED' | 'NAME_COLLISION' | 'NOT_IN_CATALOGUE'

/** One row in the browse list, annotated with what adopting it would do. */
export interface CatalogueBrowseItem {
  catalogue_id: number
  name: string
  category: string | null
  /** Already taken by this tenant — selecting it is a no-op. */
  already_adopted: boolean
  /** A row of this name already exists here; the server will skip it. */
  name_collision: boolean
}

export interface CatalogueBrowseResponse {
  status: number
  data: {
    kind: CatalogueKind
    /** Matching rows in the catalogue, ignoring paging. */
    total: number
    shown: number
    offset: number
    items: CatalogueBrowseItem[]
  }
}

/** Per-row outcome, returned by both preview and commit. */
export interface AdoptRowPlan {
  catalogue_id: number
  name: string | null
  state: AdoptRowState
  /** The tenant's own row id, when `state` is ALREADY_ADOPTED. */
  existing_id: number | null
}

/** A count of job roles and skills — the shape every tally in the response uses. */
export interface AdoptTally {
  job_roles: number
  skills: number
}

export interface AdoptResponse {
  status: number
  data: {
    /** false for preview, true for commit. The only difference between them. */
    written: boolean
    /** Rows actually created. `null` on preview, because nothing was. */
    created: AdoptTally | null
    would_create: AdoptTally
    skipped: {
      already_adopted: AdoptTally
      name_collision: AdoptTally
      not_in_catalogue: AdoptTally
    }
    job_roles: AdoptRowPlan[]
    skills: AdoptRowPlan[]
    /** Server-authored explanation. Show it — it states what was NOT copied. */
    note: string
  }
}

/** What the caller selected. At least one list must be non-empty, or the server answers 422. */
export interface AdoptSelection {
  job_role_ids?: number[]
  skill_ids?: number[]
}

export const catalogueAdoptService = {
  /**
   * GET browse — page through the catalogue.
   *
   * The catalogue is 3,347 job roles and 5,640 skills, so this is always paged
   * and usually searched. `total` is the count BEFORE paging, so it is what a
   * "showing 50 of 3,347" line should use.
   */
  browse: (
    context: LaravelContext,
    kind: CatalogueKind,
    options: { q?: string; limit?: number; offset?: number } = {},
  ) =>
    apiClient.get<CatalogueBrowseResponse>(
      '/competency/catalogue-adopt/browse',
      withLaravelParams(context, {
        kind,
        ...(options.q ? { q: options.q } : {}),
        limit: String(options.limit ?? 50),
        offset: String(options.offset ?? 0),
      }),
    ),

  /** POST preview — reports what adopting would do. Writes nothing. */
  preview: (context: LaravelContext, selection: AdoptSelection) =>
    apiClient.post<AdoptResponse>('/competency/catalogue-adopt/preview', {
      ...withLaravelParams(context),
      ...selection,
    }),

  /**
   * POST commit — adopts, in one transaction.
   *
   * HR/Admin only; the route carries `profile:admin,hr`. The UI hides the action
   * for everyone else, but the server is what enforces it.
   */
  commit: (context: LaravelContext, selection: AdoptSelection) =>
    apiClient.post<AdoptResponse>('/competency/catalogue-adopt/commit', {
      ...withLaravelParams(context),
      ...selection,
    }),
}
