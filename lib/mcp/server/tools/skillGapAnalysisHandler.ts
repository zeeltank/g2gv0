import { runSkillGapAnalysis } from "../../../ai/services/skill-gap-service.ts";
import type { SkillGapAnalysisInput } from "./skillGapAnalysis.ts";
import { createStructuredToolResult } from "./toolResult.ts";

export async function handleSkillGapAnalysis(input: SkillGapAnalysisInput) {
  const result = await runSkillGapAnalysis(input);
  return createStructuredToolResult(result as Record<string, unknown>);
}
