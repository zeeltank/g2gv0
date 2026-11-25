import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CHOOSER_TARGETS, FULL_ORDER, SHORT_ORDER, detour, goto, initial, keyAt, next, prev, progress, returnFromDetour, setMode } from './navigation'

const beatsOf = (k: string) => (k === 's4' ? 8 : k === 's1' ? 2 : 1)

test('next walks every beat of a scene, then moves to the next scene', () => {
  let s = initial('full')
  assert.equal(keyAt(s), 's1')
  s = next(s, beatsOf); s = next(s, beatsOf)
  assert.deepEqual([keyAt(s), s.beat], ['s1', 2])
  s = next(s, beatsOf)
  assert.deepEqual([keyAt(s), s.beat], ['s2', 0])
})

test('prev from the first beat lands on the previous scene fully revealed', () => {
  let s = goto(initial('full'), 's5', beatsOf)
  s = prev(s, beatsOf)
  assert.deepEqual([keyAt(s), s.beat, s.entry], ['s4', 8, 'back'])
})

test('the deck stops at the last scene and at the first', () => {
  let s = goto(initial('full'), 's15', beatsOf, true)
  assert.equal(next(s, beatsOf), s)
  s = initial('full')
  assert.equal(prev(s, beatsOf), s)
})

test('a detour opens one scenario slide and returns to the same place on the chooser', () => {
  let s = goto(initial('full'), 's4', beatsOf)
  for (let i = 0; i < 8; i++) s = next(s, beatsOf)
  assert.deepEqual([keyAt(s), s.beat], ['s4', 8])
  s = detour(s, 's10')
  assert.equal(keyAt(s), 's10')
  assert.deepEqual(s.back, { key: 's4', beat: 8 })
  s = next(s, beatsOf) // reveal its beat
  s = next(s, beatsOf) // past its last beat: back to the chooser, not on to slide 11
  assert.deepEqual([keyAt(s), s.beat, s.back], ['s4', 8, null])
})

test('returnFromDetour and prev both leave a detour; with no detour nothing changes', () => {
  const s = detour(goto(initial('full'), 's4', beatsOf), 's8')
  assert.equal(keyAt(returnFromDetour(s)), 's4')
  assert.equal(keyAt(prev(s, beatsOf)), 's4')
  const plain = initial('full')
  assert.equal(returnFromDetour(plain), plain)
})

test('every chooser target is a scene in the full deck', () => {
  for (const k of CHOOSER_TARGETS) assert.ok((FULL_ORDER as readonly string[]).includes(k), k)
  assert.equal(CHOOSER_TARGETS.length, 5)
})

test('the short version has five scenes and switching mode keeps a shared scene', () => {
  assert.equal(SHORT_ORDER.length, 5)
  const s = setMode(goto(initial('full'), 's14', beatsOf), 'short')
  assert.equal(keyAt(s), 's14')
  assert.equal(keyAt(setMode(goto(initial('full'), 's9', beatsOf), 'short')), 's1')
})

test('progress rises monotonically from near zero to one', () => {
  let s = initial('full')
  let last = progress(s, beatsOf)
  assert.ok(last > 0 && last < 0.1)
  for (let i = 0; i < 200; i++) {
    const n = next(s, beatsOf)
    if (n === s) break
    s = n
    const p = progress(s, beatsOf)
    assert.ok(p >= last)
    last = p
  }
  assert.equal(Math.round(progress(s, beatsOf) * 1000), 1000)
})

test('an unknown scene key leaves the state unchanged', () => {
  const s = initial('full')
  assert.equal(goto(s, 'nope', beatsOf), s)
  assert.equal(detour(s, 'nope'), s)
})

test('the 59-second film is the sixth scene, between the introduction and the ecosystem', () => {
  assert.equal(FULL_ORDER.length, 17)
  assert.deepEqual(FULL_ORDER.slice(4, 8), ['s5', 's17', 's6', 's16'])
  const beats = (k: string) => (k === 's17' ? 0 : beatsOf(k)) // the film has no steps: one press of Next leaves it
  let s = goto(initial('full'), 's5', beats, true)
  s = next(s, beats)
  assert.deepEqual([keyAt(s), s.pos + 1], ['s17', 6])
  s = next(s, beats)
  assert.equal(keyAt(s), 's6')
})
