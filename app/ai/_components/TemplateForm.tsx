'use client';

/**
 * The template editor — one form, used by both the Add and the Edit page.
 *
 * WHY THE TOOLBAR HAS NO BOLD, FONT OR COLOUR BUTTONS
 *
 * This produces the text of a prompt that gets sent to a model, not a document that
 * gets printed. Bold in a document is `<b>`; `<b>` here is two tokens of markup the
 * model reads as content — formatting controls would not make the prompt prettier,
 * they would make the answers worse. So the strip keeps only the controls that do
 * apply: the category, status and format selectors, the variable picker, and Preview.
 *
 * WHY THE PROMPT IS TWO FIELDS
 *
 * A prompt has a standing instruction (who the model is, what it must never do) and a
 * per-request ask. They are stored separately and sent to the model in different
 * roles, so a single box would have to be split again on save by guessing where one
 * ends. Both live inside the one content block, under the one toolbar, so the screen
 * still reads as a single "content" section.
 *
 * PROMPTS ONLY
 *
 * LMS K-12's version of this editor also authors report layouts, with an HTML editor
 * and a data-source picker bound to its read-only MCP tools. G2G has no such tool
 * registry, so that half is deliberately absent rather than present-and-broken — a
 * data-source dropdown with nothing in it cannot produce a working report. The kind
 * selector is gone with it: a form that offers one choice is not a choice.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, LoaderCircle, Sparkles, X } from 'lucide-react';

import {
  createTemplate,
  fetchTemplateOptions,
  previewTemplate,
  updateTemplate,
  SHARED_MODULE_KEY,
  type AiTemplateOptions,
  type AiTemplateRow,
  type TemplateKind,
  type TemplatePreview,
} from '@/lib/intelligence/ai-templates';
import { describeAiError } from '@/lib/intelligence/client';

export interface TemplateFormState {
  name: string;
  description: string;
  template_key: string;
  module_key: string;
  kind: TemplateKind;
  category: string;
  status: string;
  system_prompt: string;
  user_prompt: string;
  output_format: string;
  safety_rules: string[];
  allow_as_evidence: boolean;
  requires_review: boolean;
  offer_in_module: boolean;
  suggestion_label: string;
  requires_entity: boolean;
  new_version: boolean;
}

export function blankForm(moduleKey: string): TemplateFormState {
  return {
    name: '',
    description: '',
    template_key: '',
    // A new template lands in the module the administrator was looking at. Defaulting
    // to shared instead would file most templates where they are hardest to find.
    module_key: moduleKey || SHARED_MODULE_KEY,
    kind: 'prompt',
    category: '',
    status: 'draft',
    system_prompt: '',
    user_prompt: '',
    output_format: 'text',
    safety_rules: [],
    allow_as_evidence: false,
    requires_review: false,
    offer_in_module: true,
    suggestion_label: '',
    requires_entity: false,
    new_version: false,
  };
}

export function formFromRow(row: AiTemplateRow): TemplateFormState {
  return {
    name: row.name,
    description: row.description ?? '',
    template_key: row.template_key,
    module_key: row.module_key,
    kind: 'prompt',
    category: row.category ?? '',
    status: row.status,
    system_prompt: row.system_prompt ?? '',
    user_prompt: row.user_prompt,
    output_format: row.output_format,
    safety_rules: Array.isArray(row.safety_rules) ? row.safety_rules : [],
    allow_as_evidence: row.allow_as_evidence,
    requires_review: row.requires_review,
    offer_in_module: row.offered_in_module,
    suggestion_label: row.offer_label ?? '',
    // Read from the binding, not assumed. Hardcoding false here meant every edit
    // wrote it back as false, so correcting a typo in a label silently turned a
    // record-scoped suggestion into one that shows on every screen.
    requires_entity: row.offer_requires_entity ?? false,
    new_version: false,
  };
}

export function TemplateForm({
  options,
  initial,
  templateId,
  editableInPlace = true,
  isPlatform = false,
  returnTo,
}: {
  options: AiTemplateOptions | null;
  initial: TemplateFormState;
  /** Null on the Add page; the row's id on the Edit page. */
  templateId: number | null;
  editableInPlace?: boolean;
  isPlatform?: boolean;
  /** Where Cancel and a successful Save go back to. */
  returnTo: string;
}) {
  const router = useRouter();

  const [form, setForm] = useState<TemplateFormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const systemRef = useRef<HTMLTextAreaElement>(null);
  const userRef = useRef<HTMLTextAreaElement>(null);
  /**
   * Which box the variable picker inserts into.
   *
   * Tracked on focus rather than read from `document.activeElement`, because opening
   * the picker moves focus to the picker — by the time the change event fires, the
   * textarea the administrator was typing in is no longer the active element.
   */
  const lastFocused = useRef<'system' | 'user'>('user');

  const patch = (changes: Partial<TemplateFormState>) =>
    setForm((current) => ({ ...current, ...changes }));

  const insertVariable = (key: string) => {
    if (!key) return;

    const target = lastFocused.current === 'system' ? systemRef.current : userRef.current;
    const token = `{{${key}}}`;
    const field = lastFocused.current === 'system' ? 'system_prompt' : 'user_prompt';

    if (!target) {
      patch({ [field]: `${form[field]}${token}` } as Partial<TemplateFormState>);
      return;
    }

    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    const next = target.value.slice(0, start) + token + target.value.slice(end);

    patch({ [field]: next } as Partial<TemplateFormState>);

    requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const runPreview = async () => {
    setPreviewing(true);
    setError('');

    try {
      setPreview(
        await previewTemplate({
          system_prompt: form.system_prompt || null,
          user_prompt: form.user_prompt,
        })
      );
    } catch (cause) {
      setError(describeAiError(cause));
    } finally {
      setPreviewing(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      template_key: form.template_key.trim() || null,
      module_key: form.module_key,
      kind: 'prompt' as const,
      category: form.category.trim() || null,
      status: form.status,
      system_prompt: form.system_prompt.trim() || null,
      user_prompt: form.user_prompt,
      output_format: form.output_format,
      safety_rules: form.safety_rules.filter((rule) => rule.trim() !== ''),
      allow_as_evidence: form.allow_as_evidence,
      requires_review: form.requires_review,
      offer_in_module: form.offer_in_module,
      suggestion_label: form.suggestion_label.trim() || null,
      requires_entity: form.requires_entity,
    };

    try {
      if (templateId === null) {
        await createTemplate(payload);
      } else {
        await updateTemplate(templateId, { ...payload, new_version: form.new_version });
      }

      // `refresh()` before `push()` so the listing renders the saved row rather than
      // the copy the router cached on the way in.
      router.refresh();
      router.push(returnTo);
    } catch (cause) {
      setError(describeAiError(cause));
      setSaving(false);
    }
  };

  const groundingUsed = useMemo(() => {
    const both = `${form.system_prompt} ${form.user_prompt}`;

    return (options?.grounding_variables ?? []).filter((key) => both.includes(`{{${key}}}`));
  }, [form.system_prompt, form.user_prompt, options]);

  const sharedModule = form.module_key === SHARED_MODULE_KEY;

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isPlatform && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm leading-6 text-indigo-900">
          This is a platform template every organisation on this platform uses. Saving writes a copy owned by
          this organisation, which takes precedence here and leaves the shared one untouched.
        </div>
      )}


      {/* The two identifying fields, side by side, exactly as the ERP template editor
          places Module Name and Template Title. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-foreground">Module Name *</span>
          <select
            value={form.module_key}
            onChange={(event) => patch({ module_key: event.target.value })}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            {(options?.modules ?? []).map((module) => (
              <option key={module.key} value={module.key}>
                {module.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Template Title *</span>
          <input
            value={form.name}
            onChange={(event) => patch({ name: event.target.value })}
            required
            placeholder="Competency gap summary"
            className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-foreground">What it is for</span>
        <input
          value={form.description}
          onChange={(event) => patch({ description: event.target.value })}
          placeholder="A short summary of the competency gaps for a team or a job role."
          className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </label>

      {/* The content block: label, then a bordered box whose first row is the
          toolbar. Same anatomy as the HTML editor on the ERP template screen, so an
          administrator who already maintains those does not learn a second layout. */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Prompt Content *</span>
          <Sparkles className="size-4 text-indigo-400" />
        </div>

        <div className="mt-1 overflow-hidden rounded-none border border-border bg-card focus-within:border-ring">
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card p-2">
            <select
              aria-label="Category"
              value={form.category}
              onChange={(event) => patch({ category: event.target.value })}
              className="h-8 rounded border bg-card px-2 text-xs"
            >
              <option value="">Category</option>
              {(options?.categories ?? []).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              aria-label="Status"
              value={form.status}
              onChange={(event) => patch({ status: event.target.value })}
              className="h-8 rounded border bg-card px-2 text-xs"
            >
              {(options?.statuses ?? ['draft', 'published', 'archived']).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              aria-label="Output format"
              value={form.output_format}
              onChange={(event) => patch({ output_format: event.target.value })}
              className="h-8 rounded border bg-card px-2 text-xs"
            >
              {(options?.output_formats ?? ['text', 'markdown', 'json']).map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>

            <span className="mx-1 h-5 w-px bg-border" />

            <select
              aria-label="Insert template variable"
              defaultValue=""
              onChange={(event) => {
                insertVariable(event.target.value);
                event.target.value = '';
              }}
              className="h-8 max-w-64 rounded border bg-card px-2 text-xs"
            >
              <option value="">Insert template variable...</option>
              {(options?.variables ?? []).map((variable) => (
                <option key={variable.key} value={variable.key}>
                  {variable.key} - {variable.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void runPreview()}
              disabled={previewing || form.user_prompt.trim() === ''}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {previewing ? <LoaderCircle className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
              Preview
            </button>
          </div>

          <div className="divide-y divide-border">
            <div className="p-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                System instruction
              </span>
              <textarea
                ref={systemRef}
                value={form.system_prompt}
                onFocus={() => {
                  lastFocused.current = 'system';
                }}
                onChange={(event) => patch({ system_prompt: event.target.value })}
                rows={5}
                placeholder="You summarise competency data for HR administrators. Work only from the data given below…"
                className="mt-1 w-full resize-y border-0 p-0 font-mono text-xs leading-6 outline-none placeholder:font-sans placeholder:text-muted-foreground"
              />
            </div>

            <div className="p-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                User prompt
              </span>
              <textarea
                ref={userRef}
                value={form.user_prompt}
                onFocus={() => {
                  lastFocused.current = 'user';
                }}
                onChange={(event) => patch({ user_prompt: event.target.value })}
                rows={12}
                required
                placeholder={'Summarise the competency gaps on this page.\n\nPage: {{page_title}}\nRows:\n{{records}}'}
                className="mt-1 w-full resize-y border-0 p-0 font-mono text-xs leading-6 outline-none placeholder:font-sans placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </div>

        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          Placeholders such as <code className="font-mono">{'{{records}}'}</code> are filled in by the
          system when the template runs. A published template must use at least one of the data
          variables — {(options?.grounding_variables ?? []).map((key) => `{{${key}}}`).join(' or ')} —
          or the model has nothing to work from and answers from general knowledge.{' '}
          {groundingUsed.length > 0 ? (
            <span className="font-medium text-emerald-700">
              Using {groundingUsed.map((key) => `{{${key}}}`).join(', ')}.
            </span>
          ) : (
            <span className="font-medium text-amber-700">None used yet.</span>
          )}
        </p>
      </div>

      <details className="rounded-xl border border-border bg-card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
          Publishing, safety and where it appears
        </summary>

        <div className="space-y-5 border-t px-4 py-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Template key</span>
            <input
              value={form.template_key}
              onChange={(event) => patch({ template_key: event.target.value })}
              placeholder="Left blank, one is generated from the module and title"
              className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 font-mono text-xs outline-none placeholder:font-sans placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              The stable identifier the runtime and the audit trail use. Changing it on an existing
              template moves what the module offers.
            </span>
          </label>

          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">Safety rules</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Things the model must never do — checked against the output, not only asked for.
                </p>
              </div>
              <button
                type="button"
                onClick={() => patch({ safety_rules: [...form.safety_rules, ''] })}
                className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
              >
                Add rule
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {form.safety_rules.length === 0 && (
                <p className="rounded-xl border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                  No rules yet. &ldquo;Do not invent a name, amount or date&rdquo; is the one almost
                  every template wants.
                </p>
              )}

              {form.safety_rules.map((rule, position) => (
                <div key={position} className="flex items-center gap-2">
                  <input
                    value={rule}
                    onChange={(event) => {
                      const next = [...form.safety_rules];
                      next[position] = event.target.value;
                      patch({ safety_rules: next });
                    }}
                    placeholder="Do not invent a rating, an employee name or a date."
                    className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      patch({ safety_rules: form.safety_rules.filter((_, index) => index !== position) })
                    }
                    className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground">Where it appears</h3>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              A published template bound to a module is offered by that module&rsquo;s AI panel. Turn
              this off to keep it stored centrally without putting it in front of users.
            </p>

            <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.offer_in_module}
                disabled={sharedModule}
                onChange={(event) => patch({ offer_in_module: event.target.checked })}
                className="size-4 accent-primary"
              />
              <span className={sharedModule ? 'text-muted-foreground' : ''}>
                Offer this in the module&rsquo;s AI panel
              </span>
            </label>

            {sharedModule && (
              <p className="mt-1 text-xs text-muted-foreground">
                Shared templates are resolved from the page type rather than offered as a button, so
                there is no single module to offer them in.
              </p>
            )}

            {form.offer_in_module && !sharedModule && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Button label</span>
                  <input
                    value={form.suggestion_label}
                    onChange={(event) => patch({ suggestion_label: event.target.value })}
                    placeholder={form.name || 'Summarise competency gaps'}
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  />
                  <span className="mt-1 block text-xs text-muted-foreground">Defaults to the template title.</span>
                </label>

                <label className="mt-6 flex items-start gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.requires_entity}
                    onChange={(event) => patch({ requires_entity: event.target.checked })}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span>
                    Only when a record is selected
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      For templates about one employee or job role rather than the list.
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-2 rounded-xl border border-border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.requires_review}
                onChange={(event) => patch({ requires_review: event.target.checked })}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                Requires human review
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Output is held for a person to approve before it is used.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 rounded-xl border border-border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.allow_as_evidence}
                onChange={(event) => patch({ allow_as_evidence: event.target.checked })}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                May be used as evidence
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Output can be cited in a case. Leave off unless the template is verifiable.
                </span>
              </span>
            </label>
          </div>

          {templateId !== null && editableInPlace && form.status === 'published' && (
            <label className="flex items-start gap-2 rounded-xl border border-border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.new_version}
                onChange={(event) => patch({ new_version: event.target.checked })}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                Publish as a new version
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Keeps the current text as an archived version, so a change that reads worse can be
                  rolled back by republishing it.
                </span>
              </span>
            </label>
          )}
        </div>
      </details>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving && <LoaderCircle className="size-4 animate-spin" />}
          Save
        </button>
        <button
          type="button"
          onClick={() => router.push(returnTo)}
          className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-5 text-sm font-medium text-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[min(85vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-card shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">What the model receives, with sample data</h2>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
              {preview.unresolved.length > 0 && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Nothing fills {preview.unresolved.map((key) => `{{${key}}}`).join(', ')} — the model
                  receives that text literally.
                </p>
              )}

              {preview.system && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    System instruction
                  </h3>
                  <pre className="mt-1 whitespace-pre-wrap rounded-xl border border-border bg-muted p-3 text-xs leading-6 text-muted-foreground">
                    {preview.system}
                  </pre>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  User prompt
                </h3>
                <pre className="mt-1 whitespace-pre-wrap rounded-xl border border-border bg-card p-3 text-xs leading-6 text-foreground">
                  {preview.user}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}


/**
 * Shared page frame for the Add, View and Edit screens.
 *
 * Kept here rather than repeated three times for the same reason `CapabilityShell`
 * exists: three copies of a header is three chances for one to drift, and the first
 * one that does is the one nobody notices.
 */
export function TemplatePageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  // No page padding or min-height here: `app/ai/layout.tsx` already supplies both
  // through GtgPageShell, and a second copy would double the gutter.
  return (
    <div>
      <div className="mx-auto max-w-[1100px] space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {actions}
        </div>
        {children}
      </div>
    </div>
  );
}

/** The load/error states every one of the three pages needs. */
export function TemplatePageState({ loading, error }: { loading: boolean; error: string }) {
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-card">
        <LoaderCircle className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {error}
    </div>
  );
}

/** Loads the option lists every page needs, with its own loading and error state. */
export function useTemplateOptions() {
  const [options, setOptions] = useState<AiTemplateOptions | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetchTemplateOptions()
      .then((next) => {
        if (!cancelled) setOptions(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeAiError(cause));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { options, optionsError: error };
}
