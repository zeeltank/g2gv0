'use client'

/**
 * The "Example" panel at the top of each AI Stack tab.
 *
 * WHAT IT IS FOR
 *
 * A configuration tab on its own looks empty to somebody who has not set anything up yet.
 * This panel shows one worked, runnable example for the tab, built by the backend from the
 * module's real records, configuration and ledger (`GET /ai/modules/{key}/examples`), with a
 * primary button that really does the thing: ask the module chat, build the report, run the
 * agent, or check the signed-in user's access and record it in the Activity ledger.
 *
 * NOTHING HERE IS INVENTED
 *
 * Every number, name and sentence about data comes from the response. When the module has
 * nothing for a tab the backend says so (`status: 'empty'`) and explains what would appear;
 * this component shows that explanation and never fills the gap. A button the backend marks
 * `none` is shown disabled with its reason.
 *
 * HOW A TAB GETS IT
 *
 * `AiStackWithExample` wraps a tab's screen: the card above, the unchanged screen below. The
 * screen is remounted after a run that changes what it lists (an agent, a report, a ledger
 * row), so the new row is visible without a manual reload.
 */

import { useCallback, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react'

import { ReportCard } from '@/components/shell/agent/report-card'
import { createAgent, runAgent } from '@/lib/agents/client'
import type { AgentRun } from '@/lib/agents/types'
import { generateChatReport, type ChatReport } from '@/lib/intelligence/ai-chat-artifacts'
import {
  fetchModuleExamples,
  runGuardrailCheck,
  sendToChat,
  type AiExampleFact,
  type AiExampleItem,
  type AiExampleTab,
  type AiGuardrailCheckResult,
  type AiModuleExample,
} from '@/lib/intelligence/ai-module-examples'
import { AiApiError, describeAiError } from '@/lib/intelligence/client'
import type { AiStackModule } from './ai-stack-module'

const MAX_ITEMS = 5

/** What a finished run leaves on screen. */
type RunResult =
  | { kind: 'chat'; delivered: boolean }
  | { kind: 'report'; report: ChatReport | null; reason: string | null }
  | { kind: 'agent'; run: AgentRun; created: string | null }
  | { kind: 'guardrail'; check: AiGuardrailCheckResult }

const STATUS_LABEL: Record<AiModuleExample['status'], { text: string; className: string }> = {
  ready: { text: 'Live data', className: 'bg-emerald-100 text-emerald-800' },
  empty: { text: 'Nothing configured yet', className: 'bg-amber-100 text-amber-900' },
  attention: { text: 'Needs attention', className: 'bg-red-100 text-red-800' },
}

const ITEM_DOT: Record<string, string> = {
  ok: 'bg-emerald-500',
  off: 'bg-slate-300',
  pending: 'bg-amber-500',
}

function showValue(value: AiExampleFact['value']): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toLocaleString('en-IN')

  return value
}

export function useModuleExamples(moduleKey: string) {
  return useQuery({
    queryKey: ['ai-module-examples', moduleKey],
    queryFn: () => fetchModuleExamples(moduleKey, { rollup: true }),
    staleTime: 10_000,
    retry: false,
  })
}

/**
 * The card for one tab.
 *
 * `onRan` is told after a run that changes what the tab lists, so the host can reload it.
 */
export function AiStackExampleCard({
  module,
  tab,
  onRan,
}: {
  module: AiStackModule
  tab: AiExampleTab
  onRan?: () => void
}) {
  const query = useModuleExamples(module.key)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const example = query.data?.tabs?.[tab] ?? null

  const run = useCallback(async () => {
    if (!example || example.run.kind === 'none') return

    const action = example.run
    setRunning(true)
    setRunError(null)
    setResult(null)

    try {
      switch (action.kind) {
        case 'chat': {
          setResult({ kind: 'chat', delivered: sendToChat(action.message, module.key) })
          break
        }
        case 'report': {
          const built = await generateChatReport(action.module_key, action.message)
          setResult({ kind: 'report', report: built.report ?? null, reason: built.reason ?? null })
          onRan?.()
          void query.refetch()
          break
        }
        case 'agent': {
          const agentRun = await runAgent(action.agent_id, { tool: action.tool })
          setResult({ kind: 'agent', run: agentRun, created: null })
          onRan?.()
          void query.refetch()
          break
        }
        case 'agent_create': {
          const agent = await createAgent(action.create)
          const agentRun = await runAgent(agent.id, { tool: action.tool })
          setResult({ kind: 'agent', run: agentRun, created: agent.name })
          onRan?.()
          void query.refetch()
          break
        }
        case 'guardrail': {
          setResult({ kind: 'guardrail', check: await runGuardrailCheck(module.key) })
          onRan?.()
          void query.refetch()
          break
        }
      }
    } catch (cause) {
      setRunError(describeAiError(cause, 'The example could not be run.'))
    } finally {
      setRunning(false)
    }
  }, [example, module.key, onRan, query])

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" />
        Building a live example from {module.label} records...
      </div>
    )
  }

  if (query.isError) {
    const status = query.error instanceof AiApiError ? query.error.status : null
    /* Not signed in, not entitled, or the AI host does not serve the route: not a fault in the
       records, so a neutral line rather than a red box on a panel the user did not ask for. */
    const neutral = status === null || [401, 403, 404, 502, 503].includes(status)

    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-3 text-sm ${
          neutral ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-red-200 bg-red-50 text-red-700'
        }`}
      >
        <p>
          <Sparkles className="mr-1.5 inline size-4 align-text-bottom" />
          The live example is not available: {describeAiError(query.error, 'it could not be loaded.')}
        </p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="size-3.5" />
          Try again
        </button>
      </div>
    )
  }

  if (!example) return null

  const status = STATUS_LABEL[example.status]
  const items = expanded ? example.items : example.items.slice(0, MAX_ITEMS)
  const disabled = example.run.kind === 'none' || running

  return (
    <section
      aria-label={`Example: ${example.title}`}
      className="rounded-2xl border border-[#D9D3FA] bg-gradient-to-br from-[#F7F5FF] to-white"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-[#5846EA] uppercase">
            <Sparkles className="size-3.5" />
            Example
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium tracking-normal normal-case ${status.className}`}>
              {status.text}
            </span>
          </p>
          <h3 className="mt-1 text-[15px] font-semibold text-slate-900">{example.title}</h3>
        </div>

        <button
          type="button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          title="Recompute from the current data"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`size-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <p className="px-5 pt-2 text-sm leading-6 text-slate-600">{example.explanation}</p>

      {example.facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-3 px-5 pt-3 sm:grid-cols-3 lg:grid-cols-4">
          {example.facts.map((fact) => (
            <div key={fact.label} className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <dt className="truncate text-[10px] font-semibold tracking-widest text-slate-400 uppercase" title={fact.label}>
                {fact.label}
              </dt>
              <dd className="mt-0.5 truncate text-sm font-semibold text-slate-900 tabular-nums" title={showValue(fact.value)}>
                {showValue(fact.value)}
              </dd>
              {fact.detail && <p className="mt-0.5 text-[11px] leading-4 text-slate-400">{fact.detail}</p>}
            </div>
          ))}
        </dl>
      )}

      {items.length > 0 && (
        <ul className="mx-5 mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {items.map((item, index) => (
            <ExampleItem key={`${item.title}-${index}`} item={item} />
          ))}
          {example.items.length > MAX_ITEMS && (
            <li>
              <button
                type="button"
                onClick={() => setExpanded((open) => !open)}
                className="flex w-full items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
              >
                {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                {expanded ? 'Show fewer' : `Show all ${example.items.length}`}
              </button>
            </li>
          )}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <button
          type="button"
          onClick={() => void run()}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-lg bg-[#5846EA] px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#4a3ad0] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? (
            <Loader2 className="size-4 animate-spin" />
          ) : example.run.kind === 'chat' ? (
            <MessageSquare className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
          {example.run.label}
        </button>
        {example.run.kind === 'none' && <p className="text-xs text-slate-500">{example.run.reason}</p>}
        {example.note && <p className="text-xs text-slate-500">{example.note}</p>}
      </div>

      {(runError || result) && (
        <div className="space-y-2 border-t border-[#E7E3FB] px-5 py-4" role="status" aria-live="polite">
          {runError && (
            <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              {runError}
            </p>
          )}
          {result && <RunOutcome result={result} />}
        </div>
      )}
    </section>
  )
}

function ExampleItem({ item }: { item: AiExampleItem }) {
  return (
    <li className="flex items-start gap-3 px-3 py-2">
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${ITEM_DOT[item.status ?? ''] ?? 'bg-slate-300'}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900" title={item.title}>
          {item.title}
        </p>
        {item.detail &&
          (item.mono ? (
            <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-slate-50 p-2 text-[11px] leading-4 whitespace-pre-wrap text-slate-700">
              {item.detail}
            </pre>
          ) : (
            <p className="text-xs leading-5 text-slate-600">{item.detail}</p>
          ))}
        {item.meta && <p className="truncate text-[11px] text-slate-400">{item.meta}</p>}
      </div>
    </li>
  )
}

/** What the run produced, in the words of the response. */
function RunOutcome({ result }: { result: RunResult }): ReactNode {
  switch (result.kind) {
    case 'chat':
      return result.delivered ? (
        <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          Sent to the assistant. Open the chat panel to read the answer; it is grounded on the same records shown above.
        </p>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The assistant chat is not available on this screen, so nothing was sent.
        </p>
      )

    case 'report':
      return result.report ? (
        <ReportCard report={result.report} />
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No report was made{result.reason ? `: ${result.reason}` : '.'}
        </p>
      )

    case 'agent': {
      const output = result.run.output as { total?: number; tool?: string } | null
      const ok = result.run.status === 'success'

      return (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <p className="flex items-start gap-2 font-medium">
            {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
            {result.created ? `Created "${result.created}" and ran it: ` : `${result.run.agent_name} ran: `}
            {ok
              ? `read ${output?.total ?? 0} row${output?.total === 1 ? '' : 's'} from ${output?.tool ?? 'its tool'} in ${result.run.duration_ms} ms.`
              : (result.run.error ?? 'it did not complete.')}
          </p>
          <p className="mt-1 pl-6 text-xs opacity-80">Run #{result.run.id} is in the log below.</p>
        </div>
      )
    }

    case 'guardrail': {
      const { check } = result
      const gates = check.result.gates

      return (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            check.allowed ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <p className="flex items-start gap-2 font-semibold">
            {check.allowed ? <ShieldCheck className="mt-0.5 size-4 shrink-0" /> : <ShieldAlert className="mt-0.5 size-4 shrink-0" />}
            {check.summary}
          </p>
          <ul className="mt-2 space-y-1 pl-6 text-xs">
            {gates.map((gate) => (
              <li key={gate.gate}>
                <span className="font-mono">{gate.gate}</span> - {gate.passed === true ? 'passed' : gate.passed === false ? 'refused' : 'not evaluated'}
                {gate.passed !== true && gate.message ? ` (${gate.message})` : ''}
              </li>
            ))}
            {check.result.gate_free && check.result.gate_free_note && <li>{check.result.gate_free_note}</li>}
            <li>
              AI policy - {check.result.policy.allowed ? 'permits an AI request' : 'refuses'}
              {check.result.policy.policy ? ` ("${check.result.policy.policy}")` : ' (no policy assigned)'}
            </li>
          </ul>
          <p className="mt-2 pl-6 text-xs opacity-80">
            {check.recorded && check.audit_id !== null
              ? `Recorded as ledger row #${check.audit_id}; see it on the Activity tab.`
              : 'The check ran but the ledger row could not be written.'}
          </p>
        </div>
      )
    }
  }
}

/**
 * A tab's screen with its example above it.
 *
 * The screen is rendered through `children` and re-keyed after a run, so it reloads its own
 * data without the card knowing anything about it.
 */
export function AiStackWithExample({
  module,
  tab,
  children,
}: {
  module: AiStackModule
  tab: AiExampleTab
  children: ReactNode
}) {
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((current) => current + 1), [])

  return (
    <div className="space-y-5">
      <AiStackExampleCard module={module} tab={tab} onRan={reload} />
      <div key={version}>{children}</div>
    </div>
  )
}

