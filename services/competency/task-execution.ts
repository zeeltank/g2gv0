/**
 * ESO — how a job role's work is executed.
 *
 * A job role task has been a sentence and nothing else. These endpoints add the
 * execution model behind it: which tasks need a person, which a machine could
 * do, at what risk, and what a role's work is actually composed of.
 *
 * THE ONE RULE THIS LAYER CARRIES UPWARD: a classification the model produced
 * is `AI-proposed`, not fact. The server never writes `Approved` from a
 * classification pass, and the composition endpoint counts approved and
 * proposed separately so a screen cannot accidentally present one as the other.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/** The six modes. `system_automated` is deliberately NOT an AI mode. */
export type ExecutionMode =
  | 'human_only'
  | 'human_ai_assist'
  | 'ai_human_review'
  | 'ai_supervised'
  | 'ai_autonomous'
  | 'system_automated'

export type RiskClass = 'Low' | 'Medium' | 'High' | 'Regulated'

export type ClassificationStatus = 'AI-proposed' | 'Human-reviewed' | 'Approved'

/** One task, with its classification if it has one. */
export interface TaskExecutionRow {
  id: number
  task: string
  critical_work_function: string | null
  jobrole: string | null

  /** Null on every field below when the task has not been classified yet. */
  execution_id: number | null
  execution_mode_current: ExecutionMode | null
  execution_mode_target: ExecutionMode | null
  digital_input: number | null
  rule_clarity: number | null
  judgment_required: number | null
  error_consequence: number | null
  ai_executability_score: number | null
  risk_class: RiskClass | null
  automation_rationale: string | null
  human_effort_current_min: number | null
  human_effort_target_min: number | null
  classification_status: ClassificationStatus | null
  model: string | null
  reviewed_at: string | null
}

export interface TaskExecutionIndexResponse {
  status: number
  data: TaskExecutionRow[]
  /** Mode → what it means. Sent by the server so no screen hardcodes the vocabulary. */
  modes: Record<ExecutionMode, string>
  /** Risk class → the most autonomous mode it may reach. The policy, not a guess. */
  risk_ceiling: Record<RiskClass, ExecutionMode>
  weights: Record<string, number>
  empty_is_expected: boolean
  empty_reason: string
}

export interface RoleProgressRow {
  jobrole: string
  tasks: number
  classified: number
  approved: number
}

export interface CompositionData {
  total_tasks: number
  classified: number
  approved: number
  proposed: number
  /** Its own bucket. Never folded into "human" — not-yet-looked-at is not the same fact. */
  unclassified: number
  /** Every classified task, approved or not. Use for the full-width bar. */
  modes: Record<ExecutionMode, number>
  /**
   * APPROVED TASKS ONLY. Every headline figure must come from this one.
   *
   * `modes` includes unreviewed AI proposals. A share computed from it but
   * presented as a finding reports a model's opinion as fact — which is the
   * one failure that would cost this feature its credibility permanently.
   */
  modes_approved: Record<ExecutionMode, number>
  automatable: number
  /** Null — not 0 — when nothing is approved. The two are different facts. */
  automatable_percent: number | null
  /** Always 'approved'. Sent so a screen cannot silently change the basis. */
  automatable_basis: string
  average_executability: number | null
  effort: {
    /** How many APPROVED tasks the effort totals are built from. */
    tasks_with_estimates: number
    current_minutes: number | null
    target_minutes: number | null
    released_minutes: number | null
  }
}

export interface ClassifyResult {
  classified: number
  rows_written: number
  distinct: number
  dropped: number
  clamped: number
  reused_rows: number
  reused_texts: number
  reason: string | null
}

interface Envelope<T> {
  status: number
  message?: string
  reason?: string
  data: T
}

export const taskExecutionService = {
  /** Every role with how far its classification has got. */
  roles: (context: LaravelContext) =>
    apiClient.get<Envelope<RoleProgressRow[]>>(
      '/competency/task-execution/roles',
      withLaravelParams(context),
    ),

  /**
   * A role's tasks with their classification.
   *
   * Unclassified tasks come back too. The gap is the point — a screen that
   * filtered them out would show a role as fully classified when it is not.
   */
  list: (context: LaravelContext, params: { jobrole?: string; status?: string } = {}) =>
    apiClient.get<TaskExecutionIndexResponse>(
      '/competency/task-execution',
      {
        ...withLaravelParams(context),
        // Only send filters that have a value. An empty `jobrole=` would be a
        // filter on the empty string, not the absence of one.
        ...(params.jobrole ? { jobrole: params.jobrole } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
    ),

  /**
   * Run the classification pass over one job role.
   *
   * Synchronous and one role at a time: there is no queue worker in this
   * deployment, and a median role is 19 tasks — one model call.
   */
  classify: (context: LaravelContext, jobrole: string, reclassify = false) =>
    apiClient.post<Envelope<ClassifyResult>>(
      '/competency/task-execution/classify',
      { ...withLaravelParams(context), jobrole, reclassify },
    ),

  /** Approve proposals, or override one with a reason. */
  review: (
    context: LaravelContext,
    body: {
      execution_ids: number[]
      decision: 'approve' | 'override'
      execution_mode_target?: ExecutionMode
      risk_class?: RiskClass
      note?: string
    },
  ) =>
    apiClient.post<Envelope<{ approved?: number; overridden?: number }>>(
      '/competency/task-execution/review',
      { ...withLaravelParams(context), ...body },
    ),

  /** The work composition map — the artifact worth showing a customer. */
  composition: (context: LaravelContext, jobrole?: string) =>
    apiClient.get<Envelope<CompositionData> & { modes_meta: Record<ExecutionMode, string> }>(
      '/competency/task-execution/composition',
      { ...withLaravelParams(context), ...(jobrole ? { jobrole } : {}) },
    ),
}

/* ------------------------------------------------------------------ *
 * Presentation vocabulary — one answer, shared by every ESO screen
 * ------------------------------------------------------------------ */

/**
 * Short labels for the six modes.
 *
 * The server sends the full definitions; these are the two-word versions a
 * table cell can hold. They live here rather than in a component so the task
 * card, the review table and the composition bar cannot drift apart.
 */
export const MODE_LABEL: Record<ExecutionMode, string> = {
  human_only: 'Human only',
  human_ai_assist: 'Human + AI',
  ai_human_review: 'AI, human checks',
  ai_supervised: 'AI, supervised',
  ai_autonomous: 'AI, autonomous',
  system_automated: 'Software',
}

/**
 * Ordered least to most autonomous, for stacked bars and sorting.
 * `system_automated` sits at the end because it is off the AI ladder entirely.
 */
export const MODE_ORDER: ExecutionMode[] = [
  'human_only',
  'human_ai_assist',
  'ai_human_review',
  'ai_supervised',
  'ai_autonomous',
  'system_automated',
]

/**
 * Colours for the composition bar.
 *
 * A deliberate progression from human (primary) to machine (emerald) so the
 * bar reads left to right as "how much of this role is already automatable".
 * Written as literal class strings because Tailwind cannot see interpolated ones.
 */
export const MODE_STYLE: Record<ExecutionMode, { bar: string; badge: string }> = {
  human_only: { bar: 'bg-primary', badge: 'border-primary/30 bg-primary/10 text-primary' },
  human_ai_assist: { bar: 'bg-sky-500', badge: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  ai_human_review: { bar: 'bg-violet-500', badge: 'border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  ai_supervised: { bar: 'bg-amber-500', badge: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  ai_autonomous: { bar: 'bg-emerald-500', badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  system_automated: { bar: 'bg-slate-400', badge: 'border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-300' },
}

export const RISK_STYLE: Record<RiskClass, string> = {
  Low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Medium: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  High: 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400',
  Regulated: 'border-destructive/30 bg-destructive/10 text-destructive',
}
