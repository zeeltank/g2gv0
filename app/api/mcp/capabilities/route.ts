import { NextResponse } from "next/server";
import { discoverMcpCapabilities } from "@/lib/mcp/client";

export const runtime = "nodejs";

export async function GET() {
  try {
    const capabilities = await discoverMcpCapabilities();
    return NextResponse.json(capabilities);
  } catch (error) {
    console.error("[api/mcp/capabilities] request failed", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to discover MCP capabilities.",
      },
      { status: 500 }
    );
  }
}
