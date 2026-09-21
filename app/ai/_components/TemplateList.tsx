'use client';

/**
 * The Template Management listing — module selector, table, and links out.
 *
 * WHAT CHANGED AND WHY
 *
 * This screen used to carry the editor and the read-only detail inline, so opening
 * either pushed the table down the page and a half-finished edit was lost the moment
 * the module selector changed. Both now live on their own routes, and this file keeps
 * only what a listing is for: choose a module, see what it has, go somewhere.
 *
 * That also makes the two actions bookmarkable and linkable — `/ai/prompts/12` is a
 * template somebody can send to a colleague, which a panel rendered under a table
 * never was.
 *
 * THE MODULE IS STILL A VALUE, NOT A BRANCH
 *
 * Selecting Competency Management and selecting Talent Management run the same fetch with a different
 * `module_key` and render the same table. The module list comes from `ai_modules` via
 * `/templates/options`, so a module added there appears here with no change to this
 * file — unchanged by the split into pages.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, Eye, Loader2, Lock, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';

import {
  fetchTemplateOptions,
  fetchTemplates,
  retireTemplate,
  type AiTemplateIndex,
  type AiTemplateOptions,
  type AiTemplateRow,
} from '@/lib/intelligence/ai-templates';
import { describeAiError } from '@/lib/intelligence/client';

/**
 * The selected module is kept here rather than in the URL.
 *
 * It is a view preference, not an address — and putting it in the query string would
 * mean every View and Edit link had to carry it forward to come back to the same
 * filter, which is four places to forget it. `returnTo` on the sub-pages handles the
 * round trip instead.
 */
export function TemplateList() {
  const [options, setOptions] = useState<AiTemplateOptions | null>(null);
  const [index, setIndex] = useState<AiTemplateIndex | null>(null);
  const [moduleKey, setModuleKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * The spinner is raised by whatever asked for the data, not by the effect that
   * fetches it — `react-hooks/set-state-in-effect` objects to the latter, and the
   * initial load needs no raise because `loading` starts true.
   */
  const reload = useCallback(() => {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

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

  useEffect(() => {
    let cancelled = false;

    fetchTemplates(moduleKey || null)
      .then((next) => {
        if (cancelled) return;
        setIndex(next);
        setError('');
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(describeAiError(cause));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [moduleKey, reloadToken]);

  const selectedLabel = useMemo(() => {
    if (!moduleKey) return 'All modules';

    return options?.modules.find((module) => module.key === moduleKey)?.label ?? moduleKey;
  }, [moduleKey, options]);

  const retire = async (row: AiTemplateRow) => {
    if (!window.confirm(`Retire "${row.name}"? It will stop being offered in ${row.module_label}.`)) {
      return;
    }

    try {
      await retireTemplate(row.id);
      setNotice('Template retired.');
      reload();
    } catch (cause) {
      setError(describeAiError(cause));
    }
  };

  const templates = index?.templates ?? [];

  return (
    <section className="mt-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Template management</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            AI templates for every module, written and stored in one place. A published template
            bound to a module is offered by that module&rsquo;s AI panel automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href={moduleKey ? `/ai/prompts/new?module=${encodeURIComponent(moduleKey)}` : '/ai/prompts/new'}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-95"
          >
            <Plus className="size-3.5" />
            Add template
          </Link>
        </div>
      </header>

      <div className="mt-5 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-[16rem] flex-1 space-y-1 text-sm">
            <span className="font-medium text-foreground">Module</span>
            <select
              value={moduleKey}
              onChange={(event) => {
                setLoading(true);
                setModuleKey(event.target.value);
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            >
              <option value="">All modules</option>
              {(options?.modules ?? []).map((module) => (
                <option key={module.key} value={module.key}>
                  {module.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-center gap-2 pb-1 text-xs text-muted-foreground">
            <Stat label="Templates" value={index?.counts.total ?? 0} />
            <Stat label="Published" value={index?.counts.published ?? 0} />
            <Stat label="Live in module" value={index?.counts.offered ?? 0} />
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {moduleKey
            ? options?.modules.find((module) => module.key === moduleKey)?.description ??
              `Templates filed under ${selectedLabel}.`
            : 'Every template this organisation can see. Pick a module to narrow the list and to file new templates there.'}
        </p>
      </div>

      {notice && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <Check className="mt-0.5 size-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <thead>
            <tr>
              {['Template', 'Module', 'Status', 'In module', 'Version', 'Actions'].map((heading) => (
                <th
                  key={heading}
                  className="whitespace-nowrap border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && templates.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline size-4 animate-spin" />
                  Loading templates…
                </td>
              </tr>
            )}

            {!loading && templates.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No templates for {selectedLabel} yet.{' '}
                  <Link href="/ai/prompts/new" className="font-medium text-primary hover:underline">
                    Create the first one.
                  </Link>
                </td>
              </tr>
            )}

            {templates.map((row) => (
              <tr key={row.id} className="align-top">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Link href={`/ai/prompts/${row.id}`} className="hover:underline">
                      {row.name}
                    </Link>
                    {row.is_platform && (
                      <span
                        title="A platform template shared by every organisation. Editing it saves this organisation its own copy."
                        className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-indigo-700"
                      >
                        <Lock className="size-2.5" />
                        Platform
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{row.template_key}</span>
                    {/* The category the author filed it under, where they set one. It
                        is the only thing on this row that says what the template is
                        FOR rather than where it lives. */}
                    {row.category && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800">
                        {row.category.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{row.module_label}</td>
                <td className="px-3 py-3">
                  <StatusPill status={row.status} />
                </td>
                <td className="px-3 py-3">
                  {row.offered_in_module ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <Check className="size-3.5" />
                      Offered
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not offered</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums text-muted-foreground">v{row.version}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/ai/prompts/${row.id}`}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      <Eye className="size-3.5" />
                      View
                    </Link>
                    <Link
                      href={`/ai/prompts/${row.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      <Pencil className="size-3.5" />
                      {row.editable_in_place ? 'Edit' : 'Customise'}
                    </Link>
                    {row.editable_in_place && row.status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => void retire(row)}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
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
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-md border border-border bg-background px-2.5 py-1.5">
      <span className="font-semibold tabular-nums text-foreground">{value}</span> {label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'published'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'draft'
        ? 'bg-amber-100 text-amber-900'
        : 'bg-slate-200 text-slate-700';

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium capitalize ${tone}`}>
      {status}
    </span>
  );
}
