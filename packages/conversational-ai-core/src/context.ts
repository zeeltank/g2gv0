import type { ConversationRequest } from "./schemas";
import type { ProjectContext } from "./types";

export function detectConversationLanguage(content: string) {
  if (/[\u0A80-\u0AFF]/.test(content)) {
    return "gujarati" as const;
  }

  if (/[\u0900-\u097F]/.test(content)) {
    return "hindi" as const;
  }

  return "english" as const;
}

export function getLatestUserMessage(request: ConversationRequest) {
  const latestUserMessage = [...request.messages]
    .reverse()
    .find((message) => message.role === "user");

  if (!latestUserMessage) {
    throw new Error("At least one user message is required.");
  }

  return latestUserMessage;
}

export function getDefaultSystemPrompt(
  context: ProjectContext,
  capability: string,
  toolNames: string[]
) {
  const languageInstruction = {
    english:
      "Reply in English because the user's latest message is in English.",
    hindi:
      "Reply fully in Hindi because the user's latest message is in Hindi.",
    gujarati:
      "Reply fully in Gujarati because the user's latest message is in Gujarati.",
  }[context.detectedLanguage];

  return [
    `You are the Conversational AI assistant for ${context.projectName}.`,
    "Act as a secure, tool-aware enterprise conversation layer, not as a generic chatbot.",
    `Capability: ${capability}.`,
    `User role: ${context.profileName || context.role || "unknown"}.`,
    `Available tools: ${toolNames.join(", ") || "none"}.`,
    "Use registered project tools and backend-integrated handlers for facts, analytics, and actions.",
    "When a suitable tool can answer using the current trusted session scope, call the tool first instead of asking the user for optional filters.",
    "Only ask follow-up questions when a required backend parameter is truly missing and cannot be safely inferred from the trusted session or the user's message.",
    "Do not fabricate data when a tool returns no result.",
    "Separate tool-backed facts from generated explanation.",
    "Keep the response in the same language as the user's latest message unless the user explicitly asks to switch languages.",
    languageInstruction,
  ].join(" ");
}
