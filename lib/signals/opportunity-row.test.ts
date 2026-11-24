import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SignalDecisionResponse } from '../../services/signal-review/signal-types'
import { historyEntry } from './signal-fixtures'
import { opportunities, opportunity, opportunityList } from './opportunity-fixtures'
import { applyDecision, replaceRow, withStatus } from './opportunity-row'
import { withLead } from './lead-action'

const answer = (data: Record<string, unknown>): SignalDecisionResponse => ({ status: 1, data: { id: 1, title: 't', company_name: 'c', business_fit: null, product_master_id: null, product_master_name: null, date_info: { status: 'undated', date: null }, review_status: 'Follow-up', ...data } as never, review: historyEntry() })

describe('a card changing in place', () => {
  it('takes the status, notes and review time from a decision\'s answer and keeps every other field of the card', () => {
    const before = opportunity({ id: 1, review_notes: 'old', reviewed_at: null, company_name: 'Kept School' })
    const after = applyDecision(before, answer({ review_status: 'Dismissed', review_notes: 'Wrong product', reviewed_at: '2026-11-13T10:00:00+05:30' }))
    assert.equal(after.review_status, 'Dismissed')
    assert.equal(after.review_notes, 'Wrong product')
    assert.equal(after.reviewed_at, '2026-11-13T10:00:00+05:30')
    assert.equal(after.company_name, 'Kept School')
    assert.equal(after.title, before.title)
    assert.equal(before.review_status, 'New', 'the old card is not changed')
  })

  it('keeps the notes and review time it already has when the answer does not carry them', () => {
    const after = applyDecision(opportunity({ review_notes: 'kept', reviewed_at: '2026-11-01T00:00:00+05:30' }), answer({}))
    assert.equal(after.review_notes, 'kept')
    assert.equal(after.reviewed_at, '2026-11-01T00:00:00+05:30')
    assert.equal(after.review_status, 'Follow-up')
  })

  it('withStatus changes only the status, and returns the same card when it is already that status', () => {
    const card = opportunity()
    assert.equal(withStatus(card, 'New'), card)
    const changed = withStatus(card, 'Reviewed')
    assert.equal(changed.review_status, 'Reviewed')
    assert.equal(changed.title, card.title)
  })

  it('withLead puts the lead on the card and drops a number or status that belonged to another lead', () => {
    const card = opportunity({ promoted_lead_id: '5', promoted_lead_no: 'LD-5', promoted_lead_status: 'New' })
    assert.equal(withLead(card, '5'), card, 'the same lead: nothing to change')
    const other = withLead(card, '9')
    assert.deepEqual([other.promoted_lead_id, other.promoted_lead_no, other.promoted_lead_status], ['9', null, null])
    assert.equal(withLead(opportunity(), '7').promoted_lead_id, '7')
  })
})

describe('the counts above the list move with the row', () => {
  const list = () => opportunityList(opportunities(), { summary: { total: 73, new: 68, high_priority: 12, follow_up: 5 } })

  it('Needs decision to Contacted: one fewer needs a decision, one more is contacted, the total stays', () => {
    const next = replaceRow(list(), withStatus(opportunity({ id: 1 }), 'Follow-up'))
    assert.deepEqual([next.summary.total, next.summary.new, next.summary.follow_up, next.summary.high_priority], [73, 67, 6, 12])
    assert.equal(next.data.find((row) => row.id === 1)?.review_status, 'Follow-up')
    assert.equal(next.data.length, 3)
  })

  it('a High signal that is dismissed leaves "high priority", and comes back when it is reopened', () => {
    const dismissed = replaceRow(list(), withStatus(opportunity({ id: 1, priority: 'High' }), 'Dismissed'))
    assert.deepEqual([dismissed.summary.new, dismissed.summary.high_priority], [67, 11])
    const reopened = replaceRow(dismissed, withStatus(dismissed.data.find((row) => row.id === 1)!, 'New'))
    assert.deepEqual([reopened.summary.new, reopened.summary.high_priority], [68, 12])
  })

  it('a Medium signal that is dismissed does not touch "high priority"', () => {
    const next = replaceRow(list(), withStatus(opportunity({ id: 2, review_status: 'Follow-up', priority: 'Medium' }), 'Dismissed'))
    assert.deepEqual([next.summary.new, next.summary.follow_up, next.summary.high_priority], [68, 4, 12])
  })

  it('a change that is not a change in status leaves the counts alone, and a signal that is not on this page changes nothing', () => {
    const response = list()
    const same = replaceRow(response, opportunity({ id: 1, promoted_lead_id: '77' }))
    assert.equal(same.summary, response.summary)
    assert.equal(same.data.find((row) => row.id === 1)?.promoted_lead_id, '77')
    assert.equal(replaceRow(response, opportunity({ id: 999, review_status: 'Reviewed' })), response)
  })

  it('keeps the other counts of the response (the feed sections) as they were', () => {
    const response = opportunityList(opportunities(), { summary: { total: 10, new: 4, high_priority: 2, follow_up: 1, immediate: 3, watchlist: 2 } })
    const next = replaceRow(response, withStatus(opportunity({ id: 1 }), 'Reviewed'))
    assert.equal(next.summary.immediate, 3)
    assert.equal(next.summary.watchlist, 2)
  })
})
