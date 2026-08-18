/**
 * Which competency each job-role task exercises — `jobrole_task_competency_map`.
 *
 * THE SHAPE OF THIS ONE DIFFERS FROM THE OTHER TWO MAPS, and the data is why.
 * A course has one competency list. A JOB ROLE HAS UP TO 209 TASKS, each holding
 * several competencies — so the subject is a role, the rows are its tasks, and
 * each task carries its own list.
 *
 * THE REFERENT IS THE GLOBAL CATALOGUE. `jobrole_task_id` points at
 * `s_jobrole_task` (55,961 rows, NO tenant column) — a shared seed library with a
 * TENANT-OWNED mapping onto it (Q-C1). So the ROLE LIST is identical for every
 * tenant and only the MAP rows are scoped. A reader who assumes both sides are
 * tenant-scoped will not understand the join.
 *
 * SYNC, NOT APPEND — and this endpoint was append until 2026-08-13. Rows absent
 * from `items` are DELETED for that task. An append-only writer gives a user no
 * way to unsay something: the row survives every later save and keeps
 * contributing to the task's competency signal with nothing able to remove it.
 *
 *   ALWAYS SEND THE TASK'S COMPLETE LIST. Sending one changed item wipes the rest.
 *
 * `removed` comes back on every save so the screen can say it in words.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/** A job role in the global catalogue, with how many tasks it holds. */
export interface TaskMapRole {
  jobrole: string
  task_count: number
}

export interface TaskMapCompetency {
  map_id: number
  competency_id: number
  competency_name: string
}

/** One catalogue task, and what this tenant has mapped onto it. */
export interface TaskMapTask {
  jobrole_task_id: number
  task: string
  critical_work_function: string | null
  /** Empty is the NORMAL case — an unmapped task is why the browse exists. */
  competencies: TaskMapCompetency[]
}

export interface TaskMapTasksResponse {
  status: number
  data: TaskMapTask[]
  counts: { tasks: number; mapped: number; unmapped: number }
  /**
   * TRUE when nothing in this role is mapped AND that is expected. Stated by the
   * server so the screen never has to infer "not authored yet" from zeroes.
   */
  empty_is_expected: boolean
}

export interface TaskMapSaveResult {
  status: number
  message: string
  /** How many competencies the task carries after the save. */
  mapped: number
  /** How many were REMOVED because they were absent from the payload. */
  removed: number
}

export const taskCompetenciesService = {
  /** GET /competency/task-map/roles — the catalogue's roles, with task counts. */
  roles: (context: LaravelContext) =>
    apiClient.get<{ status: number; data: TaskMapRole[] }>(
      '/competency/task-map/roles',
      withLaravelParams(context),
    ),

  /** GET /competency/task-map/tasks — one role's tasks, mapped and unmapped. */
  tasks: (context: LaravelContext, jobrole: string) =>
    apiClient.get<TaskMapTasksResponse>(
      '/competency/task-map/tasks',
      withLaravelParams(context, { jobrole }),
    ),

  /**
   * POST /competency/task-map — SYNC one task's complete competency list.
   *
   * HR/Admin only; the route carries `profile:admin,hr` on exact role_key.
   */
  save: (context: LaravelContext, jobroleTaskId: number, competencyIds: number[]) =>
    apiClient.post<TaskMapSaveResult>('/competency/task-map', {
      ...withLaravelParams(context),
      jobrole_task_id: jobroleTaskId,
      items: competencyIds.map((competency_id) => ({ competency_id })),
    }),

  /** DELETE /competency/task-map/{id} — drop one mapping row. */
  remove: (context: LaravelContext, mapId: number) =>
    apiClient.delete<{ status: number; message: string }>(
      `/competency/task-map/${mapId}`,
      withLaravelParams(context),
    ),
}
