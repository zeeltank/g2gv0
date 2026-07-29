'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
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
