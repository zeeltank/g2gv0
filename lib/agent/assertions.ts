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
