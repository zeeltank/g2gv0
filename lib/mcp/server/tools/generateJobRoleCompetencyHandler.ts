import {
  generateJobRoleCompetency,
  type JobRoleCompetencyInput,
} from "../../../ai/services/job-role-competency-service.ts";
import { createStructuredToolResult } from "./toolResult.ts";

export async function handleGenerateJobRoleCompetency(
  input: JobRoleCompetencyInput
) {
  const result = await generateJobRoleCompetency(input);
  return createStructuredToolResult(result);
}
