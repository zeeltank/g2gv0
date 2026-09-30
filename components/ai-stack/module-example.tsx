'use client'

/**
 * One worked example of this module's AI Stack, run against this module's real records.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS RUNS A TOOL AUTOMATICALLY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The Knowledge Base tab can already "Check" a data source, but only after somebody knows
 * which source to check and presses the button. That answers "does this tool work" for
 * somebody who already understands the tab. It does not answer the question a new
 * operator actually opens this screen with, which is "what does this module's AI get to
 * see, and is there anything there?"
 *
 * So the module's own source is called once, on arrival, and the answer is rendered: the
 * real row count the backend reported, the real rows, and one figure derived from those
 * rows in the browser.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * EVERYTHING HERE IS A RECORD. NOTHING HERE IS AN EXAMPLE OF A RECORD.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No sample rows, no plausible-looking placeholder, no "typical" figure. If the module has
 * records the panel shows the module's records; if it has none, it says so and says what
 * that means. The one thing this component will not do is fill an empty result with
 * something that looks like data — including another module's data.
 *
 * The derivation is deliberately arithmetic rather than a model call. Counting distinct
 * statuses in rows that were just fetched is reproducible, cannot hallucinate, and cannot
 * be wrong in a way a reader cannot check against the table printed under it.
 *
 * WHY REACT-QUERY AND NOT A HAND-ROLLED EFFECT
 *
 * This is a read of an external system, keyed by the module and the source — the exact
 * shape `useSidebarNavigation` and `useBrainResource` already describe. Owning it with
 * `useQuery` rather than `useEffect` + `useState` means the cache, the in-flight state
 * and the error state are the ones the rest of the app already has, and the two modules a
 * user can have open in one session cannot share a result: the key is the module.
 */

import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Database, Loader2, RefreshCw, Table2 } from 'lucide-react'

import { AiStackCard, AiStackCardHeading, AiStackEmpty, AiStackError, AiStackPill } from './ai-stack-chrome'
import { mcpError, mcpRows, summariseMcpPayload, type McpRow } from '@/lib/ai-stack/mcp-payload'
import { readModuleWorkspaceSession } from '@/lib/module-ai/module-ai-stack'
import type { TemplateDataSource } from '@/lib/intelligence/ai-templates'
import type { AiStackModule } from './ai-stack-module'

const PREVIEW_ROWS = 5

/** What one read produced: the backend's own count, and the rows it actually returned. */
type ExampleResult = { rows: McpRow[]; total: number | null; detail: string }

export function AiStackModuleExample({
  module,
  sources,
}: {
  module: AiStackModule
  /** Already filtered to this module by the caller. Never re-filtered here, and never widened. */
  sources: TemplateDataSource[]
}) {
  /*
   * The module's own default source when it is in this module's catalogue, otherwise the
   * first source that can be called with no arguments.
   *
   * `sources` came from the caller already filtered on `module.key`, so a source that is
   * not in that list is not this module's and is never considered — which is what keeps
   * this panel from becoming a way to read another module's tables.
   */
  const source = useMemo(() => {
    const callable = sources.filter((candidate) => !candidate.arguments.some((argument) => argument.required));

    return callable.find((candidate) => candidate.name === module.report.defaultDataSource) ?? callable[0] ?? null;
  }, [sources, module.report.defaultDataSource]);

  const query = useQuery<ExampleResult>({
    // Keyed by module AND source, so two modules open in one session never share a result.
    queryKey: ['ai-stack-module-example', module.key, source?.name ?? null],
    enabled: source !== null,
    // Records change as people use the module, so a revisit should ask again.
    staleTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!source) return { rows: [], total: null, detail: '' };

      const session = readModuleWorkspaceSession();

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
        throw new Error(
          typeof payload?.error === 'string' ? payload.error : `The call failed (${response.status}).`,
        );
      }

      // A tool that reports its own failure in the payload is a failure here too, not an
      // empty result — "this tool is broken" and "this module has no records" are different
      // sentences and the operator needs to be told which one they are looking at.
      const reported = mcpError(payload);
      if (reported) throw new Error(reported);

      const summary = summariseMcpPayload(payload);

      return { rows: mcpRows(payload), total: summary.rows, detail: summary.detail };
    },
  });

  const reread = useCallback(() => {
    void query.refetch();
  }, [query]);

  /* Nothing in this module can be read without arguments. Say that rather than invent a call. */
  if (!source) {
    return (
      <AiStackCard>
        <AiStackCardHeading
          title="A worked example from your records"
          hint={`Run one of ${module.label}'s read-only sources to see what its AI can ground an answer in.`}
        />
        <div className="px-5 py-6">
          <AiStackEmpty icon={Database} title="No source can be run without arguments">
            Every {module.label} source registered against this module needs a value before it will run, so there is
            nothing to call for you. Run one of them from the {module.label} data sources table below with real
            values.
          </AiStackEmpty>
        </div>
      </AiStackCard>
    );
  }

  const result = query.data;
  const summary = result ? breakdownOf(result.rows) : null;

  return (
    <AiStackCard>
      <AiStackCardHeading
        title="A worked example from your records"
        hint={`${source.label}. Run as you, read-only, and written by ${module.label} data only.`}
        actions={
          <button
            type="button"
            onClick={reread}
            disabled={query.isFetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
          >
            {query.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Read again
          </button>
        }
      />

      {query.isError ? (
        <div className="px-5 py-4">
          <AiStackError onRetry={reread}>
            {query.error instanceof Error ? query.error.message : 'The call failed.'}
          </AiStackError>
        </div>
      ) : !result ? (
        <p className="flex items-center gap-2 px-5 py-6 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Reading {module.label} records…
        </p>
      ) : result.rows.length === 0 ? (
        <div className="px-5 py-4">
          <AiStackEmpty icon={Database} title={`No ${module.records} for this organisation yet`}>
            <code className="font-mono text-xs">{source.name}</code> ran successfully and returned nothing.{' '}
            {module.label} AI therefore has no {module.records} to ground an answer in, and this panel will not show
            another module&apos;s rows in its place.
          </AiStackEmpty>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
            <code className="font-mono text-xs text-slate-700">{source.name}</code>
            <AiStackPill tone="blue">
              {result.total === null ? 'answered' : `${result.total.toLocaleString('en-IN')} record(s)`}
            </AiStackPill>
            {result.detail ? <span className="text-[11px] text-slate-500">{result.detail}</span> : null}
            {summary ? (
              <span className="ml-auto text-[11px] text-slate-600">
                <Table2 className="mr-1 inline size-3.5 align-text-bottom" />
                {summary}
              </span>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {columnsOf(result.rows).map((column) => (
                    <th
                      key={column}
                      className="border-b border-slate-200 px-4 py-2 text-[11px] font-semibold tracking-wide text-slate-600 uppercase"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.rows.slice(0, PREVIEW_ROWS).map((row, index) => (
                  <tr key={index}>
                    {columnsOf(result.rows).map((column) => (
                      <td key={column} className="px-4 py-2 text-xs text-slate-700">
                        {renderCell(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.rows.length > PREVIEW_ROWS ? (
            <p className="border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-500">
              First {PREVIEW_ROWS} of {result.rows.length} rows returned. Nothing here is sampled or trimmed for
              effect — the source returned a page and the backend reported the true total above.
            </p>
          ) : null}

          <p className="border-t border-slate-100 px-5 py-3 text-[11px] leading-5 text-slate-500">
            This is a live call against your own records, not a sample. The figure beside the source name is counted
            from the rows above in your browser — no language model produced it.
          </p>
        </>
      )}
    </AiStackCard>
  );
}

/**
 * One figure derived from the returned rows, counted here rather than asked for.
 *
 * A column is only used when it actually reads as a category — a short value repeated
 * across rows, with few distinct ones. That is what makes a count of it informative
 * ("41 present, 3 absent") rather than a list of every unique name in the table. When no
 * column qualifies the panel says nothing rather than inventing a statistic.
 */
function breakdownOf(rows: McpRow[]): string | null {
  for (const column of columnsOf(rows)) {
    const counts = new Map<string, number>();

    for (const row of rows) {
      const value = row[column];

      if (typeof value !== 'string' && typeof value !== 'number') continue;
      const text = String(value).trim();
      if (text === '' || text.length > 40) continue;

      counts.set(text, (counts.get(text) ?? 0) + 1);
    }

    if (counts.size < 2 || counts.size > 8) continue;

    const parts = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([value, count]) => `${count} ${value}`);

    return `${parts.join(' · ')} (${column}, across the ${rows.length} rows shown)`;
  }

  return null;
}

/** The columns to print: the keys of the rows, in the order the first row gives them. */
function columnsOf(rows: McpRow[]): string[] {
  const seen = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) seen.add(key);
    if (seen.size >= 6) break;
  }

  return [...seen].slice(0, 6);
}

/** A cell, as a short string. An object is reported as unreadable rather than guessed at. */
function renderCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `${value.length} item(s)`;
  return '—';
}
