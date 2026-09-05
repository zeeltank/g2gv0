/**
 * Course quiz — the gate between finishing the lessons and earning the
 * certificate.
 *
 * Backed by /api/lms/learning/courses/{id}/quiz and
 * /api/lms/learning/quiz/{attemptId} (App\Http\Controllers\Api\LmsQuizController).
 *
 * ── WHAT IS NOT IN THESE TYPES, DELIBERATELY ────────────────────────────────
 *
 * There is no `correct_answer` on QuizOption, and there will not be one. The
 * server does not send it, because a field that reaches the browser is a field
 * the learner can read — the legacy exam page put the correctness flag in each
 * radio button's own `value` attribute and then trusted the submission to
 * report back whether it had been right.
 *
 * Marking happens on the server, against answer_master, at submit time.
 */

import { apiClient } from '@/services/core'
import { withLaravelParams, type LaravelContext } from '@/lib/laravel-context'

export interface QuizApiResponse<T> {
  status: boolean
  message?: string
  data: T
}

export interface QuizOption {
  id: number
  /** May contain HTML — the authoring tools store rich text. */
  answer: string
}

export interface QuizQuestion {
  id: number
  question_title: string | null
  description: string | null
  points: number
  multiple_answer: boolean
  hint_text: string | null
  /** No options means a written answer, marked by the AI marker. */
  is_written: boolean
  options: QuizOption[]
}

export interface QuizAttemptSummary {
  id: number
  attempt_no: number
  status: 'in-progress' | 'submitted'
  score: number | null
  max_score: number | null
  percent: number | null
  passed: boolean | null
  /** Answers a model could not mark. They are unscored, NOT zero. */
  awaiting_review: number
  started_at: string | null
  submitted_at: string | null
}

/**
 * Everything the quiz card needs to explain itself.
 *
 * `can_start` and `locked_reason` come as a pair from the server: the reason a
 * quiz is unavailable is decided by the same code that would refuse the start,
 * so the button is never offered and then rejected.
 */
export interface QuizOverview {
  has_quiz: boolean
  course_id: number
  course_title?: string
  paper_id?: number
  paper_name?: string | null
  paper_desc?: string | null
  /** Minutes, or null when the paper has no time limit. */
  time_allowed?: number | null
  total_questions?: number
  passing_score?: number | null
  max_attempts?: number | null
  attempts_used?: number
  attempts_left?: number | null
  lessons_total?: number
  lessons_done?: number
  can_start?: boolean
  locked_reason?: string | null
  best_percent?: number | null
  passed?: boolean
  attempts?: QuizAttemptSummary[]
}

export interface QuizStartResponse {
  attempt_id: number
  attempt_no: number
  started_at: string
  time_allowed: number | null
  passing_score: number | null
  questions: QuizQuestion[]
}

export interface QuizSubmitResponse {
  attempt_id: number
  score: number
  max_score: number
  percent: number
  passing_score: number | null
  passed: boolean
  questions: number
  awaiting_review: number
  /** How many competency ratings this result proposed, and how many applied. */
  ratings_proposed: number
  ratings_applied: number
  certificate_available: boolean
}

export interface QuizResponseRow {
  question_id: number
  question_title: string | null
  answer_id: number | null
  narrative: string | null
  is_correct: number | null
  score: number | null
  max_score: number | null
  ai_marked: number
  feedback: string | null
  /** Only present when the paper's author chose to reveal answers. */
  correct_answer?: string
}

export interface QuizResultResponse {
  attempt: QuizAttemptSummary & {
    course_id: number
    paper_id: number
    passing_score: number | null
  }
  show_answers: boolean
  responses: QuizResponseRow[]
}

/**
 * question_id -> the chosen option id, a list of them for a multi-answer
 * question, or free text for a written one.
 */
export type QuizAnswers = Record<number, number | number[] | string>

function params(context: LaravelContext, extra?: Record<string, string>) {
  return withLaravelParams(context, extra) as Record<string, string>
}

export const lmsQuizService = {
  /** GET /api/lms/learning/courses/{courseId}/quiz */
  overview: (context: LaravelContext, courseId: number) =>
    apiClient.get<QuizApiResponse<QuizOverview>>(
      `/lms/learning/courses/${courseId}/quiz`,
      params(context),
    ),

  /**
   * POST /api/lms/learning/courses/{courseId}/quiz/start
   *
   * Returns the open attempt when one exists rather than starting another, so
   * closing the tab mid-quiz does not burn an attempt.
   */
  start: (context: LaravelContext, courseId: number) =>
    apiClient.post<QuizApiResponse<QuizStartResponse>>(
      `/lms/learning/courses/${courseId}/quiz/start`,
      params(context),
    ),

  /** POST /api/lms/learning/quiz/{attemptId}/submit */
  submit: (context: LaravelContext, attemptId: number, answers: QuizAnswers) =>
    apiClient.post<QuizApiResponse<QuizSubmitResponse>>(
      `/lms/learning/quiz/${attemptId}/submit`,
      { ...params(context), answers },
    ),

  /** GET /api/lms/learning/quiz/{attemptId} */
  result: (context: LaravelContext, attemptId: number) =>
    apiClient.get<QuizApiResponse<QuizResultResponse>>(
      `/lms/learning/quiz/${attemptId}`,
      params(context),
    ),
}
