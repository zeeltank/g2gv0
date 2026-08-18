import type {
  ConversationMessage,
  ConversationRequest,
  ConversationUserContext,
} from "./schemas";

export interface ConversationContext {
  request: ConversationRequest;
  latestUserMessage: ConversationMessage;
  messageHistory: ConversationMessage[];
  user: ConversationUserContext;
  detectedLanguage: "english" | "hindi" | "gujarati";
}

function detectConversationLanguage(content: string) {
  if (/[\u0A80-\u0AFF]/.test(content)) {
    return "gujarati" as const;
  }

  if (/[\u0900-\u097F]/.test(content)) {
    return "hindi" as const;
  }

  return "english" as const;
}

export function createConversationContext(
  request: ConversationRequest
): ConversationContext {
  const latestUserMessage = [...request.messages]
    .reverse()
    .find((message) => message.role === "user");

  if (!latestUserMessage) {
    throw new Error("At least one user message is required.");
  }

  return {
    request,
    latestUserMessage,
    messageHistory: request.messages,
    user: request.context || {},
    detectedLanguage: detectConversationLanguage(latestUserMessage.content),
  };
}
