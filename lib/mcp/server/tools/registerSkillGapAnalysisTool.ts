import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { skillGapAnalysisSchema } from "./skillGapAnalysis.ts";
import { handleSkillGapAnalysis } from "./skillGapAnalysisHandler.ts";

export function registerSkillGapAnalysisTool(
  server: Pick<McpServer, "registerTool">
) {
  server.registerTool(
    "skillGapAnalysis",
    {
      description:
        "Navigate skill gap analysis steps, fetch departments/job roles/skills/tasks, and generate a skill gap report.",
      inputSchema: skillGapAnalysisSchema.shape,
    },
    async (args) => handleSkillGapAnalysis(skillGapAnalysisSchema.parse(args))
  );
}
