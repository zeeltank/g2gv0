'use client';

/**
 * AI Stack → Examples by page, for any module.
 *
 * One worked example for EACH PAGE of the module, built from that page's own data. The page list is the
 * module's real sidebar menu; what stands behind each page (which records, how many, how they split) is
 * read from the database for the signed-in organisation at the moment this tab opens, so a number here
 * changes when the data does. Nothing on this screen is a sample.
 *
 * For the page picked, the user sees what the page is for, the real data behind it, a numbered "how to use
 * it", and buttons that really do it: ask the assistant the page's question (it opens the chat and answers
 * from those records), build the report from the same data, open the page itself, or - where a chat action
 * works on the page - the exact sentence that starts it.
 *
 * A page with no data behind it says so and why. A page nobody has mapped yet is shown as such, never
 * hidden and never given an invented example.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { LayoutList } from 'lucide-react';

import { ReportCard } from '@/components/shell/agent/report-card';
import { createG2gActionRegistry } from '@/lib/chat-actions/g2g/registry';
import { generateChatReport, type ChatReport } from '@/lib/intelligence/ai-chat-artifacts';
import { describeAiError } from '@/lib/intelligence/client';
import {
  fetchPageExamples,
  sendToChat,
  type AiPageExample,
  type AiPageExampleStatus,
} from '@/lib/intelligence/ai-module-examples';

import {
  AiStackCard,
  AiStackCardHeading,
  AiStackEmpty,
  AiStackError,
  AiStackHeader,
  AiStackLoading,
  AiStackMetrics,
  AiStackPill,
} from './ai-stack-chrome';
import type { AiStackModule } from './ai-stack-module';

const STATUS: Record<AiPageExampleStatus, { label: string; tone: 'green' | 'amber' | 'gray' | 'red'; dot: string }> = {
  ready: { label: 'Live data', tone: 'green', dot: 'bg-emerald-500' },
  empty: { label: 'No records yet', tone: 'amber', dot: 'bg-amber-500' },
  no_data: { label: 'No data behind this page', tone: 'gray', dot: 'bg-slate-400' },
  unmapped: { label: 'Not mapped yet', tone: 'red', dot: 'bg-red-500' },
};

export function AiStackPageExamplesScreen({ module }: { module: AiStackModule }) {
  const query = useQuery({
    queryKey: ['ai-page-examples', module.key],
    queryFn: () => fetchPageExamples(module.key),
    staleTime: 0,
    retry: false,
  });
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  const pages = useMemo(() => query.data?.pages ?? [], [query.data]);
  const selected: AiPageExample | null =
    pages.find((page) => page.page.route === selectedRoute) ??
    pages.find((page) => page.status === 'ready') ??
    pages[0] ??
    null;

  if (query.isLoading) {
    return <AiStackLoading label={`Reading the ${module.label} pages and their data…`} />;
  }

  if (query.isError) {
    return (
      <AiStackError onRetry={() => void query.refetch()}>
        {describeAiError(query.error)}
      </AiStackError>
    );
  }

  const coverage = query.data?.coverage;

  return (
    <section className="space-y-5">
      <AiStackHeader
        icon={LayoutList}
        title={`${module.label} - an example for every page`}
        summary={`Pick a page to see what it is for, the real ${module.label} data behind it right now, and how to use the AI Stack with it.`}
        loading={query.isFetching}
        onRefresh={() => void query.refetch()}
      />

      {coverage && (
        <AiStackMetrics
          metrics={[
            { key: 'pages', label: 'Pages', value: coverage.pages, hint: 'in this module' },
            { key: 'ready', label: 'With live data', value: coverage.ready, hint: 'a working example' },
            { key: 'empty', label: 'No records yet', value: coverage.empty, hint: 'data source is empty' },
            { key: 'no_data', label: 'No data behind them', value: coverage.no_data, hint: 'settings / guided pages' },
            { key: 'unmapped', label: 'Not mapped', value: coverage.unmapped, hint: 'still to be covered' },
          ]}
        />
      )}

      {pages.length === 0 ? (
        <AiStackEmpty icon={LayoutList} title="No pages found">
          This module has no pages in the menu you can see.
        </AiStackEmpty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem,1fr]">
          <AiStackCard className="max-h-[38rem] overflow-y-auto p-2">
            <ul className="space-y-0.5" aria-label="Pages of this module">
              {pages.map((page) => {
                const active = selected?.page.route === page.page.route;
                return (
                  <li key={page.page.route}>
                    <button
                      type="button"
                      onClick={() => setSelectedRoute(page.page.route)}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                        active ? 'bg-blue-50 font-medium text-blue-800' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                      aria-current={active ? 'true' : undefined}
                    >
                      <span className={`size-2 shrink-0 rounded-full ${STATUS[page.status].dot}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{page.page.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </AiStackCard>

          {selected && <PageExampleDetail key={selected.page.route} entry={selected} module={module} />}
        </div>
      )}
    </section>
  );
}

function PageExampleDetail({ entry, module }: { entry: AiPageExample; module: AiStackModule }) {
  const registry = useMemo(() => createG2gActionRegistry(), []);
  const action = entry.action ? registry.get(entry.action) : undefined;

  const [sent, setSent] = useState(false);
  const [building, setBuilding] = useState(false);
  const [report, setReport] = useState<{ report: ChatReport | null; reason: string | null } | null>(null);
  const [failure, setFailure] = useState('');

  const example = entry.example;
  const status = STATUS[entry.status];

  const buildReport = async () => {
    if (!example?.report_run) return;
    setBuilding(true);
    setFailure('');
    try {
      const built = await generateChatReport(example.report_run.module_key, example.report_run.message);
      setReport({ report: built.report ?? null, reason: built.reason ?? null });
    } catch (cause) {
      setFailure(describeAiError(cause));
    } finally {
      setBuilding(false);
    }
  };

  return (
    <AiStackCard>
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">{entry.page.breadcrumb.join(' › ')}</p>
            <h3 className="text-lg font-semibold text-slate-900">{entry.page.title}</h3>
            {entry.purpose ? <p className="mt-1 text-sm text-slate-600">{entry.purpose}</p> : null}
          </div>
          <AiStackPill tone={status.tone}>{status.label}</AiStackPill>
        </div>

        {entry.status === 'unmapped' && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            This page is in the menu but has no AI Stack example yet. It is listed here so the gap is visible, not hidden.
          </p>
        )}

        {entry.status === 'no_data' && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {entry.no_data_reason ?? 'There is no data behind this page.'}
          </p>
        )}

        {entry.status === 'empty' && entry.no_data_reason && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{entry.no_data_reason}</p>
        )}

        {entry.sources.length > 0 && (
          <div>
            <AiStackCardHeading title="The real data behind this page" hint="Read from your organisation's records when this tab opened." />
            <ul className="mt-2 space-y-2">
              {entry.sources.map((source) => (
                <li key={source.name} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-slate-900">{source.label}</span>
                    <span className="text-slate-700">
                      {source.error
                        ? source.error
                        : `${source.rows.toLocaleString()}${source.truncated ? '+' : ''} record${source.rows === 1 ? '' : 's'}`}
                    </span>
                  </div>
                  {source.breakdown ? <p className="mt-0.5 text-xs text-slate-600">{source.breakdown}</p> : null}
                  {source.description ? <p className="mt-0.5 text-xs text-slate-500">{source.description}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        {entry.steps.length > 0 && (
          <div>
            <AiStackCardHeading title="How to use it" hint="What you do, and what you get." />
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
              {entry.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        {action && (
          <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <span className="font-medium">Try an action here: {action.label}.</span> In the chat, say &ldquo;{action.phrases[0]}&rdquo;.
            It shows exactly what will be written and waits for your confirmation.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {example && (
            <button
              type="button"
              onClick={() => setSent(sendToChat(example.run.message, module.key))}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Ask: &ldquo;{example.question}&rdquo;
            </button>
          )}
          {example?.report_run && (
            <button
              type="button"
              disabled={building}
              onClick={() => void buildReport()}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {building ? 'Building…' : 'Build the report'}
            </button>
          )}
          <Link
            href={entry.page.route}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
          >
            Open {entry.page.title}
          </Link>
        </div>

        {sent && (
          <p className="text-sm text-emerald-700">Sent to the assistant - the answer appears in the chat panel, with the records it used.</p>
        )}
        {failure && <p className="text-sm text-red-700">{failure}</p>}
        {report &&
          (report.report ? (
            <ReportCard report={report.report} />
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No report was made{report.reason ? `: ${report.reason}` : '.'}
            </p>
          ))}
      </div>
    </AiStackCard>
  );
}
