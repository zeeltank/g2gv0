'use client';

/**
 * AI Stack → Automations, for any module.
 *
 * ONE AGENT REGISTRY, NOT TWO
 *
 * This is the point of the tab. Everything on it is a row in a store the rest of the
 * platform already reads: the backend manifest panel at the top is the `ai_agents` row the
 * chatbot resolves, run through the same `AgentRunner`, writing to the same `ai_cases`,
 * `ai_evidence`, `ai_recommendations` and `workflow_approvals`. The tool agents below are
 * configurations on the central Agent Management engine, scoped to this module. There is
 * no AI-Stack copy of either.
 *
 * TWO KINDS OF AUTOMATION, AND THE DIFFERENCE IS REAL
 *
 * 1. A backend domain agent (top), when the module is bound to one in `config/ai.php`. It
 *    detects, opens a case, cites records as evidence, explains, and drafts something that
 *    stops at a human approval.
 *
 * 2. Tool agents (bottom). Each is allowed one or more read/draft tools from this module's
 *    catalogue. These are what an operator builds for themselves; the presets are simply
 *    the useful ones written out so nobody has to re-derive a tool allow-list.
 *
 * WHEN A MODULE HAS NO BOUND AGENT, THE PANEL SAYS SO AND WHY
 *
 * Most modules have none, and that is not a gap to paper over. A module with no manifest
 * cannot open a case, cannot raise a recommendation and has nothing for a person to
 * approve — so the panel prints the reason `config/ai.php` records for it and points at
 * what the module does have. An empty panel with a disabled Run button would leave
 * somebody looking for a feature that was never claimed.
 *
 * PERMISSIONS
 *
 * The tool agents are gated on `agents.<module>`, asked of Laravel through the same
 * `/api/permissions` endpoint every content screen uses, and re-checked server-side by
 * `/api/agents` before anything is created or run.
 *
 * A bound backend agent is deliberately NOT gated on that key in this client. Its
 * authority is the manifest's own `allowed_roles` and `required_permissions`, enforced by
 * `AgentRunner` on the server. Adding a second, different frontend gate in front of it
 * would mean a user who is allowed to run it is told they are not.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  Gavel,
  Info,
  Lock,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Workflow,
  XCircle,
} from 'lucide-react';

import { AgentManagement } from './agents/AgentManagement';
import { RunAgentDialog } from './agents/RunAgentDialog';
import { useBrainResource } from './agents/useBrainResource';
import { usePermission } from './adapters/use-permission';
import { createAgent, fetchAgents, fetchRuns, setAgentStatus } from '@/lib/agents/client';
import { findTool } from '@/lib/agents/registry';
import type { Agent, AgentRun, CreateAgentInput } from '@/lib/agents/types';
import {
  listAgentRuns,
  listAgents,
  listPendingApprovals,
  resolveApproval,
  runAgent,
} from './adapters/domain-agents';
import type { AgentRunResult, PendingApproval } from './adapters/domain-agents';
import { logModuleOperation, readModuleWorkspaceSession } from '@/lib/module-ai/module-ai-stack';

import { AiStackCard, AiStackCardHeading, AiStackPill, formatWhen } from './ai-stack-chrome';
import { aiStackRbacKey, type AiStackBoundAgent, type AiStackModule } from './ai-stack-module';

/** The manifest as `/api/ai/agents` returns it. Loosely typed — it is a config row. */
interface AgentManifestRow {
  agent_key?: string;
  name?: string;
  purpose?: string;
  description?: string;
  max_verb?: string;
  may_execute_actions?: boolean | number;
  authorized_workflow_keys?: string[] | string;
  allowed_roles?: string[];
  allowed_tools?: string[];
  [key: string]: unknown;
}

/** One case a backend agent opened, as its own result describes it. */
interface AgentCase {
  case_id: number;
  student_id?: number;
  student_name?: string;
  subject_label?: string;
  placement?: { standard_name?: string | null; division_name?: string | null } | null;
  severity?: string;
  priority_score?: number;
  signals?: Array<{ signal_key?: string; severity?: string; score?: number; evidence_count?: number }>;
  explanation?: { narrative?: string; governance_passed?: boolean; reason_refused?: string | null };
  recommendation?: {
    id?: number | null;
    status?: string;
    governance_passed?: boolean;
    reason_refused?: string | null;
    title?: string;
  } | null;
}

export function AiStackAutomationsScreen({ module }: { module: AiStackModule }) {
  const rbacKey = aiStackRbacKey(module);

  // Tool agents, on the central Agent Management engine.
  const agents = useBrainResource(() => fetchAgents({ module: module.key, rollup: true }), [module.key]);
  const runs = useBrainResource(() => fetchRuns({ module: module.key, limit: 100, rollup: true }), [module.key]);
  const canCreate = usePermission(rbacKey, 'create');
  const canRun = usePermission(rbacKey, 'update');

  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [running, setRunning] = useState<Agent | null>(null);
  // Remounts the scoped console after a preset action so its own lists refresh.
  const [consoleKey, setConsoleKey] = useState(0);

  /** The agent each preset resolves to in this tenant, matched by name. */
  const configured = useMemo(() => {
    const map = new Map<string, Agent>();

    for (const preset of module.presets) {
      const match = (agents.data ?? []).find((agent) => agent.name === preset.name && agent.status !== 'archived');
      if (match) map.set(preset.name, match);
    }

    return map;
  }, [agents.data, module.presets]);

  const refreshAll = useCallback(() => {
    agents.refresh();
    runs.refresh();
    setConsoleKey((key) => key + 1);
  }, [agents, runs]);

  const enable = useCallback(
    async (preset: CreateAgentInput) => {
      setBusy(preset.name);
      setNote(null);
      try {
        const agent = await createAgent(preset);
        setNote(
          `${agent.name} enabled as ${agent.id}. It runs only when someone presses Run, and only as that person.`,
        );
        refreshAll();
      } catch (cause) {
        setNote(cause instanceof Error ? cause.message : 'The agent could not be enabled.');
      } finally {
        setBusy(null);
      }
    },
    [refreshAll],
  );

  const toggle = useCallback(
    async (agent: Agent) => {
      setBusy(agent.name);
      setNote(null);
      const next = agent.status === 'active' ? 'paused' : 'active';
      try {
        await setAgentStatus(agent.id, next);
        setNote(`${agent.name} is now ${next}.`);
        refreshAll();
      } catch (cause) {
        setNote(cause instanceof Error ? cause.message : 'The status could not be changed.');
      } finally {
        setBusy(null);
      }
    },
    [refreshAll],
  );

  /**
   * What to say about rights, and only when it is actually the obstacle.
   *
   * It names the key, because the failure this replaces was a message that told people to
   * ask for a right without saying what it was called.
   */
  const rightsNote =
    canCreate === false && configured.size === 0
      ? `Your role cannot enable tool agents for the ${module.label} module. Ask an administrator for ${rbacKey} create rights — the key is registered and grantable in Group-wise Rights.`
      : canRun === false && configured.size > 0
        ? `Your role can see these agents but cannot run or pause them (${rbacKey} update rights).`
        : null;

  const refreshing = agents.refreshing || runs.refreshing;

  return (
    <div className="space-y-6">
      {module.boundAgent ? (
        <BoundAgentPanel module={module} agent={module.boundAgent} />
      ) : (
        <NoBoundAgentPanel module={module} />
      )}

      <section className="rounded-lg border border-slate-200 bg-white px-5 py-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-950">{module.label} tool agents</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Each one runs on the central Agent Management engine, scoped to the {module.label} module. The read
              agents answer from this school&apos;s own {module.records}; a drafter writes text and sends nothing.
              Every run is recorded against the person who pressed Run.
            </p>
          </div>

          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:border-gray-300 disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {agents.error && !agents.data && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50/70 px-3 py-2 text-xs text-red-700">
            {agents.error}
          </p>
        )}
        {rightsNote && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">
            <Lock size={14} className="mt-0.5 shrink-0" />
            {rightsNote}
          </p>
        )}
        {note && (
          <p className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-900">
            {note}
          </p>
        )}

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {module.presets.map((preset) => (
            <PresetCard
              key={preset.name}
              preset={preset}
              agent={configured.get(preset.name) ?? null}
              runs={runs.data ?? []}
              checking={agents.loading && !agents.data}
              busy={busy === preset.name}
              canCreate={canCreate === true}
              canRun={canRun === true}
              onEnable={() => void enable(preset)}
              onToggle={(agent) => void toggle(agent)}
              onRun={setRunning}
            />
          ))}
        </div>
      </section>

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">
          {module.label} agent management
        </h3>
        <AgentManagement key={consoleKey} moduleFilter={module.key} embedded />
      </div>

      {running && (
        <RunAgentDialog
          agent={running}
          onClose={() => setRunning(null)}
          onRan={() => {
            runs.refresh();
            setConsoleKey((key) => key + 1);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The module has no backend manifest — say so, and say what that means
// ---------------------------------------------------------------------------

/**
 * Why there is no Run button, and what the module does have instead.
 *
 * This is the honest state for most modules, and it is written out rather than left as an
 * absence because "where is the agent" is the first question somebody has on this tab. The
 * reason is the one `config/ai.php` records for the module — the same sentence the
 * lifecycle reports when it declines to reach its deeper stages — so the screen and the
 * backend cannot give different answers.
 */
function NoBoundAgentPanel({ module }: { module: AiStackModule }) {
  return (
    <AiStackCard>
      <AiStackCardHeading
        title={`${module.label} has no agent of its own`}
        hint="What that means for cases, recommendations and approvals in this module."
      />

      <div className="space-y-3 p-5">
        <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
          <Info className="mt-0.5 size-4 shrink-0 text-slate-400" />
          <span>
            {module.noAgentReason ??
              `No agent manifest is bound to the ${module.label} module, so nothing here opens a case or raises a recommendation.`}
          </span>
        </p>

        <ul className="grid gap-2 sm:grid-cols-3">
          <NoAgentFact
            title="No cases"
            detail={`Nothing detects a condition in the ${module.records} and opens a case against it.`}
          />
          <NoAgentFact
            title="No approval queue"
            detail="Nothing raises a recommendation, so there is nothing here for a person to approve or reject."
          />
          <NoAgentFact
            title="Tool agents still run"
            detail={`The agents below read this school's own ${module.records} as the person who presses Run.`}
          />
        </ul>

        <p className="text-xs leading-5 text-slate-500">
          This is a statement about configuration, not a fault. A module gains a manifest by an administrator
          registering one in <span className="font-mono">ai_agents</span> and binding it in{' '}
          <span className="font-mono">config/ai.php</span>; until then this panel would have nothing true to show,
          and a disabled Run button would suggest otherwise.
        </p>
      </div>
    </AiStackCard>
  );
}

function NoAgentFact({ title, detail }: { title: string; detail: string }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{detail}</p>
    </li>
  );
}

// ---------------------------------------------------------------------------
// The backend agent a module is bound to — the one the chatbot uses
// ---------------------------------------------------------------------------

/** The execution stages a run passes through, in the order a reader should see them. */
type StageState = 'pending' | 'ran' | 'skipped' | 'failed';

interface Stage {
  key: string;
  label: string;
  state: StageState;
  detail: string;
}

function BoundAgentPanel({ module, agent: bound }: { module: AiStackModule; agent: AiStackBoundAgent }) {
  const [manifest, setManifest] = useState<AgentManifestRow | null>(null);
  const [manifestError, setManifestError] = useState('');
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<Record<string, string>>(() =>
    Object.fromEntries(bound.filters.map((filter) => [filter.key, filter.key === 'limit' ? '50' : ''])),
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [runError, setRunError] = useState('');

  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [approvalNote, setApprovalNote] = useState('');
  const [deciding, setDeciding] = useState<number | null>(null);
  const [token, setToken] = useState(0);

  // `setLoading(true)` lives here rather than in the effect body. Calling setState
  // synchronously inside an effect triggers a cascading render, and the spinner belongs to
  // the act of asking for a reload, not to the effect that carries it out.
  const reload = useCallback(() => {
    setLoading(true);
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const context = readModuleWorkspaceSession();

    // Settled, not all: the manifest, the run log and the approval queue are three reads
    // and one failing must not blank the other two.
    void Promise.allSettled([
      listAgents(context, 'k12'),
      listAgentRuns(context, bound.agentKey, 20),
      listPendingApprovals(context, 50),
    ]).then(([agentList, runList, approvalList]) => {
      if (cancelled) return;

      if (agentList.status === 'fulfilled') {
        const found = (agentList.value.agents ?? []).find(
          (row) => (row as AgentManifestRow).agent_key === bound.agentKey,
        ) as AgentManifestRow | undefined;

        setManifest(found ?? null);
        setManifestError(
          found
            ? ''
            : `No active manifest for ${bound.fallbackName} is registered for your role on this estate. It cannot run until an administrator registers one.`,
        );
      } else {
        setManifestError(
          agentList.reason instanceof Error ? agentList.reason.message : 'The agent registry could not be read.',
        );
      }

      setHistory(runList.status === 'fulfilled' ? (runList.value.runs ?? []) : []);
      setApprovals(
        approvalList.status === 'fulfilled'
          ? (approvalList.value.approvals ?? []).filter((approval) => approval.workflow_key === bound.workflowKey)
          : [],
      );
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [token, bound.agentKey, bound.workflowKey, bound.fallbackName]);

  const run = async () => {
    setRunning(true);
    setResult(null);
    setRunError('');

    /** A positive integer, or undefined so the backend applies its own default. */
    const positive = (value: string) => {
      const parsed = Number(value.trim());
      return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    };

    // Only the filters this manifest actually reads — declared on the descriptor. Offering
    // one it ignores would be a control that silently does nothing.
    const input = Object.fromEntries(
      bound.filters
        .map((filter) => [filter.key, positive(filters[filter.key] ?? '')] as const)
        .filter(([, value]) => value !== undefined),
    );

    try {
      const outcome = await runAgent(readModuleWorkspaceSession(), bound.agentKey, input);

      setResult(outcome);

      logModuleOperation(module, `${module.key}_agent_run`, {
        status: outcome.status === 'completed' ? 'completed' : 'failed',
        message: outcome.summary,
        agentRunId: outcome.run_id === null ? null : String(outcome.run_id),
        result: { status: outcome.status, filters: input, ...outcome.counters },
      });

      reload();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The agent could not be run.';
      setRunError(message);
      // Recorded as a failure rather than swallowed: a run that was refused is a thing the
      // Activity tab should show, and it is the only place the reason survives.
      logModuleOperation(module, `${module.key}_agent_run`, { status: 'failed', message });
    } finally {
      setRunning(false);
    }
  };

  const decide = async (approval: PendingApproval, decision: 'approved' | 'rejected') => {
    setDeciding(approval.id);
    setApprovalNote('');

    try {
      const summary = await resolveApproval(readModuleWorkspaceSession(), approval.id, decision);
      setApprovalNote(
        `Approval #${approval.id} ${decision}. The ${bound.workflowKey} run is now ${summary.status}${
          summary.current_step ? ` at "${summary.current_step}"` : ''
        }.`,
      );
      reload();
    } catch (cause) {
      setApprovalNote(cause instanceof Error ? cause.message : 'The decision could not be recorded.');
    } finally {
      setDeciding(null);
    }
  };

  const cases = useMemo<AgentCase[]>(() => {
    const found = result?.result?.cases;

    return Array.isArray(found) ? (found as unknown as AgentCase[]) : [];
  }, [result]);

  const stages = useMemo(
    () => buildStages(bound, result, runError, cases, approvals.length),
    [bound, result, runError, cases, approvals.length],
  );

  const workflowKeys = useMemo(() => {
    const raw = manifest?.authorized_workflow_keys;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') return raw.split(',').map((key) => key.trim()).filter(Boolean);
    return [];
  }, [manifest]);

  return (
    <AiStackCard>
      <AiStackCardHeading
        title={manifest?.name ?? bound.fallbackName}
        hint="The agent this module is bound to, and the same one the chatbot runs. One manifest, one run log, one approval queue."
        actions={
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-900 hover:bg-slate-50"
          >
            <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
            Refresh
          </button>
        }
      />

      <div className="space-y-5 p-5">
        {manifestError && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {manifestError}
          </p>
        )}

        {manifest && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start gap-3">
              <span className="mt-0.5 shrink-0 rounded-lg bg-indigo-50 p-2 text-indigo-600">
                <Bot size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-950">{manifest.name ?? bound.fallbackName}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{manifest.purpose ?? manifest.description}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-mono">{bound.agentKey}</span>
                  <AiStackPill tone="blue">may {String(manifest.max_verb ?? 'recommend')}</AiStackPill>
                  {/* The single most important fact about an agent, so it is stated rather
                      than left to be inferred from the absence of a button. */}
                  <AiStackPill tone={manifest.may_execute_actions ? 'amber' : 'green'}>
                    {manifest.may_execute_actions ? 'can execute actions' : 'cannot act without a person'}
                  </AiStackPill>
                  {workflowKeys.map((key) => (
                    <span key={key} className="inline-flex items-center gap-1 font-mono">
                      <Workflow size={11} />
                      {key}
                    </span>
                  ))}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {bound.filters.map((filter) => (
                <label key={filter.key} className="block">
                  <span className="text-xs font-medium text-slate-700">{filter.label}</span>
                  <input
                    value={filters[filter.key] ?? ''}
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, [filter.key]: event.target.value }))
                    }
                    inputMode="numeric"
                    placeholder={filter.placeholder}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                  />
                </label>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void run()}
                disabled={running}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                <Play className="size-4" />
                {running ? 'Running…' : 'Run agent'}
              </button>

              <p className="text-[11px] leading-4 text-slate-500">
                The institute and academic year come from your session, not from this form. The sweep reports how
                much it actually read, so &quot;nothing found&quot; is never confused with &quot;nothing
                read&quot;.
              </p>
            </div>
          </div>
        )}

        {runError && (
          <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            {runError}
          </p>
        )}

        {(result || runError) && <StageTrace stages={stages} />}

        {result && cases.length > 0 && <CaseList cases={cases} />}

        {result && cases.length === 0 && !runError && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            {result.result?.message ?? result.summary}
          </p>
        )}

        <ApprovalQueue
          approvals={approvals}
          deciding={deciding}
          note={approvalNote}
          onDecide={(approval, decision) => void decide(approval, decision)}
        />

        <RunHistory runs={history} agentName={manifest?.name ?? bound.fallbackName} />
      </div>
    </AiStackCard>
  );
}

/**
 * The stages a run actually passed through, derived from what came back.
 *
 * Every state here is read off the result rather than assumed from a successful HTTP
 * status. A run that opened no case reports `skipped` on the stages that depend on one,
 * and a refused recommendation reports the governance reason — so a partly-completed run
 * is never shown as a finished one.
 */
function buildStages(
  bound: AiStackBoundAgent,
  result: AgentRunResult | null,
  runError: string,
  cases: AgentCase[],
  pendingApprovals: number,
): Stage[] {
  if (runError) {
    return [
      { key: 'request', label: 'Your request', state: 'ran', detail: `Sent to ${bound.fallbackName}.` },
      { key: 'agent', label: 'Agent', state: 'failed', detail: runError },
      { key: 'data', label: 'Records', state: 'pending', detail: 'Not reached.' },
    ];
  }

  if (!result) return [];

  const counters = result.counters ?? {
    signals_detected: 0,
    evidence_collected: 0,
    cases_opened: 0,
    recommendations_drafted: 0,
  };

  const withRecommendation = cases.filter((entry) => entry.recommendation?.id);
  const refused = cases.filter((entry) => entry.recommendation && entry.recommendation.governance_passed === false);
  const awaiting = withRecommendation.filter((entry) => entry.recommendation?.status === 'pending_approval');

  return [
    { key: 'request', label: 'Your request', state: 'ran', detail: bound.sweepDescription },
    {
      key: 'agent',
      label: 'Agent',
      state: result.status === 'completed' ? 'ran' : 'failed',
      detail: `${bound.agentKey} finished as ${result.status}.`,
    },
    {
      key: 'data',
      label: 'Real records',
      state: counters.signals_detected > 0 ? 'ran' : 'skipped',
      detail:
        counters.signals_detected > 0
          ? `${counters.signals_detected} signal(s) raised from the school's own records.`
          : 'Nothing in scope met a detector threshold, or too little was recorded to judge.',
    },
    {
      key: 'evidence',
      label: 'Evidence',
      state: counters.evidence_collected > 0 ? 'ran' : 'skipped',
      detail:
        counters.evidence_collected > 0
          ? `${counters.evidence_collected} record(s) stored and cited.`
          : 'Nothing to cite, because nothing was detected.',
    },
    {
      key: 'analysis',
      label: 'Analysis',
      state: counters.cases_opened > 0 ? 'ran' : 'skipped',
      detail:
        counters.cases_opened > 0
          ? `${counters.cases_opened} case(s) opened, each explained from its own cited evidence.`
          : 'No case was warranted at the configured severity.',
    },
    {
      key: 'recommendation',
      label: 'Recommendation',
      state: counters.recommendations_drafted > 0 ? 'ran' : refused.length > 0 ? 'failed' : 'skipped',
      detail:
        counters.recommendations_drafted > 0
          ? `${counters.recommendations_drafted} drafted.${
              refused.length ? ` ${refused.length} refused by governance.` : ''
            }`
          : refused.length > 0
            ? `${refused.length} refused by governance — see the reason on each case below.`
            : 'Nothing to recommend.',
    },
    {
      key: 'approval',
      label: 'Human approval',
      state: awaiting.length > 0 || pendingApprovals > 0 ? 'pending' : 'skipped',
      detail:
        awaiting.length > 0 || pendingApprovals > 0
          ? `Waiting on a person. ${pendingApprovals} approval(s) in the queue below.`
          : 'Nothing is waiting at this gate.',
    },
    {
      key: 'action',
      label: 'Action',
      state: 'pending',
      // Stated plainly, because "pending" on this row is not a delay — it is the design.
      detail: 'This agent may not act. Anything that follows requires a person approving it.',
    },
  ];
}

function StageTrace({ stages }: { stages: Stage[] }) {
  if (stages.length === 0) return null;

  const tone: Record<StageState, string> = {
    ran: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    pending: 'border-amber-200 bg-amber-50 text-amber-900',
    skipped: 'border-slate-200 bg-slate-50 text-slate-600',
    failed: 'border-red-200 bg-red-50 text-red-900',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">What happened</p>
      <ol className="mt-3 space-y-2">
        {stages.map((stage, index) => (
          <li key={stage.key} className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${tone[stage.state]}`}>
            <span className="mt-0.5 shrink-0 text-[11px] font-semibold tabular-nums opacity-60">{index + 1}</span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                {stage.label}
                <span className="ml-2 text-[11px] font-normal uppercase tracking-wide opacity-70">{stage.state}</span>
              </span>
              <span className="mt-0.5 block text-xs leading-5 opacity-90">{stage.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CaseList({ cases }: { cases: AgentCase[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Cases opened ({cases.length})</p>

      {cases.map((entry) => (
        <div key={entry.case_id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-950">
              {entry.student_name ?? entry.subject_label ?? `Case #${entry.case_id}`}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {[entry.placement?.standard_name, entry.placement?.division_name].filter(Boolean).join(' / ') || '—'}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {entry.severity && <AiStackPill tone={severityTone(entry.severity)}>{entry.severity}</AiStackPill>}
              <span className="font-mono text-[11px] text-slate-500">case #{entry.case_id}</span>
            </div>
          </div>

          {/* Every figure here came from the agent's own result. Nothing is recomputed in
              the browser, so this cannot disagree with the case record. */}
          {entry.signals && entry.signals.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-600">
              {entry.signals.map((signal, index) => (
                <span
                  key={`${entry.case_id}-${signal.signal_key ?? index}`}
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] text-slate-700"
                >
                  {signal.signal_key ?? 'signal'}
                  {signal.severity ? ` · ${signal.severity}` : ''}
                </span>
              ))}
            </p>
          )}

          {entry.explanation?.narrative && (
            <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
              {entry.explanation.narrative}
            </p>
          )}

          {entry.explanation?.governance_passed === false && entry.explanation.reason_refused && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-amber-700">
              <TriangleAlert className="mt-0.5 size-3 shrink-0" />
              Explanation refused: {entry.explanation.reason_refused}
            </p>
          )}

          {entry.recommendation && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <ChevronRight className="size-3.5 text-slate-400" />
              <span className="text-slate-700">{entry.recommendation.title ?? 'Recommendation drafted'}</span>
              <AiStackPill tone={entry.recommendation.status === 'pending_approval' ? 'amber' : 'gray'}>
                {entry.recommendation.status ?? 'drafted'}
              </AiStackPill>
              {entry.recommendation.governance_passed === false && entry.recommendation.reason_refused && (
                <span className="text-amber-700">refused: {entry.recommendation.reason_refused}</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ApprovalQueue({
  approvals,
  deciding,
  note,
  onDecide,
}: {
  approvals: PendingApproval[];
  deciding: number | null;
  note: string;
  onDecide: (approval: PendingApproval, decision: 'approved' | 'rejected') => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
        <Gavel className="size-3.5" />
        Waiting for a person ({approvals.length})
      </p>

      {note && (
        <p className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
          {note}
        </p>
      )}

      {approvals.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">Nothing from this workflow is waiting on a decision.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {approvals.map((approval) => (
            <li
              key={approval.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
            >
              <div className="min-w-0 text-xs text-amber-900">
                <p className="font-medium">
                  Approval #{approval.id} · run #{approval.run_id}
                  {approval.step_key ? ` · ${approval.step_key}` : ''}
                </p>
                <p className="mt-0.5 opacity-80">
                  {approval.subject_entity_key
                    ? `${approval.subject_entity_key} #${approval.subject_id}`
                    : 'no subject'}
                  {approval.case_id ? ` · case #${approval.case_id}` : ''}
                  {approval.expires_at ? ` · expires ${formatWhen(approval.expires_at)}` : ''}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onDecide(approval, 'approved')}
                  disabled={deciding === approval.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <CheckCircle2 className="size-3.5" />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => onDecide(approval, 'rejected')}
                  disabled={deciding === approval.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <XCircle className="size-3.5" />
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RunHistory({ runs, agentName }: { runs: Array<Record<string, unknown>>; agentName: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
        <ShieldCheck className="size-3.5" />
        Recent runs of this agent
      </p>

      {runs.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">No run of {agentName} has been recorded for this school yet.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {runs.slice(0, 10).map((entry, index) => {
            const status = String(entry.status ?? 'unknown');

            return (
              <li key={String(entry.id ?? index)} className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <AiStackPill
                  tone={
                    status === 'completed'
                      ? 'green'
                      : status === 'rejected'
                        ? 'amber'
                        : status === 'failed'
                          ? 'red'
                          : 'gray'
                  }
                >
                  {status}
                </AiStackPill>
                <span className="font-mono text-[11px] text-slate-500">
                  {String(entry.run_reference ?? entry.id ?? '')}
                </span>
                <span className="text-slate-400">{formatWhen(String(entry.started_at ?? entry.created_at ?? ''))}</span>
                <span className="min-w-0 truncate">{String(entry.summary ?? entry.error ?? '')}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function severityTone(severity: string): 'red' | 'amber' | 'blue' | 'gray' {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'red';
    case 'high':
      return 'amber';
    case 'moderate':
      return 'blue';
    default:
      return 'gray';
  }
}

// ---------------------------------------------------------------------------
// Tool-agent preset card
// ---------------------------------------------------------------------------

function PresetCard({
  preset,
  agent,
  runs,
  checking,
  busy,
  canCreate,
  canRun,
  onEnable,
  onToggle,
  onRun,
}: {
  preset: CreateAgentInput;
  agent: Agent | null;
  runs: AgentRun[];
  checking: boolean;
  busy: boolean;
  canCreate: boolean;
  canRun: boolean;
  onEnable: () => void;
  onToggle: (agent: Agent) => void;
  onRun: (agent: Agent) => void;
}) {
  const tool = findTool(preset.tools_allowed[0]);
  const lastRun = agent ? (runs.find((run) => run.agent_id === agent.id) ?? null) : null;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 rounded-lg bg-indigo-50 p-2 text-indigo-600">
          <Bot size={18} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-950">{preset.name}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">{preset.description}</p>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        <span className="font-mono">{tool?.key}</span> ·{' '}
        <span className={tool?.risk === 'read' ? 'text-emerald-700' : 'text-slate-500'}>{tool?.risk} risk</span>
        {tool?.kind === 'mcp' && <> · reads live records</>}
        {agent && (
          <>
            {' '}
            · <span className="font-mono">{agent.id}</span> ·{' '}
            <span
              className={agent.status === 'active' ? 'font-semibold text-emerald-600' : 'font-semibold text-amber-600'}
            >
              {agent.status}
            </span>
          </>
        )}
      </p>

      <div className="mt-auto pt-4">
        {checking ? (
          <span className="text-xs text-slate-400">Checking…</span>
        ) : agent ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onRun(agent)}
              disabled={busy || agent.status !== 'active' || !canRun}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={12} />
              Run
            </button>
            <button
              type="button"
              onClick={() => onToggle(agent)}
              disabled={busy || !canRun}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {agent.status === 'active' ? <Pause size={12} /> : <Play size={12} />}
              {agent.status === 'active' ? 'Pause' : 'Resume'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onEnable}
            disabled={busy || !canCreate}
            className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Enabling…' : 'Enable agent'}
          </button>
        )}

        {lastRun && (
          <p className="mt-2 text-[11px] leading-4 text-slate-500">
            Last run{' '}
            <span
              className={
                lastRun.status === 'success'
                  ? 'font-semibold text-emerald-600'
                  : lastRun.status === 'denied'
                    ? 'font-semibold text-amber-600'
                    : 'font-semibold text-slate-600'
              }
            >
              {lastRun.status}
            </span>{' '}
            ·{' '}
            {new Date(lastRun.started_at).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            by {lastRun.acting_user_name || lastRun.acting_user_id}
            {lastRun.error && <span className="mt-0.5 block text-amber-700">{lastRun.error}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
