import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  actionOptions, actionUnavailableReason, consequentialPhrases, effectiveKind, factChoices, filterOptions, groupOptions, guessParamDef, needsApproval, operatorsFor,
  paramsOf, triggerOptions,
} from './catalog'
import { catalog, workflow } from './fixtures'

const c = catalog()

describe('the typed parameters of an action', () => {
  it('uses the typed list the server sends, exactly', () => {
    const defs = paramsOf(c.actions.create_lead_task)
    assert.deepEqual(defs.map((d) => [d.key, d.kind, d.required]), [['title', 'string', true], ['due_in_days', 'number', false], ['link_to', 'enum', false], ['only_if_empty', 'bool', false]])
    assert.deepEqual(defs[1].min, 0)
    assert.deepEqual(defs[1].max, 90)
    assert.deepEqual(defs[2].options, [{ value: 'lead', label: 'Lead' }, { value: 'organization', label: 'Organization' }, { value: 'opportunity', label: 'Opportunity' }])
    assert.equal(defs[0].label, 'Task title')
  })

  it('reads a text with format json as a structured value, and a picklist as a choice', () => {
    const defs = paramsOf(c.actions.run_agent_typed)
    assert.deepEqual(defs.map((d) => [d.key, d.kind]), [['agent', 'enum'], ['input', 'json']])
    assert.equal(defs[1].facts, false, 'a structured value does not take details of the record in brackets')
  })

  it('lets the typed list win over the words, even when it is empty', () => {
    const action = { ...c.actions.add_lead_note, params: { text: 'text, required', stray: 'whole number 1-5' }, param_fields: [] }
    assert.deepEqual(paramsOf(action), [])
    const old = { ...c.actions.add_lead_note, param_fields: undefined, params: { text: 'text, required' } }
    assert.deepEqual(paramsOf(old).map((d) => d.key), ['text'], 'with no typed list, the words are read')
  })

  it('reads a person as a user choice and an object as a structured one', () => {
    assert.equal(paramsOf(c.actions.create_support_onboarding)[1].kind, 'user')
    assert.equal(paramsOf(c.actions.run_agent).find((d) => d.key === 'input')!.kind, 'json')
  })

  it('knows which text may carry details of the record', () => {
    const note = paramsOf(c.actions.add_lead_note)[0]
    assert.equal(note.facts, true, 'a text note')
    assert.equal(paramsOf(c.actions.create_lead_task)[0].facts, true, 'a title')
    assert.equal(paramsOf(c.actions.create_lead_task)[2].facts, false, 'a choice')
  })

  it('falls back to reading the descriptions in words ONLY when no typed list is there', () => {
    const defs = paramsOf(c.actions.set_next_step)
    assert.deepEqual(defs.map((d) => [d.key, d.kind, d.required]), [['text', 'text', true], ['due_in_days', 'number', false], ['only_if_empty', 'bool', false]])
    assert.equal(defs[0].facts, true, 'the description says it supports placeholders')
    assert.deepEqual([defs[1].min, defs[1].max], [0, 365], 'the range in the description')
    assert.equal(defs[2].hint, 'Default true')
  })

  it('reads the words the old form read', () => {
    assert.equal(guessParamDef('agent', 'gtm-outreach | gtm-account').kind, 'enum')
    assert.equal(guessParamDef('save_drafts', 'true | false (Outreach agent only)').kind, 'bool')
    assert.equal(guessParamDef('input', 'object: each value is a fixed value').kind, 'json')
    assert.equal(guessParamDef('assign_to_user_id', 'whole number, required (an active user of your organisation)').kind, 'user')
    assert.equal(guessParamDef('campaign_id', 'id of one of your open campaigns').kind, 'number')
    assert.equal(guessParamDef('body', 'text, required').kind, 'text')
    assert.equal(guessParamDef('timezone', 'text, optional (e.g. Asia/Kolkata; default is the server time zone)').hint, 'For example Asia/Kolkata; default is the server time zone')
    assert.equal(guessParamDef('title', 'text, required, supports {{field}}').required, true)
    assert.equal(guessParamDef('title', 'text, optional').required, false)
  })

  it('has no parameters for an action that takes none, or one it does not know', () => {
    assert.deepEqual(paramsOf(c.actions.book_lead_meeting), [])
    assert.deepEqual(paramsOf(undefined), [])
  })

  it('turns a choice with no choices into a text box instead of an empty list', () => {
    assert.equal(effectiveKind({ key: 'k', label: 'K', kind: 'enum', required: false, facts: false }), 'string')
    assert.equal(effectiveKind({ key: 'k', label: 'K', kind: 'number', required: false, facts: false }), 'number')
  })
})

describe('the event and action pickers', () => {
  it('lists the events grouped by the record they are about, with the bracketed detail as a hint', () => {
    const options = triggerOptions(c)
    assert.deepEqual(groupOptions(options).map((g) => g.group), ['Leads', 'Opportunities', 'Deals'])
    const created = options.find((o) => o.value === 'crm.lead.created')!
    assert.equal(created.label, 'CRM lead created')
    assert.equal(created.hint, 'Signal promotion, manual, import or web form')
  })

  it('lists every action, those that cannot follow the event as disabled with the reason', () => {
    const options = actionOptions(c, 'crm.opportunity.stage_changed')
    const note = options.find((o) => o.value === 'add_lead_note')!
    assert.equal(note.disabled, true)
    assert.equal(note.reason, 'Needs an event about a lead')
    const onboarding = options.find((o) => o.value === 'create_support_onboarding')!
    assert.equal(onboarding.disabled, undefined, 'an action that needs nothing is always available')
    assert.equal(onboarding.group, 'General')
    assert.equal(options.find((o) => o.value === 'convert_lead')!.label, 'Convert the lead', 'the bracket is not part of the name')
  })

  it('offers the actions of the chosen event as available', () => {
    const options = actionOptions(c, 'crm.lead.created')
    assert.equal(options.find((o) => o.value === 'add_lead_note')!.disabled, undefined)
    assert.equal(actionUnavailableReason(c, 'add_lead_note', 'crm.lead.created'), null)
    assert.equal(actionUnavailableReason(c, 'set_next_step', 'crm.lead.created'), 'Needs an event about a deal')
  })

  it('searches the label, the hint and the group, ignoring case', () => {
    const options = triggerOptions(c)
    assert.deepEqual(filterOptions(options, 'quali').map((o) => o.value), [], 'no event is named "quali" here')
    assert.deepEqual(filterOptions(options, 'WEB FORM').map((o) => o.value), ['crm.lead.created'], 'the hint')
    assert.deepEqual(filterOptions(options, 'opportun').map((o) => o.value), ['crm.opportunity.stage_changed'], 'the label and the group')
    assert.equal(filterOptions(options, '  ').length, options.length, 'a blank search shows everything')
  })
})

describe('conditions', () => {
  it('offers a number the comparisons and keeps them from text and yes/no facts', () => {
    const fields = c.triggers['crm.lead.created'].fields
    assert.ok(operatorsFor(c, fields['lead.missing_count']).includes('gt'))
    assert.ok(!operatorsFor(c, fields['lead.company']).includes('gt'), 'the server refuses "more than" on text')
    assert.ok(operatorsFor(c, fields['lead.company']).includes('contains'))
    assert.ok(!operatorsFor(c, fields['lead.missing_count']).includes('contains'))
    assert.deepEqual(operatorsFor(c, fields['lead.has_email']), ['eq', 'neq', 'empty', 'not_empty'], 'a yes/no says is, is not, empty, not empty')
  })

  it('lists the details of the record by label, for inserting into a text', () => {
    assert.deepEqual(factChoices(c, 'crm.lead.created').map((f) => f.label), ['Lead company', 'Lead has an email', 'Details missing', 'Lead status'])
    assert.deepEqual(factChoices(c, 'nope'), [])
  })
})

describe('what needs approval', () => {
  it('trusts the server\'s answer when it sends one', () => {
    assert.equal(needsApproval(workflow({ needs_approval: false, actions: [{ type: 'book_lead_meeting' }] }), c), false)
    assert.equal(needsApproval(workflow({ needs_approval: true, actions: [{ type: 'add_lead_note' }] }), c), true)
  })

  it('works it out from the actions and the approval switch when the server does not say', () => {
    assert.equal(needsApproval(workflow({ actions: [{ type: 'book_lead_meeting' }] }), c), true, 'a consequential action')
    assert.equal(needsApproval(workflow({ actions: [{ type: 'add_lead_note' }], requires_approval: 1 }), c), true, 'the switch')
    assert.equal(needsApproval(workflow({ actions: [{ type: 'add_lead_note' }], requires_approval: 0 }), c), false)
  })

  it('names the actions that wait for approval', () => {
    assert.deepEqual(consequentialPhrases(c, [{ type: 'add_lead_note' }, { type: 'convert_lead' }, { type: 'book_lead_meeting' }]), ['convert the lead', 'hold the first proposed time on the owner’s calendar'])
  })
})
