'use client';

/**
 * AI Stack → Usage & Cost, for any module.
 *
 * What this module's AI has actually done, and what it cost.
 *
 * ONE CENTRAL USAGE SYSTEM, ASKED A MODULE-SHAPED QUESTION
 *
 * Nothing here is a per-module meter. The counts come from
 * `/api/ai/modules/{key}/usage` — the same endpoint every module's tab calls, over columns
 * the schema already had: `ai_conversations.module_key`, generations through this module's
 * templates, reports filed against it, and the quota on whichever credential it resolves
 * to. No table, column or counter was added to make this tab work.
 *
 * EVERY FIGURE IS MEASURED OR ABSENT
 *
 * There is no sample data on this screen and no estimate. Cost is the part worth being
 * careful about: it is `tokens × the rate on the model row`, and on a real estate either
 * half can be missing — nothing currently writes `prompt_tokens`, and `ai_models` ships
 * every rate null because a guessed rate is worse than no rate on a screen somebody uses
 * to explain a bill. So when it cannot multiply, this screen shows no money and prints the
 * backend's own reason for it. A plausible number here would be the single most damaging
 * thing it could display.
 *
 * AGENT RUNS ARE COUNTED SEPARATELY, AND SAID TO BE
 *
 * Tool-agent runs live in the Agent Management engine, not in Laravel's conversation
 * tables, so they are read from `/api/agents/runs` and shown in their own panel rather
 * than folded into a single total. Two stores, two counts, both labelled — better than one
 * number that is quietly the sum of different things.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gauge, TriangleAlert } from 'lucide-react';

import { fetchRuns } from '@/lib/agents/client';
import { fetchModuleUsage, type AiModuleTokens, type AiModuleUsage } from '@/lib/intelligence/ai-module';
import type { AgentRun } from '@/lib/agents/types';

import {
  AiStackCard,
  AiStackCardHeading,
  AiStackError,
  AiStackHeader,
  AiStackHint,
  AiStackLoading,
  AiStackMetrics,
  AiStackPill,
  AiStackTableHead,
  formatWhen,
} from './ai-stack-chrome';
import type { AiStackModule } from './ai-stack-module';

export function AiStackUsageCostScreen({ module }: { module: AiStackModule }) {
  const [usage, setUsage] = useState<AiModuleUsage | null>(null);
  const [runs, setRuns] = useState<AgentRun[] | null>(null);
  /** Non-fatal: the agent store is a separate system and may be empty or unreachable. */
  const [runsError, setRunsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchModuleUsage(module.key)
      .then((next) => {
        if (cancelled) return;
        setUsage(next);
        setError('');
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'The request failed.');
        setLoading(false);
      });

    fetchRuns({ module: module.key, limit: 200 })
      .then((next) => {
        if (!cancelled) setRuns(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setRunsError(cause instanceof Error ? cause.message : 'Agent runs unavailable.');
      });

    return () => {
      cancelled = true;
    };
  }, [token, module.key]);

  const conversations = usage?.conversations;
  const generation = usage?.generation;
  const provider = usage?.provider;
  const tokens: AiModuleTokens | null = generation?.available ? generation.tokens : null;

  const peakDay = useMemo(() => {
    if (!usage?.daily.length) return null;
    return usage.daily.reduce((best, day) => (day.turns > best.turns ? day : best));
  }, [usage]);

  if (loading && !usage) {
    return <AiStackLoading label={`Loading ${module.label} AI usage…`} />;
  }

  return (
    <section className="space-y-5">
      <AiStackHeader
        icon={Gauge}
        title={`${module.label} AI usage and cost`}
        summary={`What the ${module.label} module consumed, who used it, and what it cost. Every figure below is counted from records — nothing is estimated.`}
        loading={loading}
        onRefresh={reload}
      />

      {error && <AiStackError onRetry={reload}>{error}</AiStackError>}

      {usage && !usage.module.registered && (
        <AiStackError>
          {module.label} is not registered as an AI module on this estate, so no usage can be attributed to it.
        </AiStackError>
      )}

      <AiStackMetrics
        metrics={[
          {
            key: 'questions',
            label: `${module.label} questions`,
            value: conversations?.available ? (conversations.turn_detail.total ?? 0) : '—',
            hint: conversations?.available
              ? `across ${conversations.total.toLocaleString('en-IN')} conversations`
              : 'unavailable',
          },
          {
            key: 'users',
            label: 'People',
            value: conversations?.available ? conversations.distinct_users : '—',
            hint: `asked a ${module.label} question`,
          },
          {
            key: 'latency',
            label: 'Avg answer time',
            value:
              conversations?.available && conversations.turn_detail.avg_duration_ms
                ? `${(conversations.turn_detail.avg_duration_ms / 1000).toFixed(1)}s`
                : '—',
            hint: 'per question',
          },
          {
            key: 'agent-runs',
            label: 'Tool-agent runs',
            value: runs ? runs.length : '—',
            hint: runsError ? 'store unreachable' : `${module.label} tool agents`,
          },
          {
            key: 'cost',
            label: 'Cost',
            value: tokens?.cost !== null && tokens?.cost !== undefined ? formatUsd(tokens.cost) : '—',
            hint: tokens?.cost_source === 'unavailable' ? 'no rate or tokens' : (tokens?.cost_source ?? 'unavailable'),
          },
        ]}
      />

      {/* The single most important caveat on the screen, stated where the number would
          have been rather than in a footnote. */}
      {tokens?.cost === null && tokens.cost_reason && (
        <AiStackHint>
          <strong>No cost figure.</strong> {tokens.cost_reason}
        </AiStackHint>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <AiStackCard className="overflow-hidden">
          <AiStackCardHeading
            title={`${module.label} conversations`}
            hint={`Questions asked from a ${module.label} page, from ai_conversations.module_key.`}
          />
          {!conversations?.available ? (
            <p className="px-5 py-6 text-sm text-slate-500">{conversations?.reason ?? 'Unavailable.'}</p>
          ) : (
            <dl className="divide-y divide-slate-100">
              <Row label="Conversations" value={conversations.total.toLocaleString('en-IN')} />
              <Row label="Questions asked" value={(conversations.turn_detail.total ?? 0).toLocaleString('en-IN')} />
              <Row label="Distinct people" value={conversations.distinct_users.toLocaleString('en-IN')} />
              <Row label="First activity" value={formatWhen(conversations.first_activity)} />
              <Row label="Last activity" value={formatWhen(conversations.last_activity)} />
              <Row
                label="Slowest answer"
                value={
                  conversations.turn_detail.max_duration_ms
                    ? `${(conversations.turn_detail.max_duration_ms / 1000).toFixed(1)}s`
                    : '—'
                }
              />
              {peakDay && <Row label="Busiest day" value={`${peakDay.date} · ${peakDay.turns} question(s)`} />}
            </dl>
          )}
        </AiStackCard>

        <AiStackCard className="overflow-hidden">
          <AiStackCardHeading
            title={`What ${module.label} is asking for`}
            hint="The intent each question was classified as. Unclassified means the router could not place it, and the module's read tools answered instead."
          />
          {!conversations?.available || !(conversations.turn_detail.by_intent ?? []).length ? (
            <p className="px-5 py-6 text-sm text-slate-500">
              No questions have been classified for {module.label} yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(conversations.turn_detail.by_intent ?? []).map((row) => {
                const total = conversations.turn_detail.total || 1;
                const share = Math.round((row.count / total) * 100);
                const unclassified = row.intent === 'unknown' || row.intent === 'unclassified';

                return (
                  <li key={row.intent} className="px-5 py-2.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span
                        className={
                          unclassified ? 'font-mono text-xs text-amber-700' : 'font-mono text-xs text-slate-700'
                        }
                      >
                        {row.intent}
                      </span>
                      <span className="tabular-nums text-slate-600">
                        {row.count} · {share}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={
                          unclassified ? 'h-full rounded-full bg-amber-400' : 'h-full rounded-full bg-indigo-500'
                        }
                        style={{ width: `${Math.max(share, 2)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </AiStackCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AiStackCard className="overflow-hidden">
          <AiStackCardHeading
            title="Tokens and cost"
            hint={`From generations through ${module.label} templates, priced at the resolved model's own published rate.`}
          />
          {!tokens ? (
            <p className="px-5 py-6 text-sm text-slate-500">
              {generation?.available === false ? generation.reason : 'Unavailable.'}
            </p>
          ) : (
            <>
              <dl className="divide-y divide-slate-100">
                <Row
                  label="Generations"
                  value={(generation?.available ? generation.total : 0).toLocaleString('en-IN')}
                />
                <Row label="Outputs produced" value={tokens.outputs.toLocaleString('en-IN')} />
                <Row label="Reviewed by a person" value={tokens.reviewed.toLocaleString('en-IN')} />
                <Row
                  label="Prompt tokens"
                  value={tokens.prompt_tokens === null ? 'not recorded' : tokens.prompt_tokens.toLocaleString('en-IN')}
                />
                <Row
                  label="Completion tokens"
                  value={
                    tokens.completion_tokens === null
                      ? 'not recorded'
                      : tokens.completion_tokens.toLocaleString('en-IN')
                  }
                />
                <Row
                  label="Rate"
                  value={
                    tokens.rate === null
                      ? `no model bound to ${module.label}`
                      : tokens.rate.input_per_1k === null && tokens.rate.output_per_1k === null
                        ? `${tokens.rate.label} — no price published`
                        : `${tokens.rate.label} — ${formatUsd(tokens.rate.input_per_1k ?? 0)} in / ${formatUsd(
                            tokens.rate.output_per_1k ?? 0,
                          )} out per 1k`
                  }
                />
                <Row
                  label="Cost"
                  value={tokens.cost === null ? 'not calculable' : `${formatUsd(tokens.cost)} (${tokens.cost_source})`}
                />
              </dl>
              {generation?.available && Object.keys(generation.by_status).length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-5 py-3">
                  {Object.entries(generation.by_status).map(([status, count]) => (
                    <AiStackPill
                      key={status}
                      tone={status === 'completed' ? 'green' : status === 'failed' ? 'red' : 'amber'}
                    >
                      {status} {count}
                    </AiStackPill>
                  ))}
                </div>
              )}
            </>
          )}
        </AiStackCard>

        <AiStackCard className="overflow-hidden">
          <AiStackCardHeading
            title="Quota"
            hint={`The daily call ceiling on whichever credential ${module.label} resolves to.`}
          />
          {!provider?.available ? (
            <p className="px-5 py-6 text-sm text-slate-500">{provider?.reason ?? 'Unavailable.'}</p>
          ) : (
            <>
              <dl className="divide-y divide-slate-100">
                <Row label="Provider" value={provider.provider ?? 'resolved from the shared pool'} />
                <Row label="Model" value={provider.model ?? 'provider default'} />
                <Row
                  label="Binding"
                  value={provider.bound ? `${module.label} has its own credential` : 'shared with every module'}
                />
                <Row
                  label="Daily limit"
                  value={provider.daily_limit === null ? 'none set' : provider.daily_limit.toLocaleString('en-IN')}
                />
              </dl>

              {!provider.bound && (
                <p className="border-t border-slate-100 bg-amber-50 px-5 py-3 text-xs leading-5 text-amber-900">
                  {module.label} has no credential of its own, so its calls, quota and spend cannot be separated from
                  every other module&apos;s. That is the normal state and usually the right one — see the{' '}
                  <strong>Models</strong> tab for where a binding would be changed.
                </p>
              )}

              {provider.daily_calls && provider.daily_calls.length > 0 && (
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                  {provider.daily_calls.map((day) => (
                    <li key={day.date} className="flex items-center justify-between px-5 py-2 text-xs">
                      <span className="text-slate-600">{day.date}</span>
                      <span className="tabular-nums text-slate-900">
                        {day.count.toLocaleString('en-IN')}
                        {provider.daily_limit ? (
                          <span className="ml-1 text-slate-400">/ {provider.daily_limit.toLocaleString('en-IN')}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </AiStackCard>
      </div>

      <AiStackCard className="overflow-hidden">
        <AiStackCardHeading
          title={`${module.label} tool-agent runs`}
          hint="Counted from the Agent Management engine, which is a separate store from the conversation tables above."
        />
        {runsError ? (
          <p className="px-5 py-6 text-sm text-slate-500">{runsError}</p>
        ) : !runs ? (
          <p className="px-5 py-6 text-sm text-slate-500">Loading agent runs…</p>
        ) : runs.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            No {module.label} tool agent has been run yet. Enable one on the <strong>Automations</strong> tab.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-5 py-3">
              {(['success', 'failure', 'denied'] as const).map((status) => {
                const count = runs.filter((run) => run.status === status).length;
                return (
                  <AiStackPill
                    key={status}
                    tone={status === 'success' ? 'green' : status === 'denied' ? 'amber' : 'red'}
                  >
                    {status} {count}
                  </AiStackPill>
                );
              })}
              <AiStackPill tone="gray">
                avg {Math.round(runs.reduce((sum, run) => sum + run.duration_ms, 0) / runs.length)} ms
              </AiStackPill>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                <AiStackTableHead columns={['Run', 'Agent', 'When', 'By', 'Tools', 'Result']} />
                <tbody className="divide-y divide-slate-200">
                  {runs.slice(0, 15).map((run) => (
                    <tr key={run.id}>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{run.id}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-700">{run.agent_name}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                        {formatWhen(run.started_at)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-700">
                        {run.acting_user_name || run.acting_user_id}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                        {run.tools_used.join(', ') || '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <AiStackPill
                          tone={run.status === 'success' ? 'green' : run.status === 'denied' ? 'amber' : 'red'}
                        >
                          {run.status}
                        </AiStackPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </AiStackCard>

      {usage && usage.recent_turns.length > 0 && (
        <AiStackCard className="overflow-hidden">
          <AiStackCardHeading
            title={`Recent ${module.label} questions`}
            hint="The detail behind the counts — what was asked, how it was classified, and how long it took."
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
              <AiStackTableHead columns={['Question', 'Intent', 'Confidence', 'Took', 'Result', 'When']} />
              <tbody className="divide-y divide-slate-200">
                {usage.recent_turns.map((turn) => (
                  <tr key={turn.id} className="align-top">
                    <td className="max-w-md px-4 py-2.5 text-xs leading-5 text-slate-700">{turn.question}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">{turn.intent ?? 'unclassified'}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-slate-600">
                      {turn.confidence === null ? '—' : `${Math.round(turn.confidence * 100)}%`}
                    </td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-slate-600">
                      {turn.duration_ms === null ? '—' : `${(turn.duration_ms / 1000).toFixed(1)}s`}
                    </td>
                    <td className="px-4 py-2.5">
                      <AiStackPill tone={turn.status === 'answered' ? 'green' : 'amber'}>{turn.status}</AiStackPill>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                      {formatWhen(turn.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AiStackCard>
      )}

      <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
        <span>
          Conversations, generations and reports are attributed to {module.label} by their own module column.
          Estate-wide AI logs have no module dimension and are deliberately excluded rather than apportioned by
          guess, so these totals are a floor on {module.label} usage, not a share of the whole.
        </span>
      </p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

/**
 * Rates and costs are published in USD per 1,000 tokens, so they are shown in USD.
 *
 * Deliberately not converted to rupees: there is no exchange rate in this system, and
 * inventing one would make a provider bill unreconcilable with this screen.
 */
function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: value > 0 && value < 0.01 ? 6 : 2,
    maximumFractionDigits: 6,
  }).format(value);
}
