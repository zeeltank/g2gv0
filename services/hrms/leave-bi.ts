import type { QueryBusinessDataInput } from "@/lib/mcp/client";

async function parseJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `MCP request failed with status ${response.status}`;

    throw new Error(message);
  }

  return payload;
}

export const leaveBiService = {
  async queryBusinessData(input: QueryBusinessDataInput) {
    const response = await fetch("/api/mcp/queryBusinessData", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    return parseJson<Record<string, unknown>>(response);
  },

  async getCapabilities() {
    const response = await fetch("/api/mcp/capabilities");
    return parseJson<{
      tools: unknown[];
      prompts: unknown[];
      resources: unknown[];
    }>(response);
  },

  async getHealth() {
    const response = await fetch("/api/mcp/health");
    return parseJson<Record<string, unknown>>(response);
  },
};
