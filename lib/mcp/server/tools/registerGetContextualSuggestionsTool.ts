import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { contextualSuggestionsSchema } from "./getContextualSuggestions.ts";
import { handleGetContextualSuggestions } from "./getContextualSuggestionsHandler.ts";

export function registerGetContextualSuggestionsTool(
  server: Pick<McpServer, "registerTool">
) {
  server.registerTool(
    "getContextualSuggestions",
    {
      description:
        "Generate contextual LMS chatbot suggestions for modules such as course, assessment, learning, and question-bank.",
      inputSchema: contextualSuggestionsSchema.shape,
    },
    async (args) =>
      handleGetContextualSuggestions(contextualSuggestionsSchema.parse(args))
  );
}
