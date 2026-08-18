import { tool, type ToolSet } from "ai";
import type { ProjectContext, ProjectToolDefinition } from "./types";

function summarizeToolResult(result: unknown) {
  if (typeof result === "string") {
    return result;
  }

  return JSON.stringify(result);
}

export function createProjectTools(
  definitions: ProjectToolDefinition[],
  context: ProjectContext
): ToolSet {
  const toolEntries = definitions.map((definition) => [
    definition.name,
    tool({
      description: definition.description,
      inputSchema: definition.inputSchema,
      execute: async (input: any) => {
        const result = await definition.execute(input, context);
        return typeof result === "string"
          ? result
          : {
              summary: summarizeToolResult(result),
              data: result,
            };
      },
    }),
  ]);

  return Object.fromEntries(toolEntries);
}
