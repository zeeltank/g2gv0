import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/**
 * TASK → COMPETENCY, INSIDE THE ASSIGN FORM.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY THIS BELONGS IN THE ASSIGN MODAL AND NOT ON A MATRIX SCREEN
 * ═══════════════════════════════════════════════════════════════════════
 *
 * The person assigning "prepare the health check report" knows what it takes.
 * An admin filling a matrix months earlier is guessing. And the evidence that
 * nobody visits the matrix is in the data: 121 mappings exist because a script
 * wrote them, not a person.
 *
 * EDITING HERE IS SAFE, and the schema is what says so:
 *
 *   s_jobrole_task               NO sub_institute_id  - a shared standard task
 *   jobrole_task_competency_map  HAS sub_institute_id - YOUR organisation's view
 *
 * Two companies can hold the same catalogue task and decide it demands entirely
 * different capabilities. Neither sees the other. A manager editing this is
 * describing their own organisation, not everyone's.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * SAVE IS A SYNC, NOT AN APPEND — THE MOST IMPORTANT THING HERE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * `save` REPLACES the whole set for that task. Sending one competency REMOVES
 * every other mapping on it. So the caller must always send the complete list,
 * including the ones it is not changing.
 *
 * That failure would be silent — the write succeeds, and mappings simply vanish.
 */

export interface TaskCompetency {
  id: number
  name: string
  code: string | null
  criticality: string | null
  items: number
  items_rated: number
  /** null means UNRATED. Never 0 — "scored nothing" is a different fact. */
  rating: number | null
}

export interface TaskCompetencyView {
  jobrole_task_id: number
  task: string
  jobrole: string | null
  user_id: number | null
  competencies: TaskCompetency[]
  available: { id: number; name: string; code: string | null }[]
  empty_is_expected: boolean
  empty_reason: string | null
}

export const taskCompetencyInlineService = {
  /**
   * What this task exercises, and where the person being assigned it stands.
   *
   * `userId` is optional — omit it to see the mapping alone. When supplied, each
   * competency carries that person's rolled-up rating from its KASBA items.
   */
  async forTask(
    jobroleTaskId: number,
    userId: number | null,
    context: LaravelContext,
  ): Promise<TaskCompetencyView> {
    const res = await apiClient.get<{
      status: number
      data: Omit<TaskCompetencyView, 'empty_is_expected' | 'empty_reason'>
      empty_is_expected: boolean
      empty_reason: string | null
    }>(
      '/competency/task-map/for-task',
      withLaravelParams(context, {
        jobrole_task_id: String(jobroleTaskId),
        ...(userId ? { user_id: String(userId) } : {}),
      }),
    )

    return {
      ...res.data,
      empty_is_expected: res.empty_is_expected,
      empty_reason: res.empty_reason,
    }
  },

  /**
   * Replace this task's competencies with exactly this set.
   *
   * PASS THE WHOLE LIST. This is a sync: anything omitted is removed. The panel
   * that calls it holds the full current set and sends it every time, including
   * on a single add or remove.
   */
  async save(
    jobroleTaskId: number,
    competencyIds: number[],
    context: LaravelContext,
  ): Promise<{ saved: boolean; message: string }> {
    const res = await apiClient.post<{ status: number; message?: string }>(
      '/competency/task-map',
      {
        ...withLaravelParams(context),
        jobrole_task_id: jobroleTaskId,
        items: competencyIds.map((id) => ({ competency_id: id })),
      },
    )
    return { saved: res.status === 1, message: res.message ?? '' }
  },
}
