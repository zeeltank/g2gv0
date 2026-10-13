import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ADDITIONAL_AI_STACKS, CENTRAL_AI_STACKS } from './central'

test('the Main Dashboard and Agentic AI each have an AI Stack, keyed by their own ai_modules key', () => {
  const keys = Object.values(ADDITIONAL_AI_STACKS).map((stack) => stack.key).sort()
  assert.deepEqual(keys, ['agentic_ai', 'main_dashboard'])
})

test('they are resolved from their own menu rows and collide with no existing module', () => {
  const existing = Object.values(CENTRAL_AI_STACKS)
  for (const stack of Object.values(ADDITIONAL_AI_STACKS)) {
    assert.equal(existing.some((other) => other.key === stack.key), false)
    assert.equal(existing.some((other) => other.route === stack.route), false)
    assert.equal(existing.some((other) => other.menuSlug === stack.menuSlug), false)
  }
  assert.equal(ADDITIONAL_AI_STACKS.dashboard.route, '/dashboard')
  assert.equal(ADDITIONAL_AI_STACKS.agentic.route, '/module/agentic-ai')
})

test('each one reads its own module\'s sources by default and offers a preset per source', () => {
  for (const stack of Object.values(ADDITIONAL_AI_STACKS)) {
    assert.ok(stack.report.defaultDataSource.startsWith(stack.key === 'main_dashboard' ? 'dashboard.' : 'agentic.'))
    assert.ok(stack.presets.length >= 2)
    assert.ok(stack.presets.every((preset) => preset.module === stack.key))
  }
})
