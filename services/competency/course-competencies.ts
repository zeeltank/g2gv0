/**
 * Which competencies a course develops — `course_competency_map`.
 *
 * WHY THIS EXISTS
 *
 * Two shipped features read this table and nothing could fill it:
 *
 *   LearningAssigner        turns a competency gap into a course to assign
 *   RemediationRecommender  turns a lapse into a list of courses that fix it
 *
 * Both have been reading 56 seeded rows since they landed. Course creation writes
 * `sub_std_map` and stops, so no customer could ever add a 57th.
 *
 * SYNC, NOT APPEND — READ THIS BEFORE CALLING `save`.
 *
 * `POST /competency/course-map` DELETES rows absent from `items`. That is
 * deliberate and specific to this table: a competency dropped from a course must
 * STOP BEING RECOMMENDED FOR IT. An append-only writer would leave the
 * recommender citing a link somebody removed — a recommendation nobody could
 * explain and no user could correct.
 *
 *   ALWAYS SEND THE COURSE'S COMPLETE LIST. Sending one changed item wipes the
 *   rest.
 *
 * The server refuses an empty `items` array (`min:1`), so clearing a course
 * entirely is `remove()` per row, never `save([])`.
 *
 * IDS, NOT TEXT. `competency_id` must be a row in the `competency` table; the
 * server validates against it and rejects the rest with a 422 naming the unknown
 * ids.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/** One competency a course develops. */
export interface CourseCompetency {
  id: number
  competency_id: number
  competency_name: string
  competency_code: string | null
  /** 1–5, or null when the course does not claim a level. */
  proficiency_level: number | null
  is_primary: boolean
}

export interface CourseCompetencyInput {
  competency_id: number
  proficiency_level?: number | null
  is_primary?: boolean
}

export interface CourseCompetencyListResponse {
  status: number
  data: CourseCompetency[]
  /**
   * TRUE when the list is empty AND that is the expected state.
   *
   * The server states this rather than leaving the screen to infer it from an
   * empty array. A course nobody has mapped yet is normal; an empty list is not
   * evidence of a failure, and the panel must not imply one.
   */
  empty_is_expected: boolean
}

export interface CourseCompetencySaveResult {
  status: number
  message: string
  data: {
    course_id: number
    /** Rows written or updated. */
    written: number
    /**
     * Rows REMOVED because they were absent from the payload. Shown to the user:
     * a silent deletion is worse than no deletion, and this endpoint syncs.
     */
    removed: number
  }
}

export const courseCompetenciesService = {
  /** GET /competency/course-map — what one course already develops. */
  list: (context: LaravelContext, courseId: number) =>
    apiClient.get<CourseCompetencyListResponse>(
      '/competency/course-map',
      withLaravelParams(context, { course_id: String(courseId) }),
    ),

  /**
   * POST /competency/course-map — SYNC a course's complete competency list.
   *
   * HR/Admin only; the route carries `profile:admin,hr` matched on exact
   * role_key. The UI hides the action for everyone else, but the server is what
   * enforces it.
   */
  save: (context: LaravelContext, courseId: number, items: CourseCompetencyInput[]) =>
    apiClient.post<CourseCompetencySaveResult>('/competency/course-map', {
      ...withLaravelParams(context),
      course_id: courseId,
      items,
    }),

  /** DELETE /competency/course-map/{id} — drop one mapping row. */
  remove: (context: LaravelContext, id: number) =>
    apiClient.delete<{ status: number; message: string }>(
      `/competency/course-map/${id}`,
      withLaravelParams(context),
    ),
}
