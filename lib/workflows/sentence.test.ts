import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { catalog, workflow } from './fixtures'
import { conditionPhrase, describeAutomation, formatValue, joinWithAnd, joinWithOr, rowSentence, stripApprovalTail, triggerPhrase } from './sentence'

const c = catalog()

describe('one plain sentence', () => {
  it('reads "When ..., ..." for an event, a condition and an action, with the approval at the end', () => {
    const text = describeAutomation({
      trigger: 'crm.lead.reply_classified',
      conditions: [{ field: 'event.classification', op: 'eq', value: 'meeting_requested' }],
      actions: [{ type: 'book_lead_meeting' }],
      needsApproval: true,
    }, c, 'en-US')
    assert.equal(text, 'When a lead’s reply has been read and the reply type is meeting requested, hold the first proposed time on the owner’s calendar; needs your approval.')
  })

  it('puts the steps in order, "then" between them', () => {
    const text = describeAutomation({ trigger: 'crm.lead.created', conditions: [], actions: [{ type: 'add_lead_note' }, { type: 'create_lead_task' }, { type: 'assign_lead_round_robin' }] }, c)
    assert.equal(text, 'When a lead is created, add a note to the lead, then create a follow-up task for the lead, then assign the lead by the round-robin rotation.')
  })

  it('writes a number with its grouping and a flag as yes or no', () => {
    const t = (value: unknown, field = 'opportunity.amount', op = 'gt') => conditionPhrase(c, 'crm.opportunity.stage_changed', { field, op, value }, 'en-US')
    assert.equal(t(50000), 'the deal amount is more than 50,000')
    assert.equal(conditionPhrase(c, 'crm.lead.created', { field: 'lead.has_email', op: 'eq', value: true }), 'the lead has an email is yes')
    assert.equal(conditionPhrase(c, 'crm.lead.created', { field: 'lead.company', op: 'not_empty' }), 'the lead company is not empty')
    assert.equal(conditionPhrase(c, 'crm.lead.created', { field: 'lead.status', op: 'in', value: ['New', 'Not Contacted', 'Qualified'] }), 'the lead status is one of New, Not Contacted or Qualified')
  })

  it('copes with a half-finished form: no event, no action, no value yet', () => {
    assert.equal(describeAutomation({ trigger: '', conditions: [], actions: [] }, c), 'When something happens, choose what should happen.')
    assert.equal(describeAutomation({ trigger: 'crm.lead.created', conditions: [{ field: 'lead.missing_count', op: 'gt', value: '' }], actions: [] }, c), 'When a lead is created and the details missing is more than …, choose what should happen.')
  })

  it('takes the words after "When" from the server’s own phrase first, so the sentence is the same everywhere', () => {
    const own = { ...c, triggers: { ...c.triggers, 'crm.lead.created': { ...c.triggers['crm.lead.created'], phrase: 'a lead lands in your pipeline' } } }
    assert.equal(triggerPhrase(own, 'crm.lead.created'), 'a lead lands in your pipeline')
    assert.equal(triggerPhrase(c, 'crm.lead.created'), 'a lead is created', 'with no phrase from the server, the screen’s own')
    assert.equal(describeAutomation({ trigger: 'crm.lead.created', conditions: [], actions: [{ type: 'add_lead_note' }] }, own), 'When a lead lands in your pipeline, add a note to the lead.')
  })

  it('names an event it has no phrase for by its own label, in quotes', () => {
    const custom = { ...c, triggers: { ...c.triggers, 'crm.new.thing': { label: 'Thing happened (extra)', entity: null, provides: [], fields: {} } } }
    assert.equal(triggerPhrase(custom, 'crm.new.thing'), '“Thing happened” happens')
  })

  it('uses a name for a fact the catalog no longer has, never the raw dotted name', () => {
    assert.equal(conditionPhrase(c, 'crm.lead.created', { field: 'lead.old_fact', op: 'eq', value: 'x' }), 'the lead old fact is x')
  })

  it('joins lists in words', () => {
    assert.equal(joinWithOr(['a']), 'a')
    assert.equal(joinWithOr(['a', 'b', 'c']), 'a, b or c')
    assert.equal(joinWithAnd(['a', 'b']), 'a and b')
    assert.equal(formatValue(null), '…')
    assert.equal(formatValue('closed_won'), 'closed won')
    assert.equal(formatValue(false), 'no')
  })
})

describe('the sentence of a row', () => {
  it('takes the server\'s own sentence and leaves the approval to the badge', () => {
    const w = workflow({ sentence: 'When a lead replies and the reply is positive, book a meeting; needs your approval' })
    assert.equal(rowSentence(w, c, true), 'When a lead replies and the reply is positive, book a meeting.')
  })

  it('builds one from the definition when the server does not send one yet', () => {
    const w = workflow({ trigger_event: 'crm.lead.created', conditions: [], actions: [{ type: 'add_lead_note' }] })
    assert.equal(rowSentence(w, c, false), 'When a lead is created, add a note to the lead.')
    assert.equal(rowSentence(w, c, true), 'When a lead is created, add a note to the lead.', 'the badge says it, the sentence does not repeat it')
  })

  it('strips the approval tail whichever way it was written, and nothing else', () => {
    assert.equal(stripApprovalTail('When x, do y; needs your approval.'), 'When x, do y.')
    assert.equal(stripApprovalTail('When x, do y, and needs your approval'), 'When x, do y.')
    assert.equal(stripApprovalTail('When x, do y.'), 'When x, do y.')
    assert.equal(stripApprovalTail('When the note says needs your approval later, do y.'), 'When the note says needs your approval later, do y.')
  })
})
