import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/**
 * AI-GENERATED CAPABILITY ASSESSMENT — the client half.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * HOW TENANT AND USER SECURITY ACTUALLY WORKS HERE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * THE SERVER DECIDES, NOT THIS FILE. `withLaravelParams` attaches the caller's
 * token; the server resolves tenant and identity FROM THAT TOKEN and never from
 * anything sent alongside it. Nothing in this module can widen what a caller
 * sees, and that is deliberate — a client-side scope check is a suggestion.
 *
 * TWO AUDIENCES, TWO DIFFERENT PROTECTIONS:
 *
 *   generate / publish   profile:admin,hr on the route. An employee calling
 *                        these is refused by middleware before any handler runs.
 *
 *   mine / submit        THESE TAKE NO user_id AT ALL. Not "the server checks
 *                        the user_id matches" — there is no user_id to check.
 *                        An endpoint with no subject cannot be pointed at
 *                        somebody else, because there is no parameter to point.
 *
 * THAT IS WHY `mine()` AND `submitAnswers()` BELOW ACCEPT NO EMPLOYEE ARGUMENT.
 * If you ever find yourself wanting to add one, the answer is a different
 * endpoint with an admin guard, not a parameter on this one.
 *
 * The system's `data_scope` column is read by NOTHING server-side — measured,
 * zero occurrences. Self-scoping therefore cannot be delegated to it, and is
 * enforced by the shape of the endpoint instead.
 */

export interface AiQuestion {
  id: number
  format: 'mcq' | 'short_answer' | string
  question_text: string
  /** MCQ choices; null for short_answer. */
  options: string[] | null
  max_score: number
  /** The caller's own previous answer, if they have one. */
  answer_text: string | null
  selected_option: string | null
  answered_at: string | null
}

export interface AiTest {
  id: number
  title: string
  instructions: string | null
  published_at: string | null
}

export interface MyTestResult {
  test: AiTest | null
  questions: AiQuestion[]
  total: number
  answered: number
  /** Outstanding, never reported as a score of nothing. */
  unanswered: number
  submitted: boolean
  empty_is_expected: boolean
  empty_reason: string | null
}

export interface GenerateResult {
  test_id: number
  jobrole_id: number
  model: string | null
  items_available: number
  questions_saved: number
  status_is: string
  questions_requested: number
  /** Questions the server refused: an invented item id, or an unscorable MCQ. */
  questions_dropped: number
  message: string
}

export interface PublishResult {
  test_id: number
  jobrole_id: number
  status_is: 'published' | 'draft' | string
  questions: number
  /** Previously published tests for this role that are no longer shown. */
  superseded: number
  message: string
}

export const aiAssessmentService = {
  /**
   * HR/Admin — the tenant's job roles, with how many competencies each has.
   *
   * A role with competency_count = 0 CANNOT be assessed: generate() refuses it.
   * The count is returned so a screen can say so before the button is pressed —
   * an option that is offered and then refused is worse than one that explains
   * itself.
   */
  async jobroles(context: LaravelContext): Promise<{
    roles: { id: number; name: string; department: string | null; competency_count: number }[]
    total: number
    assessable: number
    empty_is_expected: boolean
    empty_reason: string | null
  }> {
    const res = await apiClient.get<{
      status: number
      data: {
        roles: { id: number; name: string; department: string | null; competency_count: number }[]
        total: number
        assessable: number
      }
      empty_is_expected: boolean
      empty_reason: string | null
    }>('/competency/ai-assessment/jobroles', withLaravelParams(context))

    return { ...res.data, empty_is_expected: res.empty_is_expected, empty_reason: res.empty_reason }
  },

  /**
   * HR/Admin — generate a test for a job role.
   *
   * Route-guarded profile:admin,hr. The server refuses before calling the model
   * when the job role has no competencies mapped, so an empty framework can
   * never produce a plausible-looking test about nothing.
   */
  async generate(
    input: {
      jobrole_id: number
      formats?: ('mcq' | 'short_answer')[]
      questions_per_item?: number
      title?: string | null
    },
    context: LaravelContext,
  ): Promise<GenerateResult> {
    const res = await apiClient.post<{ status: number; data: GenerateResult } & Record<string, unknown>>(
      '/competency/ai-assessment/generate',
      {
        ...withLaravelParams(context),
        jobrole_id: input.jobrole_id,
        formats: input.formats ?? ['mcq', 'short_answer'],
        questions_per_item: input.questions_per_item ?? 1,
        title: input.title ?? null,
      },
    )

    return {
      ...res.data,
      questions_requested: Number(res.questions_requested ?? 0),
      questions_dropped: Number(res.questions_dropped ?? 0),
      message: String(res.message ?? ''),
    }
  },

  /**
   * HR/Admin — publish a draft, or return it to draft.
   *
   * Publishing supersedes any other published test for the same job role. The
   * count comes back and MUST be shown: a screen that silently retires someone
   * else's test is a screen that lies about what the button did.
   */
  async publish(
    input: { test_id: number; publish?: boolean },
    context: LaravelContext,
  ): Promise<PublishResult> {
    const res = await apiClient.post<{ status: number; data: PublishResult; message: string }>(
      '/competency/ai-assessment/publish',
      {
        ...withLaravelParams(context),
        test_id: input.test_id,
        publish: input.publish ?? true,
      },
    )

    return { ...res.data, message: res.message }
  },

  /**
   * Employee — MY test. TAKES NO SUBJECT, BY DESIGN.
   *
   * There is no employee argument because the endpoint accepts none. The server
   * derives the person from the token and reads the published test for THEIR
   * job role. Answers already given come back attached to their questions.
   *
   * Correct answers are never sent — the payload has no correct_option and no
   * model_answer, so a viewer cannot read them out of the network response.
   */
  async mine(context: LaravelContext): Promise<MyTestResult> {
    const res = await apiClient.get<{
      status: number
      data: Omit<MyTestResult, 'empty_is_expected' | 'empty_reason'>
      empty_is_expected: boolean
      empty_reason: string | null
    }>('/competency/ai-assessment/mine', withLaravelParams(context))

    return {
      ...res.data,
      empty_is_expected: res.empty_is_expected,
      empty_reason: res.empty_reason,
    }
  },

  /**
   * Employee — submit answers. TAKES NO SUBJECT, BY DESIGN.
   *
   * Answers are recorded against the caller. A question id belonging to another
   * job role's test is DROPPED by the server and counted, not accepted.
   *
   * MCQ is scored automatically; a short answer is left UNSCORED awaiting
   * review, which is not the same as scoring it zero. Submitting does not change
   * anyone's proficiency — that remains an explicit, separate confirmation.
   */
  async submitAnswers(
    answers: { question_id: number; selected_option?: string | null; answer_text?: string | null }[],
    context: LaravelContext,
  ): Promise<{
    answers_written: number
    auto_scored: number
    awaiting_review: number
    dropped: number
    proficiency_unchanged: boolean
    message: string
  }> {
    const res = await apiClient.post<{
      status: number
      data: { answers_written: number; auto_scored: number; awaiting_review: number; dropped: number }
      proficiency_unchanged: boolean
      message: string
    }>('/competency/ai-assessment/submit', {
      ...withLaravelParams(context),
      answers,
    })

    return {
      ...res.data,
      proficiency_unchanged: res.proficiency_unchanged,
      message: res.message,
    }
  },
}
