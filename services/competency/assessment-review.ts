import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/**
 * THE ADMINISTRATOR'S HALF of an assessment — read it, assign it, mark it,
 * decide what it means.
 *
 * Deliberately a separate module from `ai-assessment.ts`, which is the TAKER's
 * side. That file's whole security argument is that `mine()` and `submit()`
 * accept no subject, so they cannot be pointed at another person. Every call
 * here does the opposite: it names somebody else, and every route behind it is
 * `profile:admin,hr`. Mixing the two in one file would blur a distinction the
 * server takes seriously.
 *
 * ⚠ `test(id)` IS THE ONLY CALL IN THE SYSTEM THAT RETURNS CORRECT ANSWERS.
 * It exists because the draft/publish split asks a person to read what an LLM
 * wrote before an employee is assessed on it — which is impossible without
 * seeing what it marks against. Never render its `correct_option` or
 * `model_answer` anywhere an employee can reach.
 */

export interface AssessmentTestRow {
  id: number
  title: string
  status: 'draft' | 'published' | 'superseded' | string
  scope_type: 'jobrole' | 'competency' | 'kasba_item' | string
  model: string | null
  published_at: string | null
  time_limit_minutes: number | null
  pass_percent: number | null
  is_open: number
  jobrole: string | null
  competency_name: string | null
  questions: number
  assigned: number
  submitted: number
  awaiting_review: number
}

export interface AssessmentQuestionFull {
  id: number
  format: string
  question_text: string
  options: string[] | null
  /** ⚠ ADMIN EYES ONLY. */
  correct_option: string | null
  /** ⚠ ADMIN EYES ONLY. */
  model_answer: string | null
  max_score: number
  sort_order: number
  cited_item_label: string | null
  cited_kasba_type: string | null
  cited_competency_name: string | null
  cited_required_proficiency: string | null
}

export interface AttemptRow {
  id: number
  test_id: number
  user_id: number
  employee: string
  title: string
  due_date: string | null
  started_at: string | null
  submitted_at: string | null
  total_score: number | null
  max_score: number | null
  percent: number | null
  pass_percent: number | null
  awaiting_review: number
  status: string
}

export interface AttemptAnswer {
  question_id: number
  response_id: number | null
  format: string
  question_text: string
  options: string[] | null
  correct_option: string | null
  model_answer: string | null
  max_score: number
  cited_item_label: string | null
  cited_kasba_type: string | null
  answer_text: string | null
  selected_option: string | null
  /** Null means NOT YET MARKED. It does not mean zero. */
  score: number | null
  scored_by: 'auto' | 'ai' | 'manual' | null
  answered_at: string | null
}

export interface ProposalRow {
  id: number
  user_id: number
  employee: string
  item_label: string | null
  kasba_type: string | null
  competency_name: string | null
  test_title: string | null
  questions: number
  scored_percent: number | null
  /** Null when too few questions were scored to justify proposing anything. */
  proposed_rating: number | null
  current_rating: number | null
  status: string
  decided_at: string | null
}

export type RatingBands = Record<string, { min: number; label: string }>

export const assessmentReviewService = {
  /** Every test in the tenant, with question counts and how many have sat it. */
  async tests(context: LaravelContext, status?: string): Promise<AssessmentTestRow[]> {
    const res = await apiClient.get<{ status: number; data: AssessmentTestRow[] }>(
      '/competency/ai-assessment/tests',
      { ...withLaravelParams(context), ...(status ? { status } : {}) },
    )
    return res.data ?? []
  },

  /** ⚠ Returns correct answers. Admin-gated server-side; keep it admin-only here too. */
  async test(id: number, context: LaravelContext): Promise<{
    test: AssessmentTestRow & { instructions: string | null }
    questions: AssessmentQuestionFull[]
  }> {
    const res = await apiClient.get<{ status: number; data: { test: never; questions: never } }>(
      `/competency/ai-assessment/tests/${id}`,
      withLaravelParams(context),
    )
    return res.data
  },

  async assign(
    id: number,
    userIds: number[],
    context: LaravelContext,
    dueDate?: string,
  ): Promise<{ assigned: number; already_assigned: number; not_in_tenant: number; message: string }> {
    const res = await apiClient.post<{
      status: number
      data: { assigned: number; already_assigned: number; not_in_tenant: number }
      message: string
    }>(`/competency/ai-assessment/tests/${id}/assign`, {
      ...withLaravelParams(context),
      user_ids: userIds,
      ...(dueDate ? { due_date: dueDate } : {}),
    })
    return { ...res.data, message: res.message }
  },

  async attempts(context: LaravelContext, params: { testId?: number; status?: string } = {}): Promise<AttemptRow[]> {
    const res = await apiClient.get<{ status: number; data: AttemptRow[] }>(
      '/competency/ai-assessment/attempts',
      {
        ...withLaravelParams(context),
        ...(params.testId ? { test_id: String(params.testId) } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
    )
    return res.data ?? []
  },

  async answers(attemptId: number, context: LaravelContext): Promise<{ attempt: AttemptRow; answers: AttemptAnswer[] }> {
    const res = await apiClient.get<{ status: number; data: { attempt: never; answers: never } }>(
      `/competency/ai-assessment/attempts/${attemptId}/answers`,
      withLaravelParams(context),
    )
    return res.data
  },

  /**
   * Mark one written answer by hand.
   *
   * Writes `scored_by = 'manual'`, a value the schema has always allowed and no
   * code has ever produced — so an answer could be written and never marked by
   * anyone. A human mark overrides an AI one and the record says which it was.
   */
  async scoreAnswer(responseId: number, score: number, context: LaravelContext): Promise<{ message: string }> {
    const res = await apiClient.post<{ status: number; message: string }>(
      `/competency/ai-assessment/responses/${responseId}/score`,
      { ...withLaravelParams(context), score },
    )
    return { message: res.message }
  },

  /** What results are SUGGESTING about people, awaiting a decision. */
  async proposals(context: LaravelContext, status = 'pending'): Promise<{
    rows: ProposalRow[]
    bands: RatingBands
    minQuestions: number
  }> {
    const res = await apiClient.get<{
      status: number
      data: ProposalRow[]
      bands: RatingBands
      min_questions_to_propose: number
    }>('/competency/ai-assessment/proposals', { ...withLaravelParams(context), status })

    return { rows: res.data ?? [], bands: res.bands ?? {}, minQuestions: res.min_questions_to_propose ?? 2 }
  },

  /**
   * Approve and the rating is written with `source='assessment'`; reject and the
   * result stays on record while the rating does not move.
   */
  async decide(
    id: number,
    decision: 'approve' | 'reject',
    context: LaravelContext,
    note?: string,
  ): Promise<{ message: string }> {
    const res = await apiClient.post<{ status: number; message: string }>(
      `/competency/ai-assessment/proposals/${id}/decide`,
      { ...withLaravelParams(context), decision, ...(note ? { note } : {}) },
    )
    return { message: res.message }
  },
}
