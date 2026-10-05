import type { AiFieldContext, AiFieldType } from "./types";

/**
 * Turning a field, its context and an instruction into a prompt.
 *
 * Two things are load-bearing here.
 *
 * First, the model is told to return *only the replacement text*. This output is
 * dropped straight into a form field a teacher then saves, so a preamble like "Sure!
 * Here's a shorter version:" would be saved into a student's lesson plan. Stripping it
 * afterwards is guesswork; not producing it is reliable.
 *
 * Second, it is told not to invent facts. The single most damaging failure for school
 * content is a plausible fabrication — an exam date, a syllabus reference, a marks
 * total — because it looks exactly like the rest of the text and nobody re-checks a
 * field they only asked to be shortened.
 */

/** Per-content-type instructions, added to the shared rules. */
const FIELD_TYPE_GUIDANCE: Record<AiFieldType, string> = {
  question:
    "This is an assessment question. Keep exactly one thing being asked, keep the concept and the "
    + "expected answer unchanged unless told otherwise, and never include the answer in the question.",
  answer_option:
    "This is one answer option in a multiple-choice question. Keep it short, parallel in form with "
    + "the other options, and do not signal whether it is correct.",
  explanation:
    "This explains an answer or a concept to a learner. Be correct before being brief, and build from "
    + "what the learner already knows.",
  learning_objective:
    "This is a learning objective. Start with an observable verb, describe what the learner will be "
    + "able to do, and keep it measurable.",
  lesson_content:
    "This is learning content. Keep it accurate, sequenced, and pitched at the stated proficiency level.",
  instructions:
    "These are instructions employees must follow. Be unambiguous and ordered. Never drop a "
    + "constraint such as a time limit, a material, or a step.",
  description: "This is a description shown in the HR and talent platform. Be clear and factual.",
  summary: "This is a summary. Cover the main points and nothing else.",
  announcement:
    "This is an announcement to employees or candidates. Plain language, no jargon, no abbreviation a "
    + "reader outside HR would not know. Never alter a date, time, venue or amount.",
  policy:
    "This is institutional policy or rules text. Formal register, precise wording, no softening of a "
    + "rule and no new obligations.",
  feedback:
    "This is feedback about an employee. Be specific, constructive and blame-free. Describe work and "
    + "behaviour, never the person's character or ability.",
  title: "This is a short title or name. Keep it under about ten words. No trailing punctuation.",
  notes: "These are working notes. Keep them terse and practical.",
  generic: "Keep the text fit for its purpose in an HR, talent and learning platform.",
};

export const FIELD_EDIT_SYSTEM_PROMPT = [
  "You edit text inside an HR, talent and learning management platform. An administrator has asked you to",
  "change one field on a form.",
  "",
  "Rules, in order of importance:",
  "",
  "1. Return ONLY the replacement text for the field. No preamble, no sign-off, no explanation, no",
  "   quotation marks around the whole answer, and no markdown code fences.",
  "2. Never invent facts. Do not add or change a date, time, venue, name, amount, mark, percentage,",
  "   policy reference or citation that is not already in the text or the context you were given.",
  "   If the instruction cannot be followed without inventing something, do the part you can and",
  "   leave the rest as it was.",
  "3. Follow the user's instruction exactly. If they asked only to fix grammar, do not also reword,",
  "   reorder or shorten.",
  "4. Keep the original language unless you were explicitly asked to translate.",
  "5. Keep the formatting shape you were given — if the input was HTML, return HTML; if it was plain",
  "   text, return plain text; if it was a list, return a list.",
  "6. Content is read by employees and candidates. No profanity, no stereotyping, no emoji, and",
  "   nothing that singles out or demeans a person.",
  "7. If the text is already correct for the instruction, return it unchanged rather than inventing a",
  "   difference.",
].join("\n");

/** Trimmed so a pasted essay cannot blow the context or the bill. */
const MAX_VALUE_CHARS = 8000;

export function buildFieldEditPrompt(input: {
  value: string;
  instruction: string;
  context: AiFieldContext;
}): string {
  const { value, instruction, context } = input;
  const lines: string[] = [];

  lines.push(FIELD_TYPE_GUIDANCE[context.fieldType] ?? FIELD_TYPE_GUIDANCE.generic);
  lines.push("");
  lines.push("Where this field lives:");

  const facts: Array<[string, unknown]> = [
    ["Field", context.fieldLabel],
    ["Form / page", context.page],
    ["Module", context.module],
    ["Record type", context.entityType],
    ["Grade / class", context.grade],
    ["Subject", context.subject],
    ["Language", context.language],
  ];

  for (const [label, raw] of facts) {
    const text = raw == null ? "" : String(raw).trim();
    if (text) {
      lines.push(`- ${label}: ${text}`);
    }
  }

  // Sibling values — the question stem when editing an option, and so on. Marked as
  // reference so the model does not start rewriting them too.
  const related = Object.entries(context.related ?? {}).filter(([, v]) => String(v ?? "").trim());

  if (related.length > 0) {
    lines.push("");
    lines.push("Nearby content, for reference only — do not rewrite or return any of it:");
    for (const [label, text] of related.slice(0, 8)) {
      lines.push(`- ${label}: ${truncate(String(text), 500)}`);
    }
  }

  if (context.maxLength) {
    lines.push("");
    lines.push(`The field accepts at most ${context.maxLength} characters. Stay within it.`);
  }

  lines.push("");
  lines.push("Current field content, between the markers:");
  lines.push("<<<FIELD");
  lines.push(value.trim().length > 0 ? truncate(value, MAX_VALUE_CHARS) : "(the field is empty)");
  lines.push("FIELD>>>");
  lines.push("");
  lines.push(`What the user asked for: ${instruction.trim()}`);
  lines.push("");
  lines.push("Reply with the replacement field content and nothing else.");

  return lines.join("\n");
}

/**
 * The same context, split into the variables the central template binds.
 *
 * `k12.field_edit` in `ai_templates` owns the framing and the rules; this supplies
 * only the parts that vary per call. The split is not cosmetic — SafetyChecker
 * inspects every variable for prompt injection, so keeping the product's own framing
 * out of them means it scans what a user actually typed rather than our instructions
 * to the model.
 *
 * `buildFieldEditPrompt` above is kept: it is what the local path used, and it is
 * still the readable definition of how these pieces fit together.
 */
export function buildFieldEditVariables(input: {
  value: string;
  instruction: string;
  context: AiFieldContext;
}): Record<string, string> {
  const { value, instruction, context } = input;

  const facts: Array<[string, unknown]> = [
    ["Field", context.fieldLabel],
    ["Form / page", context.page],
    ["Module", context.module],
    ["Record type", context.entityType],
    ["Grade / class", context.grade],
    ["Subject", context.subject],
    ["Language", context.language],
  ];

  const contextLines = facts
    .map(([label, raw]) => [label, raw == null ? "" : String(raw).trim()] as const)
    .filter(([, text]) => text !== "")
    .map(([label, text]) => `- ${label}: ${text}`);

  if (context.maxLength) {
    contextLines.push(`- Maximum length: ${context.maxLength} characters`);
  }

  const related = Object.entries(context.related ?? {}).filter(([, v]) => String(v ?? "").trim());

  const relatedBlock =
    related.length > 0
      ? [
          "",
          "Nearby content, for reference only — do not rewrite or return any of it:",
          ...related.slice(0, 8).map(([label, text]) => `- ${label}: ${truncate(String(text), 500)}`),
          "",
        ].join("\n")
      : "";

  return {
    field_guidance: FIELD_TYPE_GUIDANCE[context.fieldType] ?? FIELD_TYPE_GUIDANCE.generic,
    field_context: contextLines.join("\n"),
    related_content: relatedBlock,
    field_value: value.trim().length > 0 ? truncate(value, MAX_VALUE_CHARS) : "(the field is empty)",
    user_instruction: instruction.trim(),
  };
}

/**
 * Clean what came back.
 *
 * Even with clear instructions a model sometimes wraps output in a fence or opens with
 * "Here is". Both would be saved verbatim into the record, so they are removed — but
 * conservatively: only wrappers that enclose the *entire* answer are stripped, never
 * content that merely resembles one.
 */
export function cleanFieldEditOutput(raw: string, originalValue: string): string {
  let text = raw.trim();

  // A fence around the whole answer.
  const fence = text.match(/^```[a-zA-Z0-9]*\n([\s\S]*?)\n?```$/);
  if (fence) {
    text = fence[1].trim();
  }

  // A conversational opener on its own first line.
  text = text.replace(
    /^(sure|certainly|of course|here(?:'s| is)[^\n:]*|okay|ok)[!,.]?\s*[:\-—]?\s*\n+/i,
    ""
  );

  // Quotes wrapping the entire answer — but only when the original was not itself
  // quoted, or we would strip meaning the user put there.
  const wrapped = text.match(/^"([\s\S]+)"$/) ?? text.match(/^'([\s\S]+)'$/);
  if (wrapped && !/^["']/.test(originalValue.trim())) {
    text = wrapped[1].trim();
  }

  return text.trim();
}

/**
 * A cheap sanity check before the result is offered to the user.
 *
 * This is not a safety classifier — it is the small set of failures that are obvious
 * from the text alone and would otherwise reach a form field unchallenged.
 */
export function inspectFieldEditOutput(
  result: string,
  originalValue: string
): { ok: boolean; reason?: string } {
  if (!result.trim()) {
    return { ok: false, reason: "The assistant returned nothing." };
  }

  // A refusal or a question, returned as if it were field content.
  if (/^(i (?:cannot|can't|am unable|do not|don't)|as an ai\b|sorry[,.]? )/i.test(result.trim())) {
    return {
      ok: false,
      reason: "The assistant replied with a message rather than replacement text. Try rewording the instruction.",
    };
  }

  // Runaway expansion on a field that had real content. A 20x blow-up is not an edit.
  const original = originalValue.trim();
  if (original.length > 40 && result.length > original.length * 20) {
    return {
      ok: false,
      reason: "The result was far longer than the original. Try a more specific instruction.",
    };
  }

  return { ok: true };
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n…(truncated)`;
}
