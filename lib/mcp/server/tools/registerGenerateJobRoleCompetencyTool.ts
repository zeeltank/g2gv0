import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { generateJobRoleCompetencySchema } from "./generateJobRoleCompetency.ts";
import { handleGenerateJobRoleCompetency } from "./generateJobRoleCompetencyHandler.ts";

export function registerGenerateJobRoleCompetencyTool(
  server: Pick<McpServer, "registerTool">
) {
  server.registerTool(
    "generateJobRoleCompetency",
    {
      description:
        "Generate a job role competency profile with skills, knowledge, abilities, attitudes, behaviors, and critical work functions.",
      inputSchema: generateJobRoleCompetencySchema.shape,
    },
    async (args) =>
      handleGenerateJobRoleCompetency(
        generateJobRoleCompetencySchema.parse(args)
      )
  );
}
