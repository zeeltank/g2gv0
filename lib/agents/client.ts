'use client';

import { AiApiError, aiRequest } from '@/lib/intelligence/client';

import type { Agent, AgentRun, AgentStatus, CreateAgentInput, RunAgentInput } from './types';

/**
 * Browser client for AI Stack tool agents.
 *
 * Same exports and signatures as LMS_K12's `lib/agents/client.ts`, because the shared
 * Automations / Agent Management / Run Agent screens call these by name. The difference
 * is where they go: LMS_K12 talks to an agent engine inside its own Next app; G2G talks
 * to `/api/ai/tool-agents*` in hp_erp, which stores agents and runs in G2G's own Agentic
 * AI tables (`agentic_agents` / `agentic_agent_runs`). Identity and organisation come
 * from the Sanctum token `aiRequest` sends — never from a request body.
 */

export class AgentApiError extends Error {
  readonly status: number;
  /** For a refused run, the `denied` row the server wrote. */
  readonly run: AgentRun | null;

  constructor(message: string, status: number, run: AgentRun | null = null) {
    super(message);
    this.name = 'AgentApiError';
    this.status = status;
    this.run = run;
  }
}

async function call<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET', body?: unknown): Promise<T> {
  try {
    return await aiRequest<T>(path, method, body);
  } catch (cause) {
    if (cause instanceof AiApiError) throw new AgentApiError(cause.message, cause.status);
    throw cause;
  }
}

export function fetchAgents(filter: { module?: string; status?: AgentStatus; rollup?: boolean } = {}): Promise<Agent[]> {
  const params = new URLSearchParams();
  if (filter.module) params.set('module', filter.module);
  if (filter.rollup) params.set('rollup', '1');
  if (filter.status) params.set('status', filter.status);
  const query = params.toString();
  return call<{ agents: Agent[] }>(`/tool-agents${query ? `?${query}` : ''}`).then((result) => result.agents);
}

export function fetchRuns(filter: { module?: string; agentId?: string; limit?: number; rollup?: boolean } = {}): Promise<AgentRun[]> {
  const params = new URLSearchParams();
  if (filter.module) params.set('module', filter.module);
  if (filter.rollup) params.set('rollup', '1');
  if (filter.agentId) params.set('agent_id', filter.agentId);
  if (filter.limit) params.set('limit', String(filter.limit));
  const query = params.toString();
  return call<{ runs: AgentRun[] }>(`/tool-agent-runs${query ? `?${query}` : ''}`).then((result) => result.runs);
}

export function createAgent(input: CreateAgentInput): Promise<Agent> {
  return call<{ agent: Agent }>('/tool-agents', 'POST', input).then((result) => result.agent);
}

export function setAgentStatus(agentId: string, status: AgentStatus): Promise<Agent> {
  return call<{ agent: Agent }>(`/tool-agents/${encodeURIComponent(agentId)}`, 'PATCH', { status }).then(
    (result) => result.agent,
  );
}

/**
 * Run one tool. A refused run is still written (so it is in the log), and — as in
 * LMS_K12 — surfaces as an `AgentApiError` carrying that `denied` row.
 */
export async function runAgent(agentId: string, input: RunAgentInput = {}): Promise<AgentRun> {
  const { run } = await call<{ run: AgentRun }>(`/tool-agents/${encodeURIComponent(agentId)}/run`, 'POST', input);

  if (run.status === 'denied') {
    throw new AgentApiError(run.error ?? 'The run was refused.', 403, run);
  }

  return run;
}
