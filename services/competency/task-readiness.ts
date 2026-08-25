/**
 * Task readiness — `/api/competency/task-map/readiness`.
 *
 * The gap endpoint answers "where is this person short". This answers the
 * question a manager actually asks: "can they do the work in front of them".
 * Same measurements, one level down — the server resolves both from
 * ProficiencyService, so the two screens cannot disagree.
 *
 * NO ARITHMETIC IN THE CLIENT. A task's state is decided server-side and read
 * here. Deriving it in the browser from the competency rows would be a second
 * implementation of the rule, and the one that drifted would be the one nobody
 * tested.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/**
 * FOUR STATES, KEPT APART.
 *
 * `unknown` and `unmapped` are separate because they have different fixes: one
 * needs an assessment, the other needs somebody to map the task. Neither may be
 * rendered as `cleared` — asserting a readiness nobody measured is the most
 * dangerous thing this screen could say.
 */
export type TaskReadinessState = 'cleared' | 'not_cleared' | 'unknown' | 'unmapped'

/** Per competency: `met`/`below` are measured verdicts; `unknown` is not. */
export type TaskCompetencyState = 'met' | 'below' | 'unknown'

/** Why nothing can be said — an assessment is missing, or a target is. */
export type TaskCompetencyReason = 'not_assessed' | 'no_target' | null

export interface TaskReadinessCompetency {
  id: number
  name: string
  code: string | null
  /** The role's target. NULL means nobody has set one. */
  required: number | null
  /** NULL means UNMEASURED — never render this as 0. */
  level: number | null
  /** 0–1. How much of the competency's weight the level speaks for. */
  coverage: number
  is_mandatory: boolean
  state: TaskCompetencyState
  reason: TaskCompetencyReason
}

export interface TaskReadinessRow {
  user_jobrole_task_id: number
  /** The shared catalogue task, where this one is bridged to it. */
  jobrole_task_id: number | null
  task: string
  critical_work_function: string | null
  task_type: string | null
  state: TaskReadinessState
  competencies: TaskReadinessCompetency[]
}

export interface TaskReadiness {
  user_id: number
  jobrole_id: number
  jobrole: string | null
  tasks: TaskReadinessRow[]
}

export interface TaskReadinessCounts {
  total: number
  cleared: number
  not_cleared: number
  unknown: number
  unmapped: number
}

interface Envelope {
  status: number
  message?: string
  data: TaskReadiness
  counts: TaskReadinessCounts
  /** Set when nothing is mapped — the screen says so rather than showing zeroes. */
  note: string | null
}

export const taskReadinessService = {
  /**
   * An employee may read THEIR OWN readiness; anyone else needs an elevated
   * role. The UI does not police this — the server returns 403 for a colleague
   * and 404 for a stranger, verified through the real request path.
   *
   * `jobroleId` is optional and overrides the employee's own role, for asking
   * "would they be ready for THAT job" — the same target-versus-actual question
   * against a different role.
   */
  forEmployee: (context: LaravelContext, userId: number, jobroleId?: number) =>
    apiClient.get<Envelope>(
      '/competency/task-map/readiness',
      withLaravelParams(context, {
        user_id: String(userId),
        ...(jobroleId ? { jobrole_id: String(jobroleId) } : {}),
      }),
    ),
}
