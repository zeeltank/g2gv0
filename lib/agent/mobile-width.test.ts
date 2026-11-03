import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

/**
 * A table that scrolls sideways inside `overflow-x-auto` must not widen the page.
 *
 * Found in a real browser at 390 px (4 Nov 2026): Agent Run History scrolled sideways (scrollWidth 877 on a 390 px screen) although the table sat inside an
 * `overflow-x-auto` box. The cause was `<span class="sr-only">Details</span>` in the last column: `sr-only` is `position: absolute`, and with no positioned
 * ancestor its containing block is the page, so the scroll box does not clip it and its static position (the far right of the table) widened the page. A
 * `relative` scroll box clips it. jsdom has no layout, so this reads the source.
 */
describe('Agent Run History table at a phone width', () => {
  const source = readFileSync(path.resolve('components/domain/crm/agent-runs-view.tsx'), 'utf8')

  it('keeps every overflow-x-auto box positioned (relative), because the table holds sr-only text', () => {
    assert.ok(source.includes('sr-only'), 'the table still has screen-reader-only text, which is why this test exists')
    const boxes = source.split(/\r?\n/).filter((line) => /overflow-x-auto/.test(line))
    assert.ok(boxes.length > 0, 'the table is still inside an overflow-x-auto box')
    for (const line of boxes) assert.match(line, /\brelative\b/, `an overflow-x-auto box without relative lets sr-only text widen the page: ${line.trim()}`)
  })
})
