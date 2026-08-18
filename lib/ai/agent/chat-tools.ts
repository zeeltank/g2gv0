import { tool } from "ai";
import { z } from "zod";
import { callMcpTool } from "@/lib/mcp/client";
import { queryBusinessDataSchema } from "@/lib/mcp/server/tools/queryBusinessData.ts";
import {
  skillGapAnalysisSchema,
  type SkillGapAnalysisInput,
} from "@/lib/mcp/server/tools/skillGapAnalysis.ts";
import {
  recommendCoursesSchema,
  type RecommendCoursesInput,
} from "@/lib/mcp/server/tools/recommendCourses.ts";
import {
  contextualSuggestionsSchema,
} from "@/lib/mcp/server/tools/getContextualSuggestions.ts";
import {
  generateJobRoleCompetencySchema,
} from "@/lib/mcp/server/tools/generateJobRoleCompetency.ts";
import { createModuleDataTools } from "./module-data-tools";

export interface AgentRuntimeContext {
  userId?: string;
  subInstituteId?: string;
  /**
   * Laravel session coordinates. Present when the chat request carried them,
   * which is what lets the module data tools read live backend data. The five
   * MCP tools below do not use them and behave exactly as before when absent.
   */
  token?: string;
  syear?: string;
  orgId?: string;
  role?: string;
  sessionId?: string;
  /** Dataset ids the caller's role may read. Undefined means "no restriction". */
  allowedDatasets?: string[];
}

export function createAgentTools(context: AgentRuntimeContext) {
  return {
    ...createModuleDataTools({
      userId: context.userId,
      subInstituteId: context.subInstituteId,
      token: context.token,
      syear: context.syear,
      orgId: context.orgId,
      role: context.role,
      sessionId: context.sessionId || context.userId || "default",
      allowedDatasets: context.allowedDatasets,
    }),
    queryBusinessData: tool({
      description:
        "Run leave analytics such as leave risk, Monday/Friday patterns, unplanned leave, leave burden, balance risk, and department leave risk.",
      inputSchema: queryBusinessDataSchema,
      execute: async (input: z.infer<typeof queryBusinessDataSchema>) =>
        callMcpTool("queryBusinessData", input),
    }),
    skillGapAnalysis: tool({
      description:
        "Drive the skill gap workflow. Use operations industries, departments, jobRoles, skills, tasks, or report.",
      inputSchema: skillGapAnalysisSchema,
      execute: async (input: SkillGapAnalysisInput) =>
        callMcpTool("skillGapAnalysis", {
          ...input,
          subInstituteId: input.subInstituteId ?? context.subInstituteId,
        }),
    }),
    recommendCourses: tool({
      description:
        "Recommend courses based on peer enrollments for the current user and sub institute.",
      inputSchema: recommendCoursesSchema.partial().extend({
        userId: z.union([z.string(), z.number()]).optional(),
        subInstituteId: z.union([z.string(), z.number()]).optional(),
      }),
      execute: async (
        input: Partial<RecommendCoursesInput> & {
          userId?: string | number;
          subInstituteId?: string | number;
        }
      ) =>
        callMcpTool("recommendCourses", {
          userId: input.userId ?? context.userId,
          subInstituteId: input.subInstituteId ?? context.subInstituteId,
        }),
    }),
    generateJobRoleCompetency: tool({
      description:
        "Generate a competency profile and critical work functions for a job role.",
      inputSchema: generateJobRoleCompetencySchema,
      execute: async (input: z.infer<typeof generateJobRoleCompetencySchema>) =>
        callMcpTool("generateJobRoleCompetency", input),
    }),
    getContextualSuggestions: tool({
      description:
        "Generate contextual LMS suggestions for a module such as course, assessment, learning, or question-bank.",
      inputSchema: contextualSuggestionsSchema,
      execute: async (input: z.infer<typeof contextualSuggestionsSchema>) =>
        callMcpTool("getContextualSuggestions", input),
    }),
  };
}
