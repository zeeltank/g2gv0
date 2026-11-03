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
 *
 * The table now lives in the Runs tab (agent-runs-panel.tsx, the screen as it was before it had tabs, moved unchanged). The two new tabs draw no table at all
 * (cards that wrap), and this test says so: the day one of them gets a sideways-scrolling box, it must be `relative` too.
 */
describe('Agent Run History at a phone width', () => {
  const read = (name: string) => readFileSync(path.resolve('components/domain/crm', name), 'utf8')
  const boxes = (source: string) => source.split(/\r?\n/).filter((line) => /overflow-x-auto/.test(line))

  it('keeps every overflow-x-auto box of the Runs tab positioned (relative), because its table holds sr-only text', () => {
    const source = read('agent-runs-panel.tsx')
    assert.ok(source.includes('sr-only'), 'the table still has screen-reader-only text, which is why this test exists')
    assert.ok(boxes(source).length > 0, 'the table is still inside an overflow-x-auto box')
    for (const line of boxes(source)) assert.match(line, /\brelative\b/, `an overflow-x-auto box without relative lets sr-only text widen the page: ${line.trim()}`)
  })

  it('keeps every other box of the screen that scrolls sideways positioned as well, and draws no table in the two new tabs', () => {
    for (const name of ['agent-runs-view.tsx', 'agent-waiting-queue.tsx', 'agent-autonomy.tsx', 'agent-autonomy-parts.tsx']) {
      const source = read(name)
      for (const line of boxes(source)) assert.match(line, /\brelative\b/, `${name}: an overflow-x-auto box without relative: ${line.trim()}`)
    }
    for (const name of ['agent-waiting-queue.tsx', 'agent-autonomy.tsx', 'agent-autonomy-parts.tsx']) {
      assert.equal(/<table\b/.test(read(name)), false, `${name} draws a table: it would need an overflow-x-auto box that is also relative`)
    }
  })

  it('lets the long words of a proposal, an organisation name and a counter note wrap instead of widening the screen', () => {
    assert.match(read('agent-waiting-queue.tsx'), /break-words/)
    assert.match(read('agent-autonomy-parts.tsx'), /break-words/)
  })

  it('keeps the tab strip inside its own scroll box (the shared PageTabs scrolls sideways itself, so five words of tabs cannot widen the page)', () => {
    const tabs = readFileSync(path.resolve('components/shared/scaffolds/page-tabs.tsx'), 'utf8')
    assert.match(tabs, /role="tablist"[^\n]*overflow-x-auto/)
  })
})
