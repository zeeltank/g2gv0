'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  agentService,
  analyticsService,
  reflectionService,
  runService,
  toolService,
  workflowService,
  type Agent,
  type AgentDetail,
  type AgentListParams,
  type AgentMeta,
  type AgentPayload,
  type AgentRun,
  type AgentStatus,
  type AgenticPagination,
  type AnalyseResult,
  type AnalyticsOverview,
  type DashboardData,
  type OptimizationStatus,
  type ReflectionData,
  type RunDetail,
  type RunListParams,
  type ToolCatalogueEntry,
  type ToolKey,
  type ToolPayload,
  type Workflow,
  type WorkflowDetail,
  type WorkflowPayload,
  type WorkflowRun,
  type WorkflowStepPayload,
  type StepState,
} from '@/services/agentic'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Rebuilt per call so it always reads the live session, not stale React state. */
export function useLaravelContext() {
  const { user } = useAuth()
  return useCallback(() => getLaravelContext(user), [user])
}

export interface AgenticMutationResult {
  ok: boolean
  message: string
}

/**
 * Shared mutation wrapper: one saving flag, one success message, one error, and
 * a reload afterwards so the screen always reflects what the server now holds.
 */
function useMutations(reload: () => Promise<void> | void) {
  const [saving, setSaving] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const run = useCallback(
    async (action: () => Promise<{ message: string }>, fallback: string): Promise<AgenticMutationResult> => {
      setSaving(true)
      setActionError(null)
      setActionMessage(null)
      try {
        const response = await action()
        setActionMessage(response.message)
        await reload()
        return { ok: true, message: response.message }
      } catch (error) {
        const message = toMessage(error, fallback)
        setActionError(message)
        return { ok: false, message }
      } finally {
        setSaving(false)
      }
    },
    [reload],
  )

  return {
    saving,
    actionMessage,
    actionError,
    run,
    clearMessages: () => {
      setActionMessage(null)
      setActionError(null)
    },
  }
}

/* ------------------------------------------------------------------ *
 * Agent metadata (tool catalogue, models, modules, counts)
 * ------------------------------------------------------------------ */

const EMPTY_META: AgentMeta = {
  tools: [],
  models: [],
  modules: [],
  statuses: [],
  counts: { total: 0, draft: 0, deployed: 0, paused: 0, archived: 0, platform: 0, tenant: 0 },
}

export function useAgentMeta() {
  const resolveContext = useLaravelContext()
  const [meta, setMeta] = useState<AgentMeta>(EMPTY_META)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(async () => {
      try {
        const response = await agentService.meta(resolveContext())
        if (!cancelled) setMeta({ ...EMPTY_META, ...response.data })
      } catch {
        // The catalogue is supporting data; a failure must not blank the screen.
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [resolveContext])

  return { meta, loading }
}

/* ------------------------------------------------------------------ *
 * Agents
 * ------------------------------------------------------------------ */

export function useAgents(params: AgentListParams, enabled = true) {
  const resolveContext = useLaravelContext()

  const [agents, setAgents] = useState<Agent[]>([])
  const [pagination, setPagination] = useState<AgenticPagination | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const paramsKey = JSON.stringify(params)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const response = await agentService.list(resolveContext(), JSON.parse(paramsKey) as AgentListParams)
      setAgents(response.data ?? [])
      setPagination(response.pagination ?? null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load agents.'))
      setAgents([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }, [enabled, paramsKey, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const { saving, actionMessage, actionError, run, clearMessages } = useMutations(load)

  return {
    agents,
    pagination,
    loading,
    error,
    saving,
    actionMessage,
    actionError,
    retry: load,
    clearMessages,
    create: (payload: AgentPayload) =>
      run(() => agentService.create(resolveContext(), payload), 'Failed to create the agent.'),
    update: (id: number, payload: AgentPayload) =>
      run(() => agentService.update(resolveContext(), id, payload), 'Failed to update the agent.'),
    setStatus: (id: number, status: AgentStatus) =>
      run(() => agentService.setStatus(resolveContext(), id, status), 'Failed to change the agent status.'),
    clone: (id: number, name?: string) =>
      run(() => agentService.clone(resolveContext(), id, name), 'Failed to duplicate the agent.'),
    remove: (id: number) =>
      run(() => agentService.remove(resolveContext(), id), 'Failed to delete the agent.'),
    startRun: (id: number, input?: string) =>
      run(() => runService.start(resolveContext(), id, input), 'Failed to start the run.'),
  }
}

export function useAgentDetail(id: number | null) {
  const resolveContext = useLaravelContext()

  const [detail, setDetail] = useState<AgentDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(async () => {
      if (id == null) {
        setDetail(null)
        setError(null)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const response = await agentService.get(resolveContext(), id)
        if (!cancelled) setDetail(response.data)
      } catch (detailError) {
        if (!cancelled) {
          setError(toMessage(detailError, 'Failed to load the agent.'))
          setDetail(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [id, resolveContext, nonce])

  return { detail, loading, error, refresh: () => setNonce((n) => n + 1) }
}

/** Create Agent loads the agent it is editing outside the list. */
export function useAgentEditor() {
  const resolveContext = useLaravelContext()
  const [saving, setSaving] = useState(false)

  const load = useCallback(
    async (id: number): Promise<AgentDetail | null> => {
      try {
        const response = await agentService.get(resolveContext(), id)
        return response.data
      } catch {
        return null
      }
    },
    [resolveContext],
  )

  const save = useCallback(
    async (payload: AgentPayload, id?: number | null): Promise<AgenticMutationResult & { id?: number }> => {
      setSaving(true)
      try {
        const response = id
          ? await agentService.update(resolveContext(), id, payload)
          : await agentService.create(resolveContext(), payload)
        return { ok: true, message: response.message, id: response.data?.id ?? id ?? undefined }
      } catch (error) {
        return { ok: false, message: toMessage(error, 'Failed to save the agent.') }
      } finally {
        setSaving(false)
      }
    },
    [resolveContext],
  )

  return { load, save, saving }
}

/* ------------------------------------------------------------------ *
 * Runs + traces
 * ------------------------------------------------------------------ */

export function useRuns(params: RunListParams, enabled = true) {
  const resolveContext = useLaravelContext()

  const [runs, setRuns] = useState<AgentRun[]>([])
  const [pagination, setPagination] = useState<AgenticPagination | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const paramsKey = JSON.stringify(params)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const response = await runService.list(resolveContext(), JSON.parse(paramsKey) as RunListParams)
      setRuns(response.data ?? [])
      setPagination(response.pagination ?? null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load runs.'))
      setRuns([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }, [enabled, paramsKey, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const { saving, actionMessage, actionError, run, clearMessages } = useMutations(load)

  return {
    runs,
    pagination,
    loading,
    error,
    saving,
    actionMessage,
    actionError,
    retry: load,
    clearMessages,
    cancel: (id: number) => run(() => runService.cancel(resolveContext(), id), 'Failed to cancel the run.'),
    remove: (id: number) => run(() => runService.remove(resolveContext(), id), 'Failed to delete the run.'),
  }
}

/** One run's trace, loaded on demand when its row is expanded. */
export function useRunTrace(runId: number | null) {
  const resolveContext = useLaravelContext()

  const [detail, setDetail] = useState<RunDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(async () => {
      if (runId == null) {
        setDetail(null)
        return
      }
      setLoading(true)
      try {
        const response = await runService.get(resolveContext(), runId)
        if (!cancelled) setDetail(response.data)
      } catch {
        if (!cancelled) setDetail(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [runId, resolveContext])

  return { detail, loading }
}

/* ------------------------------------------------------------------ *
 * Tools
 * ------------------------------------------------------------------ */

export function useTools() {
  const resolveContext = useLaravelContext()
  const [tools, setTools] = useState<ToolCatalogueEntry[]>([])
  const [invoking, setInvoking] = useState(false)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(async () => {
      try {
        const response = await toolService.catalogue(resolveContext())
        if (!cancelled) setTools(response.data ?? [])
      } catch {
        if (!cancelled) setTools([])
      }
    })
    return () => {
      cancelled = true
    }
  }, [resolveContext])

  const invoke = useCallback(
    async (tool: ToolKey, payload: ToolPayload): Promise<AgenticMutationResult> => {
      setInvoking(true)
      try {
        const response = await toolService.invoke(resolveContext(), tool, payload)
        return { ok: true, message: response.message }
      } catch (error) {
        return { ok: false, message: toMessage(error, 'Failed to record the tool call.') }
      } finally {
        setInvoking(false)
      }
    },
    [resolveContext],
  )

  return { tools, invoke, invoking }
}

/* ------------------------------------------------------------------ *
 * Analytics
 * ------------------------------------------------------------------ */

export function useAgenticDashboard(days = 7) {
  const resolveContext = useLaravelContext()

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await analyticsService.dashboard(resolveContext(), days)
      setData(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the dashboard.'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [days, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  return { data, loading, error, retry: load }
}

export function useAgenticAnalytics(params: { days?: number; agent_id?: number }) {
  const resolveContext = useLaravelContext()

  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const paramsKey = JSON.stringify(params)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await analyticsService.overview(resolveContext(), JSON.parse(paramsKey))
      setData(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load analytics.'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [paramsKey, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  return { data, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Workflows (multi-agent)
 * ------------------------------------------------------------------ */

export function useWorkflows(params: { search?: string; status?: string; mode?: string } = {}) {
  const resolveContext = useLaravelContext()

  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const paramsKey = JSON.stringify(params)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await workflowService.list(resolveContext(), JSON.parse(paramsKey))
      setWorkflows(response.data ?? [])
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load workflows.'))
      setWorkflows([])
    } finally {
      setLoading(false)
    }
  }, [paramsKey, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const { saving, actionMessage, actionError, run, clearMessages } = useMutations(load)

  return {
    workflows,
    loading,
    error,
    saving,
    actionMessage,
    actionError,
    retry: load,
    clearMessages,
    create: (payload: WorkflowPayload) =>
      run(() => workflowService.create(resolveContext(), payload), 'Failed to create the workflow.'),
    update: (id: number, payload: WorkflowPayload) =>
      run(() => workflowService.update(resolveContext(), id, payload), 'Failed to update the workflow.'),
    remove: (id: number) =>
      run(() => workflowService.remove(resolveContext(), id), 'Failed to delete the workflow.'),
  }
}

/**
 * One workflow: its steps and its live run state.
 *
 * `runState` is held separately from `detail` so reporting a step outcome
 * repaints the diagram without refetching the whole workflow.
 */
export function useWorkflowDetail(id: number | null) {
  const resolveContext = useLaravelContext()

  const [detail, setDetail] = useState<WorkflowDetail | null>(null)
  const [runState, setRunState] = useState<WorkflowRun | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (id == null) {
      setDetail(null)
      setRunState(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await workflowService.get(resolveContext(), id)
      setDetail(response.data)
      setRunState(response.data.latest_run ?? null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the workflow.'))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [id, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const withBusy = useCallback(
    async <T>(action: () => Promise<T>, onDone?: (result: T) => void): Promise<AgenticMutationResult> => {
      setBusy(true)
      setError(null)
      try {
        const result = await action()
        onDone?.(result)
        return { ok: true, message: 'Done' }
      } catch (actionError) {
        const message = toMessage(actionError, 'That action failed.')
        setError(message)
        return { ok: false, message }
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  return {
    detail,
    runState,
    loading,
    busy,
    error,
    retry: load,
    addStep: (payload: WorkflowStepPayload) =>
      withBusy(() => workflowService.addStep(resolveContext(), id!, payload), () => load()),
    removeStep: (stepId: number) =>
      withBusy(() => workflowService.removeStep(resolveContext(), id!, stepId), () => load()),
    startRun: () =>
      withBusy(
        () => workflowService.run(resolveContext(), id!),
        (response) => setRunState(response.data),
      ),
    reportStep: (stepRunId: number, status: StepState, output?: string, error?: string) =>
      withBusy(
        () => workflowService.updateStepRun(resolveContext(), runState!.id, stepRunId, { status, output, error }),
        (response) => setRunState(response.data),
      ),
  }
}

export function useAgentMessages(workflowRunId?: number) {
  const resolveContext = useLaravelContext()
  const [messages, setMessages] = useState<Awaited<ReturnType<typeof workflowService.messages>>['data']>([])

  const load = useCallback(async () => {
    try {
      const response = await workflowService.messages(resolveContext(), workflowRunId)
      setMessages(response.data ?? [])
    } catch {
      setMessages([])
    }
  }, [resolveContext, workflowRunId])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  return { messages, retry: load }
}

/* ------------------------------------------------------------------ *
 * Reflection
 * ------------------------------------------------------------------ */

export function useReflection(days = 7) {
  const resolveContext = useLaravelContext()

  const [data, setData] = useState<ReflectionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await reflectionService.get(resolveContext(), { days })
      setData(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the reflection report.'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [days, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const analyse = useCallback(async (): Promise<AgenticMutationResult & { result?: AnalyseResult }> => {
    setAnalysing(true)
    setError(null)
    try {
      const response = await reflectionService.analyse(resolveContext(), days)
      setActionMessage(response.message)
      await load()
      return { ok: true, message: response.message, result: response.data }
    } catch (analyseError) {
      const message = toMessage(analyseError, 'Failed to run the analysis.')
      setError(message)
      return { ok: false, message }
    } finally {
      setAnalysing(false)
    }
  }, [days, load, resolveContext])

  const setOptimizationStatus = useCallback(
    async (id: number, status: OptimizationStatus): Promise<AgenticMutationResult> => {
      try {
        const response = await reflectionService.setOptimizationStatus(resolveContext(), id, status)
        setActionMessage(response.message)
        await load()
        return { ok: true, message: response.message }
      } catch (statusError) {
        const message = toMessage(statusError, 'Failed to update the recommendation.')
        setError(message)
        return { ok: false, message }
      }
    },
    [load, resolveContext],
  )

  return {
    data,
    loading,
    analysing,
    error,
    actionMessage,
    retry: load,
    analyse,
    setOptimizationStatus,
    clearMessages: () => {
      setActionMessage(null)
      setError(null)
    },
  }
}
