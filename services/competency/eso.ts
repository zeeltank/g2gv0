/**
 * ESO — the execution model for a task. §5 of the ESO v1 document.
 *
 * `task-execution.ts` answers HOW MUCH of a role could be automated.
 * This answers HOW a task is actually done: the steps, who performs each one,
 * what must never happen, and what evidence comes out.
 *
 * ── TWO RULES THIS LAYER CARRIES UPWARD ─────────────────────────────────────
 *
 * A Template is shared across every organisation and is READ-ONLY — the server
 * refuses a write with `reason: 'template_readonly'`. Editing means creating an
 * Instance from it.
 *
 * A generated ESO is `Draft` / `ai-generated` and cannot go straight to
 * Published. Somebody reads it first. Same rule the classification layer holds:
 * a machine's description of how to do a person's job is a proposal.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'
import type { ExecutionMode } from './task-execution'

export type EsoScope = 'Template' | 'Instance'
export type EsoStatus = 'Draft' | 'Reviewed' | 'Published' | 'Retired'

/** §5.13 — one workflow step. `actor` is human, agent or deterministic software. */
export interface EsoStep {
  seq?: number
  description?: string
  actor?: 'H' | 'A' | 'S'
  tool?: string
  output?: string
}

export interface EsoInput {
  name?: string
  source?: string
  format?: string
  required?: boolean
}

export interface EsoOutput {
  name?: string
  format?: string
  destination?: string
}

/** §5.18 — the link back to the capability engine. */
export interface EsoEvidence {
  evidence_type?: string
  competency_id?: number | null
  format?: string
}

export interface EsoRecord {
  id: number
  scope: EsoScope
  sub_institute_id: number | null
  user_jobrole_task_id: number | null
  catalogue_task_id: number | null
  eso_template_id: number | null
  title: string
  version: number
  status: EsoStatus
  execution_mode: ExecutionMode | null

  objective: string | null
  expected_outcome: string | null
  human_responsibility: string | null
  agent_responsibility: string | null

  /** The server decodes every list field, so a screen never parses JSON. */
  human_decision_points: string[]
  escalation_triggers: string[]
  steps: EsoStep[]
  inputs: EsoInput[]
  outputs: EsoOutput[]
  required_controls: string[]
  prohibited_actions: string[]
  evidence_emitted: EsoEvidence[]

  /** 'human' or 'ai-generated'. A generated ESO must be visibly distinguishable. */
  source: string
  model: string | null

  /** How complete this record is — §6.4 exists to find out which fields get filled. */
  fields_filled: number
  fields_total: number
}

interface Envelope<T> {
  status: number
  message?: string
  reason?: string
  detail?: string | null
  data: T
}

export const esoService = {
  /** Shared templates plus this tenant's own instances. Never another tenant's. */
  list: (context: LaravelContext, params: { scope?: EsoScope; status?: string; task_id?: number } = {}) =>
    apiClient.get<Envelope<EsoRecord[]> & { statuses: EsoStatus[]; modes: Record<string, string> }>(
      '/competency/eso',
      {
        ...withLaravelParams(context),
        ...(params.scope ? { scope: params.scope } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.task_id ? { task_id: String(params.task_id) } : {}),
      },
    ),

  get: (context: LaravelContext, id: number) =>
    apiClient.get<Envelope<EsoRecord>>(`/competency/eso/${id}`, withLaravelParams(context)),

  create: (context: LaravelContext, body: Partial<EsoRecord> & { title: string; scope: EsoScope }) =>
    apiClient.post<Envelope<{ id: number }>>('/competency/eso', { ...withLaravelParams(context), ...body }),

  update: (context: LaravelContext, id: number, body: Partial<EsoRecord>) =>
    apiClient.put<Envelope<null>>(`/competency/eso/${id}`, { ...withLaravelParams(context), ...body }),

  setStatus: (context: LaravelContext, id: number, status: EsoStatus, note?: string) =>
    apiClient.post<Envelope<null>>(`/competency/eso/${id}/status`, {
      ...withLaravelParams(context), status, note,
    }),

  remove: (context: LaravelContext, id: number) =>
    apiClient.delete<Envelope<null>>(`/competency/eso/${id}`, withLaravelParams(context)),

  /**
   * The §6.3 "Generate ESO with AI" action. Always lands as Draft /
   * ai-generated, and refuses if the task already has one rather than
   * spending on a second answer to the same question.
   */
  generate: (context: LaravelContext, taskId: number) =>
    apiClient.post<Envelope<{ id: number; title: string; execution_mode: ExecutionMode | null }>>(
      '/competency/eso/generate',
      { ...withLaravelParams(context), user_jobrole_task_id: taskId },
    ),
}

/** What each step actor means, spelled out — 'H'/'A'/'S' is not self-explanatory. */
export const ACTOR_LABEL: Record<string, string> = {
  H: 'Person',
  A: 'AI agent',
  S: 'Software',
}

export const ACTOR_STYLE: Record<string, string> = {
  H: 'border-primary/30 bg-primary/10 text-primary',
  A: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  S: 'border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-300',
}

export const STATUS_STYLE: Record<EsoStatus, string> = {
  Draft: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Reviewed: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  Published: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Retired: 'border-border bg-muted text-muted-foreground',
}
