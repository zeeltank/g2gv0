import type { AiFieldType } from "./types";

/**
 * The suggestion catalogue.
 *
 * The requirement is that the popover offers actions relevant to *this* field rather
 * than the same eight chips everywhere. That is handled in two layers: an action is
 * defined once here with the instruction it stands for, and each field type declares
 * which actions it offers, in the order a person would reach for them.
 *
 * Keeping the instruction text beside the label matters — the chip and the typed
 * sentence go down exactly the same path, so "Simplify language" is literally the
 * instruction "Rewrite it in simpler language…" and there is no second, hidden
 * behaviour for chips.
 */

export interface AiFieldAction {
  key: string;
  label: string;
  /** Lucide icon name, matching the project's icon set. */
  icon: string;
  /** The instruction this chip stands for, sent verbatim as the user instruction. */
  instruction: string;
  /**
   * When set, the chip asks for one more piece of input before running — the target
   * language, the target grade. Without this, "Translate" has to guess, and guessing
   * Hindi for a Marathi-medium school is worse than asking.
   */
  input?: {
    label: string;
    placeholder: string;
    /** Merged into the instruction as `{input}`. */
    required: boolean;
  };
  /** Groups the chips under headings, as in the reference UI. */
  group: "rewrite" | "length" | "audience" | "generate" | "language";
}

export const AI_FIELD_ACTIONS: Record<string, AiFieldAction> = {
  // ---- rewrite -----------------------------------------------------------
  improve_writing: {
    key: "improve_writing",
    label: "Improve writing",
    icon: "pencil-line",
    instruction: "Improve the writing. Keep the meaning and the facts exactly as they are.",
    group: "rewrite",
  },
  fix_grammar: {
    key: "fix_grammar",
    label: "Fix spelling & grammar",
    icon: "check",
    instruction:
      "Correct spelling, grammar and punctuation only. Do not reword anything that is already correct.",
    group: "rewrite",
  },
  simplify: {
    key: "simplify",
    label: "Simplify language",
    icon: "message-circle",
    instruction:
      "Rewrite it in simpler language. Use shorter sentences and everyday words. Keep every fact.",
    group: "rewrite",
  },
  more_specific: {
    key: "more_specific",
    label: "Be more specific",
    icon: "crosshair",
    instruction:
      "Make it more specific and concrete. Replace vague phrasing with precise wording. "
      + "Do not invent facts that are not already implied.",
    group: "rewrite",
  },
  more_engaging: {
    key: "more_engaging",
    label: "Make more engaging",
    icon: "sparkles",
    instruction:
      "Make it more engaging for its readers while staying factual and professional. No hype, no emoji.",
    group: "rewrite",
  },
  bullet_points: {
    key: "bullet_points",
    label: "Convert to bullet points",
    icon: "list",
    instruction: "Rewrite it as a short bulleted list. One idea per bullet.",
    group: "rewrite",
  },
  formal_tone: {
    key: "formal_tone",
    label: "More formal",
    icon: "briefcase",
    instruction: "Rewrite it in a more formal, professional register suitable for an official notice.",
    group: "rewrite",
  },

  // ---- length ------------------------------------------------------------
  make_longer: {
    key: "make_longer",
    label: "Make longer",
    icon: "align-justify",
    instruction:
      "Expand it with more detail and useful explanation. Do not pad it with filler or repeat yourself.",
    group: "length",
  },
  make_shorter: {
    key: "make_shorter",
    label: "Make shorter",
    icon: "align-left",
    instruction: "Make it shorter and tighter. Keep every important point.",
    group: "length",
  },
  add_details: {
    key: "add_details",
    label: "Add more details",
    icon: "plus",
    instruction:
      "Add the detail a reader would need to act on this. Only add what follows from the existing content.",
    group: "length",
  },

  // ---- audience ----------------------------------------------------------
  for_grade: {
    key: "for_grade",
    label: "Rewrite for a level",
    icon: "graduation-cap",
    instruction: "Rewrite it so it is appropriate for {input} readers — vocabulary, sentence length and examples.",
    input: { label: "Which level?", placeholder: "e.g. new joiners, senior managers", required: true },
    group: "audience",
  },
  change_difficulty: {
    key: "change_difficulty",
    label: "Change difficulty",
    icon: "gauge",
    instruction: "Adjust the difficulty to {input}. Keep the same topic and the same skill being tested.",
    input: { label: "Target difficulty", placeholder: "e.g. harder, easier, moderate", required: true },
    group: "audience",
  },
  for_parents: {
    key: "for_parents",
    label: "Reword for employees",
    icon: "users",
    instruction:
      "Reword it for employees. Plain language, no HR jargon, no abbreviations an employee would not know.",
    group: "audience",
  },

  // ---- language ----------------------------------------------------------
  translate: {
    key: "translate",
    label: "Translate",
    icon: "languages",
    instruction: "Translate it into {input}. Keep names, numbers and technical terms accurate.",
    input: { label: "Into which language?", placeholder: "e.g. Hindi, Marathi, Gujarati", required: true },
    group: "language",
  },

  // ---- generate ----------------------------------------------------------
  improve_question: {
    key: "improve_question",
    label: "Improve question",
    icon: "help-circle",
    instruction:
      "Improve this assessment question: make it unambiguous, single-barrelled and clearly answerable. "
      + "Keep the same concept and the same expected answer.",
    group: "rewrite",
  },
  generate_similar: {
    key: "generate_similar",
    label: "Generate a similar question",
    icon: "copy-plus",
    instruction:
      "Write one new question testing the same concept at the same difficulty, with different specifics. "
      + "Return only the new question.",
    group: "generate",
  },
  generate_better: {
    key: "generate_better",
    label: "Generate a better version",
    icon: "wand-sparkles",
    instruction: "Write a clearly better version of this content for its stated purpose.",
    group: "generate",
  },
  draft_from_title: {
    key: "draft_from_title",
    label: "Draft from the title",
    icon: "file-plus",
    instruction:
      "The field is empty. Draft suitable content from the surrounding context provided. "
      + "Stay conservative — do not invent specifics such as dates, names or amounts.",
    group: "generate",
  },
};

/**
 * Which actions each field type offers, in priority order.
 *
 * The first four or five are what most users will ever click, so ordering here is a
 * product decision, not an alphabetical one: a question field leads with "Improve
 * question", a policy field leads with "More formal".
 */
const SUGGESTIONS_BY_FIELD_TYPE: Record<AiFieldType, string[]> = {
  question: [
    "improve_question",
    "simplify",
    "more_specific",
    "change_difficulty",
    "for_grade",
    "generate_similar",
    "fix_grammar",
    "translate",
  ],
  answer_option: [
    "improve_writing",
    "make_shorter",
    "more_specific",
    "fix_grammar",
    "generate_similar",
    "translate",
  ],
  explanation: [
    "simplify",
    "improve_writing",
    "add_details",
    "for_grade",
    "bullet_points",
    "make_shorter",
    "fix_grammar",
    "translate",
  ],
  learning_objective: [
    "more_specific",
    "improve_writing",
    "bullet_points",
    "for_grade",
    "make_shorter",
    "fix_grammar",
  ],
  lesson_content: [
    "improve_writing",
    "simplify",
    "for_grade",
    "add_details",
    "bullet_points",
    "more_engaging",
    "make_shorter",
    "fix_grammar",
    "translate",
  ],
  instructions: [
    "simplify",
    "more_specific",
    "bullet_points",
    "make_shorter",
    "for_grade",
    "fix_grammar",
    "translate",
  ],
  description: [
    "improve_writing",
    "make_shorter",
    "make_longer",
    "simplify",
    "more_specific",
    "more_engaging",
    "fix_grammar",
    "translate",
  ],
  summary: ["make_shorter", "improve_writing", "bullet_points", "simplify", "fix_grammar"],
  announcement: [
    "improve_writing",
    "formal_tone",
    "make_shorter",
    "for_parents",
    "simplify",
    "fix_grammar",
    "translate",
  ],
  policy: [
    "formal_tone",
    "improve_writing",
    "more_specific",
    "bullet_points",
    "add_details",
    "fix_grammar",
  ],
  feedback: [
    "improve_writing",
    "for_parents",
    "more_specific",
    "make_shorter",
    "simplify",
    "fix_grammar",
  ],
  title: ["improve_writing", "make_shorter", "more_specific", "fix_grammar"],
  notes: ["improve_writing", "bullet_points", "make_shorter", "fix_grammar"],
  generic: [
    "improve_writing",
    "fix_grammar",
    "make_shorter",
    "make_longer",
    "simplify",
    "more_specific",
    "translate",
  ],
};

/**
 * The chips to show for a field.
 *
 * When the field is empty most actions are meaningless — you cannot shorten nothing —
 * so an empty field is offered the generative actions instead. This is why the popover
 * never shows a dead chip.
 */
export function suggestionsFor(fieldType: AiFieldType, currentValue: string): AiFieldAction[] {
  const isEmpty = currentValue.trim().length === 0;

  if (isEmpty) {
    const generative = ["draft_from_title", "generate_better"];
    return generative
      .map((key) => AI_FIELD_ACTIONS[key])
      .filter((action): action is AiFieldAction => Boolean(action));
  }

  return (SUGGESTIONS_BY_FIELD_TYPE[fieldType] ?? SUGGESTIONS_BY_FIELD_TYPE.generic)
    .map((key) => AI_FIELD_ACTIONS[key])
    .filter((action): action is AiFieldAction => Boolean(action));
}

/**
 * Resolve a chip into the instruction it stands for.
 *
 * `{input}` is substituted with whatever the chip asked for. An action that requires
 * input and did not get it falls back to its own label, which reads sensibly enough
 * ("Translate") for the model to ask for clarification rather than pick a language.
 */
export function instructionForAction(actionKey: string, actionInput?: string): string | null {
  const action = AI_FIELD_ACTIONS[actionKey];

  if (!action) {
    return null;
  }

  if (!action.instruction.includes("{input}")) {
    return action.instruction;
  }

  const value = (actionInput ?? "").trim();

  return value
    ? action.instruction.replace("{input}", value)
    : action.instruction.replace("{input}", "the target the user names");
}

export const ACTION_GROUP_LABELS: Record<AiFieldAction["group"], string> = {
  rewrite: "Writing",
  length: "Length",
  audience: "Audience",
  language: "Language",
  generate: "Generate",
};
