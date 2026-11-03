import type { AgentDecisionResult, AgentEnvelope, AgentOrgState, AgentRunDetail, AgentRunsResponse, RunStatus } from './types'

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
}
