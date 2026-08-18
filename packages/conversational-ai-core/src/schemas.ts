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

export const trustedSessionContextSchema = z.object({
  userId: z.string().optional(),
  subInstituteId: z.string().optional(),
  role: z.string().optional(),
  profileName: z.string().optional(),
  profileId: z.string().optional(),
  employeeNo: z.string().optional(),
  orgId: z.string().optional(),
  token: z.string().optional(),
  baseUrl: z.string().optional(),
  syear: z.string().optional(),
  termId: z.string().optional(),
  route: z.string().optional(),
  /** Department the caller is scoped to, when the UI knows it. */
  departmentId: z.string().optional(),
  /**
   * Groups the turns of one chat session so follow-up questions ("show me their
   * names") can reuse the filters of the previous data query.
   */
  sessionId: z.string().optional(),
});

export const conversationRequestSchema = z.object({
  messages: z.array(conversationMessageSchema).min(1),
  responseMode: z.enum(["stream", "json"]).optional(),
  context: trustedSessionContextSchema.optional(),
});

export type ConversationType = z.infer<typeof conversationTypeSchema>;
export type ConversationDomain = z.infer<typeof conversationDomainSchema>;
export type ConversationIntent = z.infer<typeof conversationIntentSchema>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type TrustedSessionContext = z.infer<typeof trustedSessionContextSchema>;
export type ConversationRequest = z.infer<typeof conversationRequestSchema>;
