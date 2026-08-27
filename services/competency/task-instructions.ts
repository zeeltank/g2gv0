/**
 * "How do I do this?" — the procedure behind a task somebody was assigned.
 *
 * Every other ESO service here is admin-facing. This one is for the person
 * doing the work: it is token-authenticated and the server scopes it by
 * ownership, so an employee sees the instructions for their own task and
 * nobody else's.
 *
 * It deliberately carries no executability score and no risk class. An employee
 * opening their own work should not be told in passing that a machine could do
 * it.
 */

import { apiClient, buildApiUrl } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'
import type { EsoStep, EsoInput, EsoOutput } from './eso'

export interface TaskInstructions {
  /** False when this work item is not linked to a job role duty at all. */
  has_duty: boolean
  has_eso: boolean
  task: { id: number; title: string }
  duty: { task: string; jobrole: string; critical_work_function: string | null } | null
  execution: {
    mode: string
    mode_meaning: string | null
    /** A person has agreed this is how the work is done. */
    confirmed: boolean
  } | null
  eso: {
    id: number
    title: string
    version: number
    status: string
    source: string
    /** Only a Published procedure is the agreed way of working. */
    is_agreed: boolean
    objective: string | null
    expected_outcome: string | null
    human_responsibility: string | null
    steps: EsoStep[]
    required_controls: string[]
    prohibited_actions: string[]
    escalation_triggers: string[]
    inputs: EsoInput[]
    outputs: EsoOutput[]
  } | null
  acceptance_criteria: string | null
  observation_point: string | null
  kra: string | null
  kpa: string | null
}

interface Envelope {
  status: number
  reason: string | null
  message: string | null
  data: TaskInstructions
}

export const taskInstructionsService = {
  /** `taskId` is the assigned work item's id, not the job role task's. */
  get: (context: LaravelContext, taskId: number) =>
    apiClient.get<Envelope>(
      `/competency/task-instructions/${taskId}`,
      withLaravelParams(context),
    ),

  /** The same procedure as a file, for printing or carrying off-screen. */
  downloadUrl: (context: LaravelContext, taskId: number, format: 'md' | 'pdf') =>
    buildApiUrl(`/competency/task-instructions/${taskId}/download`, {
      ...(withLaravelParams(context) as Record<string, string>),
      format,
    }),
}
