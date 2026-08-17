import { generateObject } from "ai";
import { z } from "zod";
import { createAiModel } from "../config/model.ts";
import { buildSeniorExpertPrompt } from "../prompts/job-role-competency.ts";

const skillItemSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  sub_category: z.string().optional(),
  level: z.number().int().min(1).max(6),
});

const genericCompetencyItemSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  sub_category: z.string().optional(),
  level: z.number().int().min(1).max(5),
});

const cwfItemSchema = z.object({
  critical_work_function: z.string(),
  key_tasks: z.array(z.string()).max(3),
});

export const jobRoleCompetencyInputSchema = z.object({
  industry: z.string().optional(),
  department: z.string().optional(),
  jobRole: z.string().optional(),
  description: z.string().optional(),
  chatHistory: z.array(z.string()).optional(),
});

export const jobRoleCompetencyOutputSchema = z.object({
  department: z.string(),
  description: z.string(),
  skills: z.array(skillItemSchema).max(10),
  knowledge: z.array(genericCompetencyItemSchema).max(5),
  ability: z.array(genericCompetencyItemSchema).max(5),
  attitude: z.array(genericCompetencyItemSchema).max(5),
  behavior: z.array(genericCompetencyItemSchema).max(5),
  cwf_items: z.array(cwfItemSchema).max(5),
});

export type JobRoleCompetencyInput = z.infer<typeof jobRoleCompetencyInputSchema>;

export async function generateJobRoleCompetency(
  input: JobRoleCompetencyInput
) {
  const prompt = buildSeniorExpertPrompt(input, null);
  const model = createAiModel();

  const { object } = await generateObject({
    model,
    schema: jobRoleCompetencyOutputSchema,
    prompt,
  });

  return object;
}
