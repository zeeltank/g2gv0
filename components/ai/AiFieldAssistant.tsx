"use client";

import * as React from "react";
import {
  AlignJustify,
  AlignLeft,
  ArrowLeft,
  Briefcase,
  Check,
  CopyPlus,
  Crosshair,
  FilePlus,
  Gauge,
  GraduationCap,
  HelpCircle,
  Languages,
  List,
  Loader2,
  MessageCircle,
  Pencil,
  PencilLine,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Users,
  WandSparkles,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ACTION_GROUP_LABELS,
  type AiFieldAction,
  suggestionsFor,
} from "@/lib/ai/field-edit/actions";
import type { AiFieldContext, AiFieldType } from "@/lib/ai/field-edit/types";
import { readAiSession } from "@/lib/ai/session";

/**
 * The generative editing assistant that sits beside an editable field.
 *
 * One component covers every form in the product, which is the only way a feature like
 * this stays consistent across 70-odd screens. A caller supplies the current value, a
 * way to write it back, and enough context to make the suggestions relevant:
 *
 *   <AiFieldAssistant
 *     value={form.description}
 *     onApply={(next) => setForm((f) => ({ ...f, description: next }))}
 *     fieldType="description"
 *     label="Course description"
 *     module="course-master"
 *     grade={standard}
 *   />
 *
 * Three deliberate constraints:
 *
 * 1. It never writes to the field on its own. The result is shown as a preview and
 *    applied only when the user presses Apply, so the AI can never silently change
 *    something a teacher is about to save.
 * 2. It is purely additive. It takes `value` and calls `onApply` — it does not own the
 *    input, wrap it, or interfere with validation, so the existing save flow is
 *    untouched whether or not anyone uses the assistant.
 * 3. The previous value is kept after applying, so Undo is possible without a second
 *    model call.
 */

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "pencil-line": PencilLine,
  check: Check,
  "message-circle": MessageCircle,
  crosshair: Crosshair,
  sparkles: Sparkles,
  list: List,
  briefcase: Briefcase,
  "align-justify": AlignJustify,
  "align-left": AlignLeft,
  plus: Plus,
  "graduation-cap": GraduationCap,
  gauge: Gauge,
  users: Users,
  languages: Languages,
  "help-circle": HelpCircle,
  "copy-plus": CopyPlus,
  "wand-sparkles": WandSparkles,
  "file-plus": FilePlus,
};

export interface AiFieldAssistantProps
  extends Omit<AiFieldContext, "fieldType" | "fieldLabel"> {
  /**
   * Current field value. Omit when using `targetId`.
   */
  value?: string;
  /** Write the accepted result back into the form. Omit when using `targetId`. */
  onApply?: (next: string) => void;
  /**
   * The `id` of the input/textarea to read from and write to.
   *
   * For the many forms here that use `defaultValue` rather than controlled state,
   * refactoring the field just to add an AI button would be a bad trade — so the
   * assistant can drive the element directly instead. It writes through React's own
   * native value setter and dispatches an `input` event, so controlled inputs update
   * their state correctly too; this is not a bypass of React, it is the same path a
   * real keystroke takes.
   *
   * `value`/`onApply` win when both are supplied.
   */
  targetId?: string;
  fieldType: AiFieldType;
  /** Visible field label — shown in the popover and sent as context. */
  label?: string;
  disabled?: boolean;
  className?: string;
  /** Override the trigger's accessible name. */
  triggerLabel?: string;
}

/**
 * Set a DOM input's value the way a user would, so React's onChange still fires.
 *
 * Assigning `.value` directly is invisible to React — it caches the previous value on
 * the node and skips the event. Going through the prototype's setter defeats that cache,
 * which is what makes this safe for controlled and uncontrolled fields alike.
 */
function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, next: string) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

  if (descriptor?.set) {
    descriptor.set.call(element, next);
  } else {
    element.value = next;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

type Phase = "idle" | "loading" | "result" | "error";

export function AiFieldAssistant({
  value: valueProp,
  onApply: onApplyProp,
  targetId,
  fieldType,
  label,
  disabled,
  className,
  triggerLabel,
  ...context
}: AiFieldAssistantProps) {
  const [open, setOpen] = React.useState(false);

  /** Read the live value at the moment the popover opens, not at render time. */
  const readTarget = React.useCallback(() => {
    if (!targetId || typeof document === "undefined") return "";
    const element = document.getElementById(targetId) as HTMLTextAreaElement | HTMLInputElement | null;
    return element?.value ?? "";
  }, [targetId]);

  // Snapshotted on open so the chips (which depend on whether the field is empty) and
  // the request both see the same text.
  const [targetValue, setTargetValue] = React.useState("");
  const value = valueProp ?? targetValue;

  const onApply = React.useCallback(
    (next: string) => {
      if (onApplyProp) {
        onApplyProp(next);
        return;
      }

      if (!targetId) return;
      const element = document.getElementById(targetId) as HTMLTextAreaElement | HTMLInputElement | null;
      if (element) {
        setNativeValue(element, next);
        setTargetValue(next);
      }
    },
    [onApplyProp, targetId]
  );
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [instruction, setInstruction] = React.useState("");
  const [result, setResult] = React.useState("");
  const [note, setNote] = React.useState<string | undefined>();
  const [error, setError] = React.useState<string | null>(null);
  const [undoValue, setUndoValue] = React.useState<string | null>(null);

  // An action that needs one more answer ("into which language?") parks here until the
  // user supplies it, rather than the model guessing.
  const [pendingAction, setPendingAction] = React.useState<AiFieldAction | null>(null);
  const [actionInput, setActionInput] = React.useState("");

  // What produced the current result, so Regenerate repeats it exactly.
  const lastRequest = React.useRef<{ instruction?: string; actionKey?: string; actionInput?: string } | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const suggestions = React.useMemo(() => suggestionsFor(fieldType, value), [fieldType, value]);

  const grouped = React.useMemo(() => {
    const groups = new Map<AiFieldAction["group"], AiFieldAction[]>();
    for (const action of suggestions) {
      const list = groups.get(action.group) ?? [];
      list.push(action);
      groups.set(action.group, list);
    }
    return [...groups.entries()];
  }, [suggestions]);

  function reset() {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
    setInstruction("");
    setResult("");
    setNote(undefined);
    setError(null);
    setPendingAction(null);
    setActionInput("");
    lastRequest.current = null;
  }

  function handleOpenChange(next: boolean) {
    // Re-read the element each time it opens: in targetId mode the user may have typed
    // since the last look, and stale text would be edited instead of what is on screen.
    if (next && targetId) {
      setTargetValue(readTarget());
    }

    setOpen(next);
    if (!next) {
      // Undo stays available after the popover closes — the user may only notice they
      // dislike the change once they can see the whole form again.
      reset();
    }
  }

  async function run(payload: { instruction?: string; actionKey?: string; actionInput?: string }) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    lastRequest.current = payload;
    setPhase("loading");
    setError(null);
    setResult("");
    setNote(undefined);

    try {
      // The route proxies into Laravel's AI runtime, which derives the school and
      // the user from this token. Nothing about the tenant is sent in the body —
      // a request that named its own institute could name someone else's.
      const session = readAiSession();

      const response = await fetch("/api/ai/field-edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          value,
          instruction: payload.instruction,
          actionKey: payload.actionKey,
          actionInput: payload.actionInput,
          context: { ...context, fieldType, fieldLabel: label },
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body?.error ?? "The assistant could not complete that.");
        setPhase("error");
        return;
      }

      setResult(body.result ?? "");
      setNote(body.note);
      setPhase("result");
    } catch (caught) {
      if ((caught as Error)?.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "The assistant could not be reached.");
      setPhase("error");
    }
  }

  function submitTyped() {
    const text = instruction.trim();
    if (text) void run({ instruction: text });
  }

  function pickAction(action: AiFieldAction) {
    if (action.input?.required) {
      setPendingAction(action);
      setActionInput("");
      return;
    }
    void run({ actionKey: action.key });
  }

  function apply() {
    setUndoValue(value);
    onApply(result);
    setOpen(false);
    reset();
  }

  function undo() {
    if (undoValue === null) return;
    onApply(undoValue);
    setUndoValue(null);
  }

  const busy = phase === "loading";

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        {/* G2G PORT: G2G's popover is Radix, so the trigger button is passed with
            `asChild` rather than LMS_K12's Base UI `render` prop. Same button. */}
        <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label={triggerLabel ?? `Edit ${label ?? "this field"} with AI`}
              title={busy ? "Writing a suggestion…" : (triggerLabel ?? "Edit with AI")}
              aria-busy={busy}
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                "text-indigo-600 transition-colors",
                "hover:bg-indigo-50 hover:text-indigo-700",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
                "disabled:pointer-events-none disabled:opacity-40",
                open && "bg-indigo-50 text-indigo-700"
              )}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          /* The assistant sits on ordinary forms but also inside modals — float it
             above the dialog layer (LMS_K12 set this on Base UI's positioner; Radix
             has no positioner, so it goes on the content). */
          className="z-[130] w-[26rem] max-w-[calc(100vw-2rem)] gap-0 p-0"
        >
          {/* ---- header ---- */}
          <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5">
            <span className="text-[13px] font-semibold text-slate-800">
              {label ? `Edit ${label.toLowerCase()}` : "Edit this field"}
            </span>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="max-h-[26rem] overflow-y-auto p-3.5">
            {/* ---- asking for a required action input ---- */}
            {pendingAction ? (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => setPendingAction(null)}
                  className="inline-flex items-center gap-1 text-[12px] text-slate-500 transition-colors hover:text-slate-700"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
                <label className="block text-[13px] font-medium text-slate-700">
                  {pendingAction.input?.label}
                </label>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={actionInput}
                    onChange={(event) => setActionInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && actionInput.trim()) {
                        event.preventDefault();
                        void run({ actionKey: pendingAction.key, actionInput: actionInput.trim() });
                        setPendingAction(null);
                      }
                    }}
                    placeholder={pendingAction.input?.placeholder}
                    className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="button"
                    disabled={!actionInput.trim()}
                    onClick={() => {
                      void run({ actionKey: pendingAction.key, actionInput: actionInput.trim() });
                      setPendingAction(null);
                    }}
                    className="rounded-lg bg-indigo-600 px-3 text-[13px] font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
                  >
                    Go
                  </button>
                </div>
              </div>
            ) : phase === "result" || phase === "loading" || phase === "error" ? (
              /* ---- working / preview / failure ---- */
              <div className="space-y-3">
                {busy ? (
                  <div className="flex items-center gap-2 py-6 text-[13px] text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Writing a suggestion…
                  </div>
                ) : phase === "error" ? (
                  <>
                    <p className="text-[13px] text-red-600">{error}</p>
                    <div className="flex gap-2">
                      <ActionButton onClick={() => setPhase("idle")}>Back</ActionButton>
                      {lastRequest.current ? (
                        <ActionButton onClick={() => void run(lastRequest.current!)} icon={RefreshCw}>
                          Try again
                        </ActionButton>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-indigo-600">
                      <Sparkles className="h-3 w-3" />
                      Suggested edit
                    </div>

                    {/* The result is editable before it is applied — the user should be
                        able to fix one word without another round trip. */}
                    <textarea
                      value={result}
                      onChange={(event) => setResult(event.target.value)}
                      rows={Math.min(12, Math.max(3, result.split("\n").length + 1))}
                      className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 text-[13px] leading-relaxed text-slate-800 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                    />

                    {note ? <p className="text-[12px] text-slate-500">{note}</p> : null}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={apply}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-indigo-700"
                      >
                        <Check className="h-3.5 w-3.5" /> Apply
                      </button>
                      <ActionButton
                        onClick={() => lastRequest.current && void run(lastRequest.current)}
                        icon={RefreshCw}
                      >
                        Regenerate
                      </ActionButton>
                      <ActionButton onClick={() => setPhase("idle")} icon={Pencil}>
                        New instruction
                      </ActionButton>
                      <ActionButton onClick={() => handleOpenChange(false)}>Cancel</ActionButton>
                    </div>

                    <p className="text-[11px] leading-relaxed text-slate-400">
                      Review before applying. Nothing is saved until you save the form.
                    </p>
                  </>
                )}
              </div>
            ) : (
              /* ---- idle: instruction box + context-aware chips ---- */
              <div className="space-y-3">
                <div className="relative">
                  <textarea
                    autoFocus
                    value={instruction}
                    onChange={(event) => setInstruction(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        submitTyped();
                      }
                    }}
                    rows={2}
                    placeholder="How would you like to edit this?"
                    className="w-full resize-none rounded-lg border border-indigo-300 py-2 pl-2.5 pr-9 text-[13px] outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="button"
                    onClick={submitTyped}
                    disabled={!instruction.trim()}
                    aria-label="Send instruction"
                    className="absolute bottom-2 right-2 rounded-md p-1 text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-30"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>

                {grouped.map(([group, actions]) => (
                  <div key={group} className="space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {ACTION_GROUP_LABELS[group]}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {actions.map((action) => {
                        const Icon = ICONS[action.icon] ?? Sparkles;
                        return (
                          <button
                            key={action.key}
                            type="button"
                            onClick={() => pickAction(action)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            <Icon className="h-3 w-3" aria-hidden="true" />
                            {action.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Survives the popover closing, because that is when regret usually arrives. */}
      {undoValue !== null ? (
        <button
          type="button"
          onClick={undo}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <RefreshCw className="h-3 w-3" /> Undo AI edit
        </button>
      ) : null}
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  icon: Icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-700 transition-colors hover:bg-slate-50"
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}
