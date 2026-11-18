'use client';

/**
 * Wires G2G's real session and network calls into the adapter and chat engine and
 * registers them with the core. Everything the core can reach is decided here, and
 * every dependency is one G2G already had: nothing is added, nothing is mocked.
 *
 * Only imported behind `isAiCoreEnabled()`; with the flag off this module is never loaded.
 */

import {
  AdapterRegistry,
  guardAdapter,
  guardChatEngine,
  type AppAdapter,
  type AppContext,
  type ChatEngine,
  type ContextInput,
} from 'darshana-ai-core';

import { createAgent, runAgent, setAgentStatus } from '@/lib/agents/client';
import { aiRequest } from '@/lib/intelligence/client';
import { readLaravelSession } from '@/lib/laravel-session';

import { createG2gAdapter, G2G_APP_ID } from './g2g-adapter';
import { createG2gChatEngine, type G2gChatPayload } from './g2g-chat-engine';

export interface G2gAiCore {
  registry: AdapterRegistry;
  adapter: AppAdapter;
  chatEngine: ChatEngine;
  /** A context for the signed-in user, stamped `g2g`. Throws when nobody (or no organisation) is signed in. */
  context: (input?: Partial<ContextInput>) => Promise<AppContext>;
}

let cached: G2gAiCore | null = null;

export function getG2gAiCore(): G2gAiCore {
  if (cached) return cached;

  const readSession = () => readLaravelSession();

  const adapter = createG2gAdapter({
    readSession,
    async runDataSource(name, args) {
      const result = await aiRequest<{ data?: { rows?: unknown[]; total?: number } }>(
        `/data-sources/${encodeURIComponent(name)}/run`,
        'POST',
        { arguments: args },
      );

      return { rows: result?.data?.rows ?? [], total: result?.data?.total };
    },
    agents: { createAgent, setAgentStatus, runAgent },
  });

  const chatEngine = createG2gChatEngine({
    readSession,
    async postChat(body) {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      return { ok: response.ok, status: response.status, payload: (await response.json()) as G2gChatPayload };
    },
  });

  const registry = new AdapterRegistry();
  registry.registerAdapter(adapter);
  registry.registerChatEngine(chatEngine);

  // Callers get the guarded wrappers, never the raw implementations, so the
  // app/tenant isolation checks cannot be skipped by importing the wrong thing.
  const guardedAdapter = guardAdapter(adapter);

  cached = {
    registry,
    adapter: guardedAdapter,
    chatEngine: guardChatEngine(chatEngine),
    context: (input) => guardedAdapter.getContext({ credentials: null, ...input }),
  };

  return cached;
}

export { G2G_APP_ID };
