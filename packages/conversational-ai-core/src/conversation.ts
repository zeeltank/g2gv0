import {
  generateText,
  stepCountIs,
  streamText,
  type ModelMessage,
} from "ai";
import { recordAuditEvent } from "./audit";
import { appendConversationHistory } from "./history";
import { getLatestUserMessage } from "./context";
import { createAiModel } from "./model";
import type { ConversationalResponse } from "./response-schema";
import type { ConversationRequest } from "./schemas";
import type {
  PreparedConversation,
  ProjectAIAdapter,
  ProjectToolDefinition,
} from "./types";
import { createProjectTools } from "./tools";

function isQuotaExceededError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /quota exceeded|rate.?limit|resource_exhausted|generativelanguage\.googleapis\.com\/generate_content_free_tier_requests/i.test(
    message
  );
}

function toLocalizedMessage(
  language: PreparedConversation["context"]["detectedLanguage"],
  english: string,
  hindi: string,
  gujarati: string
) {
  if (language === "hindi") {
    return hindi;
  }

  if (language === "gujarati") {
    return gujarati;
  }

  return english;
}

function summarizeDirectToolData(result: unknown) {
  if (typeof result === "string") {
    return result;
  }

  if (Array.isArray(result)) {
    return `Retrieved ${result.length} record(s).`;
  }

  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return `Retrieved ${record.data.length} record(s) from the backend.`;
    }

    if (
      record.data &&
      typeof record.data === "object" &&
      !Array.isArray(record.data)
    ) {
      const nested = record.data as Record<string, unknown>;
      const nestedSummary = Object.entries(nested)
        .filter(([, value]) => Array.isArray(value))
        .map(([key, value]) => `${key}: ${value.length}`)
        .slice(0, 3)
        .join(", ");

      if (nestedSummary) {
        return `Retrieved backend data (${nestedSummary}).`;
      }
    }

    const keys = Object.keys(record).slice(0, 5);
    if (keys.length > 0) {
      return `Retrieved backend data with fields: ${keys.join(", ")}.`;
    }
  }

  return "Retrieved backend data successfully.";
}

async function buildQuotaFallbackResponse(
  prepared: PreparedConversation
): Promise<ConversationalResponse | null> {
  const selectedDefinition =
    prepared.toolDefinitions.find(
      (definition) =>
        prepared.intent.suggestedTool &&
        definition.name === prepared.intent.suggestedTool
    ) || prepared.toolDefinitions[0];

  if (!selectedDefinition) {
    return null;
  }

  try {
    const result = await selectedDefinition.execute({}, prepared.context);
    const dataSummary = summarizeDirectToolData(result);
    const prefix = toLocalizedMessage(
      prepared.context.detectedLanguage,
      "The AI provider is temporarily rate-limited, but I was still able to fetch data from the LMS backend.",
      "AI सेवा पर अभी रेट-लिमिट लागू है, लेकिन मैं LMS बैकएंड से डेटा फिर भी प्राप्त कर सका।",
      "AI સેવા હાલમાં રેટ-લિમિટમાં છે, છતાં હું LMS બેકએન્ડમાંથી માહિતી મેળવી શક્યો છું."
    );

    return {
      message: `${prefix}\n\n${dataSummary}`,
      conversationType: prepared.intent.type,
      status: "completed",
      data: result,
      toolExecutions: [
        {
          tool: selectedDefinition.name,
          status: "completed",
          summary: "Executed directly through the backend fallback path.",
        },
      ],
      followUpSuggestions: [
        "Ask for a narrower filter.",
        "Retry later for a fully generated AI explanation.",
      ],
      intent: prepared.intent,
      activeTools: [selectedDefinition.name],
    };
  } catch (toolError) {
    const detail =
      toolError instanceof Error ? toolError.message : "Tool execution failed.";
    const message = toLocalizedMessage(
      prepared.context.detectedLanguage,
      `The AI provider quota is temporarily exhausted, and the backend fallback could not complete this request: ${detail}`,
      `AI प्रदाता का कोटा अभी समाप्त है, और बैकएंड फॉलबैक यह अनुरोध पूरा नहीं कर सका: ${detail}`,
      `AI પ્રદાતાનો ક્વોટા હાલમાં પૂર્ણ થયો છે, અને બેકએન્ડ ફૉલબેક આ વિનંતી પૂર્ણ કરી શક્યો નથી: ${detail}`
    );

    return {
      message,
      conversationType: prepared.intent.type,
      status: "failed",
      toolExecutions: [
        {
          tool: selectedDefinition.name,
          status: "failed",
          summary: detail,
        },
      ],
      intent: prepared.intent,
      activeTools: [selectedDefinition.name],
    };
  }
}

export async function prepareConversation(
  adapter: ProjectAIAdapter,
  request: ConversationRequest,
  messages: ModelMessage[]
): Promise<PreparedConversation> {
  const context = await adapter.resolveContext({
    request,
    trustedContext: request.context || {},
  });
  const intent = await adapter.classifyIntent(context);
  await adapter.validatePermission(intent, context);

  const allowedTools = await adapter.getAllowedToolNames(context);
  const definitions = await adapter.getToolDefinitions(context);
  const activeTools =
    intent.suggestedTool && allowedTools.includes(intent.suggestedTool)
      ? [intent.suggestedTool]
      : allowedTools;
  const tools = createProjectTools(
    definitions.filter((definition) => activeTools.includes(definition.name)),
    context
  );
  const systemPrompt = await adapter.buildSystemPrompt(context, intent);

  recordAuditEvent(
    "conversation.request",
    {
      projectId: adapter.projectId,
      intentType: intent.type,
      capability: intent.capability,
      activeTools,
      messageCount: messages.length,
    },
    {
      userId: context.userId,
      organizationId: context.orgId,
    }
  );

  return {
    adapter,
    context,
    intent,
    systemPrompt,
    activeTools,
    tools,
    toolDefinitions: definitions.filter((definition) =>
      activeTools.includes(definition.name)
    ),
  };
}

export async function generateConversationResponse(
  adapter: ProjectAIAdapter,
  request: ConversationRequest,
  messages: ModelMessage[]
): Promise<ConversationalResponse> {
  const prepared = await prepareConversation(adapter, request, messages);
  const latestUserMessage = getLatestUserMessage(request);
  const sessionId = prepared.context.userId || "anonymous";
  const userId = prepared.context.userId || "anonymous";

  appendConversationHistory({
    sessionId,
    userId,
    messages: [latestUserMessage],
  });

  let result;
  try {
    result = await generateText({
      model: createAiModel(),
      system: prepared.systemPrompt,
      messages,
      stopWhen: stepCountIs(6),
      maxRetries: 0,
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
  } catch (error) {
    if (isQuotaExceededError(error)) {
      const fallbackResponse = await buildQuotaFallbackResponse(prepared);
      if (fallbackResponse) {
        appendConversationHistory({
          sessionId,
          userId,
          messages: [
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: fallbackResponse.message,
            },
          ],
        });

        recordAuditEvent(
          "conversation.response",
          {
            projectId: adapter.projectId,
            capability: prepared.intent.capability,
            conversationType: prepared.intent.type,
            activeTools: fallbackResponse.activeTools,
            status: fallbackResponse.status,
          },
          {
            userId: prepared.context.userId,
            organizationId: prepared.context.orgId,
          }
        );

        return fallbackResponse;
      }
    }

    throw error;
  }

  const response: ConversationalResponse = {
    message:
      result.text?.trim() ||
      "I completed the request, but there was no visible text to display.",
    conversationType: prepared.intent.type,
    status: "completed",
    toolExecutions: prepared.activeTools.map((toolName) => ({
      tool: toolName,
      status: "completed",
      summary: "Executed through the shared conversational AI pipeline.",
    })),
    followUpSuggestions: [
      "Ask a follow-up question.",
      "Refine the result with more filters.",
    ],
    intent: prepared.intent,
    activeTools: prepared.activeTools,
  };

  appendConversationHistory({
    sessionId,
    userId,
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
      projectId: adapter.projectId,
      capability: prepared.intent.capability,
      conversationType: prepared.intent.type,
      activeTools: prepared.activeTools,
      status: response.status,
    },
    {
      userId: prepared.context.userId,
      organizationId: prepared.context.orgId,
    }
  );

  return response;
}

export async function streamConversationResponse(
  adapter: ProjectAIAdapter,
  request: ConversationRequest,
  messages: ModelMessage[]
) {
  const prepared = await prepareConversation(adapter, request, messages);

  return {
    intent: prepared.intent,
    activeTools: prepared.activeTools,
    result: streamText({
      model: createAiModel(),
      system: prepared.systemPrompt,
      messages,
      stopWhen: stepCountIs(6),
      maxRetries: 0,
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
