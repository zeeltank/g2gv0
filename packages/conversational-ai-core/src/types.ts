import type { ToolSet } from "ai";
import type { z } from "zod";
import type {
  ConversationIntent,
  ConversationMessage,
  ConversationRequest,
  TrustedSessionContext,
} from "./schemas";

export interface ProjectContext {
  projectId: string;
  projectName: string;
  userId?: string;
  subInstituteId?: string;
  role?: string;
  profileName?: string;
  profileId?: string;
  employeeNo?: string;
  orgId?: string;
  token?: string;
  baseUrl?: string;
  syear?: string;
  termId?: string;
  route?: string;
  request: ConversationRequest;
  latestUserMessage: ConversationMessage;
  messageHistory: ConversationMessage[];
  detectedLanguage: "english" | "hindi" | "gujarati";
}

export interface ProjectToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  requiredPermissions: string[];
  riskLevel: "low" | "medium" | "high";
  requiresConfirmation: boolean;
  capabilities: string[];
  execute: (input: unknown, context: ProjectContext) => Promise<unknown>;
}

export interface ProjectAIAdapter {
  projectId: string;
  projectName: string;
  resolveContext(input: {
    request: ConversationRequest;
    trustedContext: TrustedSessionContext;
  }): Promise<ProjectContext>;
  classifyIntent(context: ProjectContext): Promise<ConversationIntent>;
  buildSystemPrompt(
    context: ProjectContext,
    intent: ConversationIntent
  ): Promise<string>;
  getToolDefinitions(context: ProjectContext): Promise<ProjectToolDefinition[]>;
  getAllowedToolNames(context: ProjectContext): Promise<string[]>;
  validatePermission(
    intent: ConversationIntent,
    context: ProjectContext
  ): Promise<void>;
}

export interface PreparedConversation {
  adapter: ProjectAIAdapter;
  context: ProjectContext;
  intent: ConversationIntent;
  systemPrompt: string;
  activeTools: string[];
  tools: ToolSet;
  toolDefinitions: ProjectToolDefinition[];
}
