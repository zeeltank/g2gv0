import type {
  AgentEvidenceRef, AgentOrgState, AgentProposal, AgentRunDetail, AgentRunsResponse, AgentRunSummary, AgentTraceStep, ProposalCounts,
} from '../../services/agent/types'

/** Data for the agent screens' tests, shaped exactly as hp_erp's AgentPresenter writes it. */

export const ORG_ID = 7
export const NOW = '2026-11-03T15:22:57+00:00'

export const SIGNAL: AgentEvidenceRef = { type: 'signal', id: '39', label: 'Hillcrest is opening a new CBSE campus', url: '/module/crm/signal-review?status=all&q=Hillcrest' }
export const CRM_ORG: AgentEvidenceRef = { type: 'crm_organization', id: '135', label: 'Hillcrest Academy', url: '/module/crm/marketing/organizations/135' }
export const DEAL: AgentEvidenceRef = { type: 'gtm_deal', id: '125', label: 'Hillcrest Academy - Opportunity', url: '/gtm/deals/125' }
export const SELF: AgentEvidenceRef = { type: 'org_account', id: String(ORG_ID), label: 'Hillcrest Academy', url: `/module/crm/organisation-360/${ORG_ID}` }
export const PAIR: AgentEvidenceRef = { type: 'link_suggestion', id: 'crm_organization:135|g2g_company:77', label: 'Possible link: Hillcrest Academy Pvt', url: `/module/crm/organisation-360/${ORG_ID}` }

export function proposal(over: Partial<AgentProposal> = {}): AgentProposal {
  return {
    id: 1, run_id: 10, action: 'add_note', status: 'pending', summary: 'Add a note: Hiring a principal for the new campus.',
    payload: { text: 'Hiring a principal for the new campus.' }, reason: 'A fresh hiring signal is not in the notes yet.', evidence: [SIGNAL],
    applied_via: null, applied_at: null, decided_by: null, decided_by_name: null, decided_at: null, decision_note: null, result_ref: null, error: null,
    created_at: NOW, ...over,
  }
}

export const taskApplied = (over: Partial<AgentProposal> = {}) => proposal({
  id: 2, action: 'add_task', status: 'applied', applied_via: 'policy', applied_at: NOW, summary: 'Add a task: Call the trustee (due 2026-11-17)',
  payload: { title: 'Call the trustee', due_date: '2026-11-17' }, reason: 'Open deal with no next step.', evidence: [DEAL, CRM_ORG], result_ref: 'task_management_calendar_events:470', ...over,
})

export const linkPending = (over: Partial<AgentProposal> = {}) => proposal({
  id: 3, action: 'confirm_link', status: 'pending', summary: 'Confirm they are the same organisation: Hillcrest Academy and Hillcrest Academy Pvt',
  payload: { pair_key: PAIR.id, left: { type: 'crm_organization', id: 135, name: 'Hillcrest Academy' }, right: { type: 'g2g_company', id: 77, name: 'Hillcrest Academy Pvt' } },
  reason: 'Same name and the same city.', evidence: [PAIR, SELF], ...over,
})

export const dismissed = (over: Partial<AgentProposal> = {}) => proposal({
  id: 4, status: 'dismissed', decided_by: 5, decided_by_name: 'Anil Shah', decided_at: NOW, decision_note: 'Already knew this', summary: 'Add a note: Old news.', ...over,
})

export const failed = (over: Partial<AgentProposal> = {}) => proposal({
  id: 5, action: 'confirm_link', status: 'failed', error: 'Both organisations already have a record from the same source, so they cannot be one.',
  summary: 'Confirm they are the same organisation: A and B', ...over,
})

export const TRACE: AgentTraceStep[] = [
  { seq: 1, tool: 'read_context', outcome: 'read', deny_reason: null, proposal_id: null, result_ref: null, latency_ms: null },
  { seq: 2, tool: 'model_call', outcome: 'read', deny_reason: null, proposal_id: null, result_ref: null, latency_ms: 3921 },
  { seq: 3, tool: 'write_brief', outcome: 'applied', deny_reason: null, proposal_id: null, result_ref: 'g2g_agent_runs:10', latency_ms: null },
  { seq: 4, tool: 'add_task', outcome: 'applied', deny_reason: null, proposal_id: 2, result_ref: 'task_management_calendar_events:470', latency_ms: null },
  { seq: 5, tool: 'send_email', outcome: 'denied', deny_reason: 'unknown_tool', proposal_id: null, result_ref: null, latency_ms: null },
]

const ZERO: ProposalCounts = { pending: 0, applied: 0, dismissed: 0, failed: 0 }

export function runSummary(over: Partial<AgentRunSummary> = {}): AgentRunSummary {
  return {
    id: 10, agent_key: 'organisation', trigger: 'manual', status: 'completed', subject: { type: 'org_account', id: ORG_ID, name: 'Hillcrest Academy' },
    user_id: 5, user_name: 'Anil Shah', started_at: '2026-11-03T15:22:48+00:00', finished_at: '2026-11-03T15:22:57+00:00', provider: 'deepseek', model: 'deepseek-flash',
    input_tokens: 1232, output_tokens: 343, cost: 0.075, cost_currency: 'INR', tool_calls: 5, error_code: null, message: null,
    proposal_counts: { ...ZERO, applied: 1, pending: 2 }, ...over,
  }
}

export function run(over: Partial<AgentRunDetail> = {}): AgentRunDetail {
  return {
    ...runSummary(), brief: 'Hillcrest is opening a new campus and has an open deal with no next step. The only signal is fresh.', brief_evidence: [SIGNAL, DEAL],
    proposals: [taskApplied(), proposal(), linkPending()], trace: TRACE, ...over,
  }
}

export function orgState(over: Partial<AgentOrgState> = {}): AgentOrgState {
  return {
    org_account: { id: ORG_ID, name: 'Hillcrest Academy', has_crm_organization: true },
    can: { run: true, decide: true },
    agent: { enabled: true, unavailable_reason: null, runs_today: 1, daily_cap: 10, autonomy: { add_note: 'alone', add_task: 'alone', confirm_link: 'approval' } },
    last_run: run(), pending: [proposal(), linkPending()], recent: [taskApplied(), dismissed()], ...over,
  }
}

/** An organisation the agent has never run on. */
export const freshState = (over: Partial<AgentOrgState> = {}): AgentOrgState => orgState({ last_run: null, pending: [], recent: [], ...over })

export function runsResponse(rows: AgentRunSummary[] = [runSummary(), runSummary({ id: 9, status: 'unavailable', cost: null, cost_currency: null, message: 'No AI model is set up for your organisation, so the agent cannot run.', proposal_counts: { ...ZERO } })], over: Partial<AgentRunsResponse> = {}): AgentRunsResponse {
  return {
    status: 1, data: rows, meta: { page: 1, per_page: 20, total: rows.length, last_page: 1 },
    summary: { total: rows.length, completed: 1, failed: 0, unavailable: 1, running: 0, proposals_pending: 2, actions_applied: 1 }, ...over,
  }
}
