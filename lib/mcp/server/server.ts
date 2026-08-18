import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPrompts } from "./registerPrompts.ts";
import { registerResources } from "./registerResources.ts";
import { registerGenerateJobRoleCompetencyTool } from "./tools/registerGenerateJobRoleCompetencyTool.ts";
import { registerGetContextualSuggestionsTool } from "./tools/registerGetContextualSuggestionsTool.ts";
import { registerQueryBusinessDataTool } from "./tools/registerQueryBusinessDataTool.ts";
import { registerRecommendCoursesTool } from "./tools/registerRecommendCoursesTool.ts";
import { registerSkillGapAnalysisTool } from "./tools/registerSkillGapAnalysisTool.ts";

export function createBiMcpServer() {
  const server = new McpServer({
    name: "bi-mcp-server",
    version: "1.0.0"
  });

  registerQueryBusinessDataTool(server);
  registerSkillGapAnalysisTool(server);
  registerRecommendCoursesTool(server);
  registerGenerateJobRoleCompetencyTool(server);
  registerGetContextualSuggestionsTool(server);
  registerResources(server);
  registerPrompts(server);

  return server;
}

export const server = createBiMcpServer();
