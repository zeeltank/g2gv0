/** A bulk endpoint's per-task result array, as both /workspace/bulk routes return it. */
interface BulkResult {
  summary: { succeeded: number; failed: number }
  results: Array<{ task_id: string; ok: boolean; reason: string | null }>
}

/**
 * One line summarizing a bulk action, naming failures rather than hiding
 * them behind a bare count - a partial failure is the normal case here
 * (a batch can legally mix tasks the caller may and may not act on), not an
 * edge case to collapse into "3 succeeded".
 */
export function bulkResultMessage(action: string, data: BulkResult): string {
  const { succeeded, failed } = data.summary

  if (failed === 0) {
    return `${action} ${succeeded} task${succeeded === 1 ? '' : 's'}.`
  }

  const reasons = Array.from(new Set(data.results.filter((row) => !row.ok && row.reason).map((row) => row.reason as string)))

  return `${action} ${succeeded} of ${succeeded + failed} task${succeeded + failed === 1 ? '' : 's'}. ${failed} failed: ${reasons.join(' ')}`
}
