'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Play, X } from 'lucide-react';

import { AgentApiError, runAgent } from '@/lib/agents/client';
import { findTool } from '@/lib/agents/registry';
import type { Agent, AgentRun } from '@/lib/agents/types';

/**
 * Run one agent, once, now.
 *
 * v1 runs exactly one tool from the agent's allow-list with the arguments typed
 * here, so the operator sees precisely what will be logged before pressing Run.
 * The example arguments come from the tool registry; editing them is the whole
 * input surface for now.
 *
 * A refusal is shown with the `denied` run's id: the attempt was recorded.
 */
export function RunAgentDialog({ agent, onClose, onRan }: { agent: Agent; onClose: () => void; onRan: (run: AgentRun) => void }) {
  const runnable = useMemo(() => agent.tools_allowed.map(findTool).filter((tool) => tool?.available), [agent.tools_allowed]);
  const [toolKey, setToolKey] = useState(runnable[0]?.key ?? '');
  const [argsText, setArgsText] = useState('{}');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentRun | null>(null);

  useEffect(() => {
    const tool = findTool(toolKey);
    // Reset the arguments whenever the tool changes; stale arguments for another tool are worse than an empty form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setArgsText(JSON.stringify(tool?.exampleInput ?? {}, null, 2));
  }, [toolKey]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    let parsed: Record<string, unknown>;
    try {
      const value = JSON.parse(argsText) as unknown;
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Arguments must be a JSON object.');
      parsed = value as Record<string, unknown>;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Arguments must be valid JSON.');
      return;
    }

    setBusy(true);
    try {
      const run = await runAgent(agent.id, { tool: toolKey, arguments: parsed });
      setResult(run);
      onRan(run);
    } catch (cause) {
      if (cause instanceof AgentApiError && cause.run) {
        setError(`${cause.message} The attempt was recorded as ${cause.run.id}.`);
        onRan(cause.run);
      } else {
        setError(cause instanceof Error ? cause.message : 'The run failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="run-agent-title">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id="run-agent-title" className="text-base font-semibold text-slate-900">
              Run {agent.name}
            </h2>
            <p className="text-xs text-slate-500">
              <span className="font-mono">{agent.id}</span> · {agent.module} · runs under your user and is logged
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-gray-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 px-5 py-4">
          {agent.instructions && (
            <p className="rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2 text-xs text-slate-600">
              <span className="font-bold text-slate-500">Instructions: </span>
              {agent.instructions}
            </p>
          )}

          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-widest text-gray-400">Tool</span>
            <select value={toolKey} onChange={(event) => setToolKey(event.target.value)} className={inputClass} disabled={!runnable.length}>
              {runnable.map((tool) => (
                <option key={tool!.key} value={tool!.key}>
                  {tool!.label} ({tool!.key})
                </option>
              ))}
            </select>
            {!runnable.length && <span className="mt-1 block text-xs text-amber-700">This agent has no runnable tool on its allow-list.</span>}
          </label>

          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-widest text-gray-400">Arguments (JSON)</span>
            <textarea value={argsText} onChange={(event) => setArgsText(event.target.value)} rows={7} spellCheck={false} className={`${inputClass} font-mono text-xs`} />
          </label>

          {error && <p className="rounded-xl border border-red-200 bg-red-50/70 px-3 py-2 text-xs text-red-700">{error}</p>}

          {result && (
            <div className={`rounded-xl border px-3 py-3 text-xs ${result.status === 'success' ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
              <p className="font-bold text-slate-700">
                {result.status === 'success' ? 'Run completed' : 'Run failed'} · <span className="font-mono font-normal">{result.id}</span> · {result.duration_ms} ms
              </p>
              {result.error && <p className="mt-1 text-amber-800">{result.error}</p>}
              {result.output && (
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-white/80 p-3 font-mono text-[11px] text-slate-800">
                  {typeof result.output.message === 'string' ? result.output.message : JSON.stringify(result.output, null, 2)}
                </pre>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:border-gray-300">
              {result ? 'Close' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={busy || !toolKey || agent.status !== 'active'}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={14} />
              {busy ? 'Running…' : result ? 'Run again' : 'Run now'}
            </button>
          </div>
          {agent.status !== 'active' && <p className="text-right text-[11px] text-amber-700">Only active agents run. This one is {agent.status}.</p>}
        </form>
      </div>
    </div>
  );
}

const inputClass =
  'mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-400 disabled:bg-gray-50';
