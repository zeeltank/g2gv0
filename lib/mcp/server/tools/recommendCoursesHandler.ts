import { recommendCourses } from "../../../ai/services/course-recommendation-service.ts";
import type { RecommendCoursesInput } from "./recommendCourses.ts";
import { createStructuredToolResult } from "./toolResult.ts";

export async function handleRecommendCourses(input: RecommendCoursesInput) {
  const result = await recommendCourses(input);
  return createStructuredToolResult(result);
}
