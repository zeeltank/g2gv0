import { z } from "zod";

const skillRatingSchema = z.object({
  id: z.union([z.string(), z.number()]).optional().nullable(),
  name: z.string(),
  expectedProficiency: z.number().min(0).max(6).optional(),
  userRating: z.number().min(0).max(6).optional(),
});

export const skillGapAnalysisSchema = z.object({
  operation: z.enum([
    "industries",
    "departments",
    "jobRoles",
    "skills",
    "tasks",
    "report",
  ]),
  industry: z.string().optional(),
  department: z.string().optional(),
  jobRole: z.string().optional(),
  jobRoleId: z.union([z.string(), z.number()]).optional(),
  subInstituteId: z.union([z.string(), z.number()]).optional(),
  skills: z.array(skillRatingSchema).optional(),
});

export type SkillGapAnalysisInput = z.infer<typeof skillGapAnalysisSchema>;
