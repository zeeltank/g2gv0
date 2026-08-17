import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { recommendCoursesSchema } from "./recommendCourses.ts";
import { handleRecommendCourses } from "./recommendCoursesHandler.ts";

export function registerRecommendCoursesTool(
  server: Pick<McpServer, "registerTool">
) {
  server.registerTool(
    "recommendCourses",
    {
      description:
        "Recommend LMS courses for a user based on peer enrollments within the same sub institute.",
      inputSchema: recommendCoursesSchema.shape,
    },
    async (args) => handleRecommendCourses(recommendCoursesSchema.parse(args))
  );
}
