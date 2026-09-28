'use client';

/**
 * AI Stack → Knowledge Base, for any module.
 *
 * The material the AI is allowed to draw on when it answers a question about this module,
 * and proof that each source actually answers.
 *
 * WHAT A "KNOWLEDGE SOURCE" IS HERE
 *
 * Not a folder of uploaded files. For a module it is a read-only MCP tool, because that is
 * what the assistant really reads when somebody asks a question on one of its pages. Those
 * tools already carry the tenant scoping, the academic-year filter, the joins and the rule
 * that a filter naming something the school does not have returns nothing rather than
 * everything — all of which the rest of the platform was built on.
 * `ReportDataSourceCatalog` in Laravel lists them from the tool registry itself, so the
 * catalogue on this screen is derived, not maintained: register a tool in the backend and
 * it appears here with no edit to this file.
 *
 * READ-ONLY BY CONSTRUCTION
 *
 * The backend filters the catalogue on each tool's own `read_only` annotation. A knowledge
 * source that changed records when it was read would mean opening a report altered the
 * thing it was reporting on.
 *
 * WHY THERE IS A CHECK BUTTON
 *
 * A source can be registered, bound to a template, and still return nothing for this
 * school — wrong academic year, nothing recorded yet, a permission the signed-in user
 * lacks. That is invisible on an inventory and obvious the moment you call it. Check runs
 * the real tool through the existing `/api/mcp/tools/call` proxy, as the signed-in user,
 * and reports what came back. It reads; it writes nothing.
 *
 * NOTHING IS SEEDED INTO THIS TAB. There is no sample document and no fabricated policy.
 * An estate that has indexed nothing is told exactly that, because a knowledge base padded
 * with invented material is worse than an empty one — it looks authoritative and it is not.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookMarked, CheckCircle2, Database, FileText, Loader2, PlayCircle, XCircle } from 'lucide-react';

import { fetchCapability, type CapabilityDetail } from '@/lib/intelligence/ai-capabilities';
import {
  fetchTemplateOptions,
  fetchTemplates,
  type AiTemplateOptions,
  type AiTemplateRow,
  type TemplateDataSource,
} from '@/lib/intelligence/ai-templates';
import { readModuleWorkspaceSession } from '@/lib/module-ai/module-ai-stack';

import {
  AiStackCard,
  AiStackCardHeading,
  AiStackEmpty,
  AiStackError,
  AiStackHeader,
  AiStackHint,
  AiStackLoading,
  AiStackMetrics,
  AiStackPill,
  AiStackTableHead,
} from './ai-stack-chrome';
import type { AiStackModule } from './ai-stack-module';

/** What one Check produced. Held per source so several can be run independently. */
type CheckResult =
  | { state: 'running' }
  | { state: 'ok'; rows: number | null; detail: string }
  | { state: 'failed'; detail: string };

export function AiStackKnowledgeBaseScreen({ module }: { module: AiStackModule }) {
  const [options, setOptions] = useState<AiTemplateOptions | null>(null);
  const [templates, setTemplates] = useState<AiTemplateRow[]>([]);
  const [documents, setDocuments] = useState<CapabilityDetail | null>(null);
  /** Non-fatal: the document inventory is admin-only, and the rest of the screen stands without it. */
  const [documentsError, setDocumentsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checks, setChecks] = useState<Record<string, CheckResult>>({});
  const [token, setToken] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setChecks({});
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchTemplateOptions(), fetchTemplates(module.key)])
      .then(([nextOptions, index]) => {
        if (cancelled) return;
        setOptions(nextOptions);
        setTemplates(index.templates);
        setError('');
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'The request failed.');
        setLoading(false);
      });

    // Separate, and allowed to fail on its own: `knowledge-rag` is an administrator read.
    // A non-admin still gets the source catalogue rather than an error page.
    fetchCapability('knowledge-rag')
      .then((detail) => {
        if (!cancelled) setDocuments(detail);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setDocumentsError(cause instanceof Error ? cause.message : 'Document inventory unavailable.');
      });

    return () => {
      cancelled = true;
    };
  }, [token, module.key]);

  /** This module's sources only. This screen never lists another module's tools. */
  const sources = useMemo<TemplateDataSource[]>(
    () => (options?.data_sources ?? []).filter((source) => source.module === module.key),
    [options, module.key],
  );

  /** Which of this module's templates read each source — the binding, from the rows. */
  const consumers = useMemo(() => {
    const map = new Map<string, AiTemplateRow[]>();

    for (const template of templates) {
      if (!template.data_source) continue;
      const list = map.get(template.data_source) ?? [];
      list.push(template);
      map.set(template.data_source, list);
    }

    return map;
  }, [templates]);

  const boundCount = useMemo(
    () => sources.filter((source) => (consumers.get(source.name) ?? []).length > 0).length,
    [sources, consumers],
  );

  const check = useCallback(async (source: TemplateDataSource) => {
    setChecks((current) => ({ ...current, [source.name]: { state: 'running' } }));

    const session = readModuleWorkspaceSession();

    try {
      const response = await fetch('/api/mcp/tools/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        cache: 'no-store',
        body: JSON.stringify({
          tool: source.name,
          // No arguments, so a tool with a required argument reports itself as such rather
          // than being called wrongly. A detail tool needs an id and will say so — which is
          // a true and useful thing for this tab to show.
          arguments: {},
          baseUrl: session.baseUrl,
          meta: {
            instituteId: session.instituteId,
            academicYear: session.academicYear,
            termId: session.termId,
          },
        }),
      });

      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (!response.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : `The call failed (${response.status}).`;
        setChecks((current) => ({ ...current, [source.name]: { state: 'failed', detail: message } }));
        return;
      }

      const { rows, detail } = summariseMcpPayload(payload);
      setChecks((current) => ({ ...current, [source.name]: { state: 'ok', rows, detail } }));
    } catch (cause) {
      setChecks((current) => ({
        ...current,
        [source.name]: { state: 'failed', detail: cause instanceof Error ? cause.message : 'The call failed.' },
      }));
    }
  }, []);

  if (loading && !options) {
    return <AiStackLoading label={`Loading ${module.label} knowledge sources…`} />;
  }

  const documentCount = documents?.metrics.find((metric) => metric.key === 'assets')?.value ?? null;
  const evidenceCount = documents?.metrics.find((metric) => metric.key === 'evidence')?.value ?? null;

  return (
    <section className="space-y-5">
      <AiStackHeader
        icon={BookMarked}
        title={`${module.label} knowledge base`}
        summary={`The ${module.records} and documents the AI may draw on when it answers, and whether each one is actually returning data.`}
        loading={loading}
        onRefresh={reload}
      />

      {error && <AiStackError onRetry={reload}>{error}</AiStackError>}

      <AiStackMetrics
        metrics={[
          { key: 'sources', label: `${module.label} sources`, value: sources.length, hint: 'read-only tools' },
          { key: 'bound', label: 'In use', value: boundCount, hint: `read by a ${module.label} template` },
          {
            key: 'templates',
            label: `${module.label} templates`,
            value: templates.length,
            hint: 'prompts and reports',
          },
          {
            key: 'documents',
            label: 'SOP documents',
            value: documentCount ?? '—',
            hint: documentCount === null ? 'not readable by your role' : 'estate-wide',
          },
          {
            key: 'evidence',
            label: 'Evidence records',
            value: evidenceCount ?? '—',
            hint: evidenceCount === null ? 'not readable by your role' : 'what claims rested on',
          },
        ]}
      />

      <AiStackHint>
        Every source below is read-only by construction — the backend filters the catalogue on each tool&apos;s own
        annotation, so a tool that changes a {module.record} record cannot appear here or be bound to a template.
      </AiStackHint>

      {sources.length === 0 ? (
        <AiStackEmpty icon={Database} title={`No ${module.label} knowledge sources registered`}>
          The backend reported no read-only {module.label} tools. Until one is registered, {module.label} AI has no{' '}
          {module.records} to ground an answer in.
        </AiStackEmpty>
      ) : (
        <AiStackCard className="overflow-hidden">
          <AiStackCardHeading
            title={`${module.label} data sources`}
            hint="Each is a governed, read-only tool. Check calls it as you, and writes nothing."
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
              <AiStackTableHead columns={['Source', 'What it returns', 'Arguments', 'Read by', 'Check']} />
              <tbody className="divide-y divide-slate-200">
                {sources.map((source) => {
                  const readers = consumers.get(source.name) ?? [];
                  const result = checks[source.name];

                  return (
                    <tr key={source.name} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-medium text-slate-900">{source.name}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{source.label}</div>
                      </td>
                      <td className="max-w-md px-4 py-3 text-xs leading-5 text-slate-600">{source.description}</td>
                      <td className="px-4 py-3">
                        {source.arguments.length ? (
                          <ul className="space-y-1">
                            {source.arguments.map((argument) => (
                              <li key={argument.key} className="text-[11px] leading-4">
                                <span className="font-mono text-slate-700">{argument.key}</span>
                                <span className="text-slate-400">
                                  {' '}
                                  {argument.type}
                                  {argument.required ? ' · required' : ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-xs text-slate-400">none</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {readers.length ? (
                          <ul className="space-y-1">
                            {readers.map((reader) => (
                              <li key={reader.id} className="flex items-center gap-1.5 text-xs text-slate-700">
                                <FileText className="size-3 shrink-0 text-slate-400" />
                                <span className="truncate">{reader.name}</span>
                                <AiStackPill tone={reader.kind === 'report' ? 'blue' : 'gray'}>
                                  {reader.kind}
                                </AiStackPill>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-xs text-slate-400">nothing yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => void check(source)}
                          disabled={result?.state === 'running'}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {result?.state === 'running' ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <PlayCircle className="size-3.5" />
                          )}
                          Check
                        </button>

                        {result?.state === 'ok' && (
                          <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-4 text-emerald-700">
                            <CheckCircle2 className="mt-0.5 size-3 shrink-0" />
                            <span>
                              {result.rows === null ? 'Answered' : `${result.rows.toLocaleString('en-IN')} row(s)`}
                              {result.detail ? ` · ${result.detail}` : ''}
                            </span>
                          </p>
                        )}

                        {result?.state === 'failed' && (
                          <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-4 text-amber-700">
                            <XCircle className="mt-0.5 size-3 shrink-0" />
                            <span>{result.detail}</span>
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AiStackCard>
      )}

      <AiStackCard className="overflow-hidden">
        <AiStackCardHeading
          title="Indexed documents"
          hint="Knowledge assets from hpbrain_knowledge_assets. Held per organisation, not per module — a document indexed here is visible to the whole organisation's AI."
        />

        {documentsError ? (
          <p className="px-5 py-6 text-sm text-slate-500">{documentsError}</p>
        ) : !documents ? (
          <p className="flex items-center gap-2 px-5 py-6 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Loading the document inventory…
          </p>
        ) : documents.table && documents.table.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <AiStackTableHead columns={documents.table.columns.map((column) => column.label)} />
              <tbody className="divide-y divide-slate-200">
                {documents.table.rows.map((row, index) => (
                  <tr key={index}>
                    {documents.table!.columns.map((column) => (
                      <td key={column.key} className="px-4 py-2.5 text-xs text-slate-600">
                        {row[column.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-slate-500">
            No documents are indexed for this institute yet. {module.label} answers therefore rest entirely on{' '}
            {module.copy.groundedOn}
          </p>
        )}
      </AiStackCard>
    </section>
  );
}

/**
 * Turn an MCP envelope into a row count and a short sentence.
 *
 * Deliberately defensive rather than typed: different tools return their payload under
 * different keys, and this only has to say "it answered, with this much". A shape it does
 * not recognise reports as answered with no count, which is honest — better than claiming
 * zero rows because the count was somewhere else.
 *
 * `count` is read BEFORE any array, and that ordering matters. Every tool in this platform
 * reports `count` as the whole result set before its own limit, while the array beside it
 * is the page. Finding the array first would report a fifty-row page of eight hundred
 * records as "50 rows", which is the number this tab exists to stop people believing.
 */
function summariseMcpPayload(payload: Record<string, unknown> | null): { rows: number | null; detail: string } {
  if (!payload) return { rows: null, detail: '' };

  const result = payload.result as Record<string, unknown> | undefined;
  const data = payload.data as Record<string, unknown> | undefined;

  const error = payload.error ?? result?.error;
  if (typeof error === 'string' && error.trim()) return { rows: null, detail: error };

  for (const source of [payload, data, result]) {
    const count = source?.count ?? source?.total;
    if (typeof count === 'number') {
      const list = firstList(source);
      return {
        rows: count,
        detail: list && list.length !== count ? `${list.length} shown` : '',
      };
    }
  }

  for (const source of [payload, data, result]) {
    const list = firstList(source);
    if (list) {
      const first = list[0];
      const keys = first && typeof first === 'object' ? Object.keys(first as object).slice(0, 4) : [];
      return { rows: list.length, detail: keys.length ? keys.join(', ') : '' };
    }
  }

  return { rows: null, detail: '' };
}

/**
 * The longest array of objects in a payload.
 *
 * A payload often carries several arrays — a list of rows beside a list of unresolved
 * filters. The longest is the answer; the others describe the query, and picking one of
 * those is how a check reports the number of search terms it used.
 */
function firstList(source: Record<string, unknown> | undefined): unknown[] | null {
  if (!source) return null;

  let best: unknown[] | null = null;

  for (const value of Object.values(source)) {
    if (!Array.isArray(value) || value.length === 0) continue;
    if (typeof value[0] !== 'object' || value[0] === null) continue;
    if (!best || value.length > best.length) best = value;
  }

  return best;
}
