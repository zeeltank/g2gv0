import {
  generateText,
  stepCountIs,
  streamText,
  type ModelMessage,
} from "ai";
import {
  AI_MAX_RETRIES,
  createAiModel,
  getLlmUnavailableReason,
  getQuotaCooldownSecondsRemaining,
  isLlmAvailable,
  isQuotaError,
  noteQuotaExhausted,
} from "../config/model";
import { createAgentTools } from "../agent/chat-tools";
import {
  tryAnswerFromDatabase,
  type DatabaseFirstResult,
} from "./database-first.service";
import {
  isRegisteredToolName,
  type RegisteredToolName,
} from "../mcp/registry/tool-catalog";
import { recordAuditEvent } from "../audit/audit-log.service";
import { appendConversationHistory } from "./history.service";
import {
  buildConfirmationPayload,
  needsConversationConfirmation,
} from "./confirmation.service";
import {
  getAllowedDatasetIds,
  getAllowedToolNames,
  validateConversationPermission,
} from "./permission.service";
import { createConversationContext } from "./context.service";
import { classifyConversationIntent } from "./intent-classifier.service";
import { buildConversationSystemPrompt } from "./response-composer.service";
import type { ConversationRequest } from "./schemas";
import type { ConversationalResponse } from "./response-schema";

export interface PreparedConversation {
  intent: Awaited<ReturnType<typeof classifyConversationIntent>>;
  systemPrompt: string;
  activeTools: RegisteredToolName[];
  tools: ReturnType<typeof createAgentTools>;
}

/**
 * Tools that must stay reachable on every turn.
 *
 * The intent classifier narrows `activeTools` down to its single suggested tool,
 * which is right for the specialised MCP flows. But the cross-module data tools
 * are not an alternative to those - they are how any factual question gets
 * answered, and how a follow-up pivots to a different module mid-conversation.
 * Pinning them keeps the assistant from being locked out of live data because
 * the classifier guessed one specific flow.
 */
const ALWAYS_ACTIVE_TOOLS: RegisteredToolName[] = [
  "listModules",
  "resolveEntity",
  "getModuleData",
];

function resolveSessionId(context: ReturnType<typeof createConversationContext>) {
  return context.user.sessionId || context.user.userId || "anonymous";
}

type ToolExecutionSummary = NonNullable<
  ConversationalResponse["toolExecutions"]
>[number];

/** Synthesises the intent shape the API already returns, without an LLM call. */
function intentFromPlan(
  plan: DatabaseFirstResult["plan"]
): ConversationalResponse["intent"] {
  return {
    type: plan.shape === "ranking" || plan.shape === "summary" ? "analyse" : "ask",
    domain: "shared",
    capability: plan.capability,
    entities: plan.filters as Record<string, unknown>,
    confidence: plan.confidence,
    requiresConfirmation: false,
    requiredPermission: "assistant:module-data:read",
    suggestedTool: plan.dataset ? "getModuleData" : undefined,
  };
}

/** Wraps a deterministic answer in the standard response envelope. */
function finalizeDatabaseFirstResponse(
  context: ReturnType<typeof createConversationContext>,
  sessionId: string,
  databaseFirst: DatabaseFirstResult
): ConversationalResponse {
  const answer = databaseFirst.answer!;
  const outcome = databaseFirst.outcome;

  const response: ConversationalResponse = {
    message: answer.message,
    conversationType: intentFromPlan(databaseFirst.plan)!.type,
    status:
      outcome?.status === "needs_clarification" ||
      outcome?.status === "missing_parameter"
        ? "requires_input"
        : "completed",
    data: outcome?.status === "success" ? outcome.data : undefined,
    toolExecutions: (databaseFirst.datasetTried ?? []).map((dataset) => ({
      tool: "getModuleData",
      status: dataset === outcome?.dataset && outcome?.status === "success"
        ? "completed"
        : dataset === outcome?.dataset
          ? "skipped"
          : "failed",
      summary: `Read ${dataset} from the G2G backend.`,
    })),
    intent: intentFromPlan(databaseFirst.plan),
    activeTools: databaseFirst.datasetTried?.length ? ["getModuleData"] : undefined,
    followUpSuggestions: [
      "Ask a follow-up question.",
      "Refine the result with more filters.",
    ],
  };

  appendConversationHistory({
    sessionId,
    userId: context.user.userId || "anonymous",
    messages: [
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.message,
      },
    ],
  });

  recordAuditEvent(
    "conversation.response",
    {
      capability: databaseFirst.plan.capability,
      dataset: outcome?.dataset,
      status: response.status,
      source: "database-first",
    },
    { userId: context.user.userId, organizationId: context.user.orgId }
  );

  return response;
}

/**
 * The graceful reply when the question genuinely needs the LLM and the LLM is
 * not usable. Never returned for a question the backend could have answered -
 * those are handled before this point.
 */
function buildLlmUnavailableResponse(
  context: ReturnType<typeof createConversationContext>,
  databaseFirst: DatabaseFirstResult
): ConversationalResponse {
  const reason = getLlmUnavailableReason();
  const cooldown = getQuotaCooldownSecondsRemaining();

  const message =
    reason === "no_key"
      ? "I can look up anything stored in G2G, but general questions need the AI service, which isn't configured on this environment yet."
      : `I can still answer questions about your G2G data, but this one needs the AI assistant and its usage limit has been reached${
          cooldown ? ` - it should recover in about ${cooldown} second${cooldown === 1 ? "" : "s"}` : ""
        }. In the meantime, ask me about people, departments, attendance, leave, learning, competencies, recruitment, tasks or reports and I'll pull the real numbers.`;

  console.log("[conversation.fallback] llm-unavailable", {
    reason,
    cooldownSeconds: cooldown,
    planCapability: databaseFirst.plan.capability,
  });

  recordAuditEvent(
    "conversation.response",
    {
      capability: databaseFirst.plan.capability,
      status: "failed",
      source: "llm-unavailable",
      reason,
    },
    { userId: context.user.userId, organizationId: context.user.orgId }
  );

  return {
    message,
    conversationType: "guide",
    status: "failed",
    toolExecutions: [],
    intent: intentFromPlan(databaseFirst.plan),
    followUpSuggestions: [
      "Ask about your G2G data instead.",
      "Try the general question again shortly.",
    ],
  };
}

/**
 * Reports the tools that were really invoked during the run, and whether each
 * one produced data. A tool that returned an 'empty' / 'unavailable' outcome is
 * reported as such instead of as a success.
 */
function summarizeToolExecutions(result: {
  steps?: ReadonlyArray<{
    toolCalls?: ReadonlyArray<{ toolName: string }>;
    toolResults?: ReadonlyArray<{ toolName: string; output?: unknown }>;
  }>;
}): ToolExecutionSummary[] {
  const summaries = new Map<string, ToolExecutionSummary>();

  for (const step of result.steps ?? []) {
    for (const call of step.toolCalls ?? []) {
      if (!summaries.has(call.toolName)) {
        summaries.set(call.toolName, {
          tool: call.toolName,
          status: "completed",
          summary: "Called during this turn.",
        });
      }
    }

    for (const toolResult of step.toolResults ?? []) {
      const output = toolResult.output as { status?: string } | undefined;
      const status = typeof output?.status === "string" ? output.status : undefined;

      if (!status) continue;

      if (status === "success") {
        summaries.set(toolResult.toolName, {
          tool: toolResult.toolName,
          status: "completed",
          summary: "Returned live backend data.",
        });
        continue;
      }

      summaries.set(toolResult.toolName, {
        tool: toolResult.toolName,
        status: status === "unavailable" || status === "forbidden" ? "failed" : "skipped",
        summary: `Returned ${status.replace(/_/g, " ")}.`,
      });
    }
  }

  return [...summaries.values()];
}

export async function prepareConversation(
  request: ConversationRequest,
  messages: ModelMessage[]
): Promise<PreparedConversation> {
  const context = createConversationContext(request);
  const intent = await classifyConversationIntent(context);
  validateConversationPermission(intent, context.user);

  const allowedTools = getAllowedToolNames(context.user);
  const suggestedTool =
    intent.suggestedTool && isRegisteredToolName(intent.suggestedTool)
      ? intent.suggestedTool
      : undefined;
  const narrowedTools: RegisteredToolName[] = suggestedTool
    ? allowedTools.includes(suggestedTool)
      ? [suggestedTool]
      : allowedTools
    : allowedTools;

  const activeTools: RegisteredToolName[] = [
    ...new Set([
      ...narrowedTools,
      ...ALWAYS_ACTIVE_TOOLS.filter((tool) => allowedTools.includes(tool)),
    ]),
  ];

  const allowedDatasets = getAllowedDatasetIds(context.user);
  const sessionId = resolveSessionId(context);

  const tools = createAgentTools({
    userId: context.user.userId,
    subInstituteId: context.user.subInstituteId,
    token: context.user.token,
    syear: context.user.syear,
    orgId: context.user.orgId,
    role: context.user.role,
    sessionId,
    allowedDatasets,
  });

  recordAuditEvent(
    "conversation.request",
    {
      intentType: intent.type,
      capability: intent.capability,
      activeTools,
      messageCount: messages.length,
    },
    {
      userId: context.user.userId,
      organizationId: context.user.orgId,
    }
  );

  console.log("[conversation.prepare]", {
    intent,
    activeTools,
    messageCount: messages.length,
  });

  return {
    intent,
    systemPrompt:
      request.systemPrompt ||
      buildConversationSystemPrompt(context, intent, {
        allowedDatasets,
        hasBackendSession: Boolean(
          context.user.token && context.user.subInstituteId
        ),
        sessionId,
      }),
    activeTools,
    tools,
  };
}

export async function generateConversationResponse(
  request: ConversationRequest,
  messages: ModelMessage[]
): Promise<ConversationalResponse> {
  const context = createConversationContext(request);
  // Same key the module data tools record follow-up state under, so the
  // transcript and the remembered queries stay in step.
  const sessionId = resolveSessionId(context);

  appendConversationHistory({
    sessionId,
    userId: context.user.userId || "anonymous",
    messages: [context.latestUserMessage],
  });

  /* ------------------------------------------------------------------ *
   * Step 1 - database first.
   *
   * Deterministic planning and execution, with no LLM call. If the question
   * maps onto a G2G dataset, it is answered here from real backend data and
   * the Gemini quota is never touched.
   * ------------------------------------------------------------------ */
  const databaseFirst = await tryAnswerFromDatabase(
    {
      userId: context.user.userId,
      subInstituteId: context.user.subInstituteId,
      token: context.user.token,
      syear: context.user.syear,
      orgId: context.user.orgId,
      role: context.user.role,
      sessionId,
      allowedDatasets: getAllowedDatasetIds(context.user),
    },
    context.latestUserMessage.content
  );

  if (databaseFirst.handled && databaseFirst.answer) {
    return finalizeDatabaseFirstResponse(context, sessionId, databaseFirst);
  }

  console.log("[conversation.fallback] deterministic path declined", {
    reason: databaseFirst.reason,
  });

  /* ------------------------------------------------------------------ *
   * Step 2 - the question needs real language work (advice, reasoning, or a
   * shape the planner does not cover). That is what the LLM is for.
   * ------------------------------------------------------------------ */
  if (!isLlmAvailable()) {
    return buildLlmUnavailableResponse(context, databaseFirst);
  }

  const prepared = await prepareConversation(request, messages);

  if (needsConversationConfirmation(prepared.intent)) {
    const response: ConversationalResponse = {
      message:
        "This request needs explicit confirmation before execution or monitoring is created.",
      conversationType: prepared.intent.type,
      status: "requires_confirmation",
      confirmation: buildConfirmationPayload(prepared.intent),
      toolExecutions: prepared.activeTools.map((tool) => ({
        tool,
        status: "planned",
        summary: "Awaiting user confirmation before execution.",
      })),
      intent: prepared.intent,
      activeTools: prepared.activeTools,
      followUpSuggestions: [
        "Confirm the action to continue.",
        "Edit the request if any parameter is incorrect.",
      ],
    };

    recordAuditEvent(
      "conversation.confirmation_required",
      {
        capability: prepared.intent.capability,
        activeTools: prepared.activeTools,
      },
      {
        userId: context.user.userId,
        organizationId: context.user.orgId,
      }
    );

    return response;
  }

  /**
   * The classifier inside prepareConversation may itself have hit the quota and
   * opened the cooldown. Re-check here so the agent call is not spent on a
   * request that is already known to fail - this is the second of the two calls
   * the old flow always made.
   */
  if (!isLlmAvailable()) {
    console.log("[conversation.fallback] skipping agent call (quota cooldown)");
    return buildLlmUnavailableResponse(context, databaseFirst);
  }

  // Declared as a local so its (heavily generic) return type is inferred from
  // the concrete tool set rather than widened to ToolSet.
  const runAgent = () =>
    generateText({
      model: createAiModel(),
      system: prepared.systemPrompt,
      messages,
      // A data-backed answer can need listModules -> resolveEntity ->
      // getModuleData -> compose, and a comparison question needs two fetches.
      stopWhen: stepCountIs(10),
      maxRetries: AI_MAX_RETRIES,
      tools: prepared.tools,
      activeTools: prepared.activeTools,
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 0,
            includeThoughts: false,
          },
        },
      },
    });

  let result: Awaited<ReturnType<typeof runAgent>>;

  try {
    result = await runAgent();
  } catch (error) {
    if (!isQuotaError(error)) {
      throw error;
    }

    noteQuotaExhausted(error);

    // The LLM agent could not run. If the question was in fact data shaped,
    // the deterministic path above already had its chance, so all that is
    // left is to say so plainly rather than retry or invent an answer.
    return buildLlmUnavailableResponse(context, databaseFirst);
  }

  const executions = summarizeToolExecutions(result);

  const response: ConversationalResponse = {
    message:
      result.text?.trim() ||
      "I completed the request, but there was no visible text to display.",
    conversationType: prepared.intent.type,
    status: "completed",
    toolExecutions: executions,
    followUpSuggestions: [
      "Ask a follow-up question.",
      "Refine the result with more filters.",
    ],
    intent: prepared.intent,
    // The tools that actually ran, so the UI badges reflect reality rather than
    // everything the role happened to be allowed to use.
    activeTools: executions.length
      ? executions.map((execution) => execution.tool)
      : undefined,
  };

  appendConversationHistory({
    sessionId,
    userId: context.user.userId || "anonymous",
    messages: [
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.message,
      },
    ],
  });

  recordAuditEvent(
    "conversation.response",
    {
      capability: prepared.intent.capability,
      conversationType: prepared.intent.type,
      activeTools: prepared.activeTools,
      status: response.status,
    },
    {
      userId: context.user.userId,
      organizationId: context.user.orgId,
    }
  );

  return response;
}

export async function streamConversationResponse(
  request: ConversationRequest,
  messages: ModelMessage[]
) {
  const prepared = await prepareConversation(request, messages);

  return {
    intent: prepared.intent,
    activeTools: prepared.activeTools,
    result: streamText({
      model: createAiModel(),
      system: prepared.systemPrompt,
      messages,
      // A data-backed answer can need listModules -> resolveEntity ->
      // getModuleData -> compose, and a comparison question needs two fetches.
      stopWhen: stepCountIs(10),
      maxRetries: AI_MAX_RETRIES,
      tools: prepared.tools,
      activeTools: prepared.activeTools,
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 0,
            includeThoughts: false,
          },
        },
      },
    }),
  };
}
