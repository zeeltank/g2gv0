import type { AgentApi, AgentRunsParams } from '../../services/agent/api-types'
import type { AgentDecisionResult } from '../../services/agent/types'
import { orgState, proposal, run, runsResponse } from './fixtures'

export interface FakeCalls {
  state: Array<number | string>
  resolve: Array<number | string>
  run: Array<number | string>
  accept: Array<number | string>
  dismiss: Array<{ id: number | string; reason?: string }>
  runs: AgentRunsParams[]
  runDetail: Array<number | string>
}

/**
 * A stand-in for the agent API for component tests. Every call is recorded exactly as the screen made it, and `overrides` replace what a method answers (or
 * throws). Nothing here touches the network.
 */
export function fakeAgentService(overrides: Partial<AgentApi> = {}) {
  const calls: FakeCalls = { state: [], resolve: [], run: [], accept: [], dismiss: [], runs: [], runDetail: [] }
  const decided = (outcome: AgentDecisionResult['data']['outcome']): AgentDecisionResult => ({ status: 1, data: { outcome, proposal: proposal({ status: outcome.includes('dismissed') ? 'dismissed' : 'applied' }) } })
  const service: AgentApi = {
    state: async (id) => { calls.state.push(id); return overrides.state ? overrides.state(id) : { status: 1, data: orgState() } },
    resolve: async (id) => { calls.resolve.push(id); return overrides.resolve ? overrides.resolve(id) : { status: 1, data: { org_account_id: 7 } } },
    run: async (id) => { calls.run.push(id); return overrides.run ? overrides.run(id) : { status: 1, data: run() } },
    accept: async (id) => { calls.accept.push(id); return overrides.accept ? overrides.accept(id) : decided('applied') },
    dismiss: async (id, reason) => { calls.dismiss.push({ id, reason }); return overrides.dismiss ? overrides.dismiss(id, reason) : decided('dismissed') },
    runs: async (params) => { calls.runs.push(params); return overrides.runs ? overrides.runs(params) : runsResponse() },
    runDetail: async (id) => { calls.runDetail.push(id); return overrides.runDetail ? overrides.runDetail(id) : { status: 1, data: run() } },
  }
  return { service, calls }
}
