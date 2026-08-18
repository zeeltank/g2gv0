import {
  getToolDefinition,
  type RegisteredToolName,
} from "../mcp/registry/tool-catalog";
import type { ConversationIntent } from "./schemas";

/**
 * Tools that only ever read. Confirmation exists to guard actions with side
 * effects, and there is no side effect to guard here - so a classifier that
 * guesses `requiresConfirmation: true` for "show me the leave register" must not
 * be able to stall a plain lookup behind a prompt the chat UI cannot answer.
 *
 * Scoped deliberately to these three: the pre-existing MCP tools keep their
 * original confirmation behaviour untouched.
 */
const READ_ONLY_TOOLS: RegisteredToolName[] = [
  "listModules",
  "resolveEntity",
  "getModuleData",
];

function isReadOnlyTool(toolName: string | undefined): boolean {
  return Boolean(
    toolName && READ_ONLY_TOOLS.includes(toolName as RegisteredToolName)
  );
}

export function needsConversationConfirmation(intent: ConversationIntent) {
  const definition = intent.suggestedTool
    ? getToolDefinition(intent.suggestedTool)
    : undefined;

  // A read-only lookup never needs confirmation, whatever the classifier
  // guessed, unless the conversation is genuinely asking to *do* something.
  if (isReadOnlyTool(intent.suggestedTool)) {
    return ["do", "automate", "monitor"].includes(intent.type);
  }

  if (intent.requiresConfirmation) {
    return true;
  }

  if (definition?.requiresConfirmation) {
    return true;
  }

  return ["do", "monitor"].includes(intent.type);
}

export function buildConfirmationPayload(intent: ConversationIntent) {
  const definition = intent.suggestedTool
    ? getToolDefinition(intent.suggestedTool)
    : undefined;

  return {
    action: intent.capability,
    riskLevel: definition?.riskLevel || "medium",
    message:
      "Please confirm this action before it is executed. Review the detected capability and parameters first.",
    parameters: intent.entities,
  } as const;
}
