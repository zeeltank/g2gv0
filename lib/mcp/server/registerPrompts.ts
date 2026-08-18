import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { leaveAnalysisTypeSchema } from "./tools/queryBusinessData.ts";

const leaveAnalysisPromptSchema = z.object({
  analysisType: leaveAnalysisTypeSchema.describe("The leave BI analysis to run."),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Start date in YYYY-MM-DD format."),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("End date in YYYY-MM-DD format."),
});

const skillGapPromptSchema = z.object({
  operation: z
    .enum(["industries", "departments", "jobRoles", "skills", "tasks", "report"])
    .describe("Skill gap workflow operation to execute."),
  industry: z.string().optional(),
  department: z.string().optional(),
  jobRole: z.string().optional(),
  subInstituteId: z.string().optional(),
});

const recommendCoursesPromptSchema = z.object({
  userId: z.string().describe("The learner or employee identifier."),
  subInstituteId: z.string().describe("The sub institute identifier."),
});

const competencyPromptSchema = z.object({
  industry: z.string().optional(),
  department: z.string().optional(),
  jobRole: z.string().optional(),
  description: z.string().optional(),
});

const suggestionsPromptSchema = z.object({
  module: z.string().describe("The LMS module name such as course, assessment, learning, or question-bank."),
  context: z.string().optional().describe("Optional page or workflow context."),
});

export function registerPrompts(server: Pick<McpServer, "registerPrompt">) {
  server.registerPrompt(
    "leave-bi-analysis",
    {
      title: "Leave BI Analysis",
      description: "Template prompt for running the queryBusinessData tool and summarizing the result.",
      argsSchema: leaveAnalysisPromptSchema.shape,
    },
    ({ analysisType, fromDate, toDate }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `Use the queryBusinessData tool with analysisType="${analysisType}", ` +
              `fromDate="${fromDate}", and toDate="${toDate}". ` +
              `Summarize the output for an HR operator and keep the response grounded in the tool result.`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    "skill-gap-analysis",
    {
      title: "Skill Gap Analysis",
      description: "Template prompt for running the skillGapAnalysis tool for discovery steps.",
      argsSchema: skillGapPromptSchema.shape,
    },
    ({ operation, industry, department, jobRole, subInstituteId }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `Use the skillGapAnalysis tool with operation="${operation}"` +
              `${industry ? `, industry="${industry}"` : ""}` +
              `${department ? `, department="${department}"` : ""}` +
              `${jobRole ? `, jobRole="${jobRole}"` : ""}` +
              `${subInstituteId ? `, subInstituteId="${subInstituteId}"` : ""}` +
              ". Explain the result briefly and keep the answer grounded in the tool output.",
          },
        },
      ],
    })
  );

  server.registerPrompt(
    "recommend-courses",
    {
      title: "Recommend Courses",
      description: "Template prompt for running the recommendCourses tool and summarizing the strongest recommendations.",
      argsSchema: recommendCoursesPromptSchema.shape,
    },
    ({ userId, subInstituteId }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `Use the recommendCourses tool with userId="${userId}" and subInstituteId="${subInstituteId}". ` +
              "Summarize the best course recommendations and explain why they were suggested using only the tool result.",
          },
        },
      ],
    })
  );

  server.registerPrompt(
    "job-role-competency",
    {
      title: "Job Role Competency",
      description: "Template prompt for running the generateJobRoleCompetency tool.",
      argsSchema: competencyPromptSchema.shape,
    },
    ({ industry, department, jobRole, description }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              "Use the generateJobRoleCompetency tool" +
              `${industry ? ` with industry="${industry}"` : ""}` +
              `${department ? `, department="${department}"` : ""}` +
              `${jobRole ? `, jobRole="${jobRole}"` : ""}` +
              `${description ? `, description="${description}"` : ""}` +
              ". Return the competency profile in a structured and concise format based entirely on the tool output.",
          },
        },
      ],
    })
  );

  server.registerPrompt(
    "contextual-suggestions",
    {
      title: "Contextual Suggestions",
      description: "Template prompt for running the getContextualSuggestions tool.",
      argsSchema: suggestionsPromptSchema.shape,
    },
    ({ module, context }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `Use the getContextualSuggestions tool with module="${module}"` +
              `${context ? ` and context="${context}"` : ""}` +
              ". Return the suggested follow-up questions exactly as supported by the tool output.",
          },
        },
      ],
    })
  );
}
