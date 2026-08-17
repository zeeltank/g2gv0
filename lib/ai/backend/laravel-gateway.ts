/**
 * Laravel gateway for the Conversational AI (server side).
 *
 * The conversational pipeline runs inside Next.js route handlers, so it cannot
 * use `services/*` directly: those helpers read the Laravel session out of
 * `window.localStorage` via `getLaravelContext()`. Here the same coordinates
 * (token, sub_institute_id, syear, user_id, org_id) arrive on the chat request
 * body instead and are threaded through explicitly.
 *
 * Everything else is deliberately identical to the browser services:
 *  - the same base URL resolution (`buildApiUrl` / `buildWebUrl`)
 *  - the same query parameter envelope (`withLaravelParams`)
 *
 * The one behavioural difference is error handling. `apiClient` throws
 * `ApiError`, which is right for a screen. A conversational tool must instead
 * hand the model a *fact* about the failure so it can say "that information
 * isn't available" rather than inventing an answer - so every call resolves to
 * a discriminated result and never rejects.
 */

import { withLaravelParams, type LaravelContext } from "@/lib/laravel-context";
import { buildApiUrl, buildWebUrl } from "@/services/core/api-client";

/** Tenant coordinates the conversation was started with. */
export interface LaravelRuntimeContext {
  token?: string;
  subInstituteId?: string;
  syear?: string;
  userId?: string;
  orgId?: string;
}

export type LaravelFailureReason =
  /** The chat request carried no Laravel token - the user must sign in again. */
  | "session_missing"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  /** Laravel accepted the request but has no rows for these filters. */
  | "empty"
  | "validation"
  | "server"
  | "network"
  | "invalid_response";

export interface LaravelSuccess<T> {
  ok: true;
  status: number;
  data: T;
}

export interface LaravelFailure {
  ok: false;
  status: number;
  reason: LaravelFailureReason;
  message: string;
}

export type LaravelResult<T> = LaravelSuccess<T> | LaravelFailure;

export interface LaravelRequestOptions {
  /** `api` hits /api/*, `web` hits the Laravel web root (table_data, settings/*). */
  transport?: "api" | "web";
  method?: "GET" | "POST";
  /** Extra query params. Values that are undefined/null/'' are dropped. */
  params?: Record<string, string | number | undefined | null>;
  /** POST body. The Laravel context params are merged in automatically. */
  body?: Record<string, unknown>;
  /** Some endpoints (talent-acquisition/*) additionally want a bearer header. */
  bearer?: boolean;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;

export function hasLaravelSession(context: LaravelRuntimeContext) {
  return Boolean(context.token && context.subInstituteId);
}

function toLaravelContext(context: LaravelRuntimeContext): LaravelContext {
  return {
    token: context.token ?? "",
    subInstituteId: context.subInstituteId ?? "",
    syear: context.syear ?? "",
    userId: context.userId ?? "",
    organizationId: context.orgId ?? "",
  };
}

/** Drops empty values so Laravel's `filled()` / `has()` checks skip them. */
export function compactParams(
  params?: Record<string, string | number | undefined | null>
): Record<string, string> {
  if (!params) return {};

  return Object.entries(params).reduce<Record<string, string>>(
    (accumulator, [key, value]) => {
      if (value === undefined || value === null) return accumulator;

      const normalized = String(value).trim();
      if (normalized === "") return accumulator;

      accumulator[key] = normalized;
      return accumulator;
    },
    {}
  );
}

/**
 * The tenant envelope every Laravel endpoint reads: token, sub_institute_id,
 * syear/financial_year, user_id, organization_id and type=API.
 */
export function laravelParams(
  context: LaravelRuntimeContext,
  extra?: Record<string, string | number | undefined | null>
) {
  return withLaravelParams(toLaravelContext(context), compactParams(extra));
}

function classifyStatus(status: number): LaravelFailureReason {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 422 || status === 400) return "validation";
  return "server";
}

function extractMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["message", "error", "errors"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }

  return fallback;
}

/**
 * Laravel signals "authenticated but nothing matched" in several shapes:
 * a 404 `{message: 'Data not found'}` from table_data, and `status: 0`
 * envelopes from the settings/* controllers. Treat both as an empty result so
 * the assistant reports "no matching records" instead of an error.
 */
function detectEnvelopeFailure(payload: unknown): LaravelFailure | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const status = record.status ?? record.status_code;

  if (status !== undefined && String(status) === "0") {
    return {
      ok: false,
      status: 200,
      reason: "validation",
      message: extractMessage(payload, "Laravel rejected the request."),
    };
  }

  return null;
}

export async function laravelRequest<T = unknown>(
  context: LaravelRuntimeContext,
  path: string,
  options: LaravelRequestOptions = {}
): Promise<LaravelResult<T>> {
  const {
    transport = "api",
    method = "GET",
    params,
    body,
    bearer = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  if (!hasLaravelSession(context)) {
    return {
      ok: false,
      status: 401,
      reason: "session_missing",
      message:
        "No Laravel session is attached to this conversation, so live system data cannot be read. Ask the user to sign in again.",
    };
  }

  const envelope = laravelParams(context, params);
  const buildUrl = transport === "web" ? buildWebUrl : buildApiUrl;
  const url = buildUrl(path, envelope);

  /**
   * The browser services can fetch "/api/..." relatively; a route handler
   * cannot - Node rejects a relative URL outright. When the base URL env var is
   * missing this would surface as an opaque "Invalid URL" network error on every
   * single dataset, so name the actual cause instead.
   */
  if (!/^https?:\/\//i.test(url)) {
    return {
      ok: false,
      status: 0,
      reason: "server",
      message:
        "The G2G API base URL is not configured for server-side calls. Set NEXT_PUBLIC_API_BASE_URL_DEV (or NEXT_PUBLIC_API_BASE_URL_PROD) so the assistant can reach the backend.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        ...(bearer && context.token
          ? { Authorization: `Bearer ${context.token}` }
          : {}),
      },
      ...(method === "POST"
        ? { body: JSON.stringify({ ...envelope, ...(body || {}) }) }
        : {}),
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();
    let payload: unknown = null;

    if (text.trim()) {
      try {
        payload = JSON.parse(text);
      } catch {
        // Laravel redirected to an HTML login page or returned a stack trace.
        return {
          ok: false,
          status: response.status,
          reason: response.ok ? "invalid_response" : classifyStatus(response.status),
          message: response.ok
            ? `${path} returned a non-JSON response, so no data could be read.`
            : `${path} failed with HTTP ${response.status}.`,
        };
      }
    }

    if (!response.ok) {
      const reason = classifyStatus(response.status);

      // table_data answers 404 {message:'Data not found'} for an empty result.
      if (reason === "not_found" && /not found/i.test(extractMessage(payload, ""))) {
        return {
          ok: false,
          status: response.status,
          reason: "empty",
          message: "No matching records were found for these filters.",
        };
      }

      return {
        ok: false,
        status: response.status,
        reason,
        message: extractMessage(payload, `${path} failed with HTTP ${response.status}.`),
      };
    }

    const envelopeFailure = detectEnvelopeFailure(payload);
    if (envelopeFailure) return envelopeFailure;

    return { ok: true, status: response.status, data: payload as T };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";

    return {
      ok: false,
      status: 0,
      reason: "network",
      message: aborted
        ? `${path} did not respond within ${Math.round(timeoutMs / 1000)}s.`
        : `${path} could not be reached: ${
            error instanceof Error ? error.message : "unknown network error"
          }`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Unwraps the payload shapes the Laravel controllers use, in priority order:
 * `{data}` (Api\Leave\*, talent\*), `{metrics}`, `{result}`, a bare array, or
 * the object itself. Keeps the raw envelope available for the caller.
 */
export function unwrapLaravelData(payload: unknown): unknown {
  if (payload === null || payload === undefined) return payload;
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== "object") return payload;

  const record = payload as Record<string, unknown>;

  for (const key of ["data", "metrics", "result", "rows"]) {
    if (record[key] !== undefined) return record[key];
  }

  return payload;
}

/** True when a successful response carries no usable rows. */
export function isEmptyPayload(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}
