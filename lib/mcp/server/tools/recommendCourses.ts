import { z } from "zod";

export const recommendCoursesSchema = z.object({
  userId: z.union([z.string(), z.number()]),
  subInstituteId: z.union([z.string(), z.number()]),
});

export type RecommendCoursesInput = z.infer<typeof recommendCoursesSchema>;
