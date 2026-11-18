import type { AgentApi, AgentRunsParams } from '../../services/agent/api-types'
import type { AgentDecisionResult, ProposalsParams } from '../../services/agent/types'
import { autonomyAction, autonomyResponse, orgState, proposal, proposalsPage, run, runsResponse } from './fixtures'

export interface FakeCalls {
  state: Array<number | string>
  resolve: Array<number | string>
  run: Array<number | string>
  accept: Array<number | string>
  dismiss: Array<{ id: number | string; reason?: string }>
  runs: AgentRunsParams[]
  runDetail: Array<number | string>
  proposals: ProposalsParams[]
  autonomy: number
  setAutonomy: Array<{ key: string; level: string; reason?: string }>
  setKillSwitch: Array<{ on: boolean; reason?: string }>
}

/**
 * A stand-in for the agent API for component tests. Every call is recorded exactly as the screen made it, and `overrides` replace what a method answers (or
 * throws). Nothing here touches the network.
 */
export function fakeAgentService(overrides: Partial<AgentApi> = {}) {
  const calls: FakeCalls = { state: [], resolve: [], run: [], accept: [], dismiss: [], runs: [], runDetail: [], proposals: [], autonomy: 0, setAutonomy: [], setKillSwitch: [] }
  const decided = (outcome: AgentDecisionResult['data']['outcome']): AgentDecisionResult => ({ status: 1, data: { outcome, proposal: proposal({ status: outcome.includes('dismissed') ? 'dismissed' : 'applied' }) } })
  const service: AgentApi = {
    state: async (id) => { calls.state.push(id); return overrides.state ? overrides.state(id) : { status: 1, data: orgState() } },
    resolve: async (id) => { calls.resolve.push(id); return overrides.resolve ? overrides.resolve(id) : { status: 1, data: { org_account_id: 7 } } },
    run: async (id) => { calls.run.push(id); return overrides.run ? overrides.run(id) : { status: 1, data: run() } },
    accept: async (id) => { calls.accept.push(id); return overrides.accept ? overrides.accept(id) : decided('applied') },
    dismiss: async (id, reason) => { calls.dismiss.push({ id, reason }); return overrides.dismiss ? overrides.dismiss(id, reason) : decided('dismissed') },
    runs: async (params) => { calls.runs.push(params); return overrides.runs ? overrides.runs(params) : runsResponse() },
    runDetail: async (id) => { calls.runDetail.push(id); return overrides.runDetail ? overrides.runDetail(id) : { status: 1, data: run() } },
    proposals: async (params) => { calls.proposals.push(params); return overrides.proposals ? overrides.proposals(params) : proposalsPage() },
    autonomy: async () => { calls.autonomy += 1; return overrides.autonomy ? overrides.autonomy() : autonomyResponse() },
    // Default answer of a change: the action as the server would send it back (the new level, overridden unless it is the default, changed just now).
    setAutonomy: async (key, level, reason) => {
      calls.setAutonomy.push({ key, level, reason })
      return overrides.setAutonomy ? overrides.setAutonomy(key, level, reason) : { status: 1, data: autonomyAction(key, { level, last_changed: { at: '2026-11-04T10:00:00+00:00', by_name: 'Anil Shah' } }) }
    },
    setKillSwitch: async (on, reason) => {
      calls.setKillSwitch.push({ on, reason })
      return overrides.setKillSwitch ? overrides.setKillSwitch(on, reason) : { status: 1, data: { kill_switch: { on, scope: on ? 'organisation' : null } } }
    },
  }
  return { service, calls }
}
