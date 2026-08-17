import { google } from "@ai-sdk/google";

export function createAiModel() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error(
      "GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY is required for AI SDK usage."
    );
  }

  return google(process.env.GEMINI_MODEL || "gemini-2.5-flash");
}
