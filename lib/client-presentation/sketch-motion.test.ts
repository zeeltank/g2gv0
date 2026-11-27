import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { STOP_FPS, jitter, jitterTrack, mulberry32, tornPolygon } from './sketch-motion'

test('the same seed gives the same sequence, and different seeds differ', () => {
  const a = mulberry32(7)
  const b = mulberry32(7)
  const c = mulberry32(8)
  const xs = Array.from({ length: 5 }, () => a())
  assert.deepEqual(xs, Array.from({ length: 5 }, () => b()))
  assert.notDeepEqual(xs, Array.from({ length: 5 }, () => c()))
  for (const v of xs) assert.ok(v >= 0 && v < 1)
})

test('jitter is a pure function of seed and frame: asking twice, or out of order, gives the same frame', () => {
  const forward = [0, 1, 2, 3, 4].map((k) => jitter(3, k))
  const backward = [4, 3, 2, 1, 0].map((k) => jitter(3, k)).reverse()
  assert.deepEqual(forward, backward)
  assert.notDeepEqual(jitter(3, 0), jitter(3, 1))
  for (const j of forward) assert.ok(Math.abs(j.x) <= 3.5 && Math.abs(j.y) <= 3.5 && Math.abs(j.r) <= 1.3)
})

test('a jitter track has one frame per twelfth of a second, in order', () => {
  const t = jitterTrack(5, 2)
  assert.equal(t.length, 2 * STOP_FPS)
  assert.deepEqual(t.map((f) => f.at), Array.from({ length: t.length }, (_, k) => Math.round((k / STOP_FPS) * 100) / 100))
  assert.deepEqual(t, jitterTrack(5, 2))
  assert.deepEqual(jitterTrack(5, 0), [])
})

test('a torn polygon is deterministic, closed, stays inside the box and is straight where it is not torn', () => {
  const p = tornPolygon(11, { top: true, bottom: false, bite: 3 })
  assert.equal(p, tornPolygon(11, { top: true, bottom: false, bite: 3 }))
  assert.notEqual(p, tornPolygon(12, { top: true, bottom: false, bite: 3 }))
  const nums = [...p.matchAll(/(-?\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]))
  assert.ok(nums.length > 40 && nums.every((n) => n >= 0 && n <= 100))
  const pts = [...p.matchAll(/(-?\d+(?:\.\d+)?)% (-?\d+(?:\.\d+)?)%/g)].map((m) => [Number(m[1]), Number(m[2])])
  assert.ok(pts.filter(([, y]) => y >= 99.99).length > 10, 'the bottom edge stays straight at 100%')
  assert.ok(pts.some(([, y]) => y > 0 && y <= 3), 'the top edge has bites')
})

test('the sketchbook helpers read no clock, no Math.random and no DOM', () => {
  const src = readFileSync(new URL('./sketch-motion.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  for (const banned of [/Math\.random/, /Date\.now/, /performance\.now/, /requestAnimationFrame/, /\bwindow\b/, /\bdocument\b/]) assert.ok(!banned.test(src), String(banned))
})
