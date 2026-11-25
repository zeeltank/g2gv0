import assert from 'node:assert/strict'
import { test } from 'node:test'

import planJson from './generated/atlas-plan.json'
import { ATLAS, ATLAS_KEYS, ATLAS_PLAN, atlasByN, atlasSlides, buildAtlasPlan, chunk } from './atlas'

test('chunk splits evenly and never exceeds the maximum', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5, 6, 7], 5).map((c) => c.length), [4, 3])
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 5).map((c) => c.length), [5])
  assert.deepEqual(chunk([] as number[], 5), [])
  assert.equal(chunk(Array.from({ length: 25 }, (_, i) => i), 5).length, 5)
})

test('the plan covers every sub-module exactly once, in family order', () => {
  const seen = ATLAS_PLAN.filter((s) => s.kind === 'subs').flatMap((s) => s.subs ?? [])
  const all = ATLAS.products.flatMap((p) => p.subs.map((s) => s.id))
  assert.deepEqual(seen, all)
  assert.equal(new Set(seen).size, seen.length)
})

test('slide numbers and keys are unique, start at 201 and match the plan order', () => {
  assert.equal(ATLAS_PLAN[0].n, 201)
  assert.equal(new Set(ATLAS_KEYS).size, ATLAS_KEYS.length)
  ATLAS_PLAN.forEach((s, i) => { assert.equal(s.n, 201 + i); assert.equal(s.key, `a${i + 1}`); assert.equal(atlasByN(s.n), s) })
})

test('a spotlight scene has one press of Next per sub-module (minus one when there is no overview)', () => {
  for (const s of ATLAS_PLAN.filter((x) => x.kind === 'subs')) assert.equal(s.beats, s.intro ? (s.subs?.length ?? 0) : (s.subs?.length ?? 0) - 1)
  // only the first slide of a family opens with the overview
  const firsts = ATLAS_PLAN.filter((s) => s.kind === 'subs' && s.intro).map((s) => s.family)
  assert.equal(new Set(firsts).size, firsts.length)
})

test('the plan is empty without sheets, and the slides carry notes', () => {
  assert.deepEqual(buildAtlasPlan({ captured: '', products: [] }), [])
  const slides = atlasSlides()
  assert.equal(slides.length, ATLAS_PLAN.length)
  for (const s of slides) { assert.ok(s.say.length > 0); assert.equal(s.lines[0].role, 'headline'); assert.ok(s.n >= 201) }
})

test('no big-letter title or plan text carries a banned claim', () => {
  const banned = [/\d\s*%/, /\bfree\b/i, /guarantee/i, /\bpredict/i, /at-risk/i, /\bNEP\b/]
  for (const s of ATLAS_PLAN) for (const re of banned) assert.ok(!re.test(`${s.title} ${s.kicker}`), `${s.title}: ${re}`)
})

test('the generated plan file (read by the lint and shoot scripts) matches the TypeScript plan', () => {
  assert.deepEqual(planJson, ATLAS_PLAN)
})
