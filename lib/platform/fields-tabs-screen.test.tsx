import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signals/router-harness'
import type { DecentralizedModuleKey } from './access-links'

/**
 * The shell of the Field settings page in a fake browser with a stand-in router that keeps the address: which tabs a module is shown, which one opens, what the address says once a
 * tab is chosen, and that only the open tab is built (so a console that reads data reads it when its tab is opened). The panels are stand-ins, because this is the shell's job alone.
 */

const IDS = ['custom', 'picklists', 'tax-rates', 'lead-scoring', 'web-to-lead', 'sla-policies'] as const

async function setup(search: string, moduleKey: DecentralizedModuleKey | null) {
  const k = await kit()
  const router = await routerHarness(search, '/platform-services/fields-configuration')
  const { FieldsTabs } = await import('../../app/platform-services/fields-configuration/_components/FieldsTabs')
  const built: string[] = []
  const Panel = ({ name }: { name: string }) => {
    built.push(name)
    return k.h('p', { 'data-panel': name }, `the ${name} panel`)
  }
  const panels = Object.fromEntries(IDS.map((id) => [id, k.h(Panel, { name: id })])) as Record<(typeof IDS)[number], ReturnType<typeof k.h>>

  await k.render(router.wrap(k.h(FieldsTabs, { moduleKey, panels })))
  await k.tick(10)

  const tabs = () => k.all('[role="tab"]')
  const selected = () => tabs().filter((tab) => tab.getAttribute('aria-selected') === 'true').map((tab) => tab.textContent)
  const open = () => k.all('[data-panel]').map((panel) => panel.getAttribute('data-panel'))

  return { k, router, built, tabs, selected, open }
}

describe('the Field settings page shell', () => {
  afterEach(disposeAll)

  it('shows six tabs for Sales & Marketing, opens Custom fields, and builds only that panel', async () => {
    const s = await setup('module=crm', 'crm')
    assert.deepEqual(s.tabs().map((tab) => tab.textContent), ['Custom fields', 'Picklist values', 'Tax rates', 'Lead scoring & assignment', 'Web-to-lead', 'SLA policies'])
    assert.deepEqual(s.selected(), ['Custom fields'])
    assert.deepEqual(s.open(), ['custom'])
    assert.equal(s.k.one('[role="tablist"]')!.getAttribute('aria-label'), 'Field settings sections')
  })

  for (const key of [null, 'organization', 'hrms', 'talent', 'lms', 'competency', 'task'] as const) {
    it(`shows Custom fields alone, with no tab bar, for ${key ?? 'the central view'}`, async () => {
      const s = await setup(key ? `module=${key}` : '', key)
      assert.equal(s.tabs().length, 0, 'no tab bar')
      assert.equal(s.k.one('[role="tablist"]'), null)
      assert.deepEqual(s.open(), ['custom'])
    })
  }

  it('opens the tab the address names (the retired Master Fields address names picklists), and Custom fields for one it does not know', async () => {
    assert.deepEqual((await setup('module=crm&tab=picklists', 'crm')).selected(), ['Picklist values'])
    await disposeAll()
    assert.deepEqual((await setup('module=crm&tab=sla-policies', 'crm')).selected(), ['SLA policies'])
    await disposeAll()
    assert.deepEqual((await setup('module=crm&tab=nonsense', 'crm')).selected(), ['Custom fields'])
    await disposeAll()
    // A module with only Custom fields stays on it even when a link names another tab.
    const other = await setup('module=hrms&tab=picklists', 'hrms')
    assert.deepEqual(other.open(), ['custom'])
  })

  it('writes the chosen tab into the address, keeps the module, and builds a panel only when its tab is opened', async () => {
    const s = await setup('module=crm', 'crm')
    const tax = s.tabs().find((tab) => tab.textContent === 'Tax rates')!
    await s.k.click(tax)
    await s.k.tick(10)
    assert.match(s.router.lastSearch(), /(^|&)tab=tax-rates(&|$)/)
    assert.match(s.router.lastSearch(), /(^|&)module=crm(&|$)/, 'the module survives')
    assert.deepEqual(s.open(), ['tax-rates'])
    assert.deepEqual([...new Set(s.built)].sort(), ['custom', 'tax-rates'], 'only the panels that were opened were built')
  })
})
