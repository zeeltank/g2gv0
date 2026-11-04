import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ORG_DETAIL_TABS, tabFromSearch } from './detail-tabs'

describe('the tabs of the Organization detail page', () => {
  it('keeps the tabs it had, in order, and Account 360 sits where it was', () => {
    assert.deepEqual(ORG_DETAIL_TABS.map((t) => t.label), ['Details', 'Hierarchy', 'Opportunities', 'Quotes', 'Account 360', 'Schedule', 'Comments', 'Documents', 'Emails', 'History', 'Projects'])
  })

  it('has no GTM & Signals tab any more: its content is the linked records of the Account 360 tab', () => {
    assert.ok(!ORG_DETAIL_TABS.some((t) => t.id === ('cross_links' as string) || /GTM & Signals/i.test(t.label)))
    assert.ok(ORG_DETAIL_TABS.some((t) => t.id === 'account_360'))
  })

  it('opens the tab a link asks for, and Details for anything else', () => {
    assert.equal(tabFromSearch(''), 'details')
    assert.equal(tabFromSearch('?tab=account_360'), 'account_360')
    assert.equal(tabFromSearch('tab=opportunities&x=1'), 'opportunities')
    assert.equal(tabFromSearch('?tab=nonsense'), 'details')
  })

  it('opens Details for an old bookmark to the retired tab, and for a tab only some organizations have', () => {
    assert.equal(tabFromSearch('?tab=cross_links'), 'details')
    assert.equal(tabFromSearch('?tab=custom'), 'details')
  })
})
