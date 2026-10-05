import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAiBaseUrl } from "@/lib/api-config";
import { instructionForAction } from "@/lib/ai/field-edit/actions";
import {
  buildFieldEditVariables,
  cleanFieldEditOutput,
  inspectFieldEditOutput,
} from "@/lib/ai/field-edit/prompt";
import type { AiFieldContext } from "@/lib/ai/field-edit/types";

// G2G PORT of LMS_K12's route, behaviour unchanged. It calls hp_erp's POST /api/ai/generate
// (AiGenerationController: renders the `g2g.field_edit` template, calls the model through
// AiModelClient — resolved, quota-checked, metered). resolveAiBaseUrl() already ends in /api.

/**
 * Field-level AI editing — a proxy into the central AI runtime.
 *
 * One field in, one replacement value out. Deliberately not a conversation: the caller
 * is a form field, the answer is text destined for that field, and every request is
 * independent so nothing carries over between two unrelated edits.
 *
 * This route does not write anything. It reads the value it was handed and returns a
 * suggestion; the existing form save path is what persists it, only after a human
 * presses Apply and then Save. That separation is what keeps the feature additive —
 * an AI failure can never corrupt a record on its own.
 *
 * WHAT CHANGED, AND WHY
 *
 * This used to be the one generative call outside the platform's runtime: it built its
 * own prompt, took a model name from `GEMINI_MODEL`, and read a provider key straight
 * from the environment. That meant the highest-volume AI traffic in the product — the
 * sparkle assistant on 40 fields across 14 modules — used none of the platform's
 * provider pool, none of its prompt versioning, and wrote nothing to its audit or
 * usage tables. The file's own note said to replace it with a proxy once Laravel had
 * an equally narrow contract to proxy to.
 *
 * `POST /api/ai/generate` is that contract. It resolves, centrally and per tenant:
 * the prompt (`ai_templates` → `k12.field_edit`, versioned and overridable per
 * school), the policy (SafetyChecker on the caller's variables), the provider and key
 * (the `ai_api_keys` pool, rotated, with per-key daily limits), and the model (the
 * configured driver). It records `ai_generation_requests`, `ai_generation_outputs`
 * and an audit entry on the way past.
 *
 * The browser contract is unchanged — same request body, same
 * `{ result, note, actionKey, model }` response — so no call site moved. The output
 * guards stay here because they are about what a *form field* can accept, which is a
 * frontend concern the runtime has no opinion on.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const fieldContextSchema = z.object({
  fieldType: z
    .enum([
      "question",
      "answer_option",
      "explanation",
      "learning_objective",
      "lesson_content",
      "instructions",
      "description",
      "summary",
      "announcement",
      "policy",
      "feedback",
      "title",
      "notes",
      "generic",
    ])
    .default("generic"),
  fieldLabel: z.string().max(120).optional(),
  module: z.string().max(80).optional(),
  page: z.string().max(120).optional(),
  entityType: z.string().max(80).optional(),
  entityId: z.union([z.string(), z.number()]).nullable().optional(),
  grade: z.union([z.string(), z.number()]).nullable().optional(),
  subject: z.string().max(120).nullable().optional(),
  language: z.string().max(60).nullable().optional(),
  related: z.record(z.string(), z.string().max(2000)).optional(),
  maxLength: z.number().int().positive().nullable().optional(),
});

const requestSchema = z
  .object({
    // 20k is generous for a form field and still bounded — a pasted document should
    // not become a prompt.
    value: z.string().max(20000).default(""),
    instruction: z.string().max(1000).optional(),
    actionKey: z.string().max(80).optional(),
    actionInput: z.string().max(200).optional(),
    context: fieldContextSchema,
  })
  .refine((body) => Boolean(body.instruction?.trim() || body.actionKey), {
    message: "Provide an instruction or an action.",
    path: ["instruction"],
  });

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "AI field edit failed.";
}

function parseRetryAfterSeconds(message: string) {
  const match = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (!match) return undefined;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : undefined;
}

/** The template every field edit renders. Owned by Prompt Management, not by this file. */
const FIELD_EDIT_TEMPLATE_KEY = "g2g.field_edit";

/**
 * Hand the edit to the central runtime and return what it generated.
 *
 * The module the request came from travels as `domain`/`purpose`, so usage and audit
 * rows record which part of the ERP asked — that is what makes "who is spending the
 * AI budget" answerable per module rather than per product.
 */
async function generateViaCentralRuntime(input: {
  authorization: string;
  instruction: string;
  value: string;
  context: AiFieldContext;
}): Promise<{ text: string; model: string | null }> {
  const baseUrl = resolveAiBaseUrl();

  if (!baseUrl) {
    throw new Error("The AI API base URL is not configured.");
  }

  const response = await fetch(`${baseUrl}/ai/generate`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: input.authorization,
    },
    body: JSON.stringify({
      template_key: FIELD_EDIT_TEMPLATE_KEY,
      // Bounded to the column's 120 characters and prefixed so a usage report can
      // group every field edit together regardless of which module raised it.
      purpose: `field_edit:${input.context.module || "unknown"}`.slice(0, 120),
      domain: "g2g",
      variables: buildFieldEditVariables({
        value: input.value,
        instruction: input.instruction,
        context: input.context,
      }),
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success === false) {
    // The runtime's own refusals — safety, missing template, provider failure — are
    // meaningful to the user, so its message is surfaced rather than replaced.
    throw new Error(payload?.message || `The AI runtime returned ${response.status}.`);
  }

  const data = payload?.data ?? {};
  const text = typeof data.content === "string" ? data.content : "";

  if (!text.trim()) {
    throw new Error("The AI runtime returned no content.");
  }

  return { text, model: typeof data.model === "string" ? data.model : null };
}

function isQuotaExceededError(message: string) {
  return /quota exceeded|rate.?limit|generativelanguage\.googleapis\.com\/generate_content_free_tier_requests/i.test(
    message
  );
}

/**
 * A provider that rejected the credential rather than the request.
 *
 * Worth telling apart from every other failure because it is the one a teacher
 * can do nothing about and an administrator can fix in a minute — and because
 * the runtime's own wording for it, a raw `The AI provider returned 401:
 * {"error":{"message":"User not found."}}`, reads as a bug in the assistant
 * when it is a key that is missing, disabled or revoked.
 */
function isProviderCredentialError(message: string) {
  return /returned 40[13]\b|invalid[_ ]api[_ ]key|api key not valid|user not found|unauthorized|permission denied/i.test(
    message
  );
}

export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema>;

  try {
    body = requestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "The AI edit request was not valid.",
        code: "AI_FIELD_EDIT_INVALID",
        detail: error instanceof z.ZodError ? z.prettifyError(error) : getErrorMessage(error),
      },
      { status: 422 }
    );
  }

  // A chip and a typed sentence resolve to the same instruction, so there is one code
  // path and one thing to debug. A typed instruction wins when both are present.
  const instruction =
    body.instruction?.trim() ||
    (body.actionKey ? instructionForAction(body.actionKey, body.actionInput) : null);

  if (!instruction) {
    return NextResponse.json(
      { error: "That action is not recognised.", code: "AI_FIELD_EDIT_UNKNOWN_ACTION" },
      { status: 422 }
    );
  }

  // Nothing to edit and nothing to build from. Refusing here saves a pointless call and
  // stops the model narrating an empty field back at the user as if it were content.
  const hasContext =
    Object.values(body.context.related ?? {}).some((value) => value.trim()) ||
    Boolean(body.context.fieldLabel?.trim());

  if (!body.value.trim() && !hasContext) {
    return NextResponse.json(
      {
        error: "There is nothing to work from yet. Type something in the field first, or fill in the rest of the form.",
        code: "AI_FIELD_EDIT_NO_CONTENT",
      },
      { status: 422 }
    );
  }

  // The caller's own token. Scope — which school, which user — is derived from it on
  // the Laravel side by McpContextHydrator, so nothing about the tenant travels in
  // this request body and no institute id is written down anywhere in this file.
  const authorization = request.headers.get('authorization');

  if (!authorization) {
    return NextResponse.json(
      { error: 'Sign in to use the AI assistant.', code: 'AI_FIELD_EDIT_UNAUTHENTICATED' },
      { status: 401 }
    );
  }

  try {
    const { text, model } = await generateViaCentralRuntime({
      authorization,
      instruction,
      value: body.value,
      context: body.context,
    });

    const result = cleanFieldEditOutput(text, body.value);
    const inspection = inspectFieldEditOutput(result, body.value);

    if (!inspection.ok) {
      return NextResponse.json(
        { error: inspection.reason, code: "AI_FIELD_EDIT_UNUSABLE" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      result,
      actionKey: body.actionKey,
      model,
      note:
        result.trim() === body.value.trim()
          ? "No change was needed — the text already meets that instruction."
          : undefined,
    });
  } catch (error) {
    console.error("[ai/field-edit] route failure", error);
    const message = getErrorMessage(error);

    if (isQuotaExceededError(message)) {
      const retryAfterSeconds = parseRetryAfterSeconds(message);

      return NextResponse.json(
        {
          error: "The AI provider quota is temporarily exhausted. Please retry shortly.",
          detail: message,
          retryAfterSeconds,
          code: "AI_QUOTA_EXCEEDED",
        },
        {
          status: 429,
          headers: retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : undefined,
        }
      );
    }

    // Quota is checked first: a 429 can also read as "rate limit", and a
    // throttled provider is a wait, not a misconfiguration.
    if (isProviderCredentialError(message)) {
      return NextResponse.json(
        {
          error:
            'The AI provider rejected the configured credential, so the assistant could not run. '
            + 'An administrator can fix this in AI & Intelligence → AI Providers: the key for this '
            + 'module is missing, disabled or no longer valid.',
          detail: message,
          code: 'AI_PROVIDER_CREDENTIAL_REJECTED',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: message, code: "AI_FIELD_EDIT_FAILED" }, { status: 500 });
  }
}
