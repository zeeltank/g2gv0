'use client'

import { useCallback, useState } from 'react'

import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import { saveBlob } from '@/components/domain/hrms/hrit/payroll-management/shared/payroll-shell'

/** One invoice PDF download - same shape as useQuotePdfDownload(), its direct sibling. */
export function useInvoicePdfDownload() {
  const [downloadingFor, setDownloadingFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const download = useCallback(async (invoiceId: string, invoiceNo: string | null) => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setError('Your session is not ready yet. Reload the page and try again.')
      return
    }

    setDownloadingFor(invoiceId)
    setError(null)
    try {
      const blob = await crmService.downloadInvoicePdf(context, invoiceId)
      saveBlob(`invoice-${invoiceNo ?? invoiceId}.pdf`, blob)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This invoice PDF could not be produced.')
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
