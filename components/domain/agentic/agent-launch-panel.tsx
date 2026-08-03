'use client'

/**
 * The launch surface for a single agent.
 *
 * Replaces the one free-text box every agent used to share. What it renders
 * comes from the agent itself:
 *   - `launch_component` set  -> a bespoke screen (Excel upload, and friends)
 *   - `input_schema` non-empty -> that schema as a form
 *   - neither                  -> a single free-text input, as before
 *
 * Setup is enforced before work: an agent that declares required config it has
 * not been given shows Configure instead of Launch, because running it would
 * only fail deeper in with a worse message.
 */

import { useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Rocket, Settings2, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { useLaravelContext } from '@/hooks/use-agentic'
import { runService } from '@/services/agentic'
import type { Agent, AgentInputValues } from '@/services/agentic'
import { AgentInputForm, defaultsFor, validateAgainstSchema } from './agent-input-form'
import { AgentConfigDialog } from './agent-config-dialog'
import { ExcelAutomationPanel } from './excel-automation-panel'

interface AgentLaunchPanelProps {
  agent: Agent
  /** Refreshes the agent so `configured` and the run list update after a launch. */
  onRefresh: () => void
}

interface LaunchResult {
  ok: boolean
  message: string
  runId?: number
  output?: string | null
}

export function AgentLaunchPanel({ agent, onRefresh }: AgentLaunchPanelProps) {
  const resolveContext = useLaravelContext()

  const [values, setValues] = useState<AgentInputValues>(() => defaultsFor(agent.input_schema))
  const [freeText, setFreeText] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<LaunchResult | null>(null)
  const [configOpen, setConfigOpen] = useState(false)

  const needsSetup = !agent.configured
  const hasSchema = agent.input_schema.length > 0

  const set = (name: string, value: unknown) => {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  const launch = async () => {
    const context = resolveContext()
    if (!isLaravelContextReady(context)) return

    if (hasSchema) {
      const found = validateAgainstSchema(agent.input_schema, values)

      if (Object.keys(found).length > 0) {
        setErrors(found)
        return
      }
    }

    setRunning(true)
    setResult(null)

    try {
      const response = await runService.start(
        context,
        agent.id,
        hasSchema ? undefined : freeText || undefined,
        'manual',
        hasSchema ? values : undefined,
      )

      const run = response.data

      setResult({
        // An endpoint-backed agent reports its real outcome here; a
        // record-only agent just confirms the run opened.
        ok: run.status !== 'error',
        message:
          run.status === 'error'
            ? run.error_message || 'The run failed.'
            : response.message,
        runId: run.id,
        output: run.output ?? null,
      })

      onRefresh()
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : 'Could not start the run.' })
    } finally {
      setRunning(false)
    }
  }

  // Agents whose input cannot be expressed as a plain form bring their own
  // screen. Setup still gates them, so that check stays out here.
  if (agent.launch_component === 'excel-automation' && !needsSetup) {
    return (
      <div className="space-y-4">
        <ConfigureBar agent={agent} onOpen={() => setConfigOpen(true)} />
        <ExcelAutomationPanel agent={agent} onRefresh={onRefresh} />
        <AgentConfigDialog
          agentId={agent.id}
          agentName={agent.name}
          open={configOpen}
          onOpenChange={setConfigOpen}
          onSaved={onRefresh}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ConfigureBar agent={agent} onOpen={() => setConfigOpen(true)} />

      <div className="space-y-4 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-foreground">Run this agent</p>
            <p className="text-xs text-muted-foreground">
              {agent.execution_mode === 'http'
                ? 'Sends these details to the configured endpoint and records the result.'
                : 'Records a run for an external process to pick up and report back into.'}
            </p>
          </div>
        </div>

        {needsSetup ? (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">This agent needs to be connected first.</p>
              <p className="text-xs text-muted-foreground">
                It works against your own account, so it needs those details before it can run.
              </p>
              <Button onClick={() => setConfigOpen(true)} className="h-8 gap-2 rounded-lg text-xs font-bold">
                <Settings2 className="h-3.5 w-3.5" /> Configure
              </Button>
            </div>
          </div>
        ) : (
          <>
            {hasSchema ? (
              <AgentInputForm
                schema={agent.input_schema}
                values={values}
                errors={errors}
                onChange={set}
                disabled={running}
              />
            ) : (
              <Input
                value={freeText}
                onChange={(event) => setFreeText(event.target.value)}
                placeholder="What should this agent work on?"
                disabled={running}
                className="border-border bg-background"
              />
            )}

            <Button onClick={launch} disabled={running} className="h-10 w-full gap-2 rounded-xl font-bold">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              {running ? 'Running…' : 'Launch Agent'}
            </Button>
          </>
        )}

        {result && <LaunchOutcome result={result} />}
      </div>

      <AgentConfigDialog
        agentId={agent.id}
        agentName={agent.name}
        open={configOpen}
        onOpenChange={setConfigOpen}
        onSaved={onRefresh}
      />
    </div>
  )
}

/** Shown only for agents that actually have something to configure. */
function ConfigureBar({ agent, onOpen }: { agent: Agent; onOpen: () => void }) {
  if (agent.config_schema.length === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            agent.configured ? 'bg-emerald-500' : 'bg-amber-500',
          )}
        />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {agent.configured ? 'Connected' : 'Not connected'}
          </p>
          <p className="text-xs text-muted-foreground">
            {agent.configured
              ? 'Running against your organisation’s own account.'
              : 'Add your account details to enable this agent.'}
          </p>
        </div>
      </div>

      <Button variant="outline" onClick={onOpen} className="h-9 gap-2 rounded-lg font-semibold">
        <Settings2 className="h-4 w-4" />
        {agent.configured ? 'Reconfigure' : 'Configure'}
      </Button>
    </div>
  )
}

function LaunchOutcome({ result }: { result: LaunchResult }) {
  return (
    <div
      className={cn(
        'space-y-2 rounded-lg border p-3',
        result.ok ? 'border-border bg-muted/30' : 'border-destructive/30 bg-destructive/5',
      )}
    >
      <div className="flex items-start gap-2.5">
        {result.ok ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        )}
        <div className="min-w-0">
          <p className={cn('text-sm font-semibold', result.ok ? 'text-foreground' : 'text-destructive')}>
            {result.message}
          </p>
          {result.runId !== undefined && (
            <p className="text-xs text-muted-foreground">Run #{result.runId} — see the Run Log for the full trace.</p>
          )}
        </div>
      </div>

      {result.output && (
        <pre className="max-h-56 overflow-auto rounded-lg bg-background p-3 text-xs leading-relaxed text-foreground">
          {result.output}
        </pre>
      )}
    </div>
  )
}
