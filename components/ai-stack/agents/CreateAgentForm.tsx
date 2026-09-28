'use client';

import React, { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';

import { usePermission } from '@/components/ai-stack/adapters/use-permission';
import { createAgent } from '@/lib/agents/client';
import { AGENT_MODULES, findModule, rbacModuleKey, toolsForModule, type AgentTool } from '@/lib/agents/registry';
import type { Agent } from '@/lib/agents/types';
import { AiFieldAssistant } from '@/components/ai/AiFieldAssistant';

import { Card } from './primitives';

/**
 * Create Agent.
 *
 * The module selector comes first because everything below it depends on it:
 * the tools offered are the selected module's plus the shared ones, and the
 * create button is gated on `agents.<module>` create rights. Changing the module
 * clears the tool selection so a Fees tool cannot survive a switch to G2G.
 *
 * The permission hook is advisory — it disables the button and says why. The
 * server asks Laravel again on submit, so a client that ignores this gains nothing.
 */
export function CreateAgentForm({
  lockedModule,
  onCreated,
}: {
  /** When set (a module's own screen), the selector is fixed to this module. */
  lockedModule?: string;
  onCreated: (agent: Agent) => void;
}) {
  const [module, setModule] = useState(lockedModule ?? AGENT_MODULES[0].key);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [tools, setTools] = useState<string[]>([]);
  const [activate, setActivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offered = useMemo(() => toolsForModule(module), [module]);
  const canCreate = usePermission(rbacModuleKey(module), 'create');

  const changeModule = (next: string) => {
    setModule(next);
    setTools([]);
  };

  const toggleTool = (tool: AgentTool) => {
    if (!tool.available) return;
    setTools((current) => (current.includes(tool.key) ? current.filter((key) => key !== tool.key) : [...current, tool.key]));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const agent = await createAgent({
        name,
        description,
        module,
        tools_allowed: tools,
        instructions,
        status: activate ? 'active' : 'draft',
      });
      setName('');
      setDescription('');
      setInstructions('');
      setTools([]);
      onCreated(agent);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The agent could not be created.');
    } finally {
      setBusy(false);
    }
  };

  const rightsNote =
    canCreate === undefined
      ? 'Checking your rights…'
      : canCreate
        ? null
        : `Your role cannot create agents for ${findModule(module)?.label ?? module}. Ask an administrator for ${rbacModuleKey(module)} create rights.`;

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={labelClass}>Module</span>
            <select
              value={module}
              onChange={(event) => changeModule(event.target.value)}
              disabled={Boolean(lockedModule)}
              className={inputClass}
            >
              {AGENT_MODULES.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-slate-400">
              {findModule(module)?.description} Rights are checked against <span className="font-mono">{rbacModuleKey(module)}</span>.
            </span>
          </label>

          <label className="block">
            <span className={labelClass}>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} placeholder="Fee reminder drafter" className={inputClass} />
          </label>

          <div className="block">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="create-agent-description" className={labelClass}>
                Description
              </label>
              <AiFieldAssistant
                value={description}
                onApply={setDescription}
                fieldType="description"
                label="Description"
                module={module}
                page="Automation — Create Agent"
                entityType="agent"
                related={name.trim() ? { Agent: name } : undefined}
              />
            </div>
            <input
              id="create-agent-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this agent is for, in one line"
              className={inputClass}
            />
          </div>

          <div className="block sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="create-agent-instructions" className={labelClass}>
                Instructions
              </label>
              <AiFieldAssistant
                value={instructions}
                onApply={setInstructions}
                fieldType="instructions"
                label="Instructions"
                module={module}
                page="Automation — Create Agent"
                entityType="agent"
                related={name.trim() ? { Agent: name } : undefined}
              />
            </div>
            <textarea
              id="create-agent-instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              rows={3}
              placeholder="Draft polite, plain-language reminders. Never mention late fees unless asked."
              className={inputClass}
            />
            <span className="mt-1 block text-[11px] text-slate-400">Kept with the agent and shown to whoever runs it. Not sent to a model in v1.</span>
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className={labelClass}>Tools allowed</legend>
          <p className="mb-2 text-[11px] text-slate-400">Only {findModule(module)?.label ?? module} tools and shared tools are offered. Greyed tools have no executor yet.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {offered.map((tool) => {
              const checked = tools.includes(tool.key);
              return (
                <label
                  key={tool.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                    !tool.available
                      ? 'cursor-not-allowed border-gray-100 bg-gray-50/60 opacity-60'
                      : checked
                        ? 'border-indigo-300 bg-indigo-50/60'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <input type="checkbox" className="mt-1" checked={checked} disabled={!tool.available} onChange={() => toggleTool(tool)} />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-900">
                      {tool.label}
                      <RiskPill risk={tool.risk} />
                      {tool.module === 'shared' && <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">shared</span>}
                      {!tool.available && <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">not yet available</span>}
                    </span>
                    <span className="block text-xs text-slate-500">{tool.description}</span>
                    <span className="block font-mono text-[10px] text-slate-400">{tool.key}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </Card>

      <Card className="h-fit p-5">
        <p className={labelClass}>Review</p>
        <dl className="mt-2 space-y-2 text-sm">
          <Row label="Module" value={findModule(module)?.label ?? module} />
          <Row label="Tools" value={tools.length ? `${tools.length} selected` : 'None yet'} />
          <Row label="Trigger" value="Manual (a person presses Run)" />
          <Row label="Runs as" value="The signed-in user who presses Run" />
        </dl>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={activate} onChange={(event) => setActivate(event.target.checked)} />
          Activate on save
        </label>

        {rightsNote && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">
            <Lock size={14} className="mt-0.5 shrink-0" />
            {rightsNote}
          </p>
        )}
        {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50/70 px-3 py-2 text-xs text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={busy || !name.trim() || !tools.length || canCreate !== true}
          className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create agent'}
        </button>
      </Card>
    </form>
  );
}

const labelClass = 'block text-[11px] font-bold uppercase tracking-widest text-gray-400';
const inputClass =
  'mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-400 disabled:bg-gray-50 disabled:text-slate-500';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export function RiskPill({ risk }: { risk: AgentTool['risk'] }) {
  const tone = risk === 'write' ? 'bg-red-50 text-red-600' : risk === 'read' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}>{risk}</span>;
}
