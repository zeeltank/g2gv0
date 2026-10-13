'use client'

import { useCallback, useState } from 'react'

import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import { saveBlob } from '@/components/domain/hrms/hrit/payroll-management/shared/payroll-shell'

/**
 * One quote PDF download - mirrors usePayslipDownload()'s exact shape (same
 * three rules: Bearer-header auth via apiClient.getBlob, never a token in
 * the URL; a refusal surfaces as a message, not a blank tab; a single
 * download in flight at a time).
 */
export function useQuotePdfDownload() {
  const [downloadingFor, setDownloadingFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const download = useCallback(async (quoteId: string, quoteNo: string | null) => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setError('Your session is not ready yet. Reload the page and try again.')
      return
    }

    setDownloadingFor(quoteId)
    setError(null)
    try {
      const blob = await crmService.downloadQuotePdf(context, quoteId)
      saveBlob(`quote-${quoteNo ?? quoteId}.pdf`, blob)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This quote PDF could not be produced.')
    } finally {
      setDownloadingFor(null)
    }
  }, [])

  return {
    download,
    downloadingFor,
    busy: downloadingFor !== null,
    error,
    clearError,
  }
}
