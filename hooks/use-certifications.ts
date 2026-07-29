'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  certificationService,
  type BulkCertificationAction,
  type CertificationAuditEntry,
  type CertificationCompliance,
  type CertificationDetail,
  type CertificationDocument,
  type CertificationFilterOptions,
  type CertificationHistoryEntry,
  type CertificationItem,
  type CertificationListParams,
  type CertificationMetrics,
  type CertificationPagination,
  type CertificationPayload,
  type CertificationRequirement,
  type CertificationRequirementMatch,
  type CertificationRequirementPayload,
  type RequirementSummary,
} from '@/services/competency'

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
}

/* ------------------------------------------------------------------ *
 * List + KPIs + filter options + mutations
 * ------------------------------------------------------------------ */

export interface UseCertificationsState {
  loading: boolean
  error: string | null
  items: CertificationItem[]
  pagination: CertificationPagination | null
  metrics: CertificationMetrics | null
  metricsLoading: boolean
  filterOptions: CertificationFilterOptions | null
  saving: boolean
  actionMessage: string | null
  actionError: string | null
  retry: () => void
  create: (payload: CertificationPayload) => Promise<MutationResult>
  update: (id: number, payload: Partial<CertificationPayload>) => Promise<MutationResult>
  remove: (id: number) => Promise<MutationResult>
  bulk: (action: BulkCertificationAction, ids: number[], status?: string) => Promise<MutationResult>
  exportRows: () => Promise<CertificationItem[]>
  clearMessages: () => void
}

export function useCertifications(params: CertificationListParams): UseCertificationsState {
  const resolveContext = useLaravelContext()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<CertificationItem[]>([])
  const [pagination, setPagination] = useState<CertificationPagination | null>(null)

  const [metrics, setMetrics] = useState<CertificationMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [filterOptions, setFilterOptions] = useState<CertificationFilterOptions | null>(null)

  const [saving, setSaving] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Serialised so the effect only refires when a param value actually changes.
  const paramsKey = JSON.stringify(params)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await certificationService.list(
        resolveContext(),
        JSON.parse(paramsKey) as CertificationListParams,
      )
      setItems(response.data ?? [])
      setPagination(response.pagination ?? null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load certifications.'))
      setItems([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }, [paramsKey, resolveContext])

  // KPIs and filter options are tenant-wide, so they do not refetch per filter
  // change - only when a mutation invalidates them.
  const loadAggregates = useCallback(async () => {
    setMetricsLoading(true)
    try {
      const [metricsResponse, filtersResponse] = await Promise.all([
        certificationService.metrics(resolveContext()),
        certificationService.filterOptions(resolveContext()),
      ])
      setMetrics(metricsResponse.data ?? null)
      setFilterOptions(filtersResponse.data ?? null)
    } catch {
      // The list carries its own error surface; a failed KPI fetch just leaves
      // the cards in their loading-empty state rather than blanking the screen.
      setMetrics(null)
    } finally {
      setMetricsLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  useEffect(() => {
    queueMicrotask(() => {
      loadAggregates()
    })
  }, [loadAggregates])

  const runMutation = useCallback(
    async (action: () => Promise<{ message: string }>, fallback: string): Promise<MutationResult> => {
      setSaving(true)
      setActionError(null)
      setActionMessage(null)

      try {
        const response = await action()
        setActionMessage(response.message)
        await Promise.all([load(), loadAggregates()])
        return { ok: true, message: response.message }
      } catch (mutationError) {
        const message = toMessage(mutationError, fallback)
        setActionError(message)
        return { ok: false, message }
      } finally {
        setSaving(false)
      }
    },
    [load, loadAggregates],
  )

  const create = useCallback(
    (payload: CertificationPayload) =>
      runMutation(
        () => certificationService.create(resolveContext(), payload),
        'Failed to add the certification.',
      ),
    [runMutation, resolveContext],
  )

  const update = useCallback(
    (id: number, payload: Partial<CertificationPayload>) =>
      runMutation(
        () => certificationService.update(resolveContext(), id, payload),
        'Failed to update the certification.',
      ),
    [runMutation, resolveContext],
  )

  const remove = useCallback(
    (id: number) =>
      runMutation(
        () => certificationService.remove(resolveContext(), id),
        'Failed to delete the certification.',
      ),
    [runMutation, resolveContext],
  )

  const bulk = useCallback(
    (action: BulkCertificationAction, ids: number[], status?: string) =>
      runMutation(
        () => certificationService.bulk(resolveContext(), action, ids, status),
        'Bulk action failed.',
      ),
    [runMutation, resolveContext],
  )

  const exportRows = useCallback(async () => {
    const response = await certificationService.exportRows(
      resolveContext(),
      JSON.parse(paramsKey) as CertificationListParams,
    )
    return response.data ?? []
  }, [paramsKey, resolveContext])

  return {
    loading,
    error,
    items,
    pagination,
    metrics,
    metricsLoading,
    filterOptions,
    saving,
    actionMessage,
    actionError,
    retry: load,
    create,
    update,
    remove,
    bulk,
    exportRows,
    clearMessages: () => {
      setActionMessage(null)
      setActionError(null)
    },
  }
}

/* ------------------------------------------------------------------ *
 * Side panel: Overview / Compliance / Requirements / Documents / History
 * ------------------------------------------------------------------ */

export type CertificationPanelTab = 'overview' | 'compliance' | 'requirements' | 'documents' | 'history'

export interface UseCertificationDetailState {
  detail: CertificationDetail | null
  loading: boolean
  error: string | null
  tabLoading: boolean
  tabError: string | null
  compliance: CertificationCompliance | null
  requirements: CertificationRequirementMatch[]
  requirementSummary: RequirementSummary | null
  documents: CertificationDocument[]
  history: CertificationHistoryEntry[]
  audit: CertificationAuditEntry[]
  reload: () => void
  addNote: (note: string) => Promise<MutationResult>
  addDocument: (payload: {
    title: string
    description?: string
    link?: string
    file?: File | null
  }) => Promise<MutationResult>
  removeDocument: (documentId: number) => Promise<MutationResult>
}

/**
 * Loads the selected credential plus whichever panel tab is open. The Overview
 * payload is fetched once per credential; the other tabs fetch on first view so
 * opening the panel does not fire five requests.
 */
export function useCertificationDetail(
  id: number | null,
  tab: CertificationPanelTab,
): UseCertificationDetailState {
  const resolveContext = useLaravelContext()

  const [detail, setDetail] = useState<CertificationDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tabLoading, setTabLoading] = useState(false)
  const [tabError, setTabError] = useState<string | null>(null)
  const [compliance, setCompliance] = useState<CertificationCompliance | null>(null)
  const [requirements, setRequirements] = useState<CertificationRequirementMatch[]>([])
  const [requirementSummary, setRequirementSummary] = useState<RequirementSummary | null>(null)
  const [documents, setDocuments] = useState<CertificationDocument[]>([])
  const [history, setHistory] = useState<CertificationHistoryEntry[]>([])
  const [audit, setAudit] = useState<CertificationAuditEntry[]>([])

  // Bumped by mutations to force a refetch of the open tab.
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
        const response = await certificationService.get(resolveContext(), id)
        if (!cancelled) setDetail(response.data)
      } catch (err) {
        if (!cancelled) {
          setError(toMessage(err, 'Failed to load the certification.'))
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

  useEffect(() => {
    let cancelled = false
    queueMicrotask(async () => {
      if (id == null || tab === 'overview') return

      setTabLoading(true)
      setTabError(null)
      try {
        if (tab === 'compliance') {
          const response = await certificationService.compliance(resolveContext(), id)
          if (!cancelled) setCompliance(response.data)
        } else if (tab === 'requirements') {
          const response = await certificationService.requirementsFor(resolveContext(), id)
          if (!cancelled) {
            setRequirements(response.data ?? [])
            setRequirementSummary(response.summary ?? null)
          }
        } else if (tab === 'documents') {
          const response = await certificationService.documents(resolveContext(), id)
          if (!cancelled) setDocuments(response.data ?? [])
        } else if (tab === 'history') {
          const response = await certificationService.history(resolveContext(), id)
          if (!cancelled) {
            setHistory(response.data ?? [])
            setAudit(response.audit ?? [])
          }
        }
      } catch (err) {
        if (!cancelled) setTabError(toMessage(err, 'Failed to load this tab.'))
      } finally {
        if (!cancelled) setTabLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [id, tab, resolveContext, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  const runMutation = useCallback(
    async (action: () => Promise<{ message: string }>, fallback: string): Promise<MutationResult> => {
      try {
        const response = await action()
        setNonce((n) => n + 1)
        return { ok: true, message: response.message }
      } catch (err) {
        return { ok: false, message: toMessage(err, fallback) }
      }
    },
    [],
  )

  const addNote = useCallback(
    (note: string) =>
      runMutation(
        () => certificationService.addNote(resolveContext(), id as number, note),
        'Failed to add the note.',
      ),
    [runMutation, resolveContext, id],
  )

  const addDocument = useCallback(
    (payload: { title: string; description?: string; link?: string; file?: File | null }) =>
      runMutation(
        () => certificationService.addDocument(resolveContext(), id as number, payload),
        'Failed to attach the document.',
      ),
    [runMutation, resolveContext, id],
  )

  const removeDocument = useCallback(
    (documentId: number) =>
      runMutation(
        () => certificationService.removeDocument(resolveContext(), id as number, documentId),
        'Failed to remove the document.',
      ),
    [runMutation, resolveContext, id],
  )

  return {
    detail,
    loading,
    error,
    tabLoading,
    tabError,
    compliance,
    requirements,
    requirementSummary,
    documents,
    history,
    audit,
    reload,
    addNote,
    addDocument,
    removeDocument,
  }
}

/* ------------------------------------------------------------------ *
 * Requirements master (the "Add Certification Requirement" flow)
 * ------------------------------------------------------------------ */

export interface UseCertificationRequirementsState {
  requirements: CertificationRequirement[]
  loading: boolean
  error: string | null
  saving: boolean
  create: (payload: CertificationRequirementPayload) => Promise<MutationResult>
  update: (id: number, payload: Partial<CertificationRequirementPayload>) => Promise<MutationResult>
  remove: (id: number) => Promise<MutationResult>
  retry: () => void
}

export function useCertificationRequirements(enabled: boolean): UseCertificationRequirementsState {
  const resolveContext = useLaravelContext()

  const [requirements, setRequirements] = useState<CertificationRequirement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const response = await certificationService.listRequirements(resolveContext(), { per_page: 200 })
      setRequirements(response.data ?? [])
    } catch (err) {
      setError(toMessage(err, 'Failed to load certification requirements.'))
      setRequirements([])
    } finally {
      setLoading(false)
    }
  }, [enabled, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const runMutation = useCallback(
    async (action: () => Promise<{ message: string }>, fallback: string): Promise<MutationResult> => {
      setSaving(true)
      try {
        const response = await action()
        await load()
        return { ok: true, message: response.message }
      } catch (err) {
        return { ok: false, message: toMessage(err, fallback) }
      } finally {
        setSaving(false)
      }
    },
    [load],
  )

  const create = useCallback(
    (payload: CertificationRequirementPayload) =>
      runMutation(
        () => certificationService.createRequirement(resolveContext(), payload),
        'Failed to create the requirement.',
      ),
    [runMutation, resolveContext],
  )

  const update = useCallback(
    (id: number, payload: Partial<CertificationRequirementPayload>) =>
      runMutation(
        () => certificationService.updateRequirement(resolveContext(), id, payload),
        'Failed to update the requirement.',
      ),
    [runMutation, resolveContext],
  )

  const remove = useCallback(
    (id: number) =>
      runMutation(
        () => certificationService.removeRequirement(resolveContext(), id),
        'Failed to delete the requirement.',
      ),
    [runMutation, resolveContext],
  )

  return { requirements, loading, error, saving, create, update, remove, retry: load }
}

/* ------------------------------------------------------------------ *
 * Employee picker for the create dialogs
 * ------------------------------------------------------------------ */

export interface EmployeeOption {
  id: number
  name: string
  initials: string
  employee_no: string | null
  jobrole: string | null
  department_id: number | null
}

export function useCertificationEmployees(enabled: boolean) {
  const resolveContext = useLaravelContext()
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(async () => {
      if (!enabled) return
      setLoading(true)
      try {
        const response = await certificationService.employeeOptions(resolveContext())
        if (!cancelled) setEmployees(response.data ?? [])
      } catch {
        if (!cancelled) setEmployees([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [enabled, resolveContext])

  const options = useMemo(
    () => employees.map((employee) => ({ value: String(employee.id), label: employee.name })),
    [employees],
  )

  return { employees, options, loading }
}
