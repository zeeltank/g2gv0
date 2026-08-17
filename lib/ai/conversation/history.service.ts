import type { ConversationMessage } from "./schemas";

export interface ConversationSessionRecord {
  sessionId: string;
  userId: string;
  messages: ConversationMessage[];
  updatedAt: string;
}

const conversationSessions = new Map<string, ConversationSessionRecord>();
const MAX_MESSAGES_PER_SESSION = 50;

function getSessionKey(userId: string, sessionId: string) {
  return `${userId}:${sessionId}`;
}

export function appendConversationHistory(params: {
  sessionId: string;
  userId: string;
  messages: ConversationMessage[];
}) {
  const key = getSessionKey(params.userId, params.sessionId);
  const current = conversationSessions.get(key);
  const mergedMessages = [...(current?.messages || []), ...params.messages].slice(
    -MAX_MESSAGES_PER_SESSION
  );

  const nextRecord: ConversationSessionRecord = {
    sessionId: params.sessionId,
    userId: params.userId,
    messages: mergedMessages,
    updatedAt: new Date().toISOString(),
  };

  conversationSessions.set(key, nextRecord);
  return nextRecord;
}

export function getConversationHistory(userId: string, sessionId: string) {
  return conversationSessions.get(getSessionKey(userId, sessionId)) || null;
}

export function clearConversationHistory(userId: string, sessionId?: string) {
  if (sessionId) {
    conversationSessions.delete(getSessionKey(userId, sessionId));
    return;
  }

  for (const key of [...conversationSessions.keys()]) {
    if (key.startsWith(`${userId}:`)) {
      conversationSessions.delete(key);
    }
  }
}
