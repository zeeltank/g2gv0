/**
 * The agent API (hp_erp `/api/agent`, routes/agent_gateway.php; contract: hp_erp docs/agentic-crm/slices/S07-agent-gateway-thin.md). Names are the API's own
 * snake_case, exactly as hp_erp's AgentPresenter writes them: a renamed field fails the PHP key-list tests before it breaks a screen here.
 *
 * `null` always means "not known" or "does not apply", never zero or empty: a run whose cost could not be priced has `cost: null`, and a screen shows
 * that as "unknown", never as 0. Everything a model wrote (a brief, a note, a task title, a reason) is PLAIN TEXT and must be shown as text.
 */

/** The three things an agent can ask for. There is no fourth: nothing here can send, delete or merge. */
export type AgentAction = 'add_note' | 'add_task' | 'confirm_link'

/** pending: waiting for a person. applied: carried out. dismissed: a person said no. failed: it could not be applied. */
export type ProposalStatus = 'pending' | 'applied' | 'dismissed' | 'failed'

/** running: under way. completed: finished. unavailable: no usable priced model, nothing was done. failed: the model or the run broke. */
export type RunStatus = 'running' | 'completed' | 'unavailable' | 'failed'

/** How much the agent may do without asking, per action. In this slice off refuses, alone applies at once, the other three wait for a person. */
export type AutonomyLevel = 'off' | 'suggest' | 'draft' | 'approval' | 'alone'

/** policy: the autonomy setting let the agent do it alone. user: a person accepted it. */
export type AppliedVia = 'policy' | 'user'

/** A record a statement rests on. The label and address come from the server's own context, never from the model. */
export interface AgentEvidenceRef {
  type: string
  id: string
  label: string
  url: string | null
}

export interface AgentProposal {
  id: number
  run_id: number
  /** An AgentAction, or an action a newer server knows that this screen does not: shown by name, never assumed. */
  action: AgentAction | (string & {})
  status: ProposalStatus
  /** A short line a person can scan, plain text. */
  summary: string
  /** The normalised arguments, plain text only. */
  payload: Record<string, unknown>
  reason: string | null
  evidence: AgentEvidenceRef[]
  applied_via: AppliedVia | null
  applied_at: string | null
  decided_by: number | null
  decided_by_name: string | null
  decided_at: string | null
  decision_note: string | null
  /** What an applied action wrote, as `table:id`. */
  result_ref: string | null
  error: string | null
  created_at: string | null
}

export interface ProposalCounts {
  pending: number
  applied: number
  dismissed: number
  failed: number
}

/** A run as the history list shows it: no brief, no proposals. */
export interface AgentRunSummary {
  id: number
  agent_key: string
  /** manual: a button. cli: the artisan command. */
  trigger: string
  status: RunStatus
  subject: { type: string; id: number; name: string | null }
  user_id: number | null
  user_name: string | null
  started_at: string | null
  finished_at: string | null
  provider: string | null
  model: string | null
  input_tokens: number | null
  output_tokens: number | null
  /** In `cost_currency`, never converted. null = not known. */
  cost: number | null
  cost_currency: string | null
  tool_calls: number
  error_code: string | null
  /** Why a run that did not complete did not, in a sentence for a person. */
  message: string | null
  proposal_counts: ProposalCounts
}

export interface AgentTraceStep {
  seq: number
  tool: string
  /** read, applied, proposed, denied or error. */
  outcome: string
  deny_reason: string | null
  proposal_id: number | null
  result_ref: string | null
  latency_ms: number | null
}

/** One run with its brief, its proposals and its audit trail. */
export interface AgentRunDetail extends AgentRunSummary {
  brief: string | null
  brief_evidence: AgentEvidenceRef[]
  proposals: AgentProposal[]
  trace: AgentTraceStep[]
}

/** What the Run agent panel of one organisation shows. */
export interface AgentOrgState {
  org_account: { id: number; name: string; has_crm_organization: boolean }
  can: { run: boolean; decide: boolean }
  agent: {
    /** false when the agent is switched off for the organisation (the kill switch). */
    enabled: boolean
    /** Why a run cannot be made now (no model, no price, switched off), in a sentence; null when it can. */
    unavailable_reason: string | null
    runs_today: number
    daily_cap: number
    autonomy: Record<string, AutonomyLevel>
  }
  last_run: AgentRunDetail | null
  /** Waiting for a person, oldest first. */
  pending: AgentProposal[]
  /** Decided or applied, newest first. */
  recent: AgentProposal[]
}

export interface AgentEnvelope<T> {
  status: 1
  data: T
}

export interface AgentRunsMeta {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface AgentRunsSummary {
  total: number
  completed: number
  failed: number
  unavailable: number
  running: number
  proposals_pending: number
  actions_applied: number
}

export interface AgentRunsResponse {
  status: 1
  data: AgentRunSummary[]
  meta: AgentRunsMeta
  summary: AgentRunsSummary
}

export type DecisionOutcome = 'applied' | 'already_applied' | 'dismissed' | 'already_dismissed'

export interface AgentDecisionResult {
  status: 1
  data: { outcome: DecisionOutcome; proposal: AgentProposal }
}
