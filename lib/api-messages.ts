import { ApiError } from '@/services/core'

/**
 * The sentence to show a person for a failed request. A validation failure (422) carries the server's field messages; they are listed instead of
 * the bare "Validation failed", so the person can see which field to fix. Nothing technical (URLs, SQL, stack) is added.
 */
export function apiErrorText(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const fields = Object.entries(error.errors ?? {})
      .flatMap(([field, messages]) => (Array.isArray(messages) ? messages : [String(messages)]).map((m) => `${field.replace(/_/g, ' ')}: ${m}`))
      .slice(0, 4)
    if (fields.length > 0) return fields.join(' · ')
    return error.message || fallback
  }

  return error instanceof Error && error.message ? error.message : fallback
}
