/**
 * G2G's chatbot engine behind the universal `ChatEngine` interface.
 *
 * This does NOT replace G2G's chatbot. The engine itself is still `app/api/ai/chat`
 * and `lib/ai/*`; this class only makes the request the shell widget already makes
 * (`components/shell/gtg-app-shell.tsx`, `handleAgentSendMessage`) — same endpoint,
 * same body, same reading of the answer — so the shared chat UI can depend on the
 * interface instead of on the route.
 *
 * It is not streaming and keeps no history of its own: the server is handed the
 * transcript on every call, exactly as today, so `capabilities` says so and the
 * contract suite checks it does not expose methods it does not have.
 */

import {
  CrossAppAccessError,
  type AppContext,
  type ChatEngine,
  type ChatReply,
  type ChatRequest,
} from 'darshana-ai-core';

import { G2G_APP_ID, G2gContextError, type G2gSession } from './g2g-adapter';

/** The shape `app/api/ai/chat` answers with when asked for `responseMode: 'json'`. */
export interface G2gChatPayload {
  error?: string;
  message?: { id?: string; role?: 'assistant'; content?: string };
  response?: { message?: string; status?: string; conversationType?: string; activeTools?: string[] };
}

export interface G2gChatDeps {
  readSession: () => G2gSession | null;
  /** POST the body to `/api/ai/chat`. Resolves with the HTTP status and the parsed JSON. */
  postChat: (body: unknown) => Promise<{ ok: boolean; status: number; payload: G2gChatPayload }>;
}

function newConversationId(): string {
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createG2gChatEngine(deps: G2gChatDeps): ChatEngine {
  return {
    engineId: 'g2g-grounded',
    appId: G2G_APP_ID,
    capabilities: { streaming: false, history: false },

    async send(ctx: AppContext, request: ChatRequest): Promise<ChatReply> {
      const session = deps.readSession();

      if (!session?.token) throw new G2gContextError('Sign in to use the assistant.');
      if (String(session.sub_institute_id ?? '').trim() !== ctx.tenantId || String(session.user_id) !== ctx.userId) {
        throw new CrossAppAccessError('The signed-in session no longer matches this context.');
      }

      const conversationId = request.conversationId ?? newConversationId();
      const turns = [...(request.history ?? []), { role: 'user' as const, content: request.message }];

      const { ok, payload } = await deps.postChat({
        responseMode: 'json',
        messages: turns.map((turn, index) => ({ id: `msg-${index + 1}`, role: turn.role, content: turn.content })),
        context: {
          userId: ctx.userId,
          subInstituteId: ctx.tenantId,
          role: ctx.attributes.role,
          profileName: ctx.attributes.profileName,
          employeeNo: ctx.attributes.employeeNo,
          orgId: ctx.attributes.orgId,
          token: session.token,
          syear: ctx.attributes.syear,
          sessionId: conversationId,
        },
      });

      if (!ok) throw new Error(payload.error || 'The AI agent request failed.');

      return {
        appId: G2G_APP_ID,
        conversationId,
        answer: {
          text:
            payload.response?.message?.trim() || payload.message?.content?.trim() || 'No visible response was returned.',
          meta: {
            messageId: payload.message?.id,
            status: payload.response?.status,
            conversationType: payload.response?.conversationType,
            tools: payload.response?.activeTools,
          },
        },
      };
    },
  };
}
