import { z } from "zod";

export const conversationTypeSchema = z.enum([
  "ask",
  "learn",
  "guide",
  "do",
  "analyse",
  "recommend",
  "automate",
  "monitor",
  "coach",
]);

export const conversationDomainSchema = z.enum([
  "k12",
  "people_competency",
  "enterprise_brain",
  "shared",
]);

export const conversationIntentSchema = z.object({
  type: conversationTypeSchema,
  domain: conversationDomainSchema,
  capability: z.string().min(1),
  entities: z.record(z.string(), z.unknown()).default({}),
  confidence: z.number().min(0).max(1),
  requiresConfirmation: z.boolean(),
  requiredPermission: z.string().optional(),
  suggestedTool: z.string().optional(),
});

export const conversationMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

export const conversationUserContextSchema = z.object({
  userId: z.string().optional(),
  subInstituteId: z.string().optional(),
  role: z.string().optional(),
  profileName: z.string().optional(),
  employeeNo: z.string().optional(),
  orgId: z.string().optional(),
  /**
   * Laravel session coordinates, forwarded from the browser so the server side
   * conversation can read live module data through the same token authenticated
   * endpoints the screens use. Optional: without them the assistant still
   * answers, but reports that system data is unavailable instead of guessing.
   */
  token: z.string().optional(),
  syear: z.string().optional(),
  departmentId: z.string().optional(),
  /** Groups turns of one chat session for follow-up context. */
  sessionId: z.string().optional(),
});

export const conversationRequestSchema = z.object({
  messages: z.array(conversationMessageSchema).min(1),
  systemPrompt: z.string().optional(),
  responseMode: z.enum(["stream", "json"]).optional(),
  context: conversationUserContextSchema.optional(),
});

export type ConversationType = z.infer<typeof conversationTypeSchema>;
export type ConversationDomain = z.infer<typeof conversationDomainSchema>;
export type ConversationIntent = z.infer<typeof conversationIntentSchema>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type ConversationUserContext = z.infer<
  typeof conversationUserContextSchema
>;
export type ConversationRequest = z.infer<typeof conversationRequestSchema>;
