'use client';

/**
 * AI Stack → Templates, for any module.
 *
 * The module's own report layouts, and the place a report is actually built from one.
 * Decentralised in the sense that matters to the person using it — it lives in the module,
 * it only ever shows that module's templates, and creating one here cannot file it against
 * another module — while still being the same concept, the same store and the same API as
 * the central screen under AI & Intelligence. There is no second template system: a
 * template written here is an `ai_templates` row carrying this module's key, which is
 * exactly what the central screen would have written and exactly what the report generator
 * already resolves.
 *
 * A LAYOUT IS NOT A PROMPT, AND THAT IS THE POINT
 *
 * Every placeholder in a layout is filled by substitution from rows the bound read tool
 * returned. No model sees the figures. The data source list is filtered to this module's
 * tools and the backend only ever offers tools annotated `read_only`, so a layout cannot
 * be bound to something that changes a record.
 *
 * WHICH LAYOUT THE MODULE ACTUALLY RENDERS WITH
 *
 * `ReportTemplateResolver` picks ONE layout per module — this school's own row first, then
 * the highest version — so with more than one published layout, only one of them is what
 * "Build report" produces. That is not obvious from a list of equals, so the table below
 * marks it.
 *
 * WHY PREVIEW, PRINT AND SEND ARE NOT HERE
 *
 * They already exist. Everything a person does with a built report — previewing it,
 * editing the text, refreshing the figures against the live records, printing it and
 * sending it — lives on `/ai-reports/{id}`, which is where the link goes. Rebuilding those
 * five here would be a second implementation of a page that works.
 *
 * WHY EVERY TEMPLATE HERE IS SAVED ESTATE-WIDE
 *
 * A module's layouts are meant to be usable by anyone who opens the module, whatever their
 * `sub_institute_id`. So every save from this screen sets `shared`, which writes the row
 * with no `sub_institute_id` — the platform baseline every school resolves. The central
 * screen still defaults to school-scoped saves; this is one of the places that opts in,
 * and the banner says so rather than leaving it to be discovered.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, FileText, Loader2, Pencil, Play, Plus, Save, Trash2, X } from 'lucide-react';

import { AiFieldAssistant } from '@/components/ai/AiFieldAssistant';
import { TemplateHtmlEditor } from './adapters/template-html-editor';
import {
  createTemplate,
  fetchTemplateOptions,
  fetchTemplates,
  retireTemplate,
  updateTemplate,
  type AiTemplateOptions,
  type AiTemplateRow,
} from '@/lib/intelligence/ai-templates';
import { generateReportForContext, type WorkspaceReport } from '@/lib/intelligence/workspace';
import {
  logModuleOperation,
  readModuleWorkspaceSession,
  refreshModuleAiStack,
} from '@/lib/module-ai/module-ai-stack';

import {
  AiStackCard,
  AiStackCardHeading,
  AiStackError,
  AiStackHeader,
  AiStackHint,
  AiStackNotice,
  AiStackPill,
  AiStackTableHead,
  formatWhen,
} from './ai-stack-chrome';
import type { AiStackModule, AiStackReportFilter } from './ai-stack-module';

interface FormState {
  id: number | null;
  name: string;
  description: string;
  data_source: string;
  html_layout: string;
  status: string;
  version: number;
  offer_in_module: boolean;
}

function blankForm(module: AiStackModule, defaultSource: string): FormState {
  return {
    id: null,
    name: `${module.label} report`,
    description: `The ${module.records} on file for this institute and academic year.`,
    data_source: defaultSource,
    // Deliberately empty rather than a starter table of invented columns. The published
    // platform layout for this module is already a working example, and it is one row down
    // the table with an Edit button on it — offering a second, guessed-at one here is how a
    // layout ends up naming a field the tool does not return.
    html_layout: '',
    status: 'draft',
    version: 1,
    offer_in_module: true,
  };
}

function formFrom(row: AiTemplateRow): FormState {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    data_source: row.data_source ?? '',
    html_layout: row.html_layout ?? '',
    status: row.status,
    version: row.version,
    offer_in_module: row.offered_in_module,
  };
}

/**
 * The layout a report is actually built with, by the backend's own rule.
 *
 * Mirrors `ReportTemplateResolver::find()`: published, has a layout, this school's own row
 * before the platform baseline, then highest version. Computed rather than guessed so the
 * badge cannot say one thing while the generator does another.
 */
function resolveActiveLayout(rows: AiTemplateRow[]): AiTemplateRow | null {
  const candidates = rows.filter((row) => row.status === 'published' && (row.html_layout ?? '').trim() !== '');

  if (candidates.length === 0) return null;

  return [...candidates].sort((a, b) => {
    const ownership = Number(a.sub_institute_id === null) - Number(b.sub_institute_id === null);
    if (ownership !== 0) return ownership;
    return b.version - a.version;
  })[0];
}

export function AiStackTemplatesScreen({ module }: { module: AiStackModule }) {
  const [options, setOptions] = useState<AiTemplateOptions | null>(null);
  const [rows, setRows] = useState<AiTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
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
        // Report layouts only. A prompt is a different thing managed on the Prompts tab,
        // and mixing the two in one list is how an author edits the wrong one.
        setRows(next.templates.filter((row) => row.kind === 'report'));
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

  /** This module's data sources only — this screen never offers another module's tools. */
  const sources = useMemo(
    () => (options?.data_sources ?? []).filter((source) => source.module === module.key || source.rolls_up_to === module.key),
    [options, module.key],
  );

  const activeLayout = useMemo(() => resolveActiveLayout(rows), [rows]);

  const branding = options?.branding;
  const heading = branding?.institute_name ?? module.label;

  const patch = (changes: Partial<FormState>) =>
    setForm((current) => (current ? { ...current, ...changes } : current));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      module_key: module.key,
      kind: 'report' as const,
      html_layout: form.html_layout,
      data_source: form.data_source,
      status: form.status,
      user_prompt: '',
      offer_in_module: form.offer_in_module,
      // Every layout here serves the whole estate — see the note at the top.
      shared: true,
    };

    try {
      if (form.id === null) {
        await createTemplate(payload);
        setNotice(`${module.label} template saved.`);
      } else {
        await updateTemplate(form.id, payload);
        setNotice(`${module.label} template updated.`);
      }

      setForm(null);
      refreshModuleAiStack(module.key);
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    } finally {
      setSaving(false);
    }
  };

  const retire = async (row: AiTemplateRow) => {
    if (!window.confirm(`Retire "${row.name}"? The ${module.label} module will stop offering it.`)) return;

    try {
      await retireTemplate(row.id);
      setNotice('Template retired.');
      refreshModuleAiStack(module.key);
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    }
  };

  return (
    <section className="space-y-5">
      {/* Letterhead. Name and logo are the school's own, read from its own records —
          this component contains neither. */}
      <AiStackHeader
        icon={FileText}
        title={heading}
        summary={`${module.label} template management — the report designs this module fills from the ${module.records}.`}
        loading={loading}
        onRefresh={reload}
        actions={
          <button
            type="button"
            onClick={() => {
              setForm(blankForm(module, sources[0]?.name ?? module.report.defaultDataSource));
              setNotice('');
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white hover:opacity-95"
          >
            <Plus className="size-4" />
            New template
          </button>
        }
      />

      <AiStackHint>
        Templates saved here are available to <strong>every institute</strong> that opens the {module.label} module,
        not just this one. Only one published layout is the one a report is built with — the table marks it.
      </AiStackHint>

      {notice && <AiStackNotice>{notice}</AiStackNotice>}
      {error && <AiStackError onRetry={reload}>{error}</AiStackError>}

      <BuildReportPanel module={module} activeLayout={activeLayout} onError={setError} />

      <AiStackCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
            <AiStackTableHead
              columns={['Template', 'Data source', 'Version', 'Status', `In ${module.label}`, 'Updated', 'Actions']}
            />
            <tbody className="divide-y divide-slate-200">
              {loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    <Loader2 className="mr-2 inline size-4 animate-spin" />
                    Loading {module.label} templates…
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    No {module.label} templates yet. Until one is published, a report is built as a plain table of
                    whatever <span className="font-mono">{module.report.defaultDataSource}</span> returns.
                  </td>
                </tr>
              )}

              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                      <FileText className="size-4 shrink-0 text-slate-400" />
                      {row.name}
                      {activeLayout?.id === row.id && <AiStackPill tone="green">builds reports</AiStackPill>}
                      {row.is_platform && <AiStackPill tone="blue">platform</AiStackPill>}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-500">{row.template_key}</div>
                    {row.description && <div className="mt-1 max-w-md text-xs text-slate-500">{row.description}</div>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
                    {row.data_source ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-slate-600">v{row.version}</td>
                  <td className="px-4 py-3">
                    <AiStackPill tone={row.status === 'published' ? 'green' : row.status === 'draft' ? 'amber' : 'gray'}>
                      {row.status}
                    </AiStackPill>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {row.offered_in_module ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                        <Check className="size-3.5" />
                        Offered
                      </span>
                    ) : (
                      <span className="text-slate-500">Not offered</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatWhen(row.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setForm(formFrom(row));
                          setNotice('');
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-900 hover:bg-slate-50"
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </button>
                      {row.status !== 'archived' && (
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

      {form && (
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">
              {form.id === null ? `New ${module.label} template` : `Edit ${module.label} template`}
            </h3>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-lg p-1 text-slate-500 hover:text-slate-900"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-900">Module Name *</span>
              {/* Fixed, and shown rather than hidden: this screen exists to manage this
                  module's templates, and a module selector would offer one option. */}
              <input
                value={module.label}
                readOnly
                className="mt-1 h-10 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-900">Template Title *</span>
              <input
                value={form.name}
                onChange={(event) => patch({ name: event.target.value })}
                required
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
          </div>

          {/* A real <label htmlFor> rather than a wrapper, because the assistant's trigger
              is a button and a button inside a <label> also toggles the label's control. */}
          <div className="block">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={`${module.key}-template-description`} className="text-sm font-medium text-slate-900">
                What it is for
              </label>
              <AiFieldAssistant
                value={form.description}
                onApply={(next) => patch({ description: next })}
                fieldType="description"
                label="What it is for"
                module={module.key}
                page="AI Stack — Templates"
                entityType={`${module.key}_ai_template`}
                related={{ Template: form.name }}
              />
            </div>
            <input
              id={`${module.key}-template-description`}
              value={form.description}
              onChange={(event) => patch({ description: event.target.value })}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-900">{module.label} data source *</span>
              <select
                value={form.data_source}
                onChange={(event) => patch({ data_source: event.target.value })}
                required
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select…</option>
                {sources.map((source) => (
                  <option key={source.name} value={source.name}>
                    {source.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">
                {sources.find((source) => source.name === form.data_source)?.description ??
                  `Where the live ${module.records} come from. Read-only tools only.`}
              </span>
            </label>

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
              <span className="mt-1 block text-xs text-slate-500">
                Only a published template is used. With more than one published, the highest version builds reports.
              </span>
            </label>
          </div>

          <div>
            <span className="text-sm font-medium text-slate-900">Report layout *</span>
            <TemplateHtmlEditor
              value={form.html_layout}
              onChange={(html) => patch({ html_layout: html })}
              tags={(options?.report_placeholders ?? []).map((placeholder) => ({
                key: placeholder.key,
                label: placeholder.label,
              }))}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-900">
            <input
              type="checkbox"
              checked={form.offer_in_module}
              onChange={(event) => patch({ offer_in_module: event.target.checked })}
              className="size-4 accent-blue-600"
            />
            Offer this template in the {module.label} AI panel
          </label>

          <div className="flex gap-2 pt-1">
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
              onClick={() => setForm(null)}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/**
 * Build a report from the live records, and hand over the link that previews, edits,
 * refreshes, prints and sends it.
 *
 * The filters are the arguments the bound read tool accepts, and nothing else — they come
 * from the module's descriptor, which took them from the tool's own schema. They narrow
 * what the school itself can already see: the institute and the academic year come from
 * the bearer token on the backend and are not parameters this form could widen even if it
 * tried.
 */
function BuildReportPanel({
  module,
  activeLayout,
  onError,
}: {
  module: AiStackModule;
  activeLayout: AiTemplateRow | null;
  onError: (message: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => initialValues(module.report.filters));
  const [building, setBuilding] = useState(false);
  const [report, setReport] = useState<WorkspaceReport | null>(null);
  const [emptyNote, setEmptyNote] = useState('');

  const build = async () => {
    setBuilding(true);
    setReport(null);
    setEmptyNote('');
    onError('');

    const argumentsGiven: Record<string, unknown> = {};

    for (const filter of module.report.filters) {
      const value = values[filter.key];

      if (filter.kind === 'boolean') {
        // Always sent, because the published layout's own default is a value and leaving
        // it out would silently mean that default when the operator had changed the box.
        argumentsGiven[filter.key] = value === true;
        continue;
      }

      const text = String(value ?? '').trim();
      if (text === '') continue;

      if (filter.kind === 'number') {
        const parsed = Number(text);
        if (Number.isInteger(parsed) && parsed > 0) argumentsGiven[filter.key] = parsed;
        continue;
      }

      argumentsGiven[filter.key] = text;
    }

    try {
      const result = await generateReportForContext(readModuleWorkspaceSession(), {
        route: module.route,
        arguments: argumentsGiven,
      });

      // `row_count: 0` comes back as a success with no link, because an empty result is an
      // answer and not a document. Saying so is better than opening a blank report.
      if (!result.template_link || result.row_count === 0) {
        setEmptyNote(module.report.emptyNote);
        return;
      }

      setReport(result);
      logModuleOperation(module, module.report.operation, {
        message: `Built "${result.title}" from ${result.row_count} ${module.record} record(s).`,
        reference: result.title,
        tool: result.source_tool,
        result: {
          row_count: result.row_count,
          layout: result.layout_name,
          filters: argumentsGiven,
        },
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The report could not be built.';
      onError(message);
      // Recorded as a failure rather than swallowed: a build that was refused is a thing
      // the Activity tab should show, and it is the only place the reason survives.
      logModuleOperation(module, module.report.operation, { status: 'failed', message });
    } finally {
      setBuilding(false);
    }
  };

  return (
    <AiStackCard>
      <AiStackCardHeading
        title="Build a report"
        hint={
          activeLayout
            ? `Filled from the live ${module.records} using the "${activeLayout.name}" layout.`
            : 'No published layout yet — publish one above and this builds the plain table instead.'
        }
      />

      <div className="grid gap-3 p-5 sm:grid-cols-4">
        {module.report.filters.map((filter) =>
          filter.kind === 'boolean' ? (
            <label key={filter.key} className="flex items-end gap-2 pb-1 text-sm text-slate-900">
              <input
                type="checkbox"
                checked={values[filter.key] === true}
                onChange={(event) => setValues((current) => ({ ...current, [filter.key]: event.target.checked }))}
                className="size-4 accent-blue-600"
              />
              <span>
                {filter.label}
                {filter.hint && (
                  <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{filter.hint}</span>
                )}
              </span>
            </label>
          ) : (
            <label key={filter.key} className="block">
              <span className="text-xs font-medium text-slate-700">{filter.label}</span>
              <input
                value={String(values[filter.key] ?? '')}
                onChange={(event) => setValues((current) => ({ ...current, [filter.key]: event.target.value }))}
                inputMode={filter.kind === 'number' ? 'numeric' : 'text'}
                placeholder={filter.placeholder}
                className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
              />
              {filter.hint && <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{filter.hint}</span>}
            </label>
          ),
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-4">
        <button
          type="button"
          onClick={() => void build()}
          disabled={building}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {building ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Build report
        </button>

        <p className="text-xs text-slate-500">
          The institute and academic year come from your session, not from this form.
        </p>
      </div>

      {emptyNote && (
        <p className="mx-5 mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
          {emptyNote}
        </p>
      )}

      {report && (
        <div className="mx-5 mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-medium">{report.title}</p>
          <p className="mt-0.5 text-xs">
            {report.row_count} row(s) read through{' '}
            <span className="font-mono">{report.source_tool ?? 'the module'}</span>
            {report.layout_name ? ` into the "${report.layout_name}" layout` : ''}.
          </p>
          <a
            href={report.template_link ?? undefined}
            className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Open to preview, edit, print or send
          </a>
        </div>
      )}
    </AiStackCard>
  );
}

function initialValues(filters: AiStackReportFilter[]): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};

  for (const filter of filters) {
    values[filter.key] = filter.defaultValue ?? (filter.kind === 'boolean' ? false : '');
  }

  return values;
}
