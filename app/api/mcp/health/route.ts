import { NextResponse } from "next/server";
import { checkMariaDbHealth } from "@/lib/mcp/server/datasource/mariadb.ts";

export const runtime = "nodejs";

export async function GET() {
  try {
    const health = await checkMariaDbHealth();
    return NextResponse.json(health, { status: health.ok ? 200 : 503 });
  } catch (error) {
    console.error("[api/mcp/health] request failed", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to run the MCP database health check.",
      },
      { status: 500 }
    );
  }
}
