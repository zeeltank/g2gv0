/**
 * Shared contract for the field-level AI editing assistant.
 *
 * One shape is used by the trigger component, the API route and the prompt builder, so
 * a field that renders the assistant is automatically a field the backend can reason
 * about. The context fields exist because rewriting "make this simpler" well is
 * impossible without knowing *what* is being simplified and *for whom* — a Grade 2
 * reading passage and a Class 12 physics question want very different answers to the
 * same instruction.
 */

/**
 * What kind of content is in the field.
 *
 * This drives both the suggested actions the user sees and the guardrails the model is
 * given. It is deliberately about *content*, not about the widget: a question is a
 * question whether it lives in a textarea or a rich-text editor.
 */
export type AiFieldType =
  | "question"
  | "answer_option"
  | "explanation"
  | "learning_objective"
  | "lesson_content"
  | "instructions"
  | "description"
  | "summary"
  | "announcement"
  | "policy"
  | "feedback"
  | "title"
  | "notes"
  | "generic";

/** Everything the model is told about where this text lives. */
export interface AiFieldContext {
  /** What kind of content this is — picks the suggestions and the guardrails. */
  fieldType: AiFieldType;
  /** The visible label, e.g. "Learning objectives". Helps the model stay on-topic. */
  fieldLabel?: string;
  /** Module slug, e.g. "lms", "quiz", "course-master". */
  module?: string;
  /** Human page name, e.g. "Lesson plan". */
  page?: string;
  /** Entity being edited, e.g. "lesson_plan", "quiz_question". */
  entityType?: string;
  entityId?: string | number | null;
  /** Grade / class the content is aimed at — the single most useful hint we have. */
  grade?: string | number | null;
  subject?: string | null;
  /** Language the content should stay in unless the instruction says otherwise. */
  language?: string | null;
  /**
   * Sibling values worth knowing about — e.g. the question stem when editing an
   * option, or the chapter title when editing its description. Kept small: this is
   * context, not a payload.
   */
  related?: Record<string, string>;
  /** Soft cap the model is asked to respect, when the form has one. */
  maxLength?: number | null;
}

export interface AiFieldEditRequest {
  /** The text as it stands. May be empty when the action generates from scratch. */
  value: string;
  /** Free-text instruction typed by the user. */
  instruction?: string;
  /** Key of a suggestion chip the user clicked, e.g. "simplify". */
  actionKey?: string;
  /** Extra input an action asked for — the target language, the target grade. */
  actionInput?: string;
  context: AiFieldContext;
}

export interface AiFieldEditResult {
  /** The rewritten text, ready to drop into the field. */
  result: string;
  /** One short line explaining what changed, shown above the preview. */
  note?: string;
  /** Echoed back so the surface can label the preview. */
  actionKey?: string;
  model: string;
}

/** Failure envelope returned by the deliberately local field-edit endpoint. */
export interface AiFieldEditError {
  error: string;
  code?: string;
  detail?: string;
  retryAfterSeconds?: number;
}
