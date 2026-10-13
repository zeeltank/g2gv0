/**
 * G2G adapter: the shared contract suite plus G2G-specific isolation, permission,
 * data-access and action tests.
 *
 * The session and the two network calls are injected fakes — they exist so the real
 * adapter code runs offline. They carry no application data; the rows a fake data
 * source returns are whatever the test hands it, and every assertion is about what the
 * adapter does with them (stamps, scopes, refuses), not about their content.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { AdapterRegistry, CrossAppAccessError, guardAdapter, type AppAdapter } from 'darshana-ai-core';
import { runAdapterContract } from 'darshana-ai-core/testing';

import { AGENT_MODULES, AGENT_TOOLS } from '@/lib/agents/registry';

import { G2G_ACTIONS, G2G_APP_ID, G2gContextError, createG2gAdapter, type G2gAdapterDeps, type G2gSession } from './g2g-adapter';

const adminSession = (overrides: Partial<G2gSession> = {}): G2gSession => ({
  token: 'tok-admin',
  sub_institute_id: 3,
  user_id: 6,
  user_profile_name: 'Admin',
  role_key: 'administrator',
  syear: 2026,
  org_id: 3,
  employee_no: null,
  ...overrides,
});

const employeeSession = (): G2gSession =>
  adminSession({ token: 'tok-emp', user_id: 9, user_profile_name: 'Employee', role_key: 'employee' });

const firstReadTool = AGENT_TOOLS.find((t) => t.available && t.risk === 'read');

function harness(initial: G2gSession | null = adminSession()) {
  const state = { session: initial };
  const calls = {
    data: [] as Array<{ name: string; args: Record<string, unknown> }>,
    agents: [] as Array<{ fn: string; args: unknown[] }>,
  };
  const deps: G2gAdapterDeps = {
    readSession: () => state.session,
    async runDataSource(name, args) {
      calls.data.push({ name, args });
      return { rows: [{ a: 1 }, { a: 2 }, { a: 3 }], total: 3 };
    },
    agents: {
      async createAgent(input) {
        calls.agents.push({ fn: 'createAgent', args: [input] });
        return { id: 'agt_x' } as never;
      },
      async setAgentStatus(id, status) {
        calls.agents.push({ fn: 'setAgentStatus', args: [id, status] });
        return { id } as never;
      },
      async runAgent(id, input) {
        calls.agents.push({ fn: 'runAgent', args: [id, input] });
        return { id: 'run_x' } as never;
      },
    },
  };
  return { state, calls, adapter: guardAdapter(createG2gAdapter(deps)), raw: createG2gAdapter(deps) };
}

assert.ok(firstReadTool, 'G2G must expose at least one available read tool');

// The suite every application adapter must pass.
runAdapterContract('g2g', {
  create: () => harness().raw,
  contextInput: { credentials: null },
  dataSource: firstReadTool.key,
});

describe('g2g adapter: context and tenant', () => {
  it('stamps the g2g app id and the session organisation, user and role', async () => {
    const { adapter } = harness();
    const ctx = await adapter.getContext({ credentials: null, module: 'hrit_management', route: '/x' });
    assert.equal(ctx.appId, G2G_APP_ID);
    assert.equal(ctx.tenantId, '3');
    assert.equal(ctx.userId, '6');
    assert.equal(ctx.module, 'hrit_management');
    assert.equal(ctx.attributes.role, 'administrator');
  });

  it('fails closed with no session and with no organisation (no fallback tenant)', async () => {
    await assert.rejects(() => harness(null).adapter.getContext({ credentials: null }), G2gContextError);
    await assert.rejects(
      () => harness(adminSession({ sub_institute_id: '' })).adapter.getContext({ credentials: null }),
      G2gContextError,
    );
  });

  it('never sends an organisation or user id to the backend itself', async () => {
    const { adapter, calls } = harness();
    const ctx = await adapter.getContext({ credentials: null });
    await adapter.getData(ctx, { source: firstReadTool!.key, params: { q: 'x' } });
    assert.deepEqual(calls.data[0]?.args, { q: 'x' });
  });
});

describe('g2g adapter: tenant and user isolation', () => {
  it('rejects a context after the session switches to another organisation', async () => {
    const { adapter, state } = harness();
    const ctx = await adapter.getContext({ credentials: null });
    state.session = adminSession({ sub_institute_id: 4, token: 'tok-other-org' });
    await assert.rejects(() => adapter.getData(ctx, { source: firstReadTool!.key }), CrossAppAccessError);
    await assert.rejects(() => adapter.getPermissions(ctx), CrossAppAccessError);
    await assert.rejects(() => adapter.executeAction(ctx, { action: 'agent.run' }), CrossAppAccessError);
    await assert.rejects(() => adapter.listCapabilities(ctx), CrossAppAccessError);
  });

  it('rejects a context after a different user signs in to the same organisation', async () => {
    const { adapter, state } = harness();
    const ctx = await adapter.getContext({ credentials: null });
    state.session = adminSession({ user_id: 99, token: 'tok-someone-else' });
    await assert.rejects(() => adapter.getData(ctx, { source: firstReadTool!.key }), CrossAppAccessError);
  });

  it('rejects a context once the user has signed out', async () => {
    const { adapter, state } = harness();
    const ctx = await adapter.getContext({ credentials: null });
    state.session = null;
    await assert.rejects(() => adapter.getData(ctx, { source: firstReadTool!.key }), G2gContextError);
  });

  it('is unreachable from another application’s context', async () => {
    const registry = new AdapterRegistry();
    const { raw } = harness();
    registry.registerAdapter(raw);
    const ctx = await registry.adapterFor({ appId: G2G_APP_ID, tenantId: '3', userId: '6', attributes: {} }).getContext({ credentials: null });
    assert.throws(() => registry.adapterFor({ ...ctx, appId: 'lms_k12' }), CrossAppAccessError);
  });
});

describe('g2g adapter: permissions', () => {
  it('gives an administrator every capability and nothing to anyone else', async () => {
    const admin = harness();
    const ctx = await admin.adapter.getContext({ credentials: null });
    const caps = await admin.adapter.listCapabilities(ctx);
    const perms = await admin.adapter.getPermissions(ctx);
    assert.equal(perms.isAdmin, true);
    assert.deepEqual(Object.keys(perms.grants).sort(), caps.map((c) => c.key).sort());

    const emp = harness(employeeSession());
    const eCtx = await emp.adapter.getContext({ credentials: null });
    const ePerms = await emp.adapter.getPermissions(eCtx);
    assert.equal(ePerms.isAdmin, false);
    assert.deepEqual(ePerms.grants, {});
  });

  it('refuses data and actions to a non-administrator without calling the backend', async () => {
    const { adapter, calls } = harness(employeeSession());
    const ctx = await adapter.getContext({ credentials: null });
    await assert.rejects(() => adapter.getData(ctx, { source: firstReadTool!.key }), G2gContextError);
    const result = await adapter.executeAction(ctx, { action: 'agent.run', input: { agentId: 'a' } });
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, 'forbidden');
    assert.equal(calls.data.length, 0);
    assert.equal(calls.agents.length, 0);
  });
});

describe('g2g adapter: capabilities, entities and data', () => {
  it('lists only what G2G’s own registries hold', async () => {
    const { adapter } = harness();
    const ctx = await adapter.getContext({ credentials: null });
    const caps = await adapter.listCapabilities(ctx);
    const keys = new Set(caps.map((c) => c.key));
    for (const tool of AGENT_TOOLS.filter((t) => t.available && t.risk === 'read')) assert.ok(keys.has(tool.key));
    for (const action of G2G_ACTIONS) assert.ok(keys.has(action));
    assert.equal(caps.filter((c) => c.kind === 'insight').length, 12);
  });

  it('resolves modules from the registry, stamped g2g, and nothing else', async () => {
    const { adapter } = harness();
    const ctx = await adapter.getContext({ credentials: null });
    const refs = await adapter.resolveEntity(ctx, { text: AGENT_MODULES[0]!.label });
    assert.ok(refs.length > 0);
    for (const ref of refs) {
      assert.equal(ref.appId, G2G_APP_ID);
      assert.equal(ref.kind, 'module');
    }
    assert.deepEqual(await adapter.resolveEntity(ctx, { kind: 'student', text: 'x' }), []);
    assert.deepEqual(await adapter.resolveEntity(ctx, { text: '   ' }), []);
  });

  it('stamps data with the context tenant, applies the limit, and reports truncation', async () => {
    const { adapter, calls } = harness();
    const ctx = await adapter.getContext({ credentials: null });
    const result = await adapter.getData(ctx, { source: firstReadTool!.key, limit: 2 });
    assert.equal(result.appId, G2G_APP_ID);
    assert.equal(result.tenantId, ctx.tenantId);
    assert.equal(result.rows.length, 2);
    assert.equal(result.total, 3);
    assert.equal(result.truncated, true);
    assert.equal(calls.data[0]?.name, firstReadTool!.key);
  });

  it('refuses a source G2G does not expose, before any request is made', async () => {
    const { adapter, calls } = harness();
    const ctx = await adapter.getContext({ credentials: null });
    await assert.rejects(() => adapter.getData(ctx, { source: 'students.grades' }), G2gContextError);
    assert.equal(calls.data.length, 0);
  });
});

describe('g2g adapter: actions', () => {
  it('runs the existing agent endpoints with the arguments given', async () => {
    const { adapter, calls } = harness();
    const ctx = await adapter.getContext({ credentials: null });
    const run = await adapter.executeAction(ctx, { action: 'agent.run', input: { agentId: 'agt_1', input: { limit: 5 } } });
    assert.equal(run.ok, true);
    assert.equal(run.tenantId, ctx.tenantId);
    assert.deepEqual(calls.agents[0], { fn: 'runAgent', args: ['agt_1', { limit: 5 }] });

    await adapter.executeAction(ctx, { action: 'agent.setStatus', input: { agentId: 'agt_1', status: 'paused' } });
    assert.deepEqual(calls.agents[1], { fn: 'setAgentStatus', args: ['agt_1', 'paused'] });

    await adapter.executeAction(ctx, { action: 'agent.create', input: { name: 'n' } });
    assert.equal(calls.agents[2]?.fn, 'createAgent');
  });

  it('turns a backend failure into a refusal result carrying its status', async () => {
    const raw = createG2gAdapter({
      readSession: () => adminSession(),
      runDataSource: async () => ({ rows: [] }),
      agents: {
        createAgent: async () => Promise.reject(Object.assign(new Error('nope'), { status: 403 })),
        setAgentStatus: async () => ({}) as never,
        runAgent: async () => ({}) as never,
      },
    });
    const adapter: AppAdapter = guardAdapter(raw);
    const ctx = await adapter.getContext({ credentials: null });
    const result = await adapter.executeAction(ctx, { action: 'agent.create', input: {} });
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, 'http_403');
    assert.equal(result.error?.message, 'nope');
  });
});
