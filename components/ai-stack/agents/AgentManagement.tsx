'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Activity, BarChart3, Bot, Play, Plus, RefreshCw, ScrollText } from 'lucide-react';

import { fetchAgents, fetchRuns, setAgentStatus } from '@/lib/agents/client';
import { AGENT_MODULES, findModule, findTool } from '@/lib/agents/registry';
import type { Agent, AgentRun, AgentStatus } from '@/lib/agents/types';

import { BreakdownBars, Card, ErrorState, HeroHeader, LoadingState, MetricTiles, Pill } from './primitives';
import { useBrainResource } from './useBrainResource';
import { CreateAgentForm, RiskPill } from './CreateAgentForm';
import { RunAgentDialog } from './RunAgentDialog';

/**
 * Agent Management — the one surface every module's agents share.
 *
 * Five tabs, the shape of a mature agent console: the Library (every configured
 * agent), a Dashboard (what ran, how it went), Create agent, the Run log (the
 * audit record, row per execution) and Analytics (runs by module, agent and
 * outcome).
 *
 * A module's own screen embeds this same component with `moduleFilter` set, so
 * Fees sees only Fees agents and can only create Fees agents — and there is
 * still exactly one engine, one store and one log behind both views.
 */

type TabKey = 'library' | 'dashboard' | 'create' | 'runs' | 'analytics';

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { key: 'library', label: 'Agentic library', icon: Bot },
  { key: 'dashboard', label: 'Agent dashboard', icon: Activity },
  { key: 'create', label: 'Create agent', icon: Plus },
  { key: 'runs', label: 'Run log', icon: ScrollText },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
];

export function AgentManagement({
  moduleFilter,
  embedded = false,
  initialTab = 'library',
}: {
  /** Restrict every tab to one module (and lock Create agent to it). */
  moduleFilter?: string;
  /** Skip the hero header when rendered inside another module's page. */
  embedded?: boolean;
  initialTab?: TabKey;
}) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [running, setRunning] = useState<Agent | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const agents = useBrainResource(() => fetchAgents({ module: moduleFilter }), [moduleFilter]);
  const runs = useBrainResource(() => fetchRuns({ module: moduleFilter, limit: 200 }), [moduleFilter]);

  const refresh = useCallback(() => {
    agents.refresh();
    runs.refresh();
  }, [agents, runs]);

  const changeStatus = useCallback(
    async (agent: Agent, status: AgentStatus) => {
      setNote(null);
      try {
        await setAgentStatus(agent.id, status);
        setNote(`${agent.name} is now ${status}.`);
        agents.refresh();
      } catch (cause) {
        setNote(cause instanceof Error ? cause.message : 'The status could not be changed.');
      }
    },
    [agents],
  );

  const moduleLabel = moduleFilter ? (findModule(moduleFilter)?.label ?? moduleFilter) : null;
  const agentRows = agents.data ?? [];
  const runRows = runs.data ?? [];

  const body = (() => {
    if ((agents.loading && !agents.data) || (runs.loading && !runs.data)) return <LoadingState label="Loading agents" />;
    if (agents.error && !agents.data) return <ErrorState message={agents.error} onRetry={refresh} />;

    switch (tab) {
      case 'library':
        return <LibraryTab agents={agentRows} runs={runRows} onRun={setRunning} onStatus={changeStatus} onCreate={() => setTab('create')} />;
      case 'dashboard':
        return <DashboardTab agents={agentRows} runs={runRows} moduleLabel={moduleLabel} />;
      case 'create':
        return (
          <CreateAgentForm
            lockedModule={moduleFilter}
            onCreated={(agent) => {
              setNote(`${agent.name} created as ${agent.id}${agent.status === 'active' ? ' and activated' : ''}.`);
              agents.refresh();
              setTab('library');
            }}
          />
        );
      case 'runs':
        return <RunLogTab runs={runRows} error={runs.error} />;
      case 'analytics':
        return <AnalyticsTab agents={agentRows} runs={runRows} />;
    }
  })();

  const refreshing = agents.refreshing || runs.refreshing;

  return (
    <div className={embedded ? '' : 'p-6'}>
      {!embedded && (
        <HeroHeader
          breadcrumb="Enterprise Brain · Automation"
          title="Agent management"
          description="Configure agents per module, decide which tools each may call, and see every run — recorded against the person who ran it, under that module's rights."
          actions={<RefreshButton onClick={refresh} refreshing={refreshing} dark />}
          meta={
            <>
              <span>{agentRows.length} agents</span>
              <span>{runRows.length} runs logged</span>
              {moduleLabel && <span>Scoped to {moduleLabel}</span>}
            </>
          }
        />
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1" aria-label="Agent management sections">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-current={tab === key ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                tab === key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-gray-100 hover:text-slate-900'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>
        {embedded && <RefreshButton onClick={refresh} refreshing={refreshing} />}
      </div>

      {note && <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-900">{note}</div>}

      {body}

      {running && (
        <RunAgentDialog
          agent={running}
          onClose={() => setRunning(null)}
          onRan={() => {
            runs.refresh();
          }}
        />
      )}
    </div>
  );
}

function RefreshButton({ onClick, refreshing, dark = false }: { onClick: () => void; refreshing: boolean; dark?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={refreshing}
      className={
        dark
          ? 'flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-60'
          : 'flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 disabled:opacity-60'
      }
    >
      <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
      Refresh
    </button>
  );
}

// ---- Library ---------------------------------------------------------------

const STATUS_TONE: Record<AgentStatus, 'gray' | 'blue' | 'green' | 'amber'> = {
  draft: 'gray',
  active: 'green',
  paused: 'amber',
  archived: 'gray',
};

function LibraryTab({
  agents,
  runs,
  onRun,
  onStatus,
  onCreate,
}: {
  agents: Agent[];
  runs: AgentRun[];
  onRun: (agent: Agent) => void;
  onStatus: (agent: Agent, status: AgentStatus) => void;
  onCreate: () => void;
}) {
  const lastRunByAgent = useMemo(() => {
    const map = new Map<string, AgentRun>();
    for (const run of runs) if (!map.has(run.agent_id)) map.set(run.agent_id, run);
    return map;
  }, [runs]);

  if (!agents.length) {
    return (
      <Card className="p-10 text-center">
        <Bot size={28} className="mx-auto text-slate-300" />
        <p className="mt-3 text-sm font-semibold text-slate-700">No agents yet</p>
        <p className="mt-1 text-sm text-slate-500">Create the first one. It runs only when a person presses Run, and only as that person.</p>
        <button type="button" onClick={onCreate} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700">
          Create agent
        </button>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-auto">
        <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
          <thead className="bg-gray-50/95">
            <tr>
              {['Id', 'Name', 'Module', 'Tenant', 'Tools allowed', 'Status', 'Created by', 'Created', 'Last run', ''].map((label) => (
                <th key={label} className="whitespace-nowrap border-b border-gray-200 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {agents.map((agent) => {
              const last = lastRunByAgent.get(agent.id);
              return (
                <tr key={agent.id} className="align-top transition-colors hover:bg-gray-50/70">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{agent.id}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-900">{agent.name}</p>
                    {agent.description && <p className="text-xs text-slate-500">{agent.description}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{findModule(agent.module)?.label ?? agent.module}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{agent.tenant_id}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {agent.tools_allowed.map((key) => {
                        const tool = findTool(key);
                        return (
                          <span key={key} title={key} className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-slate-700">
                            {tool?.label ?? key}
                            {tool && <RiskPill risk={tool.risk} />}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Pill tone={STATUS_TONE[agent.status]}>{agent.status}</Pill>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {agent.created_by_name || <span className="font-mono text-xs">{agent.created_by}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{formatWhen(agent.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                    {last ? (
                      <>
                        <RunStatusPill status={last.status} /> <span className="ml-1">{formatWhen(last.started_at)}</span>
                      </>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onRun(agent)}
                        disabled={agent.status !== 'active'}
                        className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Play size={12} /> Run
                      </button>
                      {agent.status === 'draft' && <SmallButton onClick={() => onStatus(agent, 'active')}>Activate</SmallButton>}
                      {agent.status === 'active' && <SmallButton onClick={() => onStatus(agent, 'paused')}>Pause</SmallButton>}
                      {agent.status === 'paused' && <SmallButton onClick={() => onStatus(agent, 'active')}>Resume</SmallButton>}
                      {agent.status !== 'archived' && <SmallButton onClick={() => onStatus(agent, 'archived')}>Archive</SmallButton>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SmallButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-600 hover:border-gray-300">
      {children}
    </button>
  );
}

// ---- Dashboard -------------------------------------------------------------

function DashboardTab({ agents, runs, moduleLabel }: { agents: Agent[]; runs: AgentRun[]; moduleLabel: string | null }) {
  const today = new Date().toISOString().slice(0, 10);
  const runsToday = runs.filter((run) => run.started_at.startsWith(today));
  const successes = runs.filter((run) => run.status === 'success').length;
  const denied = runs.filter((run) => run.status === 'denied').length;

  return (
    <>
      <MetricTiles
        metrics={[
          { key: 'agents', label: 'Agents', value: agents.length, hint: moduleLabel ? `in ${moduleLabel}` : 'all modules' },
          { key: 'active', label: 'Active', value: agents.filter((agent) => agent.status === 'active').length },
          { key: 'today', label: 'Runs today', value: runsToday.length },
          { key: 'rate', label: 'Success rate', value: runs.length ? Math.round((successes / runs.length) * 100) : 0, hint: runs.length ? `${successes} of ${runs.length} runs` : 'no runs yet' },
          { key: 'denied', label: 'Denied', value: denied, hint: 'refused by rights' },
        ]}
      />
      <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">
        Recent runs <span className="font-normal text-slate-400">({Math.min(runs.length, 10)})</span>
      </h2>
      <RunTable runs={runs.slice(0, 10)} compact />
    </>
  );
}

// ---- Run log ---------------------------------------------------------------

function RunLogTab({ runs, error }: { runs: AgentRun[]; error: string }) {
  const [open, setOpen] = useState<AgentRun | null>(null);
  if (error && !runs.length) return <ErrorState message={error} />;
  return (
    <>
      <RunTable runs={runs} onOpen={setOpen} />
      {open && <RunDetail run={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function RunStatusPill({ status }: { status: AgentRun['status'] }) {
  return <Pill tone={status === 'success' ? 'green' : status === 'denied' ? 'amber' : 'gray'}>{status}</Pill>;
}

function RunTable({ runs, compact = false, onOpen }: { runs: AgentRun[]; compact?: boolean; onOpen?: (run: AgentRun) => void }) {
  if (!runs.length) {
    return (
      <Card className="p-8">
        <p className="text-sm text-slate-400">No runs logged yet. Every run — allowed or refused — is recorded here with the person who made it.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-auto" style={{ maxHeight: compact ? undefined : '36rem' }}>
        <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur">
            <tr>
              {['Run', 'Agent', 'Module', 'Tenant', 'When', 'Acting user', 'Input', 'Output', 'Result'].map((label) => (
                <th key={label} className="whitespace-nowrap border-b border-gray-200 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {runs.map((run) => (
              <tr
                key={run.id}
                onClick={onOpen ? () => onOpen(run) : undefined}
                className={onOpen ? 'cursor-pointer transition-colors hover:bg-blue-50/60' : 'transition-colors hover:bg-gray-50/70'}
              >
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{run.id}</td>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-slate-900">{run.agent_name}</p>
                  <p className="font-mono text-[10px] text-slate-400">{run.agent_id}</p>
                </td>
                <td className="px-4 py-2.5 text-slate-700">{findModule(run.module)?.label ?? run.module}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{run.tenant_id}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                  {formatWhen(run.started_at)}
                  <span className="ml-1 text-slate-300">· {run.duration_ms} ms</span>
                </td>
                <td className="px-4 py-2.5">
                  <p className="text-slate-900">{run.acting_user_name || <span className="font-mono text-xs">{run.acting_user_id}</span>}</p>
                  <p className="text-[11px] text-slate-400">
                    {run.acting_profile_name || 'role unknown'} · user <span className="font-mono">{run.acting_user_id}</span>
                  </p>
                </td>
                <td className="max-w-[16rem] truncate px-4 py-2.5 font-mono text-[11px] text-slate-500" title={JSON.stringify(run.input)}>
                  {summariseInput(run)}
                </td>
                <td className="max-w-[18rem] truncate px-4 py-2.5 text-xs text-slate-600" title={run.output ? JSON.stringify(run.output) : run.error ?? ''}>
                  {run.output ? summariseOutput(run.output) : <span className="text-amber-700">{run.error}</span>}
                </td>
                <td className="px-4 py-2.5">
                  <RunStatusPill status={run.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {onOpen && <p className="border-t border-gray-100 px-4 py-2.5 text-[11px] text-slate-400">Select a run to see its full input and output.</p>}
    </Card>
  );
}

function RunDetail({ run, onClose }: { run: AgentRun; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              <span className="font-mono">{run.id}</span> <RunStatusPill status={run.status} />
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {run.agent_name} · {findModule(run.module)?.label ?? run.module} · tenant <span className="font-mono">{run.tenant_id}</span> · {formatWhen(run.started_at)} · {run.duration_ms} ms
            </p>
            <p className="text-xs text-slate-500">
              Run by {run.acting_user_name || 'user'} <span className="font-mono">{run.acting_user_id}</span> as {run.acting_profile_name || 'unknown role'}
              {run.acting_profile_id && <span className="font-mono"> ({run.acting_profile_id})</span>} · trigger {run.trigger}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-gray-300">
            Close
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Input</p>
            <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-3 font-mono text-[11px] text-slate-800">{JSON.stringify(run.input, null, 2)}</pre>
            <p className="mt-2 text-[11px] text-slate-400">Tools used: {run.tools_used.length ? run.tools_used.join(', ') : 'none'}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{run.output ? 'Output' : 'Error'}</p>
            <pre className={`mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl p-3 font-mono text-[11px] ${run.output ? 'bg-gray-50 text-slate-800' : 'bg-amber-50 text-amber-900'}`}>
              {run.output ? JSON.stringify(run.output, null, 2) : run.error}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Analytics -------------------------------------------------------------

function AnalyticsTab({ agents, runs }: { agents: Agent[]; runs: AgentRun[] }) {
  const byModule = AGENT_MODULES.map((module) => ({ label: module.label, value: runs.filter((run) => run.module === module.key).length })).filter((row) => row.value);
  const byAgent = agents.map((agent) => ({ label: agent.name, value: runs.filter((run) => run.agent_id === agent.id).length })).sort((a, b) => b.value - a.value);
  const byOutcome = (['success', 'failure', 'denied'] as const).map((status) => ({ label: status, value: runs.filter((run) => run.status === status).length }));
  const byUser = Object.entries(
    runs.reduce<Record<string, number>>((acc, run) => {
      const key = run.acting_user_name || run.acting_user_id || 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const avg = runs.length ? Math.round(runs.reduce((sum, run) => sum + run.duration_ms, 0) / runs.length) : 0;

  return (
    <>
      <MetricTiles
        metrics={[
          { key: 'runs', label: 'Total runs', value: runs.length },
          { key: 'avg', label: 'Avg duration', value: avg, hint: 'milliseconds' },
          { key: 'agents', label: 'Agents run', value: byAgent.filter((row) => row.value).length, hint: `of ${agents.length}` },
          { key: 'users', label: 'Distinct users', value: byUser.length },
        ]}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <AnalyticsPanel title="Runs by outcome" data={byOutcome} />
        <AnalyticsPanel title="Runs by module" data={byModule} />
        <AnalyticsPanel title="Runs by agent" data={byAgent} />
        <AnalyticsPanel title="Runs by acting user" data={byUser} />
      </div>
    </>
  );
}

function AnalyticsPanel({ title, data }: { title: string; data: Array<{ label: string; value: number }> }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      </div>
      <BreakdownBars data={data} />
    </Card>
  );
}

// ---- Helpers ---------------------------------------------------------------

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function summariseInput(run: AgentRun): string {
  const tool = typeof run.input.tool === 'string' ? run.input.tool : '';
  const args = run.input.arguments && typeof run.input.arguments === 'object' ? (run.input.arguments as Record<string, unknown>) : {};
  const keys = Object.keys(args);
  return `${tool || '(no tool)'}${keys.length ? ` · ${keys.join(', ')}` : ''}`;
}

function summariseOutput(output: Record<string, unknown>): string {
  if (typeof output.message === 'string') return output.message.replace(/\s+/g, ' ').trim();
  return Object.entries(output)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' · ');
}
