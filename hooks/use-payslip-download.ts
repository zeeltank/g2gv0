'use client'

import { useCallback, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { downloadMonthlyPayslip } from '@/services/hrms'
import { saveBlob } from '@/components/domain/hrms/hrit/payroll-management/shared/payroll-shell'

/**
 * One payslip download, shared by every HRIT screen that shows a paid month.
 *
 * F-209. Until now the payslip existed on exactly one HR screen - the Monthly
 * Payroll data-entry grid - as an unlabelled icon in the last column, rendered
 * only when the row was saved AND the Laravel session had fully resolved. When
 * either was false the control was simply absent, with nothing to explain it.
 * Meanwhile the four screens people actually read a month's pay ON - Payroll
 * Register, Payroll History, Bank-wise Payment Advice, and the employee's own
 * My HR - offered CSV and print and no payslip at all.
 *
 * The three rules this hook exists to keep, in one place rather than four:
 *
 *   1. The token goes in the Authorization header, never the URL. A URL is
 *      written to access logs, browser history and Referer headers, and a
 *      Sanctum token harvested from one is a working credential for the whole
 *      API - not just the payslip it was meant to fetch.
 *   2. A refusal is shown to the user. The generator answers with a redirect
 *      when the employee has no salary structure for that year; opened in a new
 *      tab that was a blank page, so "nothing happened" was the entire message.
 *   3. Only one request is in flight at a time, so a double-click cannot
 *      produce two PDFs of the same month.
 */
export interface PayslipTarget {
  employeeId: number | string
  /** Only used to name the file and to word a failure. */
  employeeName?: string
  employeeNo?: string
  month: string
  year: string | number
}

export function usePayslipDownload() {
  const { user } = useAuth()

  const [downloadingFor, setDownloadingFor] = useState<string | number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const download = useCallback(
    async (target: PayslipTarget) => {
      const context = getLaravelContext(user)
      if (!isLaravelContextReady(context)) {
        // Previously this branch hid the button. Saying so is the whole fix.
        setError('Your session is not ready yet. Reload the page and try again.')
        return
      }

      setDownloadingFor(target.employeeId)
      setError(null)
      try {
        const blob = await downloadMonthlyPayslip(context, {
          employeeId: target.employeeId,
          month: target.month,
          year: target.year,
        })
        const who = target.employeeNo || target.employeeId
        saveBlob(`payslip-${who}-${target.month}-${target.year}.pdf`, blob)
      } catch (caught) {
        const who = target.employeeName ? `${target.employeeName}: ` : ''
        setError(
          caught instanceof Error
            ? `${who}${caught.message}`
            : `${who}the ${target.month} ${target.year} payslip could not be produced.`,
        )
      } finally {
        setDownloadingFor(null)
      }
    },
    [user],
  )

  return {
    download,
    /** The employee whose payslip is being built, or null. */
    downloadingFor,
    /** True while any download is in flight - disable every button, not one. */
    busy: downloadingFor !== null,
    error,
    clearError,
  }
}
