// src/lib/mcp/client/mcpClient.ts

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { QueryBusinessDataInput, McpToolResult } from "./types.ts";

const MCP_SERVER_URL = process.env.MCP_SERVER_URL ?? "http://localhost:3400";

function getMcpServerUrl() {
  try {
    return new URL(MCP_SERVER_URL);
  } catch {
    throw new Error(
      `Invalid MCP_SERVER_URL value: ${MCP_SERVER_URL}. Expected a valid absolute URL.`
    );
  }
}

function getMcpErrorMessage(toolName: string, error: unknown) {
  const baseMessage =
    error instanceof Error ? error.message : "Unknown MCP client error";

  if (baseMessage.startsWith("MCP server is unavailable for")) {
    return baseMessage;
  }

  if (/ECONNREFUSED|ENOTFOUND|fetch|network|timeout/i.test(baseMessage)) {
    return `MCP server is unavailable for "${toolName}". Check MCP_SERVER_URL and server health.`;
  }

  return `MCP call failed for "${toolName}": ${baseMessage}`;
}

function getTextContent(result: McpToolResult<any>) {
  return result.content?.[0]?.text?.trim() || "";
}

function parseStructuredContent<TResponse>(
  result: McpToolResult<any>
): TResponse | string {
  if (result.structuredContent !== undefined) {
    return result.structuredContent;
  }

  const text = getTextContent(result);
  if (!text) {
    throw new Error("MCP tool returned empty content.");
  }

  try {
    return JSON.parse(text) as TResponse;
  } catch {
    return text;
  }
}

/**
 * Creates a connected MCP client instance.
 * Each call opens a fresh connection, which works well for request-scoped usage.
 */
export async function createMcpClient() {
  const client = new Client({ name: "bi-mcp-client", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(getMcpServerUrl());

  await client.connect(transport);
  return client;
}

export async function callMcpTool<
  TResponse = Record<string, unknown>,
  TArgs = Record<string, unknown>,
>(toolName: string, input: TArgs): Promise<TResponse> {
  let client: Awaited<ReturnType<typeof createMcpClient>> | undefined;

  try {
    client = await createMcpClient();

    const result = (await client.callTool({
      name: toolName,
      arguments: { ...(input as Record<string, unknown>) },
    })) as McpToolResult<TResponse>;

    console.log("[mcp-client] tool response", {
      toolName,
      isError: result.isError,
      hasStructuredContent: Boolean(result.structuredContent),
      contentText: getTextContent(result),
    });

    if (result.isError) {
      throw new Error(
        getTextContent(result) || `MCP tool "${toolName}" returned an error.`
      );
    }

    return parseStructuredContent(result) as TResponse;
  } catch (error) {
    throw new Error(getMcpErrorMessage(toolName, error));
  } finally {
    if (client) {
      await client.close().catch(() => undefined);
    }
  }
}

export async function queryBusinessData(
  input: QueryBusinessDataInput
): Promise<Record<string, unknown>> {
  return callMcpTool<Record<string, unknown>, QueryBusinessDataInput>(
    "queryBusinessData",
    input
  );
}

/**
 * Lists all tools, prompts, and resources the MCP server exposes.
 * Useful during development to verify what's available.
 */
export async function discoverMcpCapabilities() {
  const client = await createMcpClient();

  try {
    const [tools, prompts, resources] = await Promise.all([
      client.listTools(),
      client.listPrompts(),
      client.listResources(),
    ]);

    return {
      tools: tools.tools,
      prompts: prompts.prompts,
      resources: resources.resources,
    };
  } finally {
    await client.close().catch(() => undefined);
  }
}
