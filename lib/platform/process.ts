/**
 * Add Process — a written procedure, turned into tasks somebody can do.
 *
 * ── `issues` IS PART OF THE ANSWER, NOT AN ERROR CHANNEL ────────────────────
 *
 * The parser is deterministic and reports what it could not read rather than
 * asking a model to fill the gap. A line it skipped appears in `issues` so the
 * author can fix it at the source. That matters because these steps become real
 * tasks in real queues: a line nobody parsed is a gap somebody can see, whereas
 * an invented step is work that looks reviewed and is not.
 */

import { platformRequest } from './client'

export interface ProcessStep {
  order: number
  text: string
  /** Who does it, from a trailing "(Role)". Null when the line named nobody. */
  actor: string | null
  /** Marked with `[approval]` in the procedure text. */
  is_approval: boolean
}

export interface DerivedTask {
  /** Stable across re-parses, which is how a second publish knows what it raised. */
  ref: string
  title: string
  actor: string
  is_approval: boolean
  due_in_days: number
}

export interface ProcessSpec {
  name: string
  objective: string | null
  trigger: string | null
  completion: string | null
  steps: ProcessStep[]
  /** Only steps that name an actor. A step nobody performs is not a task. */
  tasks: DerivedTask[]
  issues: string[]
}

export interface ProcessRow {
  id: number
  name: string
  module: string
  status: 'draft' | 'published'
  source_text: string
  spec: ProcessSpec
  /** What this process has actually raised. */
  published_tasks: number
  /**
   * Of those, how many are done — joined through to the real `task` table's own
   * status. Null (not 0) when nothing has been published yet: "0 of 0" reads as a
   * stalled process, and this one just has not been raised.
   */
  completed_tasks: number | null
  created_at: string | null
  created_by: string | null
  updated_at: string | null
  updated_by: string | null
}

export interface PublishResult {
  created: { ref: string; task_id: number }[]
  /** Named, not counted — "3 skipped" leaves somebody wondering which. */
  already_published: string[]
  problems: string[]
}

export function convertProcedure(sourceText: string, name?: string): Promise<{ spec: ProcessSpec }> {
  return platformRequest<{ spec: ProcessSpec }>('/process/convert', undefined, {
    method: 'POST',
    body: { source_text: sourceText, name },
  })
}

export function fetchProcesses(): Promise<{ rows: ProcessRow[] }> {
  return platformRequest<{ rows: ProcessRow[] }>('/process')
}

export interface ProcessTaskRow {
  task_id: number
  task_ref: string
  title: string
  assignee_id: number | null
  created_at: string | null
  completed: boolean
}

export function fetchProcess(
  id: number,
): Promise<{ process: ProcessRow; tasks: ProcessTaskRow[] }> {
  return platformRequest(`/process/${id}`)
}

export interface ProcessVersion {
  id: number
  source_text: string
  spec: ProcessSpec
  changed_by: string | null
  created_at: string | null
}

/** The state each row held BEFORE the edit that produced it — see the migration's note. */
export function fetchProcessHistory(id: number): Promise<{ versions: ProcessVersion[] }> {
  return platformRequest<{ versions: ProcessVersion[] }>(`/process/${id}/history`)
}

export function createProcess(input: {
  name: string
  module: string
  source_text: string
}): Promise<{ id: number; spec: ProcessSpec }> {
  return platformRequest('/process', undefined, { method: 'POST', body: input })
}

export function deleteProcess(id: number): Promise<{ deleted: number }> {
  return platformRequest(`/process/${id}`, undefined, { method: 'DELETE' })
}

/** `assignments` is task ref → user id. */
export function publishProcess(
  id: number,
  assignments: Record<string, number>,
): Promise<PublishResult> {
  return platformRequest<PublishResult>(`/process/${id}/publish`, undefined, {
    method: 'POST',
    body: { assignments },
  })
}
