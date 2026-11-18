import type { CrmBulkActionResponse } from '@/types/crm'

/**
 * Shared bulk-result summary across all 4 CRM modules, mirroring Task
 * Management's bulkResultMessage - same {succeeded, failed, reasons} shape,
 * parameterized by the record noun instead of a hardcoded "task".
 */
export function crmBulkResultMessage(action: string, noun: string, data: CrmBulkActionResponse['data']): string {
  const { succeeded, failed } = data.summary

  if (failed === 0) {
    return `${action} ${succeeded} ${noun}${succeeded === 1 ? '' : 's'}.`
  }

  const reasons = Array.from(new Set(data.results.filter((row) => !row.ok && row.reason).map((row) => row.reason as string)))

  return `${action} ${succeeded} of ${succeeded + failed} ${noun}${succeeded + failed === 1 ? '' : 's'}. ${failed} failed: ${reasons.join(' ')}`
}
