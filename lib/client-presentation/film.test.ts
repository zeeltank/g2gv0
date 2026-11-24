import assert from 'node:assert/strict'
import { test } from 'node:test'

import { FILM, beatOf, lineOf, linesOf, splitProduct } from './film'

test('the film has nine beats that follow each other from 0 to 59 seconds', () => {
  assert.equal(FILM.beats.length, 9)
  assert.equal(FILM.beats[0].start, 0)
  FILM.beats.forEach((b, i) => { if (i) assert.equal(b.start, FILM.beats[i - 1].end, `${b.id} starts where ${FILM.beats[i - 1].id} ends`) })
  assert.equal(FILM.beats[FILM.beats.length - 1].end, 59)
  assert.equal(FILM.length, 59)
})

test('the end card carries the approved invitation and the film says its data is made up', () => {
  const end = beatOf('end')
  assert.equal(lineOf(end, 'invite'), 'We would like to talk with you about the Founding 25 Pilot Programme.')
  assert.equal(lineOf(end, 'close'), 'The next step is a conversation.')
  assert.equal(FILM.disclosure, 'Illustrative school data')
})

test('the six product lines split into a name and a description', () => {
  const products = linesOf(beatOf('modules'), 'product').map(splitProduct)
  assert.equal(products.length, 6)
  assert.deepEqual(products[1], { name: 'Scholar Core', desc: 'Intelligent School Operations' })
})

test('the approved sentence of the reveal beat joins into the slide-5 headline', () => {
  const b = beatOf('reveal')
  assert.equal(['c1', 'c2', 'c3', 'c4'].map((r) => lineOf(b, r)).join(' '), 'An integrated intelligent K–12 platform designed to help schools connect information, support better decisions and take meaningful action.')
})
