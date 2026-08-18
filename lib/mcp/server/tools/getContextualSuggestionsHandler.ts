import { getContextualSuggestions } from "../../../ai/services/contextual-suggestions-service.ts";
import type { z } from "zod";
import { contextualSuggestionsSchema } from "./getContextualSuggestions.ts";
import { createStructuredToolResult } from "./toolResult.ts";

type ContextualSuggestionsInput = z.infer<typeof contextualSuggestionsSchema>;

export async function handleGetContextualSuggestions(
  input: ContextualSuggestionsInput
) {
  const result = await getContextualSuggestions(input);
  return createStructuredToolResult(result);
}
