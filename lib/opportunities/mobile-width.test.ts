import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

/**
 * The opportunity screens at a phone width (390 px). jsdom has no layout, so this reads the source, the way lib/campaigns/mobile-width.test.ts and
 * lib/agent/mobile-width.test.ts do. The two things that widened a page in a real browser before: a table inside `overflow-x-auto` holding `sr-only` text (it
 * is `position: absolute`, so only a `relative` box clips it), and a line of nowrap text or a fixed width that cannot shrink.
 */

const read = (file: string) => readFileSync(path.resolve(file), 'utf8')
const lines = (source: string) => source.split(/\r?\n/)

describe('the loss-reason dialog at a phone width', () => {
  const parts = read('components/domain/crm/opportunity-parts.tsx')

  it('is as wide as the screen less a margin, never wider, and scrolls inside itself when it is taller than the screen', () => {
    const content = lines(parts).find((l) => l.includes('<DialogContent') || l.includes('className="max-h-[calc(100dvh-2rem)]'))
    assert.ok(content, 'the dialog content is configured')
    const classes = lines(parts).filter((l) => l.includes('max-h-[calc(100dvh-2rem)]')).join(' ')
    assert.match(classes, /\bw-\[calc\(100%-2rem\)\]/, 'two rem of margin on a 390 px screen')
    assert.match(classes, /\bmax-w-md\b/)
    assert.match(classes, /\boverflow-y-auto\b/)
  })

  it('lets the buttons wrap instead of pushing past the edge, and a long deal name break', () => {
    const buttons = lines(parts).find((l) => l.includes('justify-end gap-2'))
    assert.ok(buttons)
    assert.match(buttons!, /\bflex-wrap\b/)
    const name = lines(parts).find((l) => l.includes('<DialogDescription'))
    assert.ok(name)
    assert.match(name!, /\bbreak-words\b/)
  })

  it('draws no table, no sr-only text, no sideways-scrolling box, no nowrap text and no fixed width in pixels', () => {
    assert.equal(/<table\b/.test(parts), false)
    assert.equal(/sr-only/.test(parts), false)
    assert.equal(/overflow-x-(auto|scroll)/.test(parts), false)
    const offences = lines(parts).filter((l) => /whitespace-nowrap|\bmin-w-\[|\bw-\[\d|\bmin-w-\d|\bshrink-0\b/.test(l))
    assert.deepEqual(offences, [])
  })

  it('wraps the product line and the reason in words so a long name cannot widen the page', () => {
    for (const marker of ['data-opportunity-product>', 'data-loss-reason-label>', 'data-loss-reason-note>']) {
      const line = lines(parts).find((l) => l.includes(marker))
      assert.ok(line, marker)
      assert.match(line!, /\bbreak-words\b/, marker)
    }
  })
})

describe('the screens that gained a part', () => {
  it('the table hides the Product column on a narrow table, as the campaign list does Type, and names the product under the name instead', () => {
    const source = read('components/domain/crm/opportunity-list-view.tsx')
    const head = lines(source).find((l) => l.includes('>Product</TableHead>'))
    const cell = lines(source).find((l) => l.includes('data-opportunity-product>'))
    const narrow = lines(source).find((l) => l.includes('data-opportunity-product-narrow'))
    assert.match(head ?? '', /hidden @md\/opportunities:table-cell/)
    assert.match(cell ?? '', /hidden @md\/opportunities:table-cell/)
    assert.match(narrow ?? '', /@md\/opportunities:hidden/)
    assert.match(narrow ?? '', /\bbreak-words\b/)
    assert.ok(lines(source).some((l) => l.includes('@container/opportunities') && l.includes('overflow-x-auto')), 'the scroll box is the container the width is measured against')
    assert.equal(/sr-only/.test(source), false, 'no sr-only text inside the list\'s overflow-x-auto box')
  })

  it('the edit form\'s new fields stack in the dialog\'s one column, with no fixed width', () => {
    const source = read('components/domain/crm/create-opportunity-modal.tsx')
    const wrapper = lines(source).find((l) => l.includes('data-opportunity-reason-fields'))
    assert.ok(wrapper)
    assert.equal(/whitespace-nowrap|\bw-\[\d|\bmin-w-/.test(wrapper!), false)
    const parts = read('components/domain/crm/opportunity-parts.tsx')
    const product = lines(parts).find((l) => l.includes('data-opportunity-product-field'))
    assert.ok(product)
    assert.equal(/whitespace-nowrap|\bw-\[\d|\bmin-w-/.test(product!), false)
  })

  it('the board gains no width: its cards and columns are the ones it had, and the dialog sits outside the sideways-scrolling box', () => {
    const source = read('components/domain/crm/opportunity-kanban-view.tsx')
    const all = lines(source)
    const scrollBox = all.findIndex((l) => l.includes('ref={boardRef}') && l.includes('overflow-x-auto'))
    const dialog = all.findIndex((l, i) => i > scrollBox && l.includes('{lossDialog}'))
    assert.ok(scrollBox >= 0 && dialog > scrollBox, 'the dialog is drawn after the box')
    const indent = (line: string) => line.length - line.trimStart().length
    assert.equal(indent(all[dialog]), indent(all[scrollBox]), 'the dialog is a sibling of the sideways-scrolling box, not inside it')
    assert.ok(all.slice(scrollBox + 1, dialog).some((l) => /min-w-max/.test(l)), 'the box holds the board')
  })
})
