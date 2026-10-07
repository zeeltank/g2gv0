/**
 * G2G's adapter to the universal AI core (`darshana-ai-core`).
 *
 * This file is the whole boundary between the shared core and G2G's data. The core
 * never names a table or reads a session; it calls the methods below, and every one
 * of them can only reach what G2G already exposes to the signed-in user:
 *
 *   - capabilities  → G2G's own registries (`ai-intelligence-core`, `lib/agents/registry`)
 *   - data          → `POST /api/ai/data-sources/{name}/run` in hp_erp (scoped by the Sanctum token)
 *   - actions       → `/api/ai/tool-agents*` in hp_erp (same endpoints `lib/agents/client.ts` calls)
 *   - permissions   → the same rule hp_erp enforces: the whole AI API is `profile:admin`
 *
 * Nothing here is a copy of LMS K-12 behaviour and nothing here carries a default
 * tenant. If there is no organisation in the session the adapter refuses to build a
 * context at all — a fallback tenant id is how one organisation sees another's rows.
 *
 * The session and the two network calls are injected, which is what lets the same
 * contract suite every application must pass run against this adapter in plain Node.
 */

import { capabilitiesForSolution } from '@shared/ai-intelligence-core';
import {
  CORE_CONTRACT_VERSION,
  CrossAppAccessError,
  type ActionRequest,
  type ActionResult,
  type AppAdapter,
  type AppContext,
  type Capability,
  type ContextInput,
  type DataRequest,
  type DataResult,
  type EntityQuery,
  type EntityRef,
  type PermissionSet,
  type PermissionVerb,
} from 'darshana-ai-core';

import { AGENT_MODULES, AGENT_TOOLS } from '@/lib/agents/registry';
import type { Agent, AgentRun, AgentStatus, CreateAgentInput, RunAgentInput } from '@/lib/agents/types';
import { resolveSessionRole, type LaravelSessionData } from '@/lib/laravel-session';
import { ROLE_GROUPS } from '@/types/role';

export const G2G_APP_ID = 'g2g';

/** The session fields the adapter reads. A real `LaravelSessionData` satisfies this. */
export type G2gSession = Pick<
  LaravelSessionData,
  'token' | 'sub_institute_id' | 'user_id' | 'user_profile_name' | 'role_key' | 'syear' | 'org_id' | 'employee_no'
>;

export interface G2gAdapterDeps {
  /** The signed-in session, or null. Re-read on every call so a sign-out / sign-in switch is noticed. */
  readSession: () => G2gSession | null;
  /** Run one read-only data source as the caller. Resolves to the rows the server returned. */
  runDataSource: (name: string, args: Record<string, unknown>) => Promise<{ rows: unknown[]; total?: number }>;
  /** The existing agent endpoints, unchanged. */
  agents: {
    createAgent: (input: CreateAgentInput) => Promise<Agent>;
    setAgentStatus: (agentId: string, status: AgentStatus) => Promise<Agent>;
    runAgent: (agentId: string, input?: RunAgentInput) => Promise<AgentRun>;
  };
}

/** Raised when there is no usable organisation in the session. Fails closed. */
export class G2gContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'G2gContextError';
  }
}

/** The actions this adapter executes. Anything else is refused as `unknown_action`. */
export const G2G_ACTIONS = ['agent.create', 'agent.setStatus', 'agent.run'] as const;
type G2gAction = (typeof G2G_ACTIONS)[number];

function isG2gAction(value: string): value is G2gAction {
  return (G2G_ACTIONS as readonly string[]).includes(value);
}

function isAdminRole(session: G2gSession): boolean {
  return ROLE_GROUPS.admin.includes(resolveSessionRole(session as LaravelSessionData));
}

function tenantOf(session: G2gSession): string {
  return String(session.sub_institute_id ?? '').trim();
}

function errorResult(ctx: AppContext, action: string, code: string, message: string): ActionResult {
  return { appId: G2G_APP_ID, tenantId: ctx.tenantId, action, ok: false, error: { code, message } };
}

export function createG2gAdapter(deps: G2gAdapterDeps): AppAdapter {
  /**
   * The context is only valid for the person and organisation it was built for. If the
   * browser session has since changed (sign-out, sign-in as someone else) the old
   * context must not be able to read the new person's data, nor the reverse.
   */
  function currentSession(ctx: AppContext): G2gSession {
    const session = deps.readSession();

    if (!session?.token) {
      throw new G2gContextError('Sign in to use AI & Intelligence.');
    }
    if (tenantOf(session) !== ctx.tenantId || String(session.user_id) !== ctx.userId) {
      throw new CrossAppAccessError('The signed-in session no longer matches this context.');
    }

    return session;
  }

  return {
    appId: G2G_APP_ID,
    contractVersion: CORE_CONTRACT_VERSION,

    async getContext(input: ContextInput): Promise<AppContext> {
      const session = deps.readSession();

      if (!session?.token) throw new G2gContextError('Sign in to use AI & Intelligence.');

      const tenantId = tenantOf(session);

      if (!tenantId) throw new G2gContextError('This session has no organisation.');

      return {
        appId: G2G_APP_ID,
        tenantId,
        userId: String(session.user_id),
        module: input.module,
        route: input.route,
        attributes: {
          role: resolveSessionRole(session as LaravelSessionData),
          profileName: session.user_profile_name ?? null,
          employeeNo: session.employee_no ?? null,
          orgId: session.org_id == null ? null : String(session.org_id),
          syear: session.syear == null ? null : String(session.syear),
        },
      };
    },

    /**
     * G2G has no free-text record search behind the AI API, so what can honestly be
     * resolved is a module: the thing a chat turn or an agent is scoped to. People and
     * records are not resolved here until an endpoint exists for it.
     */
    async resolveEntity(ctx: AppContext, query: EntityQuery): Promise<EntityRef[]> {
      currentSession(ctx);

      if (query.kind && query.kind !== 'module') return [];

      const needle = query.text.trim().toLowerCase();

      if (!needle) return [];

      return AGENT_MODULES.filter(
        (module) => module.key.toLowerCase().includes(needle) || module.label.toLowerCase().includes(needle),
      ).map((module) => ({ appId: G2G_APP_ID, kind: 'module', id: module.key, label: module.label }));
    },

    async listCapabilities(ctx: AppContext): Promise<Capability[]> {
      currentSession(ctx);

      const insights: Capability[] = capabilitiesForSolution('g2g').map((capability) => ({
        key: capability.id,
        label: capability.name,
        kind: 'insight',
        description: capability.purpose,
      }));

      const data: Capability[] = AGENT_TOOLS.filter((tool) => tool.available && tool.risk === 'read').map((tool) => ({
        key: tool.key,
        label: tool.label,
        kind: 'data',
        module: tool.module,
        description: tool.description,
      }));

      const actions: Capability[] = G2G_ACTIONS.map((action) => ({
        key: action,
        label: action,
        kind: 'action',
      }));

      return [...insights, ...data, ...actions];
    },

    /**
     * hp_erp puts every `/api/ai/*` route behind `profile:admin`, so an administrator
     * holds every capability and anyone else holds none. This reports the server's rule
     * early; the server still enforces it.
     */
    async getPermissions(ctx: AppContext): Promise<PermissionSet> {
      const session = currentSession(ctx);
      const isAdmin = isAdminRole(session);
      const grants: Record<string, ReadonlyArray<PermissionVerb>> = {};

      if (isAdmin) {
        for (const capability of await this.listCapabilities(ctx)) {
          grants[capability.key] = capability.kind === 'action' ? ['execute'] : capability.kind === 'data' ? ['view', 'execute'] : ['view'];
        }
      }

      return { appId: G2G_APP_ID, tenantId: ctx.tenantId, userId: ctx.userId, grants, isAdmin };
    },

    async getData(ctx: AppContext, request: DataRequest): Promise<DataResult> {
      const session = currentSession(ctx);

      if (!isAdminRole(session)) throw new G2gContextError('AI data sources are limited to administrators.');

      const known = AGENT_TOOLS.some((tool) => tool.key === request.source && tool.available && tool.risk === 'read');

      if (!known) throw new G2gContextError(`"${request.source}" is not a data source G2G exposes.`);

      const { rows, total } = await deps.runDataSource(request.source, { ...(request.params ?? {}) });
      const limited = request.limit && request.limit > 0 ? rows.slice(0, request.limit) : rows;

      return {
        appId: G2G_APP_ID,
        tenantId: ctx.tenantId,
        source: request.source,
        rows: limited as DataResult['rows'],
        total: total ?? rows.length,
        truncated: limited.length < rows.length,
      };
    },

    async executeAction(ctx: AppContext, request: ActionRequest): Promise<ActionResult> {
      const session = currentSession(ctx);

      if (!isG2gAction(request.action)) {
        return errorResult(ctx, request.action, 'unknown_action', `"${request.action}" is not an action G2G exposes.`);
      }
      if (!isAdminRole(session)) {
        return errorResult(ctx, request.action, 'forbidden', 'AI actions are limited to administrators.');
      }

      const input = (request.input ?? {}) as Record<string, unknown>;

      try {
        switch (request.action) {
          case 'agent.create': {
            const agent = await deps.agents.createAgent(input as unknown as CreateAgentInput);
            return { appId: G2G_APP_ID, tenantId: ctx.tenantId, action: request.action, ok: true, output: agent };
          }
          case 'agent.setStatus': {
            const agent = await deps.agents.setAgentStatus(String(input.agentId ?? ''), input.status as AgentStatus);
            return { appId: G2G_APP_ID, tenantId: ctx.tenantId, action: request.action, ok: true, output: agent };
          }
          case 'agent.run': {
            const run = await deps.agents.runAgent(String(input.agentId ?? ''), (input.input ?? {}) as RunAgentInput);
            return { appId: G2G_APP_ID, tenantId: ctx.tenantId, action: request.action, ok: true, output: run };
          }
        }
      } catch (cause) {
        const status = (cause as { status?: number }).status;
        const message = cause instanceof Error ? cause.message : 'The action failed.';

        return errorResult(ctx, request.action, status ? `http_${status}` : 'action_failed', message);
      }
    },
  };
}
