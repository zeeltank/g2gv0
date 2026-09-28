import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAiBaseUrl } from "@/lib/api-config";

/**
 * Run one read-only data source as the signed-in user — the AI Stack Knowledge Base
 * tab's "Check" button.
 *
 * Same path and request shape as LMS_K12's `/api/mcp/tools/call` proxy, because the
 * shared Knowledge Base screen posts here unchanged. G2G's "tools" are the read-only
 * sources in hp_erp's ModuleDataSourceCatalog, run by `POST /api/ai/data-sources/{name}/run`
 * — so a check reads real rows for the caller's organisation and can never write.
 *
 * The organisation and user come from the bearer token on the Laravel side; nothing in
 * the body (`baseUrl`, `meta`) is forwarded or trusted.
 */

const requestSchema = z.object({
  tool: z.string().regex(/^[a-z0-9_.-]+$/).max(120),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema>;

  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "The tool call was not valid." }, { status: 422 });
  }

  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return NextResponse.json({ error: "Sign in to check a data source." }, { status: 401 });
  }

  const response = await fetch(`${resolveAiBaseUrl()}/ai/data-sources/${encodeURIComponent(body.tool)}/run`, {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify({ arguments: body.arguments }),
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ error: "The data source could not be reached." }, { status: 502 });
  }

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; message?: string; data?: { data?: { rows?: unknown[]; total?: number } } }
    | null;

  if (!response.ok || payload?.success === false) {
    return NextResponse.json(
      { error: payload?.message ?? `The data source returned ${response.status}.` },
      { status: response.status || 500 },
    );
  }

  const rows = payload?.data?.data?.rows ?? [];

  return NextResponse.json({ data: { rows, total: payload?.data?.data?.total ?? rows.length } });
}
