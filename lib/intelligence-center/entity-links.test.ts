import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { compactEntities, entityHref, entityNoun, LINKABLE_ENTITY_TYPES } from './entity-links'
import { entities } from './fixtures'

describe('record links', () => {
  it('links ONLY the kinds whose detail page is verified: opportunities, invoices, departments', () => {
    assert.equal(entityHref('crm_opportunity', 12), '/module/crm/sales/opportunities/12')
    assert.equal(entityHref('crm_invoice', 7), '/module/crm/sales/invoices/7')
    assert.equal(entityHref('department', 3), '/organization/departments/3')
    assert.deepEqual([...LINKABLE_ENTITY_TYPES].sort(), ['crm_invoice', 'crm_opportunity', 'department'])
  })

  it('never builds a URL for any other kind, known or not', () => {
    for (const type of ['gtm_deal', 'gtm_account', 'gtm_renewal', 'leave_request', 'certification', 'lms_certificate', 'job_application', 'job_offer', 'onboarding_journey', 'employee', 'task', 'learning_assignment', 'course_enrolment', 'something_new', '../../etc']) {
      assert.equal(entityHref(type, 5), null, type)
    }
  })

  it('refuses an id that is not a plain positive whole number, so nothing but digits reaches a path', () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity, '12/../x' as unknown as number, null as unknown as number]) assert.equal(entityHref('crm_opportunity', bad), null, String(bad))
  })

  it('folds eleven repeated records into ONE line: the count, the first three as links, and "and N more"', () => {
    const [group] = compactEntities(entities('crm_opportunity', 11))
    assert.equal(group.summary, '11 opportunities listed')
    assert.deepEqual(group.shown.map((s) => s.text), ['Opportunity #1', 'Opportunity #2', 'Opportunity #3'])
    assert.deepEqual(group.shown.map((s) => s.href), ['/module/crm/sales/opportunities/1', '/module/crm/sales/opportunities/2', '/module/crm/sales/opportunities/3'])
    assert.equal(group.more, 8)
    assert.equal(group.noPage, false)
  })

  it('a kind without a page says so and names the module to find it in', () => {
    const [group] = compactEntities(entities('leave_request', 4))
    assert.equal(group.summary, '4 leave requests listed')
    assert.deepEqual(group.shown.map((s) => [s.text, s.href]), [['Record #1', null], ['Record #2', null], ['Record #3', null]])
    assert.equal(group.noPage, true)
    assert.deepEqual(group.module, { label: 'Leave Management', href: '/dashboard/leave-management' })
    assert.equal(group.more, 1)
  })

  it('groups mixed kinds separately and treats an unknown kind gracefully', () => {
    const groups = compactEntities([...entities('crm_invoice', 1), ...entities('some_new_thing', 2), { kind: 'metric', label: 'm', value: 1 }])
    assert.deepEqual(groups.map((g) => g.summary), ['1 invoice listed', '2 some new thing records listed'])
    assert.equal(groups[1].module, null)
    assert.equal(groups[1].noPage, true)
    assert.equal(entityNoun('crm_invoice', 1), 'invoice')
  })

  it('no evidence of records gives no groups', () => {
    assert.deepEqual(compactEntities([{ kind: 'window', label: 'w', from: 'a', to: 'b' }]), [])
  })
})
