import assert from 'node:assert/strict'

/**
 * Assertions about DOM elements that fail in words. `assert.equal(element, other)` and `assert.equal(element, null)` print the whole jsdom object graph when
 * they fail, which can take the test process down with "JavaScript heap out of memory" instead of reporting the failure: the first mutation sweep of these
 * screens met exactly that. Compare with `===` and say what was meant.
 */
export function absent(value: unknown, message: string): void {
  assert.ok(value === null || value === undefined, message)
}

export function same(actual: unknown, expected: unknown, message: string): void {
  assert.ok(actual === expected, message)
}

/**
 * "This text says that." A bare `assert.ok(text.includes(...))` that fails builds its message by reading the test's own source, and under the TypeScript
 * loader it was seen to hang for minutes instead of failing (a mutation sweep of the Autonomy tab lost 7 minutes to one). A message that is already in hand
 * avoids that, and this one also says what the text was.
 */
export function says(actual: string | null | undefined, expected: string): void {
  assert.ok(typeof actual === 'string' && actual.includes(expected), `expected the text to include ${JSON.stringify(expected)}, but it was ${JSON.stringify(actual ?? null)}`)
}
