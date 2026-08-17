import { generateObject } from "ai";
import { z } from "zod";
import { createAiModel } from "../config/model.ts";

export const contextualSuggestionsInputSchema = z.object({
  module: z.string(),
  context: z.string().optional(),
});

const contextualSuggestionsOutputSchema = z.object({
  suggestions: z.array(z.string()).min(3).max(4),
});

const fallbackSuggestions: Record<string, string[]> = {
  course: [
    "How do I create a new course?",
    "What are the best practices for course design?",
    "How can I track employee progress?",
    "How do I add assessments to a course?",
  ],
  assessment: [
    "How do I create an assessment?",
    "What question types are available?",
    "How do I set assessment deadlines?",
    "How can I view assessment results?",
  ],
  learning: [
    "How do I enroll in a course?",
    "What courses are available for me?",
    "How do I track my learning progress?",
    "How do I complete a course?",
  ],
  "question-bank": [
    "How do I add questions to the bank?",
    "How do I organize questions by category?",
    "Can I import questions from other sources?",
    "How do I edit existing questions?",
  ],
};

export async function getContextualSuggestions(input: {
  module: string;
  context?: string;
}) {
  const moduleDescriptions: Record<string, string> = {
    course:
      "Course Management for administrators and instructors to create and manage courses",
    assessment: "Assessment for creating and managing quizzes and exams",
    learning:
      "My Learning for employees to view and complete assigned courses",
    "question-bank": "Question Bank for managing question repositories",
  };

  const moduleName = moduleDescriptions[input.module] || "LMS";
  const prompt = `You are an AI assistant for a Learning Management System.
The user is currently on the ${moduleName} page.

Generate 3-4 highly relevant, practical questions that users typically ask on this page.

Requirements:
- Questions should be practical and action-oriented.
- Keep each question concise.
- Questions should be specific to this LMS module.
- Return JSON only with { "suggestions": ["...", "..."] }.

Additional context:
${input.context || "No extra context provided."}`;

  try {
    const { object } = await generateObject({
      model: createAiModel(),
      schema: contextualSuggestionsOutputSchema,
      prompt,
    });

    return {
      suggestions: object.suggestions.slice(0, 4),
      module: input.module,
    };
  } catch (error) {
    console.error("[contextual-suggestions] fallback triggered", error);
    return {
      suggestions: fallbackSuggestions[input.module] || [],
      module: input.module,
    };
  }
}
