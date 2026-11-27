import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MODULE_LABEL, type DecentralizedModuleKey } from './access-links'
import { readTab } from '../../components/shared/scaffolds/url-tab'
import {
  APPROVALS_ONLY_TAB_IDS,
  AUTOMATIONS_HREF,
  CENTRAL_TAB_IDS,
  CRM_TAB_IDS,
  WORKFLOW_TABS,
  workflowHref,
  workflowTabRules,
} from './workflow-tabs'

/**
 * The tabs of the Workflows page (contract WORKFLOWS-MERGE.md, "The shape of the page"). Sales & Marketing and the central view carry three tabs, Automations and Runs
 * read the tenant's GTM engine, which has no split by module, so every other module keeps Approvals alone, exactly as the page was before the merge.
 */

const OTHER_MODULES = (Object.keys(MODULE_LABEL) as DecentralizedModuleKey[]).filter((key) => key !== 'crm')

describe('the tabs of the Workflows page', () => {
  it('shows three tabs for Sales & Marketing, in the order Automations, Approvals, Runs, and opens Automations', () => {
    const rules = workflowTabRules('crm')
    assert.deepEqual(rules.tabs.map((tab) => tab.id), ['automations', 'approvals', 'runs'])
    assert.deepEqual(rules.tabs.map((tab) => tab.label), ['Automations', 'Approvals', 'Runs'])
    assert.equal(rules.defaultTab, 'automations')
    assert.equal(rules.showTabBar, true)
  })

  it('shows the same three tabs, in the same order, for the central view, and opens Approvals', () => {
    const rules = workflowTabRules(null)
    assert.deepEqual(rules.tabs.map((tab) => tab.id), ['automations', 'approvals', 'runs'])
    assert.equal(rules.defaultTab, 'approvals')
    assert.equal(rules.showTabBar, true)
  })

  it('shows Approvals alone, and no tab bar, for every other module', () => {
    assert.ok(OTHER_MODULES.length >= 6, 'the six other modules are covered')
    for (const key of OTHER_MODULES) {
      const rules = workflowTabRules(key)
      assert.deepEqual(rules.tabs.map((tab) => tab.id), ['approvals'], key)
      assert.equal(rules.defaultTab, 'approvals', key)
      assert.equal(rules.showTabBar, false, key)
      assert.deepEqual(rules.ids, ['approvals'], key)
    }
  })

  it('makes the first id the one a plain address opens, as useUrlTab does, and keeps the id lists stable (they are a dependency of the hook)', () => {
    assert.equal(workflowTabRules('crm').ids, CRM_TAB_IDS)
    assert.equal(workflowTabRules(null).ids, CENTRAL_TAB_IDS)
    assert.equal(workflowTabRules('hrms').ids, APPROVALS_ONLY_TAB_IDS)
    assert.equal(workflowTabRules('crm').ids, workflowTabRules('crm').ids)
    assert.equal(CRM_TAB_IDS[0], 'automations')
    assert.equal(CENTRAL_TAB_IDS[0], 'approvals')
  })

  it('opens the default tab for a missing or unknown ?tab=, and the named one when it exists in that view', () => {
    const none = new URLSearchParams('module=crm')
    assert.equal(readTab(none, CRM_TAB_IDS, CRM_TAB_IDS[0]), 'automations')
    assert.equal(readTab(new URLSearchParams('module=crm&tab=runs'), CRM_TAB_IDS, CRM_TAB_IDS[0]), 'runs')
    assert.equal(readTab(new URLSearchParams('tab=runs'), CENTRAL_TAB_IDS, CENTRAL_TAB_IDS[0]), 'runs')
    assert.equal(readTab(new URLSearchParams('tab=nonsense'), CENTRAL_TAB_IDS, CENTRAL_TAB_IDS[0]), 'approvals')
    // Another module has no Runs tab: a link that names one still opens Approvals.
    assert.equal(readTab(new URLSearchParams('module=hrms&tab=runs'), APPROVALS_ONLY_TAB_IDS, APPROVALS_ONLY_TAB_IDS[0]), 'approvals')
    assert.equal(readTab(new URLSearchParams('module=hrms&tab=automations'), APPROVALS_ONLY_TAB_IDS, APPROVALS_ONLY_TAB_IDS[0]), 'approvals')
  })

  it('lists exactly the three tabs, each once', () => {
    assert.deepEqual(WORKFLOW_TABS.map((tab) => tab.id).sort(), ['approvals', 'automations', 'runs'])
    for (const ids of [CRM_TAB_IDS, CENTRAL_TAB_IDS]) assert.deepEqual([...ids].sort(), ['approvals', 'automations', 'runs'])
  })
})

describe('the addresses of the page', () => {
  it('writes the module and the tab, and nothing else', () => {
    assert.equal(workflowHref(null), '/platform-services/workflow')
    assert.equal(workflowHref('hrms'), '/platform-services/workflow?module=hrms')
    assert.equal(workflowHref('crm', 'runs'), '/platform-services/workflow?module=crm&tab=runs')
    assert.equal(workflowHref(null, 'approvals'), '/platform-services/workflow?tab=approvals')
  })

  it('sends the two retired addresses to the Automations tab of Sales & Marketing', () => {
    assert.equal(AUTOMATIONS_HREF, '/platform-services/workflow?module=crm&tab=automations')
  })
})
