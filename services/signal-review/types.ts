/**
 * The Signal Review API (hp_erp `/api/signals/...`, contract: hp_erp docs/agentic-crm/slices/S02-contract.md). Names are the API's own snake_case,
 * as the existing Signals API already uses. `null` always means "not known", never zero or empty.
 */

/** What is stored on a signal. The screens call `Follow-up` "Contacted". */
export type ReviewStatus = 'New' | 'Reviewed' | 'Follow-up' | 'Dismissed'

/** What a person can decide on the Signal Review screen. */
export type ReviewDecisionCode = 'reviewed' | 'dismissed' | 'follow_up' | 'reopened'

/** What a history row can hold: the four decisions, and `promoted` (a lead was made from the signal). */
export type HistoryDecisionCode = ReviewDecisionCode | 'promoted'

export type HistoryVia = 'signal_review' | 'legacy_screen' | 'backfill' | 'promote'

export type DateStatus = 'event_date_stated' | 'source_date_only' | 'undated'

export type Freshness = 'last_30_days' | 'last_90_days' | 'older' | 'undated'

/** How old a signal really is, and what kind of date that is. `date` is `YYYY-MM-DD`, or null when undated. */
export interface DateInfo {
  status: DateStatus
  date: string | null
}

/** One reason a person can give for dismissing, from the server's list (`filters.review_reasons`). */
export interface ReasonOption {
  value: string
  label: string
}

/** One row of a signal's decision history (GET /opportunities/{id}/reviews, newest first; also `review` in a decision response). */
export interface ReviewHistoryEntry {
  id: number
  decision: HistoryDecisionCode
  reason_code: string | null
  /** null when there is no reason, or the code is no longer in the server's list (the code is still returned). */
  reason_label: string | null
  note: string | null
  from_status: ReviewStatus
  to_status: ReviewStatus
  via: HistoryVia
  decided_by: number | null
  decided_by_name: string | null
  /** ISO 8601 with offset. */
  decided_at: string
}

/** POST /opportunities/{id}/decisions */
export interface DecisionRequest {
  decision: ReviewDecisionCode
  /** Required when `decision` is `dismissed`. */
  reason_code?: string
  /** Optional; required (not blank) when `reason_code` is `other`. At most 1000 characters. */
  note?: string
  /** The status the person was looking at. If the server's differs, the answer is a 409 `conflict`. */
  expected_status?: ReviewStatus
}

/** A 409 from the decisions endpoint. `current` is the latest decision, so the screen can show who got there first. */
export interface DecisionConflictBody {
  status: 0
  code: 'unchanged' | 'conflict'
  message: string
  current: ReviewHistoryEntry | null
}

/** A row of GET /research/runs. Null cost fields mean "unknown" (a run from before cost was recorded), never zero. */
export interface SignalRunRow {
  id: number
  trigger: string
  status: string
  stage?: string | null
  report_date?: string | null
  started_at?: string | null
  finished_at?: string | null
  duration_seconds: number | null
  product_key?: string | null
  product_master_id: number | null
  ai_input_tokens: number | null
  ai_output_tokens: number | null
  /** What the AI calls of the run cost, in `ai_cost_currency` (rupees by default). Null = unknown (some call had no price), never zero. */
  ai_cost: number | null
  ai_cost_currency: string | null
  search_requests: number | null
  search_credits: number | null
  error_code?: string | null
  /** Any other field the server sends. */
  [key: string]: unknown
}

// ── Prop contracts between the screen's parts, so they can be built separately ────────────────────────────────────────────────────────────

/** Why the decision dialog was opened. It decides which fields appear. */
export type DecisionDialogMode = ReviewDecisionCode

export interface DecisionDialogSubmit {
  decision: ReviewDecisionCode
  reason_code?: string
  note?: string
}

/**
 * The decision dialog. Presentational: it holds only its own form state and hands the answer to `onSubmit`. It never calls the API.
 * - `dismissed`: a reason from `reasons` is required; picking `other` makes the note required. Blocks submit and shows the message under the field.
 * - `reviewed`, `follow_up`, `reopened`: reason hidden, note optional.
 * - `serverErrors` are field-keyed (`decision`, `reason_code`, `note`) as a 422 returns them, shown under the matching field.
 * - `conflict` (a 409): shows who decided first and what, and offers to continue (`onResolveConflict('continue')`) or leave (`'cancel'`).
 */
export interface DecisionDialogProps {
  open: boolean
  mode: DecisionDialogMode
  signalTitle: string
  currentStatus: ReviewStatus
  reasons: ReasonOption[]
  saving: boolean
  serverErrors: Partial<Record<'decision' | 'reason_code' | 'note', string>> | null
  /** A message that belongs to no field (a network failure, a 403, a 409 `unchanged`). */
  formError: string | null
  conflict: ReviewHistoryEntry | null
  onSubmit: (answer: DecisionDialogSubmit) => void
  onResolveConflict: (choice: 'continue' | 'cancel') => void
  onClose: () => void
}

/** A signal's decision history as a vertical list. Presentational. Four states: loading, error (with retry), empty, entries. */
export interface HistoryListProps {
  entries: ReviewHistoryEntry[] | null
  loading: boolean
  error: string | null
  onRetry: () => void
}
