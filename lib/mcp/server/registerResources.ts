import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { datasourceRegistry } from "./registries/datasourceRegistry.ts";
import { intentRegistry } from "./registries/intentRegistry.ts";
import { metricRegistry } from "./registries/metricRegistry.ts";
import { routeRegistry } from "./registries/routeRegistry.ts";
import { tableRegistry } from "./registries/tableRegistry.ts";

function asJsonResource(uri: URL, payload: unknown) {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function registerResources(
  server: Pick<McpServer, "registerResource">
) {
  server.registerResource(
    "datasource-registry",
    "config://mcp/datasources",
    {
      title: "Datasource Registry",
      description: "Datasource to database mapping used by the MCP leave analytics server.",
      mimeType: "application/json",
    },
    async (uri) => asJsonResource(uri, datasourceRegistry)
  );

  server.registerResource(
    "intent-registry",
    "config://mcp/intents",
    {
      title: "Intent Registry",
      description: "Intent metadata and required filters for leave analytics.",
      mimeType: "application/json",
    },
    async (uri) => asJsonResource(uri, intentRegistry)
  );

  server.registerResource(
    "metric-registry",
    "config://mcp/metrics",
    {
      title: "Metric Registry",
      description: "Metric definitions used by the leave analytics flows.",
      mimeType: "application/json",
    },
    async (uri) => asJsonResource(uri, metricRegistry)
  );

  server.registerResource(
    "route-registry",
    "config://mcp/routes",
    {
      title: "Route Registry",
      description: "Logical route and flow mapping for the MCP leave analytics server.",
      mimeType: "application/json",
    },
    async (uri) => asJsonResource(uri, routeRegistry)
  );

  server.registerResource(
    "table-registry",
    "config://mcp/tables",
    {
      title: "Table Registry",
      description: "Database table to datasource mapping used by the leave analytics queries.",
      mimeType: "application/json",
    },
    async (uri) => asJsonResource(uri, tableRegistry)
  );
}
