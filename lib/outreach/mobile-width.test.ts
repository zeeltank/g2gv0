import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

/**
 * The Checks section at a phone width (390 px). jsdom has no layout, so this reads the source, the way lib/campaigns/mobile-width.test.ts and
 * lib/agent/mobile-width.test.ts do. The things that widened a page in a real browser before: a table inside `overflow-x-auto` holding `sr-only` text
 * (it is `position: absolute`, so only a `relative` box clips it), and a line of nowrap text, a fixed width or a long unbroken word that cannot shrink.
 * The section draws no table, so there is no box that needs to be `relative`; the test says so and fails if one is added.
 */

const read = (file: string) => readFileSync(path.resolve(file), 'utf8')
const lines = (source: string) => source.split(/\r?\n/)

describe('the Checks section at a phone width', () => {
  const checks = read('components/domain/gtm/outreach-checks.tsx')
  const claims = read('components/domain/gtm/outreach-claims.tsx')

  it('draws no table, no sr-only text and no sideways-scrolling box, so there is nothing to widen the dialog', () => {
    for (const source of [checks, claims]) {
      assert.equal(/<table\b/.test(source), false)
      assert.equal(/sr-only/.test(source), false)
      assert.equal(/overflow-x-(auto|scroll)/.test(source), false)
    }
  })

  it('has no nowrap text, no truncation and no fixed or minimum width in pixels', () => {
    for (const source of [checks, claims]) {
      const offences = lines(source).filter((l) => /whitespace-nowrap|\btruncate\b|\bmin-w-\[|\bw-\[\d|\bmin-w-[1-9]|\bshrink-0\b/.test(l))
      assert.deepEqual(offences, [])
    }
  })

  it('lets the heading and the Check again button wrap onto two lines', () => {
    const header = lines(checks).find((l) => l.includes('justify-between'))
    assert.ok(header, 'the header is a flex row')
    assert.match(header!, /\bflex-wrap\b/)
  })

  it('lets a check\'s sentence and its detail break, in a box that is allowed to shrink next to the icon', () => {
    const text = lines(checks).find((l) => l.includes('min-w-0'))
    assert.ok(text, 'the text box can shrink')
    const sentence = lines(checks).find((l) => l.includes('{checkSentence(c)}'))
    const detail = lines(checks).find((l) => l.includes('c.detail !==')) 
    assert.match(sentence ?? '', /\bbreak-words\b/)
    assert.match(detail ?? '', /\bbreak-words\b/, 'a long detail (a link, a domain) breaks instead of widening the dialog')
    const icon = lines(checks).find((l) => l.includes('CheckCircle2 aria-hidden'))
    assert.match(icon ?? '', /\bflex-none\b/, 'the icon keeps its size and the text gives way')
  })

  it('lets the refusal sentence, a claim and its source break', () => {
    const refusal = lines(checks).find((l) => l.includes('refusal.message'))
    assert.match(refusal ?? '', /\bbreak-words\b/)
    const claim = lines(claims).find((l) => l.includes('{c.claim}'))
    assert.match(claim ?? '', /\bbreak-words\b/)
    const source = lines(claims).find((l) => l.includes('productId === null && c.productName'))
    assert.ok(source, 'the source line is there')
    const sourceBox = lines(claims)[lines(claims).indexOf(source!) - 1]
    assert.match(sourceBox, /\bbreak-words\b/)
  })

  it('stacks the list in one column (a plain vertical list; no grid with fixed columns)', () => {
    for (const source of [checks, claims]) assert.equal(/grid-cols-[2-9]|\bcols-\d/.test(source), false)
    assert.match(checks, /<ul className="mt-2 space-y-2">/)
  })

  it('sits inside the message dialog, which scrolls on its own and is as wide as the screen allows', () => {
    const view = read('components/domain/gtm/outreach-view.tsx')
    const content = lines(view).find((l) => l.includes('<DialogContent className="max-h-[88vh]'))
    assert.match(content ?? '', /\boverflow-y-auto\b/)
    assert.match(content ?? '', /\bmax-w-2xl\b/)
  })
})
