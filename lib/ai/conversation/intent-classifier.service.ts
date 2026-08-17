import { generateObject } from "ai";
import { z } from "zod";
import {
  AI_MAX_RETRIES,
  createAiModel,
  isLlmAvailable,
  isQuotaError,
  noteQuotaExhausted,
} from "../config/model";
import { getToolDefinition } from "../mcp/registry/tool-catalog";
import type { ConversationContext } from "./context.service";
import {
  conversationIntentSchema,
  type ConversationIntent,
} from "./schemas";

const classifierOutputSchema = conversationIntentSchema.extend({
  reasoning: z.string().optional(),
});

function fallbackIntent(context: ConversationContext): ConversationIntent {
  const text = context.latestUserMessage.content.toLowerCase();

  if (/leave|absence|monday|friday|burden|balance/.test(text)) {
    return {
      type: /why|risk|pattern|analyse|analyze/.test(text) ? "analyse" : "ask",
      domain: "people_competency",
      capability: "leave_analytics",
      entities: {},
      confidence: 0.72,
      requiresConfirmation: false,
      requiredPermission: "leave:analytics:read",
      suggestedTool: "queryBusinessData",
    };
  }

  if (/skill gap|competency gap|skills|responsibilit|job role/.test(text)) {
    return {
      type: /recommend|improve|coach/.test(text) ? "coach" : "analyse",
      domain: "people_competency",
      capability: "skill_gap",
      entities: {},
      confidence: 0.71,
      requiresConfirmation: false,
      requiredPermission: "competency:skill-gap:read",
      suggestedTool: "skillGapAnalysis",
    };
  }

  if (/course|training|learn|upskill/.test(text)) {
    return {
      type: /recommend|suggest/.test(text) ? "recommend" : "ask",
      domain: "people_competency",
      capability: "course_recommendation",
      entities: {},
      confidence: 0.69,
      requiresConfirmation: false,
      requiredPermission: "learning:recommendation:read",
      suggestedTool: "recommendCourses",
    };
  }

  if (/competency profile|kasba|critical work function|job description|hire/.test(text)) {
    return {
      type: /hire|prepare|workflow/.test(text) ? "automate" : "guide",
      domain: "people_competency",
      capability: "job_role_competency",
      entities: {},
      confidence: 0.66,
      requiresConfirmation: false,
      requiredPermission: "competency:framework:generate",
      suggestedTool: "generateJobRoleCompetency",
    };
  }

  /**
   * Module data fallbacks. These come after the specialised flows above so an
   * existing leave-analytics or skill-gap question keeps routing exactly where
   * it did before, and only the questions those flows never covered land here.
   *
   * Advice-shaped questions are excluded even when they mention a module noun:
   * "how can we improve attendance?" is a reasoning question about attendance,
   * not a request for the attendance table.
   */
  const moduleDataCapability = isAdvisoryQuestion(text)
    ? null
    : detectModuleCapability(text);

  if (moduleDataCapability) {
    return {
      type: /how many|count|total|list|show|who|which|what is|report/.test(text)
        ? "ask"
        : "analyse",
      domain: "shared",
      capability: moduleDataCapability,
      entities: {},
      confidence: 0.68,
      requiresConfirmation: false,
      requiredPermission: "assistant:module-data:read",
      suggestedTool: "getModuleData",
    };
  }

  return {
    type: "guide",
    domain: "shared",
    capability: "contextual_guidance",
    entities: {},
    confidence: 0.55,
    requiresConfirmation: false,
    requiredPermission: "assistant:suggestions:read",
    suggestedTool: "getContextualSuggestions",
  };
}

/**
 * Keyword routing to a module data capability, used only when the LLM
 * classifier is unavailable. Ordered from most specific module vocabulary to
 * least so "employee attendance" lands on attendance, not on employee records.
 */
const MODULE_CAPABILITY_RULES: Array<{ capability: string; pattern: RegExp }> = [
  {
    capability: "attendance_data",
    pattern:
      /attendance|present|absent|punch|late|check.?in|check.?out|working day/,
  },
  {
    capability: "leave_data",
    pattern:
      /leave request|pending leave|leave balance|on leave|holiday|weekly off|leave type|leave report/,
  },
  {
    capability: "task_data",
    pattern: /\btask\b|\btasks\b|to.?do|assigned work|project workstream/,
  },
  {
    capability: "talent_data",
    pattern:
      /candidate|applicant|application|job posting|requisition|interview|offer|recruit|shortlist|onboard|funnel|drop.?off/,
  },
  {
    capability: "learning_data",
    pattern:
      /enrol|enroll|my learning|learning streak|learning goal|achievement|certificat|course progress|learning calendar/,
  },
  {
    capability: "competency_data",
    pattern:
      /skill coverage|skill heatmap|proficien|competenc|job role|jobrole|industr/,
  },
  {
    capability: "reports_data",
    pattern:
      /headcount|attrition|turnover|growth|lifecycle|new hire|kpi|analytics|distribution|department size/,
  },
  {
    capability: "organization_data",
    pattern:
      /organi[sz]ation|department|employee director|employee list|employee record|staff list|team list|compliance|disciplinar/,
  },
];

export function detectModuleCapability(text: string): string | null {
  const lowerText = text.toLowerCase();

  for (const rule of MODULE_CAPABILITY_RULES) {
    if (rule.pattern.test(lowerText)) return rule.capability;
  }

  return null;
}

/**
 * Phrasings that ask for guidance rather than for records. A question that both
 * asks for advice and names a module is still advice - the counts it might need
 * are the model's decision to fetch, not the router's.
 */
const ADVISORY_PATTERNS = [
  /\bhow (can|could|do|would|should) (i|we|you|they|one)\b/,
  /\bways to\b/,
  /\bhow to\b/,
  /\bwhat should\b/,
  /\bbest practice/,
  /\bany (advice|tips|suggestions|ideas|recommendations) (on|for|about)\b/,
  /\b(advice|tips|strategies|ideas|suggestions) (on|for|about|to)\b/,
  /\bimprove\b.*\?/,
  /\breduce\b.*\?/,
  /\bexplain\b/,
  /\bwhat does .* mean\b/,
  /\bwhy (is|are|do|does) .* important\b/,
];

export function isAdvisoryQuestion(text: string) {
  const lowerText = text.toLowerCase();

  // "how many" / "how much" are counting questions, not advice.
  if (/\bhow (many|much)\b/.test(lowerText)) return false;

  return ADVISORY_PATTERNS.some((pattern) => pattern.test(lowerText));
}

export async function classifyConversationIntent(
  context: ConversationContext
): Promise<ConversationIntent> {
  const latestMessage = context.latestUserMessage.content;

  /**
   * Classification is a convenience, never a requirement: the rule based
   * fallback already produces a usable intent. When the LLM is unavailable
   * (no key, or a quota cooldown is open) skip the call entirely rather than
   * spending a request that is certain to fail.
   */
  if (!isLlmAvailable()) {
    console.log("[conversation.fallback] classifier=rules (llm unavailable)");
    return fallbackIntent(context);
  }

  try {
    const { object } = await generateObject({
      model: createAiModel(),
      // A quota error is fatal and anything else falls back to rules, so
      // retrying only burns more of the same quota.
      maxRetries: AI_MAX_RETRIES,
      schema: classifierOutputSchema,
      prompt: `Classify the user's request into a supported conversational intent.

User role: ${context.user.role || "unknown"}
User message: ${latestMessage}

Supported types:
- ask
- learn
- guide
- do
- analyse
- recommend
- automate
- monitor
- coach

Supported domains:
- k12
- people_competency
- enterprise_brain
- shared

If the request appears related to current tools, prefer these mappings:
- leave risk / leave abuse / leave pattern analytics -> queryBusinessData
- skill gap / competency gap / responsibilities -> skillGapAnalysis
- courses / training recommendation -> recommendCourses
- job role competency / KASBA / hiring preparation -> generateJobRoleCompetency
- LMS help / contextual guidance -> getContextualSuggestions

Any other question about this organisation's stored records - employees,
departments, the organization profile, attendance, leave requests or balances,
holidays, course enrollments and learning progress, competency and skill
coverage, job postings, candidates, interviews, offers, tasks, headcount,
attrition or any count, list or report drawn from them -> getModuleData, with
capability set to one of: organization_data, attendance_data, leave_data,
learning_data, competency_data, talent_data, task_data, reports_data.

General advice, explanation or reasoning that is not stored in the system (for
example "how can we improve attendance?") -> no data tool; use
getContextualSuggestions and capability contextual_guidance.

Extract any department, employee, leave type, job role or date range the user
mentioned into the entities object, using the keys departmentName, employeeName,
leaveTypeName, jobRole, fromDate, toDate. Use the names exactly as the user said
them - do not invent ids.

Return only structured output.`,
    });

    const intent = conversationIntentSchema.parse(object);
    const definition = intent.suggestedTool
      ? getToolDefinition(intent.suggestedTool)
      : undefined;

    if (intent.suggestedTool && !definition) {
      return fallbackIntent(context);
    }

    /**
     * The classifier is free to invent a permission string, and an unrecognised
     * one would be refused by validateConversationPermission even for an admin.
     * The registered tool is the authority on what it requires, so trust that
     * instead of the model's guess.
     */
    return definition
      ? { ...intent, requiredPermission: definition.requiredPermissions[0] }
      : intent;
  } catch (error) {
    if (isQuotaError(error)) {
      // Open the cooldown so the rest of this request, and the next few,
      // skip the LLM instead of repeating a call that cannot succeed.
      noteQuotaExhausted(error);
      console.log("[conversation.fallback] classifier=rules (quota)");
    } else {
      console.warn("[conversation.intent] falling back to rules", error);
    }

    return fallbackIntent(context);
  }
}
