import assert from 'node:assert/strict'
import { test } from 'node:test'

import planJson from './generated/atlas-plan.json'
import { ATLAS, ATLAS_KEYS, ATLAS_PLAN, GALLERY_PER_SLIDE, HUB_KEY, PRODUCT_NAV, atlasByN, atlasSlides, buildAtlasPlan, chunk, openerKeyOf } from './atlas'

test('chunk splits evenly and never exceeds the maximum', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5, 6, 7], 5).map((c) => c.length), [4, 3])
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 5).map((c) => c.length), [5])
  assert.deepEqual(chunk([] as number[], 5), [])
  assert.equal(chunk(Array.from({ length: 25 }, (_, i) => i), 5).length, 5)
})

test('the plan starts with the hub, then one section per product, in product order', () => {
  assert.equal(ATLAS_PLAN[0].kind, 'hub')
  assert.equal(HUB_KEY, ATLAS_PLAN[0].key)
  const families = ATLAS_PLAN.slice(1).map((s) => s.family)
  const order = ATLAS.products.filter((p) => p.subs.length).map((p) => p.key)
  // each product's slides are contiguous and the products keep their order
  assert.deepEqual([...new Set(families)], order)
  for (const k of order) {
    const idx = ATLAS_PLAN.map((s, i) => (s.family === k ? i : -1)).filter((i) => i >= 0)
    assert.equal(idx[idx.length - 1] - idx[0] + 1, idx.length, `${k} is contiguous`)
  }
})

test('every product section is opener, spotlights, how it works, screens', () => {
  for (const p of ATLAS.products.filter((x) => x.subs.length)) {
    const kinds = ATLAS_PLAN.filter((s) => s.family === p.key).map((s) => s.kind)
    assert.equal(kinds[0], 'opener')
    assert.equal(kinds[kinds.length - 1], 'gallery')
    assert.equal(kinds.filter((k) => k === 'glance').length, 1)
    const rank = { opener: 0, subs: 1, glance: 2, gallery: 3 } as Record<string, number>
    for (let i = 1; i < kinds.length; i++) assert.ok(rank[kinds[i]] >= rank[kinds[i - 1]], `${p.key}: ${kinds.join(' ')}`)
  }
})

test('the spotlights cover every sub-module exactly once, in family order', () => {
  const seen = ATLAS_PLAN.filter((s) => s.kind === 'subs').flatMap((s) => s.subs ?? [])
  const all = ATLAS.products.flatMap((p) => p.subs.map((s) => s.id))
  assert.deepEqual(seen, all)
  assert.equal(new Set(seen).size, seen.length)
})

test('the screens slides hold every sub-module that has a screenshot, at most nine to a slide', () => {
  const shown = ATLAS_PLAN.filter((s) => s.kind === 'gallery')
  for (const s of shown) assert.ok((s.subs?.length ?? 0) >= 1 && (s.subs?.length ?? 0) <= GALLERY_PER_SLIDE)
  const withShot = ATLAS.products.flatMap((p) => p.subs.filter((x) => x.shots.length).map((x) => x.id))
  assert.deepEqual(shown.flatMap((s) => s.subs ?? []), withShot)
})

test('slide numbers and keys are unique, start at 201 and match the plan order', () => {
  assert.equal(ATLAS_PLAN[0].n, 201)
  assert.equal(new Set(ATLAS_KEYS).size, ATLAS_KEYS.length)
  ATLAS_PLAN.forEach((s, i) => { assert.equal(s.n, 201 + i); assert.equal(s.key, `a${i + 1}`); assert.equal(atlasByN(s.n), s) })
})

test('a spotlight has one press of Next per sub-module after the first', () => {
  for (const s of ATLAS_PLAN.filter((x) => x.kind === 'subs')) assert.equal(s.beats, (s.subs?.length ?? 0) - 1)
  for (const s of ATLAS_PLAN.filter((x) => x.kind !== 'subs')) assert.equal(s.beats, 0)
})

test('the product rail opens each product at its opener', () => {
  assert.equal(PRODUCT_NAV.length, ATLAS.products.filter((p) => p.subs.length).length)
  for (const n of PRODUCT_NAV) {
    assert.equal(openerKeyOf(n.key), n.opener)
    const slide = ATLAS_PLAN.find((s) => s.key === n.opener)
    assert.equal(slide?.kind, 'opener')
    assert.equal(slide?.family, n.key)
    assert.ok(!n.short.startsWith('Scholar'))
  }
})

test('the plan is empty without sheets, and the slides carry notes', () => {
  assert.deepEqual(buildAtlasPlan({ captured: '', products: [] }), [])
  const slides = atlasSlides()
  assert.equal(slides.length, ATLAS_PLAN.length)
  for (const s of slides) { assert.ok(s.say.length > 0); assert.equal(s.lines[0].role, 'headline'); assert.ok(s.n >= 201) }
})

test('no plan title carries a banned claim', () => {
  const banned = [/\d\s*%/, /\bfree\b/i, /guarantee/i, /\bpredict/i, /at-risk/i, /\bNEP\b/]
  for (const s of ATLAS_PLAN) for (const re of banned) assert.ok(!re.test(`${s.title} ${s.kicker}`), `${s.title}: ${re}`)
})

test('the generated plan file (read by the lint, shoot and render scripts) matches the TypeScript plan', () => {
  assert.deepEqual(planJson, ATLAS_PLAN)
})
