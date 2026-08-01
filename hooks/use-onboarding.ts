'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  onboardingService,
  type BulkTaskAction,
  type DocumentPayload,
  type DocumentSummary,
  type JourneyFilters,
  type JourneyPayload,
  type NotePayload,
  type OnbContact,
  type OnbDocument,
  type OnbFilterOptions,
  type OnbJourney,
  type OnbKpi,
  type OnbNote,
  type OnbOverview,
  type OnbPagination,
  type OnbProbation,
  type OnbStage,
  type OnbTask,
  type OnbTimeline,
  type OnbWorkstream,
  type ProbationDecisionPayload,
  type ProbationFilters,
  type ProbationSummary,
  type StagePayload,
  type TaskFilters,
  type TaskPayload,
  type TaskSummary,
  type TaskUpdatePayload,
} from '@/services/talent/onboarding'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** The Laravel context is rebuilt per call - it reads live storage, not React state. */
function useLaravelContext() {
  const { user } = useAuth()
  return useCallback(() => getLaravelContext(user), [user])
}

export interface MutationResult {
  ok: boolean
  message: string
  /**
   * Primary key of the record the API returned, when it sent one. Lets a caller
   * select what it just created - e.g. jumping to a brand new journey so the
   * next action does not dead-end on "no hire selected".
   */
  id?: number
}

const EMPTY_PAGINATION: OnbPagination = { page: 1, per_page: 25, total: 0, last_page: 1 }

/* ------------------------------------------------------------------ *
 * Header: KPI cards
 * ------------------------------------------------------------------ */

export function useOnboardingOverview(departmentId: string | undefined, refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [kpis, setKpis] = useState<OnbKpi[]>([])
  const [totals, setTotals] = useState<OnbOverview['totals'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await onboardingService.getOverview(resolveContext(), departmentId)
      setKpis(response.data.kpis)
      setTotals(response.data.totals)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load onboarding metrics.'))
      setKpis([])
      setTotals(null)
    } finally {
      setLoading(false)
    }
  }, [resolveContext, departmentId])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { kpis, totals, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Header: every dropdown on the screen
 * ------------------------------------------------------------------ */

export function useOnboardingFilters(refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [options, setOptions] = useState<OnbFilterOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await onboardingService.getFilters(resolveContext())
      setOptions(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load filter options.'))
      setOptions(null)
    } finally {
      setLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  /**
   * The journey the sidebar opens on: the first one still in flight, falling
   * back to the most recent, so the screen is never blank when data exists.
   */
  const defaultJourneyId = useMemo(() => {
    if (!options?.journeys?.length) return undefined
    const open = options.journeys.find((journey) => journey.status !== 'completed' && journey.status !== 'cancelled')
    return (open ?? options.journeys[0]).value
  }, [options])

  return { options, defaultJourneyId, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Journeys: the list sheet behind the search box and the KPI drill-downs
 * ------------------------------------------------------------------ */

export function useOnboardingJourneys(filters: JourneyFilters, enabled: boolean, refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [journeys, setJourneys] = useState<OnbJourney[]>([])
  const [pagination, setPagination] = useState<OnbPagination>(EMPTY_PAGINATION)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Serialising the filters keeps the effect key stable across object identity.
  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const response = await onboardingService.getJourneys(resolveContext(), JSON.parse(filterKey) as JourneyFilters)
      setJourneys(response.data)
      setPagination(response.pagination ?? EMPTY_PAGINATION)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load onboarding journeys.'))
      setJourneys([])
      setPagination(EMPTY_PAGINATION)
    } finally {
      setLoading(false)
    }
  }, [resolveContext, filterKey, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { journeys, pagination, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * The selected hire: profile card, journey timeline, contacts, notes
 * ------------------------------------------------------------------ */

export function useJourneyDetail(journeyId: number | null, refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [journey, setJourney] = useState<OnbJourney | null>(null)
  const [stages, setStages] = useState<OnbStage[]>([])
  const [stageProgress, setStageProgress] = useState(0)
  const [contacts, setContacts] = useState<OnbContact[]>([])
  const [notes, setNotes] = useState<OnbNote[]>([])
  const [documents, setDocuments] = useState<OnbDocument[]>([])
  const [documentSummary, setDocumentSummary] = useState<DocumentSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!journeyId) {
      setJourney(null)
      setStages([])
      setStageProgress(0)
      setContacts([])
      setNotes([])
      setDocuments([])
      setDocumentSummary(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const context = resolveContext()
      const [detail, stageList, contactList, noteList, documentList] = await Promise.all([
        onboardingService.getJourney(context, journeyId),
        onboardingService.getStages(context, journeyId),
        onboardingService.getContacts(context, journeyId),
        onboardingService.getNotes(context, journeyId),
        onboardingService.getDocuments(context, journeyId),
      ])

      setJourney(detail.data)
      setStages(stageList.data.stages)
      setStageProgress(stageList.data.progress_pct)
      setContacts(contactList.data)
      setNotes(noteList.data)
      setDocuments(documentList.data)
      setDocumentSummary('summary' in documentList ? documentList.summary : null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load this onboarding journey.'))
      setJourney(null)
      setStages([])
      setContacts([])
      setNotes([])
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [resolveContext, journeyId])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return {
    journey, stages, stageProgress, contacts, notes, documents, documentSummary,
    loading, error, retry: load,
  }
}

/* ------------------------------------------------------------------ *
 * Preboarding tasks: the main table
 * ------------------------------------------------------------------ */

export function useOnboardingTasks(filters: TaskFilters, refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [tasks, setTasks] = useState<OnbTask[]>([])
  const [pagination, setPagination] = useState<OnbPagination>(EMPTY_PAGINATION)
  const [summary, setSummary] = useState<TaskSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await onboardingService.getTasks(resolveContext(), JSON.parse(filterKey) as TaskFilters)
      setTasks(response.data)
      setPagination(response.pagination ?? EMPTY_PAGINATION)
      setSummary(response.summary ?? null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load preboarding tasks.'))
      setTasks([])
      setPagination(EMPTY_PAGINATION)
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [resolveContext, filterKey])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { tasks, pagination, summary, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * "Onboarding Integrations & Tasks" cards
 * ------------------------------------------------------------------ */

export function useOnboardingWorkstreams(journeyId: string | undefined, refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [workstreams, setWorkstreams] = useState<OnbWorkstream[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await onboardingService.getWorkstreams(resolveContext(), journeyId)
      setWorkstreams(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load onboarding workstreams.'))
      setWorkstreams([])
    } finally {
      setLoading(false)
    }
  }, [resolveContext, journeyId])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { workstreams, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Probation & Confirmation tab
 * ------------------------------------------------------------------ */

export function useOnboardingProbation(filters: ProbationFilters, enabled: boolean, refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [rows, setRows] = useState<OnbProbation[]>([])
  const [pagination, setPagination] = useState<OnbPagination>(EMPTY_PAGINATION)
  const [summary, setSummary] = useState<ProbationSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const response = await onboardingService.getProbation(resolveContext(), JSON.parse(filterKey) as ProbationFilters)
      setRows(response.data)
      setPagination(response.pagination ?? EMPTY_PAGINATION)
      setSummary(response.summary ?? null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load probation records.'))
      setRows([])
      setPagination(EMPTY_PAGINATION)
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [resolveContext, filterKey, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { rows, pagination, summary, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Lifecycle Timeline tab
 * ------------------------------------------------------------------ */

export function useLifecycleTimeline(journeyId: number | null, enabled: boolean, refreshKey: number) {
  const resolveContext = useLaravelContext()

  const [timeline, setTimeline] = useState<OnbTimeline | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled || !journeyId) {
      setTimeline(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await onboardingService.getTimeline(resolveContext(), journeyId)
      setTimeline(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the lifecycle timeline.'))
      setTimeline(null)
    } finally {
      setLoading(false)
    }
  }, [resolveContext, journeyId, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { timeline, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Mutations - every write the screen can make
 * ------------------------------------------------------------------ */

export function useOnboardingMutations() {
  const resolveContext = useLaravelContext()
  const [saving, setSaving] = useState(false)

  const run = useCallback(
    async (
      operation: () => Promise<{ message?: string; data?: unknown }>,
      fallback: string,
    ): Promise<MutationResult> => {
      setSaving(true)
      try {
        const response = await operation()
        const id = (response?.data as { id?: unknown } | undefined)?.id
        return {
          ok: true,
          message: response?.message || fallback,
          id: typeof id === 'number' ? id : undefined,
        }
      } catch (error) {
        return { ok: false, message: toMessage(error, `${fallback} failed.`) }
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  /* -- Journeys -- */
  const createJourney = useCallback(
    (payload: JourneyPayload) =>
      run(() => onboardingService.createJourney(resolveContext(), payload), 'Onboarding journey created'),
    [run, resolveContext],
  )

  const createJourneyFromOffer = useCallback(
    (offerId: number) =>
      run(() => onboardingService.createJourneyFromOffer(resolveContext(), offerId), 'Onboarding started'),
    [run, resolveContext],
  )

  const updateJourney = useCallback(
    (id: number, payload: Partial<JourneyPayload>) =>
      run(() => onboardingService.updateJourney(resolveContext(), id, payload), 'Onboarding journey updated'),
    [run, resolveContext],
  )

  const deleteJourney = useCallback(
    (id: number) => run(() => onboardingService.deleteJourney(resolveContext(), id), 'Onboarding journey deleted'),
    [run, resolveContext],
  )

  /* -- Journey stages -- */
  const updateStage = useCallback(
    (id: number, payload: StagePayload) =>
      run(() => onboardingService.updateStage(resolveContext(), id, payload), 'Journey stage updated'),
    [run, resolveContext],
  )

  const completeStage = useCallback(
    (id: number, reopen = false) =>
      run(
        () => onboardingService.completeStage(resolveContext(), id, reopen),
        reopen ? 'Stage reopened' : 'Stage marked complete',
      ),
    [run, resolveContext],
  )

  /* -- Tasks -- */
  const createTask = useCallback(
    (payload: TaskPayload) => run(() => onboardingService.createTask(resolveContext(), payload), 'Task added'),
    [run, resolveContext],
  )

  const updateTask = useCallback(
    (id: number, payload: TaskUpdatePayload) =>
      run(() => onboardingService.updateTask(resolveContext(), id, payload), 'Task updated'),
    [run, resolveContext],
  )

  const completeTask = useCallback(
    (id: number, reopen = false) =>
      run(
        () => onboardingService.completeTask(resolveContext(), id, reopen),
        reopen ? 'Task reopened' : 'Task marked complete',
      ),
    [run, resolveContext],
  )

  const deleteTask = useCallback(
    (id: number) => run(() => onboardingService.deleteTask(resolveContext(), id), 'Task deleted'),
    [run, resolveContext],
  )

  const bulkTasks = useCallback(
    (action: BulkTaskAction, taskIds: number[], extra?: { owner_id?: number; owner_label?: string }) =>
      run(() => onboardingService.bulkTasks(resolveContext(), action, taskIds, extra), 'Tasks updated'),
    [run, resolveContext],
  )

  /* -- Documents -- */
  const createDocument = useCallback(
    (journeyId: number, payload: DocumentPayload) =>
      run(() => onboardingService.createDocument(resolveContext(), journeyId, payload), 'Document added'),
    [run, resolveContext],
  )

  const uploadDocument = useCallback(
    (journeyId: number, file: File, meta: DocumentPayload) => {
      const form = new FormData()
      form.set('file', file)
      form.set('title', meta.title)
      if (meta.document_type_id) form.set('document_type_id', String(meta.document_type_id))
      if (meta.due_date) form.set('due_date', meta.due_date)
      if (meta.remarks) form.set('remarks', meta.remarks)
      form.set('is_mandatory', meta.is_mandatory === false ? '0' : '1')

      return run(() => onboardingService.uploadDocument(resolveContext(), journeyId, form), 'Document uploaded')
    },
    [run, resolveContext],
  )

  const uploadDocumentFile = useCallback(
    (id: number, file: File) => {
      const form = new FormData()
      form.set('file', file)
      return run(() => onboardingService.uploadDocumentFile(resolveContext(), id, form), 'Document uploaded')
    },
    [run, resolveContext],
  )

  const updateDocument = useCallback(
    (id: number, payload: Partial<DocumentPayload>) =>
      run(() => onboardingService.updateDocument(resolveContext(), id, payload), 'Document updated'),
    [run, resolveContext],
  )

  const deleteDocument = useCallback(
    (id: number) => run(() => onboardingService.deleteDocument(resolveContext(), id), 'Document deleted'),
    [run, resolveContext],
  )

  /* -- Notes -- */
  const createNote = useCallback(
    (journeyId: number, payload: NotePayload) =>
      run(() => onboardingService.createNote(resolveContext(), journeyId, payload), 'Note added'),
    [run, resolveContext],
  )

  const updateNote = useCallback(
    (id: number, payload: Partial<NotePayload>) =>
      run(() => onboardingService.updateNote(resolveContext(), id, payload), 'Note updated'),
    [run, resolveContext],
  )

  const deleteNote = useCallback(
    (id: number) => run(() => onboardingService.deleteNote(resolveContext(), id), 'Note deleted'),
    [run, resolveContext],
  )

  /* -- Probation -- */
  const updateProbation = useCallback(
    (journeyId: number, payload: { probation_start: string; probation_end: string }) =>
      run(() => onboardingService.updateProbation(resolveContext(), journeyId, payload), 'Probation window updated'),
    [run, resolveContext],
  )

  const decideProbation = useCallback(
    (journeyId: number, decision: 'confirm' | 'extend' | 'terminate', payload: ProbationDecisionPayload = {}) =>
      run(
        () => onboardingService.decideProbation(resolveContext(), journeyId, decision, payload),
        decision === 'confirm' ? 'Employee confirmed' : decision === 'extend' ? 'Probation extended' : 'Probation terminated',
      ),
    [run, resolveContext],
  )

  return {
    saving,
    createJourney,
    createJourneyFromOffer,
    updateJourney,
    deleteJourney,
    updateStage,
    completeStage,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    bulkTasks,
    createDocument,
    uploadDocument,
    uploadDocumentFile,
    updateDocument,
    deleteDocument,
    createNote,
    updateNote,
    deleteNote,
    updateProbation,
    decideProbation,
  }
}
