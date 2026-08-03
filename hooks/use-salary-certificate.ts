'use client'

import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { toMessage, useLaravelContext, type PayrollOption } from '@/hooks/use-payroll-shared'
import {
  payrollService,
  salaryCertificatePdfUrl,
  type SalaryCertificateIndexResponse,
  type SalaryCertificateQuery,
  type SalaryCertificateReportResponse,
} from '@/services/hrms'

/**
 * Salary Certificate - GET /hrms-salary-certificate for the pickers,
 * POST /hrms-salary-certificate-report to render and persist the certificate,
 * and GET /salary-certificate-pdf-download to stream the PDF.
 *
 * The earning heads come from the index action (payroll_type = 1 only), which
 * replaces the hardcoded Basic/HRA/DA/Bonus list the legacy screen shipped with.
 */
export function useSalaryCertificate() {
  const resolveContext = useLaravelContext()
  const { isLoading: authLoading } = useAuth()

  const [optionsLoading, setOptionsLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [options, setOptions] = useState<SalaryCertificateIndexResponse | null>(null)
  const [lastResult, setLastResult] = useState<SalaryCertificateReportResponse | null>(null)
  const [lastQuery, setLastQuery] = useState<SalaryCertificateQuery | null>(null)

  useEffect(() => {
    if (authLoading) return
    let cancelled = false

    const load = async () => {
      const context = resolveContext()
      if (!isLaravelContextReady(context)) {
        setError('Your session could not be resolved. Please sign in again.')
        setOptionsLoading(false)
        return
      }

      try {
        const response = await payrollService.getSalaryCertificateOptions(context)
        if (!cancelled) setOptions(response)
      } catch (loadError) {
        if (!cancelled) setError(toMessage(loadError, 'Failed to load salary certificate options.'))
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [authLoading, resolveContext])

  const months = useMemo<PayrollOption[]>(
    () => Object.entries(options?.month_ids ?? {}).map(([value, label]) => ({ value, label })),
    [options],
  )

  const earningHeads = useMemo<PayrollOption[]>(
    () =>
      (options?.payrollTypes ?? []).map((payrollType) => ({
        value: String(payrollType.id),
        label: payrollType.payroll_name ?? '',
      })),
    [options],
  )

  const years = useMemo(() => (options?.years ?? []).map(String), [options])

  return {
    optionsLoading,
    processing,
    error,
    actionMessage,
    months,
    earningHeads,
    years,
    lastResult,
    lastQuery,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
    generate: async (query: SalaryCertificateQuery) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await payrollService.generateSalaryCertificate(resolveContext(), query)
        setLastResult(response)
        setLastQuery(query)
        setActionMessage('Salary certificate generated. Use Download PDF to save a copy.')
        return { ok: true as const, message: 'Salary certificate generated.' }
      } catch (generateError) {
        const message = toMessage(
          generateError,
          'Failed to generate the certificate. Check that the employee has a salary structure for the selected year.',
        )
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    /** Only valid once `generate` has persisted the certificate HTML. */
    pdfUrl: () => {
      if (!lastQuery) return null
      const context = resolveContext()
      if (!isLaravelContextReady(context)) return null
      return salaryCertificatePdfUrl(context, {
        employeeId: lastQuery.employeeId,
        year: lastQuery.year,
      })
    },
  }
}
