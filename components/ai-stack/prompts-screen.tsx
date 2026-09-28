'use client';

/**
 * AI Stack → Prompts, for any module.
 *
 * The prompts behind each of the module's AI features, kept out of the code.
 *
 * WHY THIS SITS BESIDE TEMPLATES RATHER THAN INSIDE IT
 *
 * A prompt and a report template are both `ai_templates` rows for this module's
 * `module_key`, separated by `kind`. They are not the same thing and must not share a
 * list: a prompt is text sent to a model, which writes prose; a report is an HTML layout
 * whose placeholders are filled by substitution from rows a tool fetched, with no model
 * near the figures. The Templates screen filters to `kind === 'report'` and this one to
 * `kind === 'prompt'`, so an author editing "the summary prompt" cannot land in the report
 * layout by accident.
 *
 * DECENTRALISED, SAME STORE
 *
 * This calls the same `lib/intelligence/ai-templates` client the central console and the
 * Fees, Attendance, Admission and Student screens call, so the contract is shared and a
 * change to it breaks them all at compile time. What makes a prompt this module's is the
 * scope: the list is fetched with this module's key and every save sets it, so a prompt
 * written here cannot come out filed against another module.
 *
 * PLATFORM PROMPTS ARE NOT EDITED IN PLACE
 *
 * The prompts that ship with the product are platform rows — shared by every school, owned
 * by none. The API reports that as `editable_in_place: false`, and saving one writes this
 * school its own copy rather than changing everybody's. The screen says so before the save
 * rather than after, because "I edited the shared prompt" and "I forked it" are different
 * things to be told afterwards.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Copy, Eye, Loader2, Pencil, Plus, Save, Terminal, Trash2, X } from 'lucide-react';

import { AiFieldAssistant } from '@/components/ai/AiFieldAssistant';
import {
  createTemplate,
  fetchTemplateOptions,
  fetchTemplates,
  previewTemplate,
  retireTemplate,
  updateTemplate,
  type AiTemplateOptions,
  type AiTemplateRow,
  type TemplatePreview,
} from '@/lib/intelligence/ai-templates';
import { refreshModuleAiStack } from '@/lib/module-ai/module-ai-stack';

import {
  AiStackCard,
  AiStackEmpty,
  AiStackError,
  AiStackHeader,
  AiStackHint,
  AiStackLoading,
  AiStackNotice,
  AiStackPill,
  AiStackTableHead,
  formatWhen,
} from './ai-stack-chrome';
import type { AiStackModule } from './ai-stack-module';

/** Placeholder syntax a prompt uses. Shown, not guessed at from documentation. */
const PLACEHOLDER_HINT = 'Wrap a variable in double braces, for example {{records}}.';

interface FormState {
  id: number | null;
  /** True when saving will fork a platform row into this school's own copy. */
  forks: boolean;
  name: string;
  description: string;
  system_prompt: string;
  user_prompt: string;
  status: string;
  category: string;
  output_format: string;
  requires_review: boolean;
  offer_in_module: boolean;
}

function blankForm(module: AiStackModule, options: AiTemplateOptions | null): FormState {
  return {
    id: null,
    forks: false,
    name: '',
    description: '',
    // The standing instruction this module needs and which is easiest to forget.
    system_prompt: module.copy.promptSystemDefault,
    user_prompt: '',
    status: 'draft',
    category: '',
    output_format: options?.output_formats[0] ?? 'text',
    requires_review: true,
    offer_in_module: false,
  };
}

function formFrom(row: AiTemplateRow): FormState {
  return {
    id: row.id,
    forks: !row.editable_in_place,
    name: row.name,
    description: row.description ?? '',
    system_prompt: row.system_prompt ?? '',
    user_prompt: row.user_prompt,
    status: row.status,
    category: row.category ?? '',
    output_format: row.output_format,
    requires_review: row.requires_review,
    offer_in_module: row.offered_in_module,
  };
}

export function AiStackPromptsScreen({ module }: { module: AiStackModule }) {
  const [options, setOptions] = useState<AiTemplateOptions | null>(null);
  const [rows, setRows] = useState<AiTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [token, setToken] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchTemplateOptions()
      .then((next) => {
        if (!cancelled) setOptions(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'The request failed.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchTemplates(module.key)
      .then((next) => {
        if (cancelled) return;
        setRows(next.templates.filter((row) => row.kind === 'prompt'));
        setError('');
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'The request failed.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, module.key]);

  const patch = (changes: Partial<FormState>) =>
    setForm((current) => (current ? { ...current, ...changes } : current));

  /** The variables the backend says a prompt may use, and which ground an answer. */
  const variables = useMemo(() => options?.variables ?? [], [options]);
  const grounding = useMemo(() => new Set(options?.grounding_variables ?? []), [options]);

  const runPreview = async () => {
    if (!form) return;

    setPreviewing(true);
    setError('');

    try {
      setPreview(
        await previewTemplate({
          system_prompt: form.system_prompt.trim() === '' ? null : form.system_prompt,
          user_prompt: form.user_prompt,
          // Sample rows shaped like this module's, rather than the endpoint's default set.
          // A hostel prompt previewed against fee rows tells the author nothing.
          module_key: module.key,
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The preview failed.');
    } finally {
      setPreviewing(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() === '' ? null : form.description.trim(),
      module_key: module.key,
      kind: 'prompt' as const,
      status: form.status,
      system_prompt: form.system_prompt.trim() === '' ? null : form.system_prompt,
      user_prompt: form.user_prompt,
      category: form.category.trim() === '' ? null : form.category.trim(),
      output_format: form.output_format,
      requires_review: form.requires_review,
      offer_in_module: form.offer_in_module,
    };

    try {
      if (form.id === null) {
        await createTemplate(payload);
        setNotice(`${module.label} prompt saved.`);
      } else {
        const result = await updateTemplate(form.id, payload);
        setNotice(
          result.action === 'forked' || form.forks
            ? 'Saved as this institute’s own copy. The shared platform prompt is unchanged.'
            : `${module.label} prompt updated.`,
        );
      }

      setForm(null);
      setPreview(null);
      // The screens that resolve a prompt for an operation cache the published set for the
      // lifetime of the page. Dropping it here means the prompt just published is the one
      // the next draft uses, rather than the one that was published when the tab opened.
      refreshModuleAiStack(module.key);
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    } finally {
      setSaving(false);
    }
  };

  const retire = async (row: AiTemplateRow) => {
    if (!window.confirm(`Retire "${row.name}"? ${module.label} AI will stop using it.`)) return;

    try {
      await retireTemplate(row.id);
      setNotice('Prompt retired.');
      refreshModuleAiStack(module.key);
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    }
  };

  if (loading && rows.length === 0 && !error) {
    return <AiStackLoading label={`Loading ${module.label} prompts…`} />;
  }

  return (
    <section className="space-y-5">
      <AiStackHeader
        icon={Terminal}
        title={`${module.label} prompts`}
        summary={`The text sent to a model behind each ${module.label} AI feature. Versioned, editable, and never compiled into the app.`}
        loading={loading}
        onRefresh={reload}
        actions={
          <button
            type="button"
            onClick={() => {
              setForm(blankForm(module, options));
              setPreview(null);
              setNotice('');
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white hover:opacity-95"
          >
            <Plus className="size-4" />
            New prompt
          </button>
        }
      />

      <AiStackHint>
        A prompt is text a model reads; it cannot state a figure on its own authority. Anything that has to print
        real records belongs on the <strong>Templates</strong> tab, where {module.copy.reportCanPrint}
      </AiStackHint>

      {notice && <AiStackNotice>{notice}</AiStackNotice>}
      {error && <AiStackError onRetry={reload}>{error}</AiStackError>}

      {rows.length === 0 && !loading ? (
        <AiStackEmpty
          icon={Terminal}
          title={`No ${module.label} prompts yet`}
          action={
            <button
              type="button"
              onClick={() => setForm(blankForm(module, options))}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white hover:opacity-95"
            >
              <Plus className="size-4" />
              New prompt
            </button>
          }
        >
          {module.label} AI features fall back to their built-in wording until a prompt exists here.
        </AiStackEmpty>
      ) : (
        <AiStackCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
              <AiStackTableHead
                columns={[
                  'Prompt',
                  'Grounding',
                  'Version',
                  'Review',
                  `In ${module.label}`,
                  'Status',
                  'Updated',
                  'Actions',
                ]}
              />
              <tbody className="divide-y divide-slate-200">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium text-slate-900">
                        {row.name}
                        {row.is_platform && <AiStackPill tone="blue">platform</AiStackPill>}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-500">{row.template_key}</div>
                      {row.description && (
                        <div className="mt-1 max-w-md text-xs leading-5 text-slate-500">{row.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.grounding_variables.length ? (
                        <div className="flex max-w-[14rem] flex-wrap gap-1">
                          {row.grounding_variables.map((variable) => (
                            <span
                              key={variable}
                              className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] text-emerald-800"
                            >
                              {variable}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-amber-700">none — answers rest on nothing</span>
                      )}
                      {row.unresolvable_variables.length > 0 && (
                        <div className="mt-1 flex items-start gap-1 text-[11px] leading-4 text-amber-700">
                          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                          <span>
                            unresolved: <span className="font-mono">{row.unresolvable_variables.join(', ')}</span>
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-600">v{row.version}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {row.requires_review ? 'A person reviews' : <span className="text-slate-400">Not required</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {row.offered_in_module ? (
                        <span className="font-medium text-emerald-700">Offered</span>
                      ) : (
                        <span className="text-slate-500">Not offered</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <AiStackPill
                        tone={row.status === 'published' ? 'green' : row.status === 'draft' ? 'amber' : 'gray'}
                      >
                        {row.status}
                      </AiStackPill>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatWhen(row.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setForm(formFrom(row));
                            setPreview(null);
                            setNotice('');
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-900 hover:bg-slate-50"
                        >
                          {row.editable_in_place ? <Pencil className="size-3.5" /> : <Copy className="size-3.5" />}
                          {row.editable_in_place ? 'Edit' : 'Customise'}
                        </button>
                        {row.status !== 'archived' && row.editable_in_place && (
                          <button
                            type="button"
                            onClick={() => void retire(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            <Trash2 className="size-3.5" />
                            Retire
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AiStackCard>
      )}

      {form && (
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">
              {form.id === null
                ? `New ${module.label} prompt`
                : form.forks
                  ? 'Customise for this institute'
                  : `Edit ${module.label} prompt`}
            </h3>
            <button
              type="button"
              onClick={() => {
                setForm(null);
                setPreview(null);
              }}
              className="rounded-lg p-1 text-slate-500 hover:text-slate-900"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          {form.forks && (
            <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
              This is a shared platform prompt. Saving writes <strong>this institute its own copy</strong> — every
              other school keeps the original.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-900">Module Name *</span>
              {/* Fixed, and shown rather than hidden: this screen exists to manage this
                  module's prompts, and a module selector here would offer one option. */}
              <input
                value={module.label}
                readOnly
                className="mt-1 h-10 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-900">Prompt title *</span>
              <input
                value={form.name}
                onChange={(event) => patch({ name: event.target.value })}
                required
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
          </div>

          {/* A real <label htmlFor> rather than a wrapper: the assistant's trigger is a
              button, and a button inside a <label> also toggles the label's control. */}
          <div className="block">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={`${module.key}-prompt-description`} className="text-sm font-medium text-slate-900">
                What it is for
              </label>
              <AiFieldAssistant
                value={form.description}
                onApply={(next) => patch({ description: next })}
                fieldType="description"
                label="What it is for"
                module={module.key}
                page="AI Stack — Prompts"
                entityType={`${module.key}_ai_prompt`}
                related={{ Prompt: form.name }}
              />
            </div>
            <input
              id={`${module.key}-prompt-description`}
              value={form.description}
              onChange={(event) => patch({ description: event.target.value })}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="block">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={`${module.key}-prompt-system`} className="text-sm font-medium text-slate-900">
                System prompt
              </label>
              <AiFieldAssistant
                value={form.system_prompt}
                onApply={(next) => patch({ system_prompt: next })}
                fieldType="instructions"
                label="System prompt"
                module={module.key}
                page="AI Stack — Prompts"
                entityType={`${module.key}_ai_prompt`}
                related={{ Prompt: form.name }}
              />
            </div>
            <textarea
              id={`${module.key}-prompt-system`}
              value={form.system_prompt}
              onChange={(event) => patch({ system_prompt: event.target.value })}
              rows={4}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs leading-5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <span className="mt-1 block text-xs text-slate-500">
              The standing instruction — how to behave, and what not to invent.
            </span>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-900">User prompt *</span>
            <textarea
              value={form.user_prompt}
              onChange={(event) => patch({ user_prompt: event.target.value })}
              rows={7}
              required
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs leading-5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <span className="mt-1 block text-xs text-slate-500">{PLACEHOLDER_HINT}</span>
          </label>

          {variables.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Variables available</p>
              <p className="mt-1 text-xs text-slate-500">
                Click one to insert it. Green variables carry the {module.label} data a grounded answer has to rest
                on — a prompt with none of them is refused before a model is called.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {variables.map((variable) => (
                  <button
                    key={variable.key}
                    type="button"
                    title={variable.description}
                    onClick={() => patch({ user_prompt: `${form.user_prompt}{{${variable.key}}}` })}
                    className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${
                      grounding.has(variable.key) || variable.grounding
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {variable.key}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-900">Status</span>
              <select
                value={form.status}
                onChange={(event) => patch({ status: event.target.value })}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                {(options?.statuses ?? ['draft', 'published', 'archived']).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">Only a published prompt is used.</span>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-900">Output format</span>
              <select
                value={form.output_format}
                onChange={(event) => patch({ output_format: event.target.value })}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                {(options?.output_formats ?? ['text']).map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-900">Category</span>
              <input
                value={form.category}
                onChange={(event) => patch({ category: event.target.value })}
                list={`${module.key}-prompt-categories`}
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <datalist id={`${module.key}-prompt-categories`}>
                {(options?.categories ?? []).map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
              <input
                type="checkbox"
                checked={form.requires_review}
                onChange={(event) => patch({ requires_review: event.target.checked })}
                className="mt-0.5 size-4 shrink-0 accent-blue-600"
              />
              <span>
                A person reviews the output
                <span className="mt-0.5 block text-xs text-slate-500">
                  Nothing generated by this prompt is used until somebody reads it. Leave this on for anything a
                  family will receive.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
              <input
                type="checkbox"
                checked={form.offer_in_module}
                onChange={(event) => patch({ offer_in_module: event.target.checked })}
                className="mt-0.5 size-4 shrink-0 accent-blue-600"
              />
              <span>
                Offer this prompt in the {module.label} AI panel
                <span className="mt-0.5 block text-xs text-slate-500">
                  It appears as a suggestion when somebody opens the assistant from a {module.label} page.
                </span>
              </span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save
            </button>
            <button
              type="button"
              onClick={() => void runPreview()}
              disabled={previewing || form.user_prompt.trim() === ''}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
            >
              {previewing ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
              Preview
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(null);
                setPreview(null);
              }}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>

          {preview && <PreviewPanel preview={preview} />}
        </form>
      )}
    </section>
  );
}

/**
 * The prompts as a model would receive them, with sample values substituted.
 *
 * No model is called and nothing is stored — this answers "did my placeholder land where I
 * meant it to", which is a question about the text.
 */
function PreviewPanel({ preview }: { preview: TemplatePreview }) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        Preview — rendered with sample values. No model was called.
      </p>

      {preview.unresolved.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Nothing fills <span className="font-mono">{preview.unresolved.join(', ')}</span>, so each reaches the
            model as literal text.
          </span>
        </p>
      )}

      {preview.system && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">System</p>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 font-mono text-[11px] leading-5 text-slate-800">
            {preview.system}
          </pre>
        </div>
      )}

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">User</p>
        <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 font-mono text-[11px] leading-5 text-slate-800">
          {preview.user}
        </pre>
      </div>
    </div>
  );
}
