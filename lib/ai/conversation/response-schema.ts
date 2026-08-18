import { z } from "zod";
import {
  conversationIntentSchema,
  conversationTypeSchema,
} from "./schemas";

export const conversationalStatusSchema = z.enum([
  "completed",
  "in_progress",
  "requires_input",
  "requires_confirmation",
  "failed",
]);

export const toolExecutionSummarySchema = z.object({
  tool: z.string(),
  status: z.enum(["planned", "completed", "failed", "skipped"]),
  summary: z.string(),
});

export const confirmationPayloadSchema = z.object({
  action: z.string(),
  riskLevel: z.enum(["low", "medium", "high"]),
  message: z.string(),
  parameters: z.record(z.string(), z.unknown()).default({}),
});

export const conversationalResponseSchema = z.object({
  message: z.string(),
  conversationType: conversationTypeSchema,
  status: conversationalStatusSchema,
  data: z.unknown().optional(),
  cards: z.array(z.unknown()).optional(),
  citations: z.array(z.unknown()).optional(),
  toolExecutions: z.array(toolExecutionSummarySchema).optional(),
  workflow: z.unknown().optional(),
  confirmation: confirmationPayloadSchema.optional(),
  recommendations: z.array(z.unknown()).optional(),
  followUpSuggestions: z.array(z.string()).optional(),
  voice: z
    .object({
      transcript: z.string().optional(),
      audioUrl: z.string().optional(),
      language: z.string().optional(),
    })
    .optional(),
  intent: conversationIntentSchema.optional(),
  activeTools: z.array(z.string()).optional(),
});

export type ConversationalResponse = z.infer<
  typeof conversationalResponseSchema
>;
