import type { ConversationContext } from "./context.service";
import type { ConversationIntent } from "./schemas";
import { describeDatasetsForPrompt } from "../backend/module-catalog";
import { describeFollowUpState, getFollowUpState } from "./followup.service";

export interface SystemPromptOptions {
  /** Dataset ids the caller's role may read, from getAllowedDatasetIds. */
  allowedDatasets?: string[];
  /** True when the request carried a Laravel token, so live data is reachable. */
  hasBackendSession?: boolean;
  sessionId?: string;
}

/**
 * The routing contract. Two answer modes, and an explicit rule about which one
 * applies - this is what keeps the model from answering a database question out
 * of its own head.
 */
const ROUTING_RULES = [
  "ROUTING - decide this first, for every message:",
  "A) SYSTEM DATA question (anything about this organisation's actual records: employees, departments, attendance, leave, balances, holidays, courses and enrollments, competencies and skills, job postings, candidates, interviews, offers, tasks, headcount, attrition, or any count/list/total/report drawn from them). Answer ONLY from tool output. Call getModuleData. If you are unsure which dataset fits, call listModules first.",
  "B) GENERAL question (advice, explanation, reasoning, how-to, best practice, opinion, or anything not stored in this system, such as 'how can we improve attendance?'). Answer conversationally from your own knowledge. Do not call data tools for these.",
  "A mixed question is both: fetch the data for the factual half, then reason on top of it, and keep the two clearly distinguishable.",
].join(" ");

const GROUNDING_RULES = [
  "GROUNDING - non negotiable:",
  "Never state a number, name, date, status or total about this organisation unless it came from a tool result in this conversation.",
  "Never estimate, extrapolate, average, or carry over a figure from an example, from your training data, or from an earlier unrelated answer.",
  "If getModuleData returns status 'empty', say plainly that no matching records were found, and mention the filters that were applied.",
  "If it returns status 'unavailable', say the information could not be retrieved right now and give the reason in plain language. Do not substitute an estimate.",
  "If it returns status 'needs_clarification', ask the user the clarifying question it describes - list the candidate records and let them pick. Never choose one yourself.",
  "If it returns status 'missing_parameter', ask the user for exactly what is missing.",
  "If it returns status 'forbidden', tell the user their role does not have access to that information.",
  "If the result is marked truncated, say that you are showing the first rows and offer to narrow the filters.",
].join(" ");

const ID_RULES = [
  "IDS VS NAMES:",
  "The backend filters on ids, not display names. Pass what the user actually said in the *Name filters (departmentName, employeeName, leaveTypeName) and let the tool resolve them - do not invent an id, and do not pass a name into an *Id filter.",
  "Use resolveEntity when you need to check a name exists, list the options, or disambiguate before querying.",
].join(" ");

const FILTER_RULES = [
  "FILTERS:",
  "Every filter is optional. Call getModuleData with only the filters the user actually implied and let the backend apply its defaults - leave data defaults to the current April-March leave year and the whole institute, attendance to its own default window.",
  "Do not ask the user for a date range, a department or an employee that they did not ask to be narrowed by. Fetch the default scope first, answer, then offer to narrow.",
  "Only ask for a parameter when the tool itself reports it as missing.",
].join(" ");

const FOLLOW_UP_RULES = [
  "FOLLOW-UPS:",
  "Treat every message as part of one continuous conversation. Resolve pronouns and elisions ('their names', 'that department', 'what about last month', 'and for Division C') against the previous turns and the conversation state below.",
  "When a follow-up only changes one filter, reuse every other filter from the previous query rather than asking the user to repeat it.",
  "When a follow-up asks for detail behind a count you already gave, query the dataset that carries the rows with the same filters.",
].join(" ");

const STYLE_RULES = [
  "STYLE:",
  "Lead with the answer. Keep it short and operational.",
  "Present multiple records as a compact list or table, not as prose.",
  "Do not expose dataset ids, endpoint paths, tool names, ids or internal statuses to the user - speak in business terms.",
  "Do not claim to have performed a write, an approval or a change: this conversation has read access only.",
].join(" ");

export function buildConversationSystemPrompt(
  context: ConversationContext,
  intent: ConversationIntent,
  options: SystemPromptOptions = {}
) {
  const languageInstruction = {
    english:
      "Reply in English because the user's latest message is in English.",
    hindi:
      "Reply fully in Hindi because the user's latest message is in Hindi.",
    gujarati:
      "Reply fully in Gujarati because the user's latest message is in Gujarati.",
  }[context.detectedLanguage];

  const sessionId =
    options.sessionId || context.user.sessionId || context.user.userId || "default";

  const followUp = describeFollowUpState(
    getFollowUpState(context.user.userId || "anonymous", sessionId)
  );

  const datasetIndex = describeDatasetsForPrompt(options.allowedDatasets);

  // Names and dates the classifier already pulled out of the question, so the
  // model does not have to re-extract them (or drop one) when calling a tool.
  const entityEntries = Object.entries(intent.entities ?? {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );

  const sections = [
    "You are the CAP-020 Conversational Intelligence Platform: one conversational layer over the whole G2G system.",
    "Act as a shared enterprise conversation layer, not as a generic chatbot.",
    `Conversation type: ${intent.type}. Domain: ${intent.domain}. Capability: ${intent.capability}.`,
    `User role: ${context.user.role || "unknown"}.`,
    context.user.profileName ? `User profile: ${context.user.profileName}.` : "",
    `Today's date: ${new Date().toISOString().slice(0, 10)}.`,
    ROUTING_RULES,
    GROUNDING_RULES,
    ID_RULES,
    FILTER_RULES,
    FOLLOW_UP_RULES,
    "The specialised MCP tools remain available and are preferred for what they cover: queryBusinessData for leave risk and leave pattern analytics, skillGapAnalysis for the skill gap workflow, recommendCourses for peer-driven course recommendations, generateJobRoleCompetency for competency frameworks, getContextualSuggestions for on-page LMS guidance.",
    options.hasBackendSession === false
      ? "IMPORTANT: this conversation has no active backend session, so no live system data can be read. For any system data question, say the session is unavailable and ask the user to sign in again. Still answer general questions normally."
      : "",
    entityEntries.length
      ? `DETECTED IN THE QUESTION (pass these through as *Name filters, verbatim): ${entityEntries
          .map(([key, value]) => `${key}=${String(value)}`)
          .join(", ")}`
      : "",
    datasetIndex
      ? `DATASETS available through getModuleData, grouped by module:\n${datasetIndex}`
      : "",
    followUp
      ? `CONVERSATION STATE - the data queries already run in this session:\n${followUp}`
      : "",
    STYLE_RULES,
    languageInstruction,
    "Keep the response in the same language as the user's latest message unless the user explicitly asks to switch languages.",
  ];

  return sections.filter(Boolean).join("\n\n");
}
