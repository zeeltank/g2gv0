import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ATLAS } from './atlas'
import { firstBeatOfTab, stepsOfTab, tabForCode, tabOfBeat, tourBeats, tourSteps, tourTabs, type AtlasTour } from './tour'

const sub = (id: string) => ({ id, name: id, tagline: 't', shot: null })
function sample(research = 0): AtlasTour {
  return {
    summary: { lines: ['a', 'b', 'c'] },
    problem: { label: 'l', beats: ['1', '2', '3'], turn: 't', scattered: ['a', 'b', 'c'], record: 'r' },
    intelligence: { lead: 'l', modules: [], close: 'c' },
    ai: { lead: 'l', uses: [], guard: 'g', control: 'c', sample: { label: 'l', text: 't' } },
    research: { items: Array.from({ length: research }, (_, i) => ({ text: `r${i}`, source: 's' })) },
    features: { groups: [{ title: 'g1', subs: [sub('a'), sub('b'), sub('c')] }, { title: 'g2', subs: [sub('d'), sub('e'), sub('f')] }] },
    roles: [{ role: 'r1', who: 'w', benefits: ['1', '2', '3'], use: 'u', modules: [] }, { role: 'r2', who: 'w', benefits: ['1', '2', '3'], use: 'u', modules: [] }, { role: 'r3', who: 'w', benefits: ['1', '2', '3'], use: 'u', modules: [] }],
  }
}

test('Research is hidden until it has items, and then takes exactly one step', () => {
  assert.deepEqual(tourTabs(sample(0)), ['summary', 'problem', 'intelligence', 'ai', 'features', 'roles'])
  assert.deepEqual(tourTabs(sample(2)), ['summary', 'problem', 'intelligence', 'ai', 'research', 'features', 'roles'])
  assert.equal(stepsOfTab(sample(0), 'research'), 0)
  assert.equal(stepsOfTab(sample(5), 'research'), 1)
})

test('one beat per step: one each for the short tabs, one per group, one per role', () => {
  const t = sample(0)
  assert.equal(stepsOfTab(t, 'summary') + stepsOfTab(t, 'problem') + stepsOfTab(t, 'intelligence') + stepsOfTab(t, 'ai'), 4)
  assert.equal(stepsOfTab(t, 'features'), 2)
  assert.equal(stepsOfTab(t, 'roles'), 3)
  assert.equal(tourSteps(t).length, 9)
  assert.equal(tourBeats(t), 8) // beats are presses of Next after the entrance
  assert.equal(tourBeats(sample(1)), 9)
})

test('every beat belongs to exactly one tab, tabs follow the bar order, and the steps inside a tab count up from zero', () => {
  const t = sample(1)
  const steps = tourSteps(t)
  assert.deepEqual(steps.map((s) => s.tab), ['summary', 'problem', 'intelligence', 'ai', 'research', 'features', 'features', 'roles', 'roles', 'roles'])
  assert.deepEqual(steps.filter((s) => s.tab === 'roles').map((s) => s.step), [0, 1, 2])
  steps.forEach((s, i) => assert.equal(tabOfBeat(t, i), s.tab))
  // out-of-range beats are clamped, never undefined
  assert.equal(tabOfBeat(t, -3), 'summary')
  assert.equal(tabOfBeat(t, 999), 'roles')
})

test('a click on a tab goes to the first beat of that tab, and a hidden tab goes nowhere', () => {
  const t = sample(0)
  assert.equal(firstBeatOfTab(t, 'summary'), 0)
  assert.equal(firstBeatOfTab(t, 'features'), 4)
  assert.equal(firstBeatOfTab(t, 'roles'), 6)
  assert.equal(firstBeatOfTab(t, 'research'), null)
  assert.equal(firstBeatOfTab(sample(1), 'features'), 5)
})

test('Shift plus a digit reads the physical key and means the Nth tab in the bar; digits 6 to 9 and other keys mean nothing', () => {
  const t = sample(0)
  assert.equal(tabForCode(t, 'Digit1'), 'summary')
  assert.equal(tabForCode(t, 'Digit5'), 'features') // research is hidden, so the fifth tab is Features
  assert.equal(tabForCode(t, 'Digit6'), 'roles')
  assert.equal(tabForCode(t, 'Digit7'), null)
  assert.equal(tabForCode(sample(1), 'Digit5'), 'research')
  assert.equal(tabForCode(sample(1), 'Digit7'), 'roles')
  for (const code of ['KeyA', 'Digit0', 'Numpad1', '', 'Digit10', 'ArrowRight']) assert.equal(tabForCode(t, code), null, code)
})

// ---- the real Scholar Core tour ----

const core = ATLAS.products.find((p) => p.key === 'core')

test("Scholar Core has a tour, and its Research tab shows the owner's three sources and three areas, with no figure", () => {
  assert.ok(core?.tour, 'run node scripts/client-presentation/build-atlas.mjs')
  const items = core!.tour!.research.items
  assert.equal(items.length, 6)
  assert.ok(tourTabs(core!.tour!).includes('research'))
  const sources = items.map((r) => r.source).join(' | ')
  for (const must of [/UNESCO.*EMIS/, /EMIS-PATT/, /Ed-Fi/, /School Operations and Process Excellence/, /Interoperability and Information Architecture/, /AI-Native School Administration/]) assert.match(sources, must)
  for (const r of items) {
    assert.ok(r.text.split(/\s+/).length <= 24 && r.source.split(/\s+/).length <= 12, r.source)
    assert.ok(!/\d\s*%|percent|validated|research-backed|proven|endorse/i.test(`${r.text} ${r.source}`), `no figure and no endorsement claim: ${r.source}`)
  }
})

test('Core: the five groups hold every one of the 25 modules exactly once, each with a tagline and a screenshot', () => {
  const placed = core!.tour!.features.groups.flatMap((g) => g.subs)
  assert.equal(core!.tour!.features.groups.length, 5)
  assert.deepEqual(placed.map((s) => s.id).sort(), core!.subs.map((s) => s.id).sort())
  for (const s of placed) {
    assert.ok(s.tagline.split(' ').length <= 10, s.id)
    assert.ok(s.shot && s.shot.startsWith('/client-presentation/atlas/'), `${s.id} has a screenshot`)
  }
})

test('Core: an insight is claimed only for a module whose own sheet lists rule-based insights, and an AI line is never an insight', () => {
  for (const m of core!.tour!.intelligence.modules) {
    const sheet = core!.subs.find((s) => s.id === m.id)
    assert.ok(sheet?.technology.some((t) => /rule-based insights/i.test(t)), m.id)
  }
  assert.equal(core!.tour!.intelligence.modules.length, 6)
  const text = JSON.stringify(core!.tour!.intelligence)
  assert.ok(!/\bAI\b|predict|forecast/i.test(text), 'the intelligence tab says rules and insights, never AI or prediction')
})

test('Core: the AI tab promises only drafting and a person deciding', () => {
  const ai = core!.tour!.ai
  assert.match(ai.guard, /person/i)
  assert.ok(ai.uses.length >= 3)
  assert.ok(!/automatic|decides? for|replace/i.test(JSON.stringify(ai)))
})

test('Core: the six roles the owner confirmed, in order', () => {
  assert.deepEqual(core!.tour!.roles.map((r) => r.role), ['Principal and trustees', 'Admission and front office', 'Accounts', 'Teachers and coordinators', 'Operations', 'Students'])
  assert.equal(tourBeats(core!.tour!), 15, 'summary, problem, intelligence, AI, research, five groups, six roles: 16 steps, so 15 presses of Next')
})

test('Core: every role points at real modules, has three benefits, and the situation is tagged illustrative', () => {
  assert.ok(core!.tour!.roles.length >= 3)
  for (const r of core!.tour!.roles) {
    assert.equal(r.benefits.length, 3)
    for (const m of r.modules) assert.ok(core!.subs.some((s) => s.id === m.id), `${r.role}: ${m.id}`)
  }
  assert.match(core!.tour!.problem.label, /illustrative/i)
})

test('no product other than Core has a tour yet (the other four keep their spotlights)', () => {
  assert.deepEqual(ATLAS.products.filter((p) => p.tour).map((p) => p.key), ['core'])
})
