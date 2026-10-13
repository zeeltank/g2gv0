/**
 * G2G chat engine: the shared chat-engine contract plus a characterization of the exact
 * request the shell widget sends today, so routing the widget through the engine cannot
 * change what the server receives.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { CrossAppAccessError, guardChatEngine, type AppContext } from 'darshana-ai-core';
import { runChatEngineContract } from 'darshana-ai-core/testing';

import { G2gContextError, type G2gSession } from './g2g-adapter';
import { createG2gChatEngine, type G2gChatPayload } from './g2g-chat-engine';

const session = (overrides: Partial<G2gSession> = {}): G2gSession => ({
  token: 'tok',
  sub_institute_id: 3,
  user_id: 6,
  user_profile_name: 'Admin',
  role_key: 'administrator',
  syear: 2026,
  org_id: 3,
  employee_no: 'E-1',
  ...overrides,
});

const ctx: AppContext = {
  appId: 'g2g',
  tenantId: '3',
  userId: '6',
  attributes: { role: 'administrator', profileName: 'Admin', employeeNo: 'E-1', orgId: '3', syear: '2026' },
};

function harness(reply: { ok: boolean; status: number; payload: G2gChatPayload }, current: G2gSession | null = session()) {
  const state = { session: current, bodies: [] as unknown[] };
  const engine = createG2gChatEngine({
    readSession: () => state.session,
    async postChat(body) {
      state.bodies.push(body);
      return reply;
    },
  });
  return { state, engine };
}

const okReply = {
  ok: true,
  status: 200,
  payload: {
    message: { id: 'assistant-1', role: 'assistant' as const, content: 'fallback text' },
    response: { message: '  answer text  ', status: 'ok', conversationType: 'data', activeTools: ['t1'] },
  },
};

runChatEngineContract('g2g', {
  create: () => harness(okReply).engine,
  context: () => ctx,
  message: 'hello',
});

describe('g2g chat engine: request parity with the shell widget', () => {
  it('sends the same endpoint body shape the widget sends today', async () => {
    const { engine, state } = harness(okReply);
    await engine.send(ctx, {
      message: 'second',
      conversationId: 'agent-1',
      history: [{ role: 'user', content: 'first' }, { role: 'assistant', content: 'reply' }],
    });
    const body = state.bodies[0] as { responseMode: string; messages: Array<Record<string, unknown>>; context: Record<string, unknown> };
    assert.deepEqual(Object.keys(body).sort(), ['context', 'messages', 'responseMode']);
    assert.equal(body.responseMode, 'json');
    assert.deepEqual(
      body.messages.map((m) => [m.role, m.content]),
      [['user', 'first'], ['assistant', 'reply'], ['user', 'second']],
    );
    for (const m of body.messages) assert.deepEqual(Object.keys(m).sort(), ['content', 'id', 'role']);
    assert.deepEqual(Object.keys(body.context).sort(), [
      'employeeNo', 'orgId', 'profileName', 'role', 'sessionId', 'subInstituteId', 'syear', 'token', 'userId',
    ]);
    assert.equal(body.context.subInstituteId, '3');
    assert.equal(body.context.userId, '6');
    assert.equal(body.context.token, 'tok');
    assert.equal(body.context.sessionId, 'agent-1');
  });

  it('reads the answer the way the widget does: response.message first, trimmed, then message.content', async () => {
    const first = await harness(okReply).engine.send(ctx, { message: 'q' });
    assert.equal(first.answer.text, 'answer text');
    assert.deepEqual(first.answer.meta, { messageId: 'assistant-1', status: 'ok', conversationType: 'data', tools: ['t1'] });

    const second = await harness({ ok: true, status: 200, payload: { message: { content: ' only content ' } } }).engine.send(ctx, { message: 'q' });
    assert.equal(second.answer.text, 'only content');

    const third = await harness({ ok: true, status: 200, payload: {} }).engine.send(ctx, { message: 'q' });
    assert.equal(third.answer.text, 'No visible response was returned.');
  });

  it('surfaces the server error message, and a default when there is none', async () => {
    await assert.rejects(
      () => harness({ ok: false, status: 429, payload: { error: 'quota' } }).engine.send(ctx, { message: 'q' }),
      /quota/,
    );
    await assert.rejects(
      () => harness({ ok: false, status: 500, payload: {} }).engine.send(ctx, { message: 'q' }),
      /The AI agent request failed\./,
    );
  });

  it('reuses the caller’s conversation id and makes one when none is given', async () => {
    const { engine } = harness(okReply);
    assert.equal((await engine.send(ctx, { message: 'q', conversationId: 'c-9' })).conversationId, 'c-9');
    assert.match((await engine.send(ctx, { message: 'q' })).conversationId, /^agent-/);
  });
});

describe('g2g chat engine: isolation', () => {
  it('answers only for g2g, and only for the signed-in user and organisation', async () => {
    const { engine, state } = harness(okReply);
    assert.equal((await engine.send(ctx, { message: 'q' })).appId, 'g2g');

    state.session = session({ sub_institute_id: 4, token: 'other-org' });
    await assert.rejects(() => engine.send(ctx, { message: 'q' }), CrossAppAccessError);
    state.session = session({ user_id: 77 });
    await assert.rejects(() => engine.send(ctx, { message: 'q' }), CrossAppAccessError);
    state.session = null;
    await assert.rejects(() => engine.send(ctx, { message: 'q' }), G2gContextError);
    assert.equal(state.bodies.length, 1, 'no request may leave once the session no longer matches');
  });

  it('refuses a context from another application before reading the session', async () => {
    const { engine, state } = harness(okReply);
    await assert.rejects(() => guardChatEngine(engine).send({ ...ctx, appId: 'lms_k12' }, { message: 'q' }), CrossAppAccessError);
    assert.equal(state.bodies.length, 0);
  });
});
