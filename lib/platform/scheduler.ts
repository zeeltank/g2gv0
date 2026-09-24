/**
 * Scheduler reads.
 *
 * Mirrors `app/Services/Platform/ScheduleReader.php`, which walks Laravel's live
 * schedule rather than a hand-kept list — so a task added to `routes/console.php`
 * appears here with no change to this file.
 *
 * ── TWO HONESTY FLAGS, AND BOTH MATTER ──────────────────────────────────────
 *
 * `available.last_run` is false until a run ledger exists AND has a row for that task.
 * Nothing currently records a scheduled pass, so every task reports it false today and
 * `last_run_at` is null. Rendering that as "Never" would be a claim about the task; it
 * is a fact about the instrumentation.
 *
 * `queue.tenant_scoped` is false, permanently. `jobs` and `failed_jobs` have no
 * `sub_institute_id`, so those counts are the whole estate's. The screen must label them
 * that way — an administrator reading a failed-job count as their organisation's would
 * be reading somebody else's number.
 */

import { platformRequest } from './client'

export interface CronFields {
  minute: string
  hour: string
  day: string
  month: string
  day_of_week: string
}

export interface ScheduledTask {
  /** The artisan command, which is also the run-ledger key. */
  key: string
  command: string | null
  description: string | null
  /**
   * The catalogue key a write addresses, or null for a scheduled event the
   * catalogue does not describe. Such an event is still listed — it runs, and
   * hiding it would be the silent omission this console exists to prevent — but
   * it cannot be overridden.
   */
  task_key: string | null
  label: string | null
  /**
   * Whether THIS organisation can change the schedule.
   *
   * Only two of the six commands accept a tenant. `events:project` drains every
   * organisation in one pass, so it cannot run on a different schedule for one of
   * them — and offering the control anyway would be a setting that is accepted
   * and never acted on.
   */
  tenant_scoped: boolean
  /** Why it cannot be changed here. Null when it can. */
  estate_reason: string | null
  overridden: boolean
  disabled_here: boolean
  override_updated_by: string | null
  /** The effective expression: the override where there is one. */
  expression: string
  /** What the application ships, so a changed row can show what it changed from. */
  shipped_expression: string
  schedule: CronFields
  /** The expression as a sentence, or null for a shape the describer does not cover. */
  describes: string | null
  timezone: string
  next_run_at: string | null
  /** A stuck task that cannot overlap reports differently from one merely due. */
  without_overlapping: boolean
  on_one_server: boolean
  in_background: boolean
  last_run_at: string | null
  last_run_status: 'ok' | 'failed' | null
  last_run_duration_ms: number | null
  available: { last_run: boolean }
  source: string
}

export interface SchedulerPayload {
  tasks: ScheduledTask[]
  summary: {
    total: number
    failing: number
    never_run: number
    /** How many of these this organisation can change at all. Usually a minority. */
    configurable: number
    overridden: number
    disabled_here: number
  }
  ledger_installed: boolean
  queue: {
    connection: string
    pending: number | null
    failed: number | null
    /** Always false — see the file note. */
    tenant_scoped: boolean
  }
}

export function fetchScheduledTasks(): Promise<SchedulerPayload> {
  return platformRequest<SchedulerPayload>('/scheduler/tasks')
}

export interface ScheduleOverride {
  task_key: string
  schedule?: Partial<CronFields>
  disabled?: boolean
  /**
   * Throw away this organisation's override and follow the shipped schedule
   * again. Deletes the row rather than writing the current default into it, so a
   * later improvement to the shipped schedule still reaches this tenant.
   */
  reset?: boolean
}

export function saveScheduleOverride(input: ScheduleOverride): Promise<unknown> {
  return platformRequest('/scheduler/tasks', undefined, { method: 'POST', body: input })
}
