/**
 * LMS reports.
 *
 * Backed by /api/lms/reports/* (App\Http\Controllers\Api\LmsReportController).
 *
 * Three menu rows have pointed at these since the navigation table was written
 * — Employee Analysis (151), Quiz Progress (152), Question-wise (153) — under a
 * parent whose status is 0, with no permission rows and no screen. Two of the
 * three had nothing to report on until the quiz tables and quiz authoring
 * existed, which is why they stayed unbuilt rather than merely unbuilt-yet.
 *
 * Every figure is derived on read from the same rows the LMS screens use. None
 * is stored or cached: a report that disagrees with the screen it summarises is
 * worse than no report.
 */

import { apiClient } from '@/services/core'
import { withLaravelParams, type LaravelContext } from '@/lib/laravel-context'

export interface ReportResponse<T, M> {
  status: boolean
  data: T[]
  meta: M
}

/* ─── Employee analysis ────────────────────────────────────────────────────── */

export interface EmployeeAnalysisRow {
  user_id: number
  learner_name: string
  employee_no: string | null
  department: string | null
  enrolled: number
  completed: number
  in_progress: number
  pending: number
  completion_rate: number
  lessons_completed: number
  /** Real time recorded by the player, not a desk-time reading. */
  hours_spent: number
  quiz_attempts: number
  quizzes_passed: number
  mean_quiz_percent: number | null
  certificates: number
  last_activity: string | null
}

export interface EmployeeAnalysisMeta {
  learners: number
  enrolled: number
  completed: number
  hours_spent: number
  certificates: number
}

/* ─── Quiz progress ────────────────────────────────────────────────────────── */

export interface QuizProgressRow {
  paper_id: number
  paper_name: string | null
  course_id: number | null
  course_name: string | null
  questions: number
  total_marks: number
  passing_score: number | null
  attempts: number
  learners: number
  passes: number
  /** Null when nobody has sat it — which is not the same as 0%. */
  pass_rate: number | null
  mean_percent: number | null
  best_percent: number | null
  worst_percent: number | null
  awaiting_review: number
  last_attempt: string | null
  /** A quiz with no questions cannot be sat at all. */
  unusable: boolean
}

export interface QuizProgressMeta {
  papers: number
  unusable: number
  attempts: number
  passes: number
  awaiting_review: number
}

/* ─── Question-wise ────────────────────────────────────────────────────────── */

export interface QuestionWiseRow {
  question_id: number
  question_title: string | null
  points: number
  paper_id: number
  paper_name: string | null
  answered: number
  correct: number
  /** Answers a model could not mark — excluded from the rate, not counted wrong. */
  unmarked: number
  correct_rate: number | null
  mean_score: number | null
}

export interface QuestionWiseMeta {
  questions: number
  answered: number
  unanswered_questions: number
  /** Questions almost everybody gets right — they measure nothing. */
  too_easy: number
  /** Questions almost nobody gets right — usually wording, not difficulty. */
  too_hard: number
  note?: string
}

function params(context: LaravelContext, extra?: Record<string, string>) {
  return withLaravelParams(context, extra) as Record<string, string>
}

export const lmsReportService = {
  employeeAnalysis: (context: LaravelContext) =>
    apiClient.get<ReportResponse<EmployeeAnalysisRow, EmployeeAnalysisMeta>>(
      '/lms/reports/employee-analysis',
      params(context),
    ),

  quizProgress: (context: LaravelContext) =>
    apiClient.get<ReportResponse<QuizProgressRow, QuizProgressMeta>>(
      '/lms/reports/quiz-progress',
      params(context),
    ),

  /** Omit paperId for every paper in the tenant. */
  questionWise: (context: LaravelContext, paperId?: number) =>
    apiClient.get<ReportResponse<QuestionWiseRow, QuestionWiseMeta>>(
      '/lms/reports/question-wise',
      params(context, paperId ? { paper_id: String(paperId) } : undefined),
    ),
}
