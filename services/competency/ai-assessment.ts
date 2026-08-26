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

/** What a job role CONTAINS, so a test can be aimed at part of it. */
export interface ScopeOptions {
  jobrole: string
  competencies: Array<{
    id: number
    name: string
    required_proficiency: string | number | null
    items: Array<{ id: number; label: string; kasba_type: string }>
  }>
  total_items: number
}

/** What one sitting is worth, once it has been submitted. */
export interface AttemptResult {
  attempt_id: number
  score: number
  max_score: number
  percent: number | null
  awaiting_review: number
  proposals: number
  /** True when written answers still need marking. Ask for it separately. */
  marking_pending: boolean
}

export interface StartResult {
  attempt_id: number
  started_at: string | null
  time_limit_minutes: number | null
  /** Server-computed. Null when the test has no limit. Never negative. */
  seconds_remaining: number | null
  submitted_at: string | null
}

/**
 * A rating this result SUGGESTS - never one it applied.
 *
 * `status` is 'pending' until somebody decides. Shown to the person so they can
 * see what is being proposed about them, which is fairer than finding out after
 * their record has already changed.
 */
export interface RatingProposal {
  item_label: string | null
  kasba_type: string | null
  questions: number
  scored_percent: number | null
  /** Null when too few questions were scored to justify proposing anything. */
  proposed_rating: number | null
  current_rating: number | null
  status: 'pending' | 'approved' | 'rejected' | string
}

export interface MyResult {
  attempt: {
    id: number
    test_id: number
    title: string
    percent: number | null
    total_score: number | null
    max_score: number | null
    awaiting_review: number
    pass_percent: number | null
    submitted_at: string | null
    status: string
  }
  questions: Array<{
    id: number
    question_text: string
    format: string
    max_score: number
    cited_item_label: string | null
    cited_kasba_type: string | null
    cited_competency_name: string | null
    /** Your score. Null means not yet marked - NOT zero. */
    score: number | null
    scored_by: 'auto' | 'ai' | 'manual' | null
    answered_at: string | null
  }>
  proposals: RatingProposal[]
  /** Null when the test sets no pass mark, so it makes no pass/fail claim. */
  passed: boolean | null
  bands: Record<string, { min: number; label: string }>
}

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
      /**
       * What the test is ABOUT. 'jobrole' takes every KASBA item of every
       * competency mapped to the role; 'competency' narrows to one competency;
       * 'kasba_item' to a single item.
       *
       * Narrowing never escapes the role — the server keeps the role's own
       * mapping in the query either way, so a competency the role does not
       * require cannot be assessed by asking for it directly.
       */
      scope_type?: 'jobrole' | 'competency' | 'kasba_item'
      competency_id?: number | null
      kasba_item_id?: number | null
      /** Minutes for the WHOLE test. Omit for untimed. */
      time_limit_minutes?: number | null
      /** Omit so the test reports a score and makes no pass/fail claim. */
      pass_percent?: number | null
      /** True lets any employee take it without being assigned. */
      is_open?: boolean
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
        scope_type: input.scope_type ?? 'jobrole',
        // Sent only when they mean something. A competency_id riding along on a
        // whole-role generation would be stored as the test's scope and then
        // contradict the questions inside it.
        ...(input.scope_type === 'competency' && input.competency_id
          ? { competency_id: input.competency_id } : {}),
        ...(input.scope_type === 'kasba_item' && input.kasba_item_id
          ? { kasba_item_id: input.kasba_item_id } : {}),
        // Absent, not zero. The server treats a missing limit as untimed and a
        // missing pass mark as "makes no pass/fail claim"; sending 0 would mean
        // "no time at all" and "everybody passes".
        ...(input.time_limit_minutes ? { time_limit_minutes: input.time_limit_minutes } : {}),
        ...(input.pass_percent !== null && input.pass_percent !== undefined
          ? { pass_percent: input.pass_percent } : {}),
        is_open: Boolean(input.is_open),
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
  /**
   * Save answers, or submit the assessment.
   *
   * `final` is the difference between the two, and it matters: without it this
   * is a SAVE - answers are recorded and the person can come back. With it the
   * attempt is totalled, the result exists, and rating proposals are produced.
   *
   * A save that scored you would show a mark for a test you had not finished.
   */
  async submitAnswers(
    answers: { question_id: number; selected_option?: string | null; answer_text?: string | null }[],
    context: LaravelContext,
    final = false,
  ): Promise<{
    answers_written: number
    auto_scored: number
    awaiting_review: number
    dropped: number
    result: AttemptResult | null
    proficiency_unchanged: boolean
    message: string
  }> {
    const res = await apiClient.post<{
      status: number
      data: {
        answers_written: number; auto_scored: number; awaiting_review: number
        dropped: number; result: AttemptResult | null
      }
      proficiency_unchanged: boolean
      message: string
    }>('/competency/ai-assessment/submit', {
      ...withLaravelParams(context),
      answers,
      final,
    })

    return {
      ...res.data,
      proficiency_unchanged: res.proficiency_unchanged,
      message: res.message,
    }
  },

  /**
   * Open the sitting and start the clock.
   *
   * `seconds_remaining` is computed SERVER-SIDE from when the attempt was
   * started. The browser counts down from it but never decides it - a timer the
   * browser owns is a timer a refresh can reset.
   */
  /**
   * What this job role contains — its competencies and their KASBA items.
   *
   * Built from the same query `generate()` uses, so the list offered here is by
   * construction the list that gets assessed. A picker that could disagree with
   * the generator would offer scopes that then produce nothing, after a paid
   * model call.
   */
  async scopeOptions(jobroleId: number, context: LaravelContext): Promise<{
    data: ScopeOptions | null
    emptyReason: string | null
  }> {
    const res = await apiClient.get<{
      status: number
      data: ScopeOptions
      empty_is_expected: boolean
      empty_reason: string | null
    }>('/competency/ai-assessment/scope-options', {
      ...withLaravelParams(context),
      jobrole_id: String(jobroleId),
    })

    return { data: res.data ?? null, emptyReason: res.empty_is_expected ? res.empty_reason : null }
  },

  async start(testId: number, context: LaravelContext): Promise<StartResult> {
    const res = await apiClient.post<{ status: number; data: StartResult }>(
      '/competency/ai-assessment/start',
      { ...withLaravelParams(context), test_id: testId },
    )
    return res.data
  },

  /**
   * Mark this attempt's written answers with the model.
   *
   * A SEPARATE request from submitting, on purpose: marking is an HTTP call to
   * DeepSeek with a two-minute timeout, and nobody should watch a spinner that
   * long wondering whether their answers were saved. By the time this is
   * called they already are.
   *
   * Safe to retry - it only looks at answers that are still unscored.
   */
  async markMine(attemptId: number, context: LaravelContext): Promise<{
    marked: number
    left_for_review: number
    unavailable: string | null
    percent: number | null
    awaiting_review: number
    message: string
  }> {
    const res = await apiClient.post<{
      status: number
      data: {
        marked: number; left_for_review: number; unavailable: string | null
        percent: number | null; awaiting_review: number
      }
      message: string
    }>(`/competency/ai-assessment/attempts/${attemptId}/mark`, withLaravelParams(context))

    return { ...res.data, message: res.message }
  },

  /**
   * What I scored, and what it is proposing about me.
   *
   * `mine()` deliberately never returned a score, so until this existed a
   * person could sit an assessment and learn nothing at all about how they did.
   * Correct answers are STILL not returned - per question you get your own
   * score and the maximum, which shows where marks were lost without handing
   * out the answer key to a test that is still published.
   */
  async myResult(context: LaravelContext, testId?: number): Promise<MyResult | null> {
    const res = await apiClient.get<{ status: number; data: MyResult | null }>(
      '/competency/ai-assessment/my-result',
      { ...withLaravelParams(context), ...(testId ? { test_id: String(testId) } : {}) },
    )
    return res.data
  },
}
