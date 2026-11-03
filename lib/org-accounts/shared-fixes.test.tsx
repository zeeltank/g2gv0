import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { h } from '../scaffolds/h'

/**
 * The small fixes the real-browser walkthrough of the first Organisation 360 screen asked for in shared code (the Organizations fold-in keeps them):
 * D1 the confirm question never took focus, D5 the breadcrumb's list items had no list, D7 the icon-only back button shrank on a phone, D8 a tab's name
 * ran its label and its count together.
 */

describe('D1: the confirm question takes the focus when it opens', () => {
  afterEach(disposeAll)

  async function open(extra: Record<string, unknown> = {}) {
    const k = await kit()
    const { ConfirmDialog } = await import('../../components/ui/confirm-dialog')
    const closes: boolean[] = []
    const confirmed: number[] = []
    function Host() {
      const [isOpen, setOpen] = k.React.useState(false)
      return k.h(k.React.Fragment, null,
        k.h('button', { id: 'ask', onClick: () => setOpen(true) }, 'ask'),
        k.h(ConfirmDialog, {
          open: isOpen, onOpenChange: (next: boolean) => { if (!next) closes.push(false); setOpen(next) },
          title: 'Remove this document?', description: 'It cannot be undone.', confirmLabel: 'Remove', onConfirm: () => { confirmed.push(1); setOpen(false) }, ...extra,
        }))
    }
    await k.render(k.h(Host))
    const ask = k.one('#ask') as HTMLElement
    ask.focus()
    await k.click(ask)
    await k.tick(30)
    return { k, closes, confirmed, ask }
  }

  it('puts the focus on Cancel, inside the dialog, so a keyboard user is in the question and Escape and Tab work from there', async () => {
    const { k, ask } = await open()
    const focused = k.w.document.activeElement as HTMLElement
    assert.ok(focused !== ask, 'the focus left the button behind the dialog')
    assert.equal(focused.textContent, 'Cancel')
    assert.ok(focused.closest('[role="alertdialog"]'), 'and it is inside the dialog')
  })

  it('Cancel closes the question once (the dismissing control, not a second handler, does it)', async () => {
    const { k, closes } = await open()
    await k.click(k.withText('Cancel')!)
    await k.tick(30)
    assert.deepEqual(closes, [false], 'closed exactly once')
    assert.ok(k.one('[role="alertdialog"]') === null, 'the question closed')
  })

  it('Escape closes it, and the confirm button confirms', async () => {
    const first = await open()
    await first.k.press('Escape')
    await first.k.tick(30)
    assert.deepEqual(first.closes, [false])
    await disposeAll()
    const second = await open()
    await second.k.click(second.k.withText('Remove')!)
    await second.k.tick(30)
    assert.deepEqual(second.confirmed, [1])
  })

  it('keeps every existing caller\'s look: the confirm button is destructive unless a caller says otherwise, Cancel stays an outline button', async () => {
    const { k } = await open()
    assert.ok(k.withText('Remove')!.className.includes('bg-destructive'), 'destructive by default')
    assert.ok(k.withText('Cancel')!.className.includes('border-input'), 'Cancel is still the outline button')
    await disposeAll()
    const calm = await open({ tone: 'default' })
    assert.ok(!calm.k.withText('Remove')!.className.includes('bg-destructive'), "!calm.k.withText('Remove')!.className.includes('bg-destructive')")
    assert.ok(calm.k.withText('Remove')!.className.includes('bg-primary'), 'a question that destroys nothing is not red')
  })

  it('shows "Working…" and disables both buttons while busy', async () => {
    const { k } = await open({ busy: true })
    assert.equal(k.withText('Working…')!.hasAttribute('disabled'), true)
    assert.equal(k.withText('Cancel')!.hasAttribute('disabled'), true)
  })
})

describe('D1: useConfirm passes the button\'s look on to the dialog', () => {
  afterEach(disposeAll)

  it('a question that says tone "default" is not red, and one that says nothing still is', async () => {
    const k = await kit()
    const { useConfirm } = await import('../../components/shared/scaffolds/use-confirm')
    function Host() {
      const { confirm, confirmDialog } = useConfirm()
      return k.h(k.React.Fragment, null,
        k.h('button', { id: 'calm', onClick: () => { void confirm({ title: 'Create it?', description: 'Nothing is sent.', confirmLabel: 'Create', tone: 'default' }) } }, 'calm'),
        k.h('button', { id: 'red', onClick: () => { void confirm({ title: 'Remove it?', description: 'Gone.', confirmLabel: 'Remove' }) } }, 'red'),
        confirmDialog)
    }
    await k.render(k.h(Host))
    await k.click(k.one('#calm')!); await k.tick(30)
    assert.ok(k.withText('Create')!.className.includes('bg-primary') && !k.withText('Create')!.className.includes('bg-destructive'), "k.withText('Create')!.className.includes('bg-primary') && !k.withText('Create')!.className.includes('bg-destru")
    await k.press('Escape'); await k.tick(30)
    await k.click(k.one('#red')!); await k.tick(30)
    assert.ok(k.withText('Remove')!.className.includes('bg-destructive'), 'the default is the destructive look every existing caller has')
  })
})

const doc = (node: ReactNode) => new JSDOM(`<!doctype html><body>${renderToStaticMarkup(node)}</body>`).window.document

describe('D5: the breadcrumb items are in a list', () => {
  it('has the list items in an <ol> inside the nav, and no <li> straight under a <nav>', async () => {
    const { GtgBreadcrumb } = await import('../../components/shell/gtg-breadcrumb')
    const d = doc(h(GtgBreadcrumb, { items: [{ label: 'Sales & Marketing' }, { label: 'Organizations', href: '/module/crm/marketing/organizations' }, { label: 'Hillcrest Academy' }] }))
    const items = Array.from(d.querySelectorAll('li'))
    assert.equal(items.length, 3)
    for (const li of items) assert.equal(li.parentElement!.tagName, 'OL', 'each item is in a list')
    assert.equal(d.querySelectorAll('nav > li').length, 0)
    assert.equal(d.querySelectorAll('ol').length, 1)
    const list = d.querySelector('ol')!
    assert.equal(list.parentElement!.tagName, 'NAV')
    assert.ok(list.className.includes('list-none') && list.className.includes('flex'), 'the list carries the row layout the nav had, with its list styling reset')
    assert.deepEqual(Array.from(d.querySelectorAll('li')).map((li) => li.textContent), ['Sales & Marketing', 'Organizations', 'Hillcrest Academy'])
  })

  it('keeps the separators out of the reading order, as before', async () => {
    const { GtgBreadcrumb } = await import('../../components/shell/gtg-breadcrumb')
    const d = doc(h(GtgBreadcrumb, { items: [{ label: 'A' }, { label: 'B' }] }))
    const separators = Array.from(d.querySelectorAll('ol > span'))
    assert.equal(separators.length, 1)
    assert.equal(separators[0].getAttribute('aria-hidden'), 'true', 'hidden from a screen reader, which is what lets the list contain only items')
  })
})

describe('D7: the icon-only Back button keeps its size on a phone', () => {
  it('does not shrink and has a 24 px floor', async () => {
    const { DetailPage } = await import('../../components/shared/scaffolds/detail-page')
    const d = doc(h(DetailPage, { title: 'A very long organisation name', backLabel: 'Back to Organisation 360', onBack: () => {}, status: 'ready' }, h('p', null, 'x')))
    const back = d.querySelector('button[aria-label="Back to Organisation 360"]')!
    assert.ok(back.className.split(/\s+/).includes('shrink-0'), "back.className.split(/\\s+/).includes('shrink-0')")
    assert.ok(back.className.split(/\s+/).includes('min-h-6') && back.className.split(/\s+/).includes('min-w-6'), "back.className.split(/\\s+/).includes('min-h-6') && back.className.split(/\\s+/).includes('min-w-6')")
    assert.ok(back.className.includes('size-8'), 'its normal size is unchanged')
  })
})

describe('D8: a tab\'s name reads its label and its count apart', () => {
  it('names a tab "Signals 3", a real zero as "Signals 0", and leaves a tab with no count alone', async () => {
    const { PageTabs } = await import('../../components/shared/scaffolds/page-tabs')
    const d = doc(h(PageTabs, {
      tabs: [{ id: 'overview', label: 'Overview' }, { id: 'signals', label: 'Signals', count: 3 }, { id: 'deals', label: 'Deals', count: 0 }, { id: 'none', label: 'Empty', count: null }],
      active: 'overview', onChange: () => {}, label: 'Sections', idPrefix: 'x',
    }))
    const tab = (id: string) => d.getElementById(`x-tab-${id}`)!
    assert.equal(tab('overview').getAttribute('aria-label'), null)
    assert.equal(tab('signals').getAttribute('aria-label'), 'Signals 3')
    assert.equal(tab('deals').getAttribute('aria-label'), 'Deals 0')
    assert.equal(tab('none').getAttribute('aria-label'), null)
    assert.equal(tab('signals').textContent, 'Signals3', 'what is drawn is unchanged')
  })
})
