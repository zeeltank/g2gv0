import assert from 'node:assert/strict'
import { test } from 'node:test'

import { findModule, findTool, toolsForModule, validateToolsForModule, registerDynamicModule } from '@/lib/agents/registry'
import type { ResolvedModule } from '@/lib/intelligence/ai-module-registry'

import { CENTRAL_AI_STACKS } from './central'
import { genericAiStack, genericSpec } from './generic'

/** What the backend returns for a module it discovered; every value here stands for a runtime answer, not data. */
function resolved(overrides: Partial<ResolvedModule> = {}): ResolvedModule {
  return {
    registered: true,
    newly_registered: false,
    newly_enabled: false,
    key: 'zz_demo',
    label: 'Demo Projects',
    menu_id: 9001,
    route: '/module/zz-demo',
    menu_slug: 'zz-demo',
    sources: [
      { key: 'zz_demo.projects', label: 'Projects', description: 'Every projects record.', discovered: true, rows: 4, readable: true },
      { key: 'zz_demo.milestones', label: 'Milestones', description: 'Every milestones record.', discovered: true, rows: 9, readable: true },
      { key: 'zz_demo.empty_things', label: 'Empty Things', description: 'Nothing here.', discovered: true, rows: 0, readable: true },
      { key: 'zz_demo.hidden', label: 'Hidden', description: 'Not readable.', discovered: true, rows: null, readable: false },
    ],
    primary_source: 'zz_demo.milestones',
    discovery: { discovered: true, prefixes: ['zz_demo_'], fingerprint: 'abc', tables: [], skipped: [] },
    support: { level: 'partial', can: [], cannot: [], needs_configuration: [] },
    ...overrides,
  }
}

test('a generic stack is keyed by the backend module and nothing else', () => {
  const stack = genericAiStack(resolved())

  assert.equal(stack.key, 'zz_demo')
  assert.equal(stack.label, 'Demo Projects')
  assert.equal(stack.route, '/module/zz-demo')
  assert.equal(stack.report.defaultDataSource, 'zz_demo.milestones')
})

test('it offers only readable sources, those with records first, and never a hidden one', () => {
  const spec = genericSpec(resolved())
  const keys = spec.sources.map((source) => source.key)

  assert.deepEqual(keys, ['zz_demo.milestones', 'zz_demo.projects', 'zz_demo.empty_things'])
  assert.ok(!keys.includes('zz_demo.hidden'))
})

test('presets are capped so a module with dozens of tables does not flood the Automations tab', () => {
  const many = Array.from({ length: 60 }, (_, i) => ({
    key: `zz_demo.t${i}`, label: `T${i}`, description: '', discovered: true, rows: i, readable: true,
  }))
  const stack = genericAiStack(resolved({ sources: many, primary_source: 'zz_demo.t59' }))

  assert.equal(stack.presets.length, 12)
  assert.ok(stack.presets.every((preset) => preset.module === 'zz_demo'))
})

test('a hand-written descriptor is never shadowed by a generic one', () => {
  // The generic path is only reached for a module with no entry here.
  assert.ok(Object.values(CENTRAL_AI_STACKS).every((stack) => stack !== undefined))
  assert.equal(findModule('zz_demo'), undefined)
})

test('registering a discovered module lets the Automations tab offer and validate its tools', () => {
  const data = resolved({ key: 'zz_registered' })
  registerDynamicModule(
    { key: data.key, label: data.label, description: data.label },
    data.sources.map((s) => ({ key: s.key.replace('zz_demo', 'zz_registered'), label: s.label, description: s.description })),
  )

  assert.equal(findModule('zz_registered')?.label, 'Demo Projects')
  assert.ok(findTool('zz_registered.projects')?.available)
  assert.equal(findTool('zz_registered.projects')?.risk, 'read')
  assert.ok(toolsForModule('zz_registered').some((tool) => tool.key === 'zz_registered.projects'))
  assert.equal(validateToolsForModule('zz_registered', ['zz_registered.projects']), null)
  // Another module's tool is still refused for it.
  assert.match(validateToolsForModule('zz_registered', ['organization.employees']) ?? '', /belongs to/)
})

test('a built-in module is never overwritten by a runtime registration', () => {
  const before = findModule('lms')
  registerDynamicModule({ key: 'lms', label: 'Hijack', description: 'x' }, [{ key: 'organization.employees', label: 'X', description: 'x' }])

  assert.equal(findModule('lms'), before)
  assert.notEqual(findTool('organization.employees')?.label, 'X')
})

test('a module with nothing readable still gets a stack, without inventing a default source', () => {
  const stack = genericAiStack(resolved({ sources: [], primary_source: null }))

  assert.equal(stack.report.defaultDataSource, '')
  assert.equal(stack.presets.length, 0)
})
