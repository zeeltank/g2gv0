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
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  lmsCertificateService,
  lmsDashboardService,
  lmsLearningService,
  type CertificateVerification,
  type EnrolledCourse,
  type LearningCertificate,
  type LearningCourseSummary,
} from '@/services/lms'

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
export interface CertificationKpis {
  active: number
  expiring: number
  expired: number
  total: number
}

export interface CertificationsState {
  certificates: LearningCertificate[]
  /** Completed enrolments — the learning transcript. */
  transcript: EnrolledCourse[]
  /** Every enrolled course with its progress — the completion history. */
  history: LearningCourseSummary[]
  /** Certificates that are expiring or already expired. */
  renewals: LearningCertificate[]

  kpis: CertificationKpis
  /** The server's "expiring soon" window, so the UI never hardcodes it. */
  warningDays: number
  /** 'all' only when the caller is admin/HR — the API decides, not the client. */
  scope: 'mine' | 'all'
  isOrgWide: boolean

  loading: boolean
  error: string | null
  reload: () => void

  search: string
  setSearch: (value: string) => void
  statusFilter: string
  setStatusFilter: (value: string) => void

  filteredCertificates: LearningCertificate[]

  /** True when the signed-in user may re-issue — admin/HR only, enforced server-side too. */
  canReissue: boolean
  /** Absolute URL of the rendered PDF, for a download navigation. */
  certificateUrl: (certificateId: number) => string
  reissue: (certificateId: number) => Promise<{ ok: boolean; message: string }>
  verify: (code: string) => Promise<CertificateVerification | null>

  busy: boolean
  message: string | null
  actionError: string | null
  dismiss: () => void
}

export function useCertifications(): CertificationsState {
  const { user } = useAuth()
  const resolveContext = useCallback(() => getLaravelContext(user), [user])
  const profileName = user?.profileName
  const canSeeAll = user?.role === 'admin' || user?.role === 'hr'

  const [certificates, setCertificates] = useState<LearningCertificate[]>([])
  const [transcript, setTranscript] = useState<EnrolledCourse[]>([])
  const [history, setHistory] = useState<LearningCourseSummary[]>([])
  const [warningDays, setWarningDays] = useState(90)
  const [scope, setScope] = useState<'mine' | 'all'>('mine')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      setError('Your session has expired. Sign in again to view records.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [certResponse, enrolledResponse, coursesResponse] = await Promise.all([
        lmsCertificateService.list(context, {
          // Asking for 'all' as a non-admin is silently downgraded server-side;
          // requesting it only when entitled keeps the intent honest.
          scope: canSeeAll ? 'all' : 'mine',
          search: debouncedSearch || undefined,
          profileName,
        }),
        lmsDashboardService.getEnrolledCourses(context),
        lmsLearningService.getMyCourses(context),
      ])

      setCertificates(certResponse.data ?? [])
      setWarningDays(certResponse.meta?.warning_days ?? 90)
      setScope(certResponse.meta?.scope ?? 'mine')

      setTranscript((enrolledResponse.data ?? []).filter((c) => c.enrollment_status === 'completed'))
      setHistory(coursesResponse.data ?? [])
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load certifications and records.'))
      setCertificates([])
    } finally {
      setLoading(false)
    }
  }, [resolveContext, canSeeAll, debouncedSearch, profileName])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const kpis = useMemo<CertificationKpis>(
    () => ({
      active: certificates.filter((c) => c.expiry_state === 'active').length,
      expiring: certificates.filter((c) => c.expiry_state === 'expiring').length,
      expired: certificates.filter((c) => c.expiry_state === 'expired').length,
      total: certificates.length,
    }),
    [certificates],
  )

  const renewals = useMemo(
    () =>
      certificates
        .filter((c) => c.expiry_state === 'expiring' || c.expiry_state === 'expired')
        // Soonest (and most overdue) first.
        .sort((a, b) => (a.days_to_expiry ?? 0) - (b.days_to_expiry ?? 0)),
    [certificates],
  )

  const certificateUrl = useCallback(
    (certificateId: number) => lmsCertificateService.downloadUrl(resolveContext(), certificateId),
    [resolveContext],
  )

  const reissue = useCallback(
    async (certificateId: number) => {
      setBusy(true)
      setActionError(null)
      setMessage(null)

      try {
        const response = await lmsCertificateService.reissue(
          resolveContext(),
          certificateId,
          profileName,
        )
        // The replacement is a new row, so the list has to come back from the
        // server rather than being patched in place.
        await load()

        const success = response.data?.certificate_number
          ? `Re-issued as ${response.data.certificate_number}.`
          : 'Certificate re-issued.'
        setMessage(success)
        return { ok: true, message: success }
      } catch (reissueError) {
        const failure = toMessage(reissueError, 'Failed to re-issue the certificate.')
        setActionError(failure)
        return { ok: false, message: failure }
      } finally {
        setBusy(false)
      }
    },
    [resolveContext, profileName, load],
  )

  const verify = useCallback(async (code: string) => {
    setBusy(true)
    setActionError(null)

    try {
      const response = await lmsCertificateService.verify(code)
      // valid and message live on the envelope; flatten them onto the record so
      // the UI has one object to render.
      if (!response.data) return null
      return { ...response.data, valid: response.valid, message: response.message }
    } catch (verifyError) {
      setActionError(toMessage(verifyError, 'That certificate could not be verified.'))
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  // Search is applied server-side; the status filter is a client-side narrowing
  // of the same result set, so switching it costs no request.
  const filteredCertificates = useMemo(
    () =>
      statusFilter
        ? certificates.filter((c) => c.expiry_state === statusFilter)
        : certificates,
    [certificates, statusFilter],
  )

  return {
    certificates,
    transcript,
    history,
    renewals,

    kpis,
    warningDays,
    scope,
    isOrgWide: scope === 'all',

    loading,
    error,
    reload: () => void load(),

    search,
    setSearch,
    statusFilter,
    setStatusFilter,

    filteredCertificates,

    canReissue: canSeeAll,
    certificateUrl,
    reissue,
    verify,

    busy,
    message,
    actionError,
    dismiss: () => {
      setMessage(null)
      setActionError(null)
    },
  }
}
