import { google } from "@ai-sdk/google";

export function createAiModel() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error(
      "GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY is required for AI SDK usage."
    );
  }

  return google(process.env.GEMINI_MODEL || "gemini-2.5-flash");
}

/* ------------------------------------------------------------------------- *
 * LLM availability
 *
 * The free Gemini tier allows only a handful of generate_content calls per
 * minute. Once it answers 429 RESOURCE_EXHAUSTED, every further call in that
 * window is guaranteed to fail too - so retrying, or even attempting the next
 * call, only burns quota and adds latency to a request that has to fall back
 * anyway. A short circuit is recorded here and honoured by every caller.
 * ------------------------------------------------------------------------- */

/** Nothing is retried: a quota error is fatal and a transient one falls back. */
export const AI_MAX_RETRIES = 0;

const DEFAULT_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 15 * 60_000;

let quotaCooldownUntil = 0;
let lastQuotaMessage = "";

export function isQuotaError(error: unknown): boolean {
  if (!error) return false;

  const statusCode = (error as { statusCode?: number; status?: number })
    .statusCode ?? (error as { status?: number }).status;

  if (statusCode === 429) return true;

  const parts: string[] = [];
  let cursor: unknown = error;

  // AI SDK wraps provider failures (AI_RetryError -> APICallError), so the
  // 429 marker can sit several `cause` levels down.
  for (let depth = 0; depth < 6 && cursor; depth += 1) {
    if (cursor instanceof Error) parts.push(cursor.message);
    else if (typeof cursor === "string") parts.push(cursor);

    const record = cursor as {
      statusCode?: number;
      status?: number;
      responseBody?: string;
      cause?: unknown;
      lastError?: unknown;
      errors?: unknown[];
    };

    if (record.statusCode === 429 || record.status === 429) return true;
    if (typeof record.responseBody === "string") parts.push(record.responseBody);

    cursor = record.cause ?? record.lastError ?? record.errors?.[0];
  }

  return /429|resource_exhausted|quota exceeded|rate.?limit|free_tier_requests|AI_QUOTA_EXCEEDED/i.test(
    parts.join(" ")
  );
}

/** Seconds Gemini asked us to wait, when it says so. */
export function parseRetryAfterSeconds(error: unknown): number | undefined {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const match = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (!match) return undefined;

  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : undefined;
}

/**
 * Records a quota failure and opens a cooldown window. Called by every LLM
 * caller so one exhausted request spares the rest of the burst.
 */
export function noteQuotaExhausted(error: unknown) {
  const retryAfter = parseRetryAfterSeconds(error);
  const cooldownMs = Math.min(
    retryAfter ? retryAfter * 1000 : DEFAULT_COOLDOWN_MS,
    MAX_COOLDOWN_MS
  );

  quotaCooldownUntil = Date.now() + cooldownMs;
  lastQuotaMessage =
    error instanceof Error ? error.message : "Gemini quota exhausted.";

  console.warn("[conversation.fallback] llm quota exhausted", {
    cooldownSeconds: Math.round(cooldownMs / 1000),
    retryAfterSeconds: retryAfter,
  });

  return { cooldownMs, retryAfterSeconds: retryAfter };
}

export function isLlmAvailable() {
  const hasKey = Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
  );

  return hasKey && Date.now() >= quotaCooldownUntil;
}

export function getLlmUnavailableReason(): "quota" | "no_key" | null {
  if (
    !process.env.GOOGLE_GENERATIVE_AI_API_KEY &&
    !process.env.GEMINI_API_KEY
  ) {
    return "no_key";
  }

  return Date.now() < quotaCooldownUntil ? "quota" : null;
}

export function getQuotaCooldownSecondsRemaining() {
  const remaining = quotaCooldownUntil - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export function getLastQuotaMessage() {
  return lastQuotaMessage;
}

/** Test/ops escape hatch - clears the cooldown early. */
export function resetLlmAvailability() {
  quotaCooldownUntil = 0;
  lastQuotaMessage = "";
}
