/**
 * What the chat route needs from the backend AI layer (server side).
 *
 * `app/api/ai/chat` calls Google with its own key, so before this existed its spend never
 * reached the AI & Intelligence Usage panel and AI Model Setup could not influence it.
 * Two small calls close that without moving the chat itself:
 *
 *  - reportChatUsage()          writes what a call used to `ai_usage_events`
 *                               (POST /api/ai/chat-usage, module `conversational_ai`).
 *  - resolveConfiguredChatModel()  asks which Gemini model an administrator has explicitly
 *                               chosen (GET /api/ai/chat-model). Null — the normal case —
 *                               means "keep the route's own default".
 *
 * NEITHER MAY EVER BREAK A CHAT. Both swallow every failure (no session, backend down,
 * timeout, an older backend without the routes) and resolve to "nothing happened", because
 * a usage report or a model lookup is bookkeeping, not part of the answer.
 */

import { laravelRequest, type LaravelRuntimeContext } from "./laravel-gateway";

const REPORT_TIMEOUT_MS = 3_000;
const MODEL_TIMEOUT_MS = 2_000;
const MODEL_CACHE_MS = 60_000;
const MODEL_CACHE_MAX = 50;
/** Same character set the Gemini model ids use; anything else is not passed to the provider. */
const MODEL_ID = /^[A-Za-z0-9._-]{1,100}$/;

export interface ChatUsageReport {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  outcome?: "success" | "failed";
  error?: string;
  relatedType?: "chat" | "intent_classifier";
}

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : undefined;
}

/** Fire-and-forget. Resolves once the report has been attempted; never rejects. */
export async function reportChatUsage(
  context: LaravelRuntimeContext,
  report: ChatUsageReport
): Promise<void> {
  try {
    await laravelRequest(context, "/ai/chat-usage", {
      method: "POST",
      bearer: true,
      timeoutMs: REPORT_TIMEOUT_MS,
      body: {
        model: report.model,
        input_tokens: count(report.inputTokens),
        output_tokens: count(report.outputTokens),
        latency_ms: count(report.latencyMs),
        outcome: report.outcome ?? "success",
        error: report.error ? report.error.slice(0, 500) : undefined,
        related_type: report.relatedType ?? "chat",
      },
    });
  } catch {
    // Bookkeeping must not cost anyone an answer.
  }
}

const modelCache = new Map<string, { until: number; model: string | undefined }>();

/** The model an administrator explicitly chose for the assistant, or undefined. */
export async function resolveConfiguredChatModel(
  context: LaravelRuntimeContext
): Promise<string | undefined> {
  const key = `${context.subInstituteId ?? ""}:${context.userId ?? ""}`;

  if (!context.token || !context.subInstituteId) return undefined;

  const cached = modelCache.get(key);
  if (cached && cached.until > Date.now()) return cached.model;

  let model: string | undefined;

  try {
    const result = await laravelRequest<{ data?: { model?: string | null } }>(
      context,
      "/ai/chat-model",
      { method: "GET", bearer: true, timeoutMs: MODEL_TIMEOUT_MS }
    );

    const value = result.ok
      ? (result.data as { data?: { model?: string | null } } | undefined)?.data?.model
      : undefined;

    model = typeof value === "string" && MODEL_ID.test(value) ? value : undefined;
  } catch {
    model = undefined;
  }

  // A failure is cached briefly too, so an unreachable backend is not retried on every message.
  if (modelCache.size >= MODEL_CACHE_MAX) modelCache.clear();
  modelCache.set(key, { until: Date.now() + MODEL_CACHE_MS, model });

  return model;
}

/** Test hook. */
export function resetChatModelCache() {
  modelCache.clear();
}
