import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

/**
 * The campaign screens at a phone width (390 px). jsdom has no layout, so this reads the source, the way lib/agent/mobile-width.test.ts does for the agent
 * screens. The two things that widened a page in a real browser before: a table inside `overflow-x-auto` holding `sr-only` text (it is `position: absolute`,
 * so only a `relative` box clips it), and a line of nowrap text or a fixed width that cannot shrink.
 */

const read = (file: string) => readFileSync(path.resolve(file), 'utf8')
const lines = (source: string) => source.split(/\r?\n/)

describe('the funnel and the link lines at a phone width', () => {
  const parts = read('components/domain/crm/campaign-parts.tsx')

  it('draws no table, no sr-only text and no sideways-scrolling box, so there is nothing to widen the page', () => {
    assert.equal(/<table\b/.test(parts), false)
    assert.equal(/sr-only/.test(parts), false)
    assert.equal(/overflow-x-(auto|scroll)/.test(parts), false)
  })

  it('lets a step\'s label and its number wrap onto two lines instead of pushing past the screen', () => {
    const line = lines(parts).find((l) => l.includes('justify-between'))
    assert.ok(line, 'the step line is a flex row')
    assert.match(line!, /\bflex-wrap\b/)
  })

  it('has no nowrap text and no fixed or minimum width in pixels', () => {
    const offences = lines(parts).filter((l) => /whitespace-nowrap|\bmin-w-\[|\bw-\[\d|\bmin-w-\d|\bshrink-0\b/.test(l))
    assert.deepEqual(offences, [])
  })

  it('lets a long product or GTM campaign name break instead of widening the screen', () => {
    const value = lines(parts).find((l) => l.includes('text-sm text-foreground') && l.includes('{value}'))
    assert.ok(value, 'the value line is there')
    assert.match(value!, /\bbreak-words\b/)
  })

  it('stacks the link fields on a phone and spreads them from the small breakpoint up', () => {
    const grid = lines(parts).find((l) => l.includes('grid-cols-1'))
    assert.ok(grid)
    assert.match(grid!, /\bgrid-cols-1\b.*\bsm:grid-cols-2\b/)
  })

  it('draws the bar as a full-width box that holds its own overflow, so a wide fill cannot escape', () => {
    const track = lines(parts).find((l) => l.includes('FUNNEL_BAR.track'))
    assert.ok(track)
    assert.match(track!, /\bw-full\b/)
    assert.match(track!, /\boverflow-hidden\b/)
  })
})

describe('the screens that gained a part', () => {
  it('the list hides the Product column on a narrow table, as it does Type, and names the product under the name instead', () => {
    const source = read('components/domain/crm/campaign-list-view.tsx')
    const head = lines(source).find((l) => l.includes('>Product</TableHead>'))
    const cell = lines(source).find((l) => l.includes('data-campaign-product>'))
    const narrow = lines(source).find((l) => l.includes('data-campaign-product-narrow'))
    assert.match(head ?? '', /hidden @md\/campaigns:table-cell/)
    assert.match(cell ?? '', /hidden @md\/campaigns:table-cell/)
    assert.match(narrow ?? '', /@md\/campaigns:hidden/)
    assert.equal(/sr-only/.test(source), false, 'no sr-only text inside the list\'s overflow-x-auto box')
  })

  it('the GTM line wraps like the line above it and holds no nowrap text', () => {
    const source = read('components/domain/gtm/campaigns-detail.tsx')
    const line = lines(source).find((l) => l.includes('data-gtm-links'))
    assert.ok(line)
    assert.equal(/whitespace-nowrap|truncate/.test(line!), false)
    assert.match(line!, /\bbreak-words\b/, 'a long product or campaign name breaks instead of widening the screen')
  })

  it('the lead header line is the existing flex-wrap row, and the new item adds no nowrap or width', () => {
    const source = read('components/domain/crm/lead-parts.tsx')
    assert.ok(lines(source).some((l) => /flex flex-wrap items-center gap-x-4/.test(l)))
    const item = lines(source).find((l) => l.includes('data-lead-campaign'))
    assert.ok(item)
    assert.equal(/whitespace-nowrap|truncate|\bw-\[/.test(item!), false)
    assert.match(item!, /\bbreak-words\b/, 'a long campaign name breaks instead of widening the screen')
  })
})
