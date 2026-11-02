import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from './dom-test-kit'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'sell', label: 'Sell in CRM' },
  { id: 'prices', label: 'Prices', count: 0 },
  { id: 'usage', label: 'Usage' },
]

async function setup() {
  const k = await kit()
  const { PageTabs, TabPanel } = await import('../../components/shared/scaffolds/page-tabs')

  function Host() {
    const [active, setActive] = k.React.useState('overview')
    return k.h(k.React.Fragment, null,
      k.h(PageTabs, { tabs: TABS, active, onChange: setActive, label: 'Product sections', idPrefix: 'pm' }),
      ...TABS.map((t) => k.h(TabPanel, { key: t.id, id: t.id, active, idPrefix: 'pm' }, k.h('p', { className: 'content' }, `content of ${t.id}`))))
  }
  await k.render(k.h(Host))

  const tabs = () => k.all('[role="tab"]')
  const selectedId = () => tabs().filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.id.replace('pm-tab-', ''))
  const focusedId = () => (k.w.document.activeElement as HTMLElement | null)?.id.replace('pm-tab-', '')

  return { k, tabs, selectedId, focusedId }
}

describe('PageTabs and TabPanel', () => {
  afterEach(disposeAll)

  it('is one labelled tab list with exactly one selected tab, and only that tab in the tab order', async () => {
    const { k, tabs, selectedId } = await setup()
    assert.equal(k.one('[role="tablist"]')?.getAttribute('aria-label'), 'Product sections')
    assert.deepEqual(tabs().map((t) => t.textContent), ['Overview', 'Sell in CRM', 'Prices0', 'Usage'], 'a count of 0 is shown, not hidden')
    assert.equal(tabs()[2].querySelector('span')?.textContent, '0', 'the count sits in its own element')
    assert.equal(tabs()[0].querySelector('span'), null, 'a tab with no count has no count element')
    assert.deepEqual(selectedId(), ['overview'])
    assert.deepEqual(tabs().map((t) => t.getAttribute('tabindex')), ['0', '-1', '-1', '-1'])
  })

  it('links every tab to its panel and back, and builds only the open panel', async () => {
    const { k, tabs } = await setup()
    for (const tab of tabs()) {
      const panel = k.w.document.getElementById(tab.getAttribute('aria-controls')!)
      assert.ok(panel, `${tab.id} controls a panel that exists`)
      assert.equal(panel!.getAttribute('role'), 'tabpanel')
      assert.equal(panel!.getAttribute('aria-labelledby'), tab.id)
    }
    assert.deepEqual(k.all('.content').map((p) => p.textContent), ['content of overview'])
    assert.deepEqual(k.all('[role="tabpanel"]').map((p) => p.hasAttribute('hidden')), [false, true, true, true])
  })

  it('opens a tab on click', async () => {
    const { k, tabs, selectedId } = await setup()
    await k.click(tabs()[2])
    assert.deepEqual(selectedId(), ['prices'])
    assert.deepEqual(k.all('.content').map((p) => p.textContent), ['content of prices'])
    assert.deepEqual(tabs().map((t) => t.getAttribute('tabindex')), ['-1', '-1', '0', '-1'])
  })

  it('moves with the arrow keys, takes the focus along and wraps around at both ends', async () => {
    const { k, tabs, selectedId, focusedId } = await setup()
    await k.press('ArrowRight', tabs()[0])
    assert.deepEqual(selectedId(), ['sell'])
    assert.equal(focusedId(), 'sell')

    await k.press('ArrowLeft', tabs()[1])
    assert.deepEqual(selectedId(), ['overview'], 'left goes back one')
    await k.press('ArrowLeft', tabs()[0])
    assert.deepEqual(selectedId(), ['usage'], 'before the first comes the last')
    assert.equal(focusedId(), 'usage')

    await k.press('ArrowRight', tabs()[3])
    assert.deepEqual(selectedId(), ['overview'], 'after the last comes the first')
  })

  it('jumps to the first and last tab with Home and End', async () => {
    const { k, tabs, selectedId } = await setup()
    await k.press('End', tabs()[0])
    assert.deepEqual(selectedId(), ['usage'])
    await k.press('Home', tabs()[3])
    assert.deepEqual(selectedId(), ['overview'])
  })

  it('leaves other keys alone', async () => {
    const { k, tabs, selectedId } = await setup()
    assert.equal(await k.press('a', tabs()[0]), true)
    assert.equal(await k.press('ArrowDown', tabs()[0]), true)
    assert.deepEqual(selectedId(), ['overview'])
  })

  it('stops the browser from also scrolling the page when it takes the arrow keys, Home and End', async () => {
    const { k, tabs } = await setup()
    for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
      assert.equal(await k.press(key, tabs()[0]), false, key)
    }
  })
})
