'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Rocket, Save, Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAgentEditor, useAgentMeta } from '@/hooks/use-agentic'
import type { AgentPayload } from '@/services/agentic'

import { TOOL_ICONS } from './shared'

interface FormState {
  name: string
  description: string
  module: string
  sub_module: string
  role: string
  model: string
  temperature: number
  max_tokens: number
  system_prompt: string
  tools: string[]

  /** 'none' records a run for an external executor; 'http' calls the endpoint. */
  execution_mode: 'none' | 'http'
  endpoint_url: string
  endpoint_method: string
  /** One "Name: value" per line. Kept as text so it round-trips cleanly. */
  endpoint_headers: string
  endpoint_timeout: number
}

const EMPTY: FormState = {
  name: '',
  description: '',
  module: '',
  sub_module: '',
  role: '',
  model: 'gpt-4',
  temperature: 0.7,
  max_tokens: 2000,
  system_prompt: '',
  tools: [],
  execution_mode: 'none',
  endpoint_url: '',
  endpoint_method: 'POST',
  endpoint_headers: '',
  endpoint_timeout: 60,
}

const STEPS = [
  { id: 1, name: 'Basic Info', description: 'Agent identity' },
  { id: 2, name: 'Model & Execution', description: 'Parameters and endpoint' },
  { id: 3, name: 'System Prompt', description: 'Behaviour definition' },
  { id: 4, name: 'Tools', description: 'Capabilities' },
]

/** Drafts survive a refresh; the key is per-agent so editing two never collide. */
const draftKey = (editId: string | null) => `agentic:agent-draft:${editId ?? 'new'}`

type Errors = Partial<Record<keyof FormState, string>>

/**
 * "Name: value" per line into a header map.
 *
 * A textarea beats a key/value repeater here: the values are usually pasted
 * wholesale from a provider's docs, and only the first colon splits so bearer
 * tokens containing colons survive.
 */
function parseHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {}

  for (const line of text.split('\n')) {
    const separator = line.indexOf(':')
    if (separator === -1) continue

    const name = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (name && value) headers[name] = value
  }

  return headers
}

function validateStep(step: number, data: FormState): Errors {
  const errors: Errors = {}

  if (step === 1) {
    if (!data.name.trim()) errors.name = 'Agent name is required.'
    if (!data.description.trim()) errors.description = 'Describe what this agent does.'
  }
  if (step === 2) {
    if (data.temperature < 0 || data.temperature > 2) errors.temperature = 'Temperature must be between 0 and 2.'
    if (data.max_tokens < 100 || data.max_tokens > 8000) errors.max_tokens = 'Max tokens must be between 100 and 8000.'

    // Saving 'http' with no URL would fail on the first run, so it is caught here.
    if (data.execution_mode === 'http') {
      const url = data.endpoint_url.trim()
      if (!url) {
        errors.endpoint_url = 'An endpoint URL is required when the agent calls out.'
      } else if (!/^https?:\/\//i.test(url)) {
        errors.endpoint_url = 'Use an absolute http(s) URL.'
      }
    }
  }
  if (step === 3) {
    if (!data.system_prompt.trim()) errors.system_prompt = 'A system prompt is required — it defines the behaviour.'
  }
  if (step === 4) {
    if (data.tools.length === 0) errors.tools = 'Select at least one tool.'
  }

  return errors
}

/**
 * Create / edit an agent.
 *
 * Four steps because the decisions are genuinely different in kind: who the
 * agent is, how the model behaves, what it is told, and what it may touch. The
 * draft is saved locally as you type so a refresh mid-wizard loses nothing.
 */
export function AgCreateAgent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const isEdit = Boolean(editId)

  const { meta } = useAgentMeta()
  const { load, save, saving } = useAgentEditor()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [hydrated, setHydrated] = useState(false)

  const key = draftKey(editId)

  // Editing loads the stored agent; creating restores any local draft. Read
  // after mount so server and client markup match before hydration.
  useEffect(() => {
    let cancelled = false

    queueMicrotask(async () => {
      if (isEdit) {
        const agent = await load(Number(editId))
        if (!cancelled && agent) {
          setForm({
            name: agent.name ?? '',
            description: agent.description ?? '',
            module: agent.module ?? '',
            sub_module: agent.sub_module ?? '',
            role: agent.role ?? '',
            model: agent.model ?? 'gpt-4',
            temperature: agent.temperature ?? 0.7,
            max_tokens: agent.max_tokens ?? 2000,
            system_prompt: agent.system_prompt ?? '',
            tools: agent.tools ?? [],
            execution_mode: agent.execution_mode ?? 'none',
            endpoint_url: agent.endpoint_url ?? '',
            endpoint_method: agent.endpoint_method ?? 'POST',
            // Headers are write-only server side, so an existing set cannot be
            // shown. Leaving this blank means "unchanged" on save.
            endpoint_headers: '',
            endpoint_timeout: 60,
          })
        }
        if (!cancelled) setLoading(false)
      } else {
        try {
          const raw = window.localStorage.getItem(key)
          if (raw && !cancelled) setForm({ ...EMPTY, ...(JSON.parse(raw) as Partial<FormState>) })
        } catch {
          // A corrupt draft must not block the wizard.
        }
      }
      if (!cancelled) setHydrated(true)
    })

    return () => {
      cancelled = true
    }
  }, [editId, isEdit, key, load])

  // Autosave, but only once the real values are in — otherwise the first tick
  // would overwrite the stored draft with the empty defaults.
  useEffect(() => {
    if (!hydrated || isEdit) return
    const timer = setTimeout(() => {
      try {
        // Headers hold API keys. The server never returns them, so persisting
        // them here would be the one place they sit in plain text.
        const { endpoint_headers: _omitted, ...safe } = form
        window.localStorage.setItem(key, JSON.stringify(safe))
      } catch {
        // A full or blocked localStorage must not break the wizard.
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [form, hydrated, isEdit, key])

  // Plain function, not useCallback: the compiler memoizes it, and a manual
  // dep list here just fights its inference.
  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const toggleTool = (toolId: string) =>
    setForm((current) => ({
      ...current,
      tools: current.tools.includes(toolId)
        ? current.tools.filter((id) => id !== toolId)
        : [...current.tools, toolId],
    }))

  const next = () => {
    const found = validateStep(step, form)
    setErrors(found)
    if (Object.keys(found).length === 0 && step < STEPS.length) setStep(step + 1)
  }

  const payload = (): AgentPayload => ({
    name: form.name.trim(),
    description: form.description.trim(),
    module: form.module.trim() || undefined,
    sub_module: form.sub_module.trim() || undefined,
    role: form.role.trim() || undefined,
    model: form.model,
    temperature: form.temperature,
    max_tokens: form.max_tokens,
    system_prompt: form.system_prompt.trim(),
    tools: form.tools,
    execution_mode: form.execution_mode,
    endpoint_url: form.endpoint_url.trim() || undefined,
    endpoint_method: form.endpoint_method,
    endpoint_timeout: form.endpoint_timeout,
    // Only sent when the field was filled in, so an edit that leaves it blank
    // keeps whatever headers are already stored.
    ...(form.endpoint_headers.trim() ? { endpoint_headers: parseHeaders(form.endpoint_headers) } : {}),
  })

  /** `deploy` skips the draft state for an agent that is ready to run. */
  const submit = async (deploy: boolean) => {
    const found = { ...validateStep(1, form), ...validateStep(2, form), ...validateStep(3, form), ...validateStep(4, form) }
    setErrors(found)
    if (Object.keys(found).length > 0) {
      // Send the user to the earliest step that still has a problem.
      const firstBad = [1, 2, 3, 4].find((index) => Object.keys(validateStep(index, form)).length > 0)
      if (firstBad) setStep(firstBad)
      setMessage(null)
      return
    }

    const result = await save({ ...payload(), ...(deploy ? { status: 'deployed' as const } : {}) }, editId ? Number(editId) : null)

    if (result.ok) {
      try {
        window.localStorage.removeItem(key)
      } catch {
        // Nothing to clean up if storage is unavailable.
      }
      router.push('/module/m7/ag-agent-library/ag-agent-library')
    } else {
      setMessage(result.message)
    }
  }

  const modelOptions = (meta.models.length ? meta.models : [form.model]).map((model) => ({ label: model, value: model }))
  const moduleOptions = [
    { label: 'Select module', value: '' },
    ...Array.from(new Set([...meta.modules, form.module].filter(Boolean))).map((value) => ({ label: value, value })),
  ]

  if (loading) {
    return (
      <div className="flex h-full flex-col gap-6 p-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="g2g-scrollbar flex h-full flex-col gap-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            onClick={() => router.push('/module/m7/ag-agent-library/ag-agent-library')}
            className="h-10 w-10 shrink-0 rounded-xl p-0"
            aria-label="Back to Agent Library"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {isEdit ? 'Edit Agent' : 'Create Agent'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEdit
                ? 'Update this agent’s identity, behaviour and capabilities.'
                : 'Define an agent’s identity, behaviour and the tools it may use.'}
            </p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <ol className="flex flex-wrap gap-2 rounded-2xl border border-primary/10 bg-card/50 p-4 shadow-sm backdrop-blur-xl">
        {STEPS.map((entry) => {
          const done = step > entry.id
          const active = step === entry.id

          return (
            <li key={entry.id} className="flex-1">
              <button
                type="button"
                // Only completed steps are clickable — jumping ahead would skip
                // the validation that gates each one.
                onClick={() => done && setStep(entry.id)}
                disabled={!done && !active}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                  active && 'border-primary bg-primary/5',
                  done && 'border-border hover:bg-accent cursor-pointer',
                  !active && !done && 'border-border opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    active && 'bg-primary text-primary-foreground',
                    done && 'bg-emerald-500/15 text-emerald-600',
                    !active && !done && 'bg-muted text-muted-foreground',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : entry.id}
                </span>
                <span className="min-w-0">
                  <span className={cn('block truncate text-sm font-semibold', active ? 'text-primary' : 'text-foreground')}>
                    {entry.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">{entry.description}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {message && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm font-medium text-destructive">
          {message}
        </div>
      )}

      {/* Step body */}
      <div className="flex-1 rounded-2xl border border-primary/10 bg-card/90 p-6 shadow-sm backdrop-blur-2xl">
        {step === 1 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-foreground" htmlFor="agent-name">
                Agent Name<span className="text-destructive"> *</span>
              </label>
              <Input
                id="agent-name"
                value={form.name}
                onChange={(event) => set('name', event.target.value)}
                placeholder="e.g. Skill Generator Agent"
                className="border-border bg-background"
              />
              {errors.name && <p className="text-sm font-medium text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-foreground" htmlFor="agent-description">
                Description<span className="text-destructive"> *</span>
              </label>
              <Textarea
                id="agent-description"
                value={form.description}
                onChange={(event) => set('description', event.target.value)}
                placeholder="What does this agent do, and when should someone use it?"
                className="min-h-[100px] border-border bg-background"
              />
              {errors.description && <p className="text-sm font-medium text-destructive">{errors.description}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Module</label>
              <Select
                value={form.module}
                onChange={(value) => set('module', value)}
                options={moduleOptions}
                className="h-9 border-border bg-background"
                aria-label="Module"
              />
              <p className="text-xs text-muted-foreground">Where in the product this agent belongs.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground" htmlFor="agent-submodule">Sub Module</label>
              <Input
                id="agent-submodule"
                value={form.sub_module}
                onChange={(event) => set('sub_module', event.target.value)}
                placeholder="e.g. Skill Library"
                className="border-border bg-background"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground" htmlFor="agent-role">Role</label>
              <Input
                id="agent-role"
                value={form.role}
                onChange={(event) => set('role', event.target.value)}
                placeholder="e.g. generator, reviewer, analyst"
                className="border-border bg-background"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Model</label>
              <Select
                value={form.model}
                onChange={(value) => set('model', value)}
                options={modelOptions}
                className="h-9 border-border bg-background"
                aria-label="Model"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground" htmlFor="agent-temperature">
                Temperature — {form.temperature.toFixed(2)}
              </label>
              <input
                id="agent-temperature"
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={form.temperature}
                onChange={(event) => set('temperature', Number(event.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              <p className="text-xs text-muted-foreground">
                Lower is more deterministic; higher is more varied. 0.2–0.5 suits extraction, 0.7–1.0 suits drafting.
              </p>
              {errors.temperature && <p className="text-sm font-medium text-destructive">{errors.temperature}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground" htmlFor="agent-max-tokens">Max Tokens</label>
              <Input
                id="agent-max-tokens"
                type="number"
                min={100}
                max={8000}
                value={form.max_tokens}
                onChange={(event) => set('max_tokens', Number(event.target.value))}
                className="border-border bg-background"
              />
              <p className="text-xs text-muted-foreground">Between 100 and 8000.</p>
              {errors.max_tokens && <p className="text-sm font-medium text-destructive">{errors.max_tokens}</p>}
            </div>

            {/* Where the work actually happens. This is what connects an agent
                to a HuggingFace Space, an n8n webhook, or any HTTP service. */}
            <div className="space-y-4 rounded-xl border border-border p-4 md:col-span-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Execution</p>
                <p className="text-xs text-muted-foreground">
                  Where a run is performed. Leave as “Recorded only” to have an external process report results back
                  into the run log.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Mode</label>
                  <Select
                    value={form.execution_mode}
                    onChange={(value) => set('execution_mode', value as 'none' | 'http')}
                    options={[
                      { label: 'Recorded only — reported in externally', value: 'none' },
                      { label: 'HTTP endpoint — call on each run', value: 'http' },
                    ]}
                    className="h-9 border-border bg-background"
                    aria-label="Execution mode"
                  />
                </div>

                {form.execution_mode === 'http' && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Method</label>
                    <Select
                      value={form.endpoint_method}
                      onChange={(value) => set('endpoint_method', value)}
                      options={['POST', 'GET', 'PUT', 'PATCH'].map((method) => ({ label: method, value: method }))}
                      className="h-9 border-border bg-background"
                      aria-label="Request method"
                    />
                  </div>
                )}
              </div>

              {form.execution_mode === 'http' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground" htmlFor="agent-endpoint-url">
                      Endpoint URL<span className="text-destructive"> *</span>
                    </label>
                    <Input
                      id="agent-endpoint-url"
                      value={form.endpoint_url}
                      onChange={(event) => set('endpoint_url', event.target.value)}
                      placeholder="https://your-space.hf.space/run  ·  https://n8n.example.com/webhook/abc"
                      className="border-border bg-background font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      Each run posts the agent’s prompt, model settings and input as JSON, and records whatever comes
                      back. A response containing <code>output</code>, <code>result</code> or{' '}
                      <code>generated_text</code> is used as the run output.
                    </p>
                    {errors.endpoint_url && <p className="text-sm font-medium text-destructive">{errors.endpoint_url}</p>}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground" htmlFor="agent-endpoint-headers">
                        Request Headers
                      </label>
                      <Textarea
                        id="agent-endpoint-headers"
                        value={form.endpoint_headers}
                        onChange={(event) => set('endpoint_headers', event.target.value)}
                        placeholder={'Authorization: Bearer hf_xxx\nX-Custom: value'}
                        className="min-h-[80px] border-border bg-background font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        One per line. Stored write-only — never returned by the API.
                        {isEdit ? ' Leave blank to keep the existing headers.' : ''}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground" htmlFor="agent-endpoint-timeout">
                        Timeout (seconds)
                      </label>
                      <Input
                        id="agent-endpoint-timeout"
                        type="number"
                        min={5}
                        max={300}
                        value={form.endpoint_timeout}
                        onChange={(event) => set('endpoint_timeout', Number(event.target.value))}
                        className="border-border bg-background"
                      />
                      <p className="text-xs text-muted-foreground">
                        A sleeping HuggingFace Space can take a while to wake — 60s or more is sensible.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground" htmlFor="agent-system-prompt">
              System Prompt<span className="text-destructive"> *</span>
            </label>
            <Textarea
              id="agent-system-prompt"
              value={form.system_prompt}
              onChange={(event) => set('system_prompt', event.target.value)}
              placeholder="You are a…&#10;&#10;Describe the agent's role, the format it should answer in, and anything it must never do."
              className="min-h-[280px] border-border bg-background font-mono text-xs"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                This is what the agent is told before every run. An agent cannot be deployed without one.
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">{form.system_prompt.length} characters</p>
            </div>
            {errors.system_prompt && <p className="text-sm font-medium text-destructive">{errors.system_prompt}</p>}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Capabilities</p>
              <p className="text-xs text-muted-foreground">
                Only the tools selected here can be invoked by this agent — the server refuses the rest.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {meta.tools.map((tool) => {
                const Icon = TOOL_ICONS[tool.id] ?? Wrench
                const selected = form.tools.includes(tool.id)

                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => toggleTool(tool.id)}
                    aria-pressed={selected}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                      selected ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-accent',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {selected ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">{tool.label}</span>
                      <span className="block text-xs text-muted-foreground">{tool.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            {errors.tools && <p className="text-sm font-medium text-destructive">{errors.tools}</p>}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setStep((current) => Math.max(1, current - 1))}
          disabled={step === 1 || saving}
          className="h-10 gap-2 rounded-xl font-semibold"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="flex flex-wrap items-center gap-3">
          {step < STEPS.length ? (
            <Button onClick={next} className="h-10 gap-2 rounded-xl px-5 font-bold">
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => submit(false)}
                disabled={saving}
                className="h-10 gap-2 rounded-xl font-semibold"
              >
                <Save className="h-4 w-4" /> {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save as Draft'}
              </Button>
              <Button onClick={() => submit(true)} disabled={saving} className="h-10 gap-2 rounded-xl px-5 font-bold">
                <Rocket className="h-4 w-4" /> Save &amp; Deploy
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
