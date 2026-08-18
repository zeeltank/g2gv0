import {
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import {
  conversationRequestSchema,
  generateConversationResponse,
  streamConversationResponse,
} from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

type SimpleChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "AI chat route failed.";
}

function parseRetryAfterSeconds(message: string) {
  const match = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (!match) {
    return undefined;
  }

  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : undefined;
}

function isQuotaExceededError(message: string) {
  return /quota exceeded|rate.?limit|generativelanguage\.googleapis\.com\/generate_content_free_tier_requests/i.test(
    message
  );
}

function normalizeUiMessages(
  messages: Array<UIMessage | SimpleChatMessage>
): UIMessage[] {
  return messages.map((message, index) => {
    if ("parts" in message && Array.isArray(message.parts)) {
      return message as UIMessage;
    }

    const simpleMessage = message as SimpleChatMessage;

    return {
      id: simpleMessage.id || `msg-${index + 1}`,
      role: simpleMessage.role,
      parts: [
        {
          type: "text",
          text: simpleMessage.content,
        },
      ],
    } as UIMessage;
  });
}

function toConversationMessages(messages: Array<UIMessage | SimpleChatMessage>) {
  return messages.map((message, index) => {
    if ("parts" in message && Array.isArray(message.parts)) {
      const content = message.parts
        .filter((part) => part.type === "text")
        .map((part) => ("text" in part ? part.text : ""))
        .join("\n")
        .trim();

      return {
        id: message.id || `msg-${index + 1}`,
        role: message.role,
        content: content || "[non-text message]",
      };
    }

    const simpleMessage = message as SimpleChatMessage;

    return {
      id: simpleMessage.id || `msg-${index + 1}`,
      role: simpleMessage.role,
      content: simpleMessage.content,
    };
  });
}

export async function POST(request: Request) {
  try {
    const rawBody = (await request.json()) as {
      messages?: Array<UIMessage | SimpleChatMessage>;
      systemPrompt?: string;
      responseMode?: "stream" | "json";
      context?: {
        userId?: string;
        subInstituteId?: string;
        role?: string;
        profileName?: string;
        employeeNo?: string;
        orgId?: string;
      };
    };

    const body = conversationRequestSchema.parse({
      ...rawBody,
      messages: rawBody.messages ? toConversationMessages(rawBody.messages) : [],
    });

    const messages = await convertToModelMessages(
      normalizeUiMessages(body.messages)
    );

    if (body.responseMode === "json") {
      const result = await generateConversationResponse(body, messages);

      return NextResponse.json({
        message: {
          id: `assistant-${Date.now()}`,
          role: "assistant" as const,
          content: result.message,
        },
        response: result,
      });
    }

    const { result } = await streamConversationResponse(body, messages);

    return result.toUIMessageStreamResponse({
      onError: (error: unknown) => {
        console.error("[ai/chat] error", error);
        return error instanceof Error
          ? error.message
          : "AI agent request failed.";
      },
    });
  } catch (error) {
    console.error("[ai/chat] route failure", error);
    const message = getErrorMessage(error);

    if (isQuotaExceededError(message)) {
      const retryAfterSeconds = parseRetryAfterSeconds(message);

      return NextResponse.json(
        {
          error:
            "The AI provider quota is temporarily exhausted. Please retry shortly or switch to a billed Gemini API key/model configuration.",
          detail: message,
          retryAfterSeconds,
          code: "AI_QUOTA_EXCEEDED",
        },
        {
          status: 429,
          headers: retryAfterSeconds
            ? { "Retry-After": String(retryAfterSeconds) }
            : undefined,
        }
      );
    }

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}
