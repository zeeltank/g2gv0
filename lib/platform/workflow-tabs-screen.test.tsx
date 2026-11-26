import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signals/router-harness'
import type { DecentralizedModuleKey } from './access-links'

/**
 * The shell of the Workflows page in a fake browser with a stand-in router that keeps the address: which tabs a module is shown, which one opens, what the address says
 * once a tab is chosen, and that only the open tab is built (so a tab that reads data reads it when it is opened). The panels are stand-ins, because this is the shell's job
 * alone; each tab is tested with its own screen.
 */

async function setup(search: string, moduleKey: DecentralizedModuleKey | null) {
  const k = await kit()
  const router = await routerHarness(search, '/platform-services/workflow')
  const { WorkflowTabs } = await import('../../app/platform-services/workflow/_components/WorkflowTabs')
  const built: string[] = []
  const Panel = ({ name }: { name: string }) => {
    built.push(name)
    return k.h('p', { 'data-panel': name }, `the ${name} panel`)
  }

  await k.render(router.wrap(k.h(WorkflowTabs, {
    moduleKey,
    panels: { automations: k.h(Panel, { name: 'automations' }), approvals: k.h(Panel, { name: 'approvals' }), runs: k.h(Panel, { name: 'runs' }) },
  })))
  await k.tick(10)

  const tabs = () => k.all('[role="tab"]')
  const selected = () => tabs().filter((tab) => tab.getAttribute('aria-selected') === 'true').map((tab) => tab.textContent)
  const open = () => k.all('[data-panel]').map((panel) => panel.getAttribute('data-panel'))

  return { k, router, built, tabs, selected, open }
}

describe('the Workflows page shell', () => {
  afterEach(disposeAll)

  it('shows Automations, Approvals and Runs, in that order, for Sales & Marketing, and opens Automations', async () => {
    const s = await setup('module=crm', 'crm')
    assert.deepEqual(s.tabs().map((tab) => tab.textContent), ['Automations', 'Approvals', 'Runs'])
    assert.deepEqual(s.selected(), ['Automations'])
    assert.deepEqual(s.open(), ['automations'])
    assert.equal(s.k.one('[role="tablist"]')!.getAttribute('aria-label'), 'Workflow sections')
  })

  it('shows the same three tabs, in the same order, for the central view, and opens Approvals', async () => {
    const s = await setup('', null)
    assert.deepEqual(s.tabs().map((tab) => tab.textContent), ['Automations', 'Approvals', 'Runs'])
    assert.deepEqual(s.selected(), ['Approvals'])
    assert.deepEqual(s.open(), ['approvals'])
  })

  for (const key of ['organization', 'hrms', 'talent', 'lms', 'competency', 'task'] as const) {
    it(`shows Approvals alone, with no tab bar, for ${key}`, async () => {
      const s = await setup(`module=${key}`, key)
      assert.equal(s.tabs().length, 0, 'no tab bar')
      assert.equal(s.k.one('[role="tablist"]'), null)
      assert.deepEqual(s.open(), ['approvals'])
    })
  }

  it('opens the tab the address names, and the default for one it does not know', async () => {
    assert.deepEqual((await setup('module=crm&tab=runs', 'crm')).selected(), ['Runs'])
    await disposeAll()
    assert.deepEqual((await setup('module=crm&tab=nonsense', 'crm')).selected(), ['Automations'])
    await disposeAll()
    assert.deepEqual((await setup('tab=automations', null)).selected(), ['Automations'])
    await disposeAll()
    // A module with no Runs tab opens Approvals even when the link names Runs.
    const other = await setup('module=hrms&tab=runs', 'hrms')
    assert.deepEqual(other.open(), ['approvals'])
  })

  it('writes the tab into the address, keeping the module, when a tab is chosen, and leaves the default tab out', async () => {
    const s = await setup('module=crm', 'crm')
    await s.k.click(s.tabs().find((tab) => tab.textContent === 'Runs')!)
    assert.equal(s.router.lastSearch(), 'module=crm&tab=runs')
    assert.deepEqual(s.selected(), ['Runs'])
    assert.deepEqual(s.open(), ['runs'])
    await s.k.click(s.tabs().find((tab) => tab.textContent === 'Automations')!)
    assert.equal(s.router.lastSearch(), 'module=crm', 'the first tab is the default and is left out')
  })

  it('writes the tab for the central view too, with Approvals as the one left out', async () => {
    const s = await setup('', null)
    await s.k.click(s.tabs().find((tab) => tab.textContent === 'Automations')!)
    assert.equal(s.router.lastSearch(), 'tab=automations')
    await s.k.click(s.tabs().find((tab) => tab.textContent === 'Approvals')!)
    assert.equal(s.router.lastSearch(), '')
  })

  it('builds only the open tab, so the tabs that read data read it when they are opened', async () => {
    const s = await setup('module=crm', 'crm')
    assert.deepEqual([...new Set(s.built)], ['automations'])
    await s.k.click(s.tabs().find((tab) => tab.textContent === 'Runs')!)
    assert.deepEqual([...new Set(s.built)], ['automations', 'runs'])
  })

  it('links each tab to its panel and moves between tabs with the arrow keys, as the tabs pattern asks', async () => {
    const s = await setup('module=crm', 'crm')
    const first = s.tabs()[0]
    assert.ok(s.k.w.document.getElementById(first.getAttribute('aria-controls')!), 'the tab controls a real panel')
    first.focus()
    await s.k.press('ArrowRight', first)
    assert.deepEqual(s.selected(), ['Approvals'])
    await s.k.press('End')
    assert.deepEqual(s.selected(), ['Runs'])
  })
})
