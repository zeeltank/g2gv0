export interface SplitErrors {
  /** Messages for a field of the form, keyed by the field's name. */
  byField: Record<string, string[]>
  /** Messages the form has no field for (a refusal, a clash with another record): shown together at the top. */
  unplaced: string[]
}

/**
 * Splits the server's field-keyed errors (the `errors` of a 403, 404, 409 or 422 answer) into those shown next to a field of this form and those the
 * form has no field for. A key matches a field exactly, or as a parent: "about.needsSolved.2" belongs to the field "about.needsSolved". When several
 * fields match, the most specific wins. Repeated messages are shown once.
 */
export function splitFieldErrors(errors: Record<string, readonly string[]> | null | undefined, fields: readonly string[]): SplitErrors {
  const byField: Record<string, string[]> = {}
  const unplaced: string[] = []

  for (const [key, messages] of Object.entries(errors ?? {})) {
    const field = fields
      .filter((name) => key === name || key.startsWith(`${name}.`))
      .sort((a, b) => b.length - a.length)[0]
    const target = field !== undefined ? (byField[field] ??= []) : unplaced
    for (const message of messages) {
      if (!target.includes(message)) target.push(message)
    }
  }

  return { byField, unplaced }
}
