import type {
  AgentDecisionResult, AgentEnvelope, AgentOrgState, AgentRunDetail, AgentRunsResponse, AutonomyAction, AutonomyLevel, AutonomyState, KillSwitch, ProposalsPage, ProposalsParams,
  RunStatus,
} from './types'

/** The history list's query as the API takes it. A missing value is left out, so the server applies no filter for it. */
export interface AgentRunsParams {
  status?: RunStatus
  /** Y-m-d, the day a run started. */
  date_from?: string
  date_to?: string
  page?: number
  per_page?: number
}

/** What the agent screens need from the server. Components take this shape, so a test can hand them a fake. */
export interface AgentApi {
  /** What the panel of one organisation shows. `orgAccountId` is the Organisation 360 identity id (g2g_org_accounts.id). */
  state(orgAccountId: number | string): Promise<AgentEnvelope<AgentOrgState>>
  /** The identity of a CRM organisation, for a page that only knows the CRM organisation (through the Organisation 360 API, which makes the identity when there is none). A 404 means no such CRM organisation here. */
  resolve(crmOrganizationId: number | string): Promise<AgentEnvelope<{ org_account_id: number }>>
  /** Runs the agent once and answers with the run (any status: an unavailable or failed run is an answer, not an error). A refusal before a run throws. */
  run(orgAccountId: number | string): Promise<AgentEnvelope<AgentRunDetail>>
  /** Carries a waiting proposal out, as the person who presses it. Accepting twice writes once. A proposal that cannot be applied throws a 409. */
  accept(proposalId: number | string): Promise<AgentDecisionResult>
  /** Ends a waiting proposal; the same one is never offered again. The reason is optional. */
  dismiss(proposalId: number | string, reason?: string): Promise<AgentDecisionResult>
  runs(params: AgentRunsParams): Promise<AgentRunsResponse>
  runDetail(runId: number | string): Promise<AgentEnvelope<AgentRunDetail>>

  /**
   * Every proposal of the organisation, across organisations, newest first (S7b). A 404 means the server has no waiting queue yet (a route that is not there
   * answers 404 and nothing else on this route does).
   */
  proposals(params: ProposalsParams): Promise<AgentEnvelope<ProposalsPage>>
  /** The kill switch, every action with its level, its default and its last 30 days, and whether the caller may change them. A 404 means the server has no autonomy settings yet. */
  autonomy(): Promise<AgentEnvelope<AutonomyState>>
  /** Sets one action's level for the caller's organisation (administrators only: 403 `administrators_only`). Answers with that one action as it now stands. 404 `unknown_action`, 422 `unknown_level`. */
  setAutonomy(actionKey: string, level: AutonomyLevel | (string & {}), reason?: string): Promise<AgentEnvelope<AutonomyAction>>
  /** Switches the agent off for the caller's organisation (`on` true) or back on (false). The shared switch is never reachable from here. */
  setKillSwitch(on: boolean, reason?: string): Promise<AgentEnvelope<{ kill_switch: KillSwitch }>>
}
