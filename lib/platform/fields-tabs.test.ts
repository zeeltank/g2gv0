import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CRM_FIELDS_TAB_IDS, FIELDS_TABS, fieldsHref, fieldsTabRules } from './fields-tabs'

/**
 * Field settings after the CRM Master Fields screen was merged into it (26 Nov 2026): Sales & Marketing carries six tabs, every other view only Custom fields with no tab bar.
 */
describe('which tabs Field settings shows', () => {
  it('shows six tabs for Sales & Marketing, in the order the retired Master Fields had them after Custom fields, and opens Custom fields', () => {
    const rules = fieldsTabRules('crm')
    assert.deepEqual(rules.tabs.map((tab) => tab.label), ['Custom fields', 'Picklist values', 'Tax rates', 'Lead scoring & assignment', 'Web-to-lead', 'SLA policies'])
    assert.equal(rules.defaultTab, 'custom')
    assert.equal(rules.showTabBar, true)
    assert.deepEqual(rules.ids, CRM_FIELDS_TAB_IDS)
    assert.equal(rules.ids[0], 'custom', 'the first id is the tab a plain address opens')
  })

  it('shows Custom fields alone, with no tab bar, for the central view and for every other module, as the page was before the merge', () => {
    for (const key of [null, 'organization', 'hrms', 'talent', 'lms', 'competency', 'task'] as const) {
      const rules = fieldsTabRules(key)
      assert.deepEqual(rules.ids, ['custom'], String(key))
      assert.deepEqual(rules.tabs.map((tab) => tab.id), ['custom'], String(key))
      assert.equal(rules.showTabBar, false, String(key))
      assert.equal(rules.defaultTab, 'custom', String(key))
    }
  })

  it('lists every tab once, with a plain label', () => {
    assert.equal(new Set(FIELDS_TABS.map((tab) => tab.id)).size, FIELDS_TABS.length)
    for (const tab of FIELDS_TABS) {
      assert.ok(tab.label.trim().length > 0, tab.id)
      assert.ok(!/master fields/i.test(tab.label), 'no tab keeps the retired screen\'s name')
    }
  })
})

describe('the Field settings address of Sales & Marketing', () => {
  it('is the plain scoped address for Custom fields and names the tab for the others', () => {
    assert.equal(fieldsHref(), '/platform-services/fields-configuration?module=crm')
    assert.equal(fieldsHref('custom'), '/platform-services/fields-configuration?module=crm')
    assert.equal(fieldsHref('picklists'), '/platform-services/fields-configuration?module=crm&tab=picklists')
    assert.equal(fieldsHref('sla-policies'), '/platform-services/fields-configuration?module=crm&tab=sla-policies')
  })
})
