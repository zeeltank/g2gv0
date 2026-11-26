import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  actionToApi, addAction, addCondition, changeActionType, changeConditionField, changeConditionOp, changeTrigger, draftFromWorkflow, draftNeedsApproval,
  draftSentence, draftToInput, duplicateInput, emptyDraft, insertFact, isDirty, MAX_ACTIONS, MAX_CONDITIONS, patchActionParam, patchCondition, removeAction, removeCondition,
  snapshot, splitList, STEP_TYPE, validateDraft, valueControl, type WorkflowDraft,
} from './draft'
import { paramsOf } from './catalog'
import { catalog, workflow } from './fixtures'

const c = catalog()

function filled(over: Partial<WorkflowDraft> = {}): WorkflowDraft {
  let d = { ...emptyDraft(), name: 'Welcome new leads', trigger: 'crm.lead.created' }
  d = addAction(d, 'add_lead_note')
  d = patchActionParam(d, d.actions[0].key, 'text', 'Hello {{lead.company}}')
  return { ...d, ...over }
}

describe('a form from an automation, and back', () => {
  it('opens an existing automation as text, and says it has not changed until it does', () => {
    const w = workflow({ trigger_event: 'crm.lead.created', conditions: [{ field: 'lead.missing_count', op: 'gt', value: 2 }], actions: [{ type: 'create_lead_task', params: { title: 'Call', due_in_days: 1 } }] })
    const initial = draftFromWorkflow(w)
    assert.equal(initial.conditions[0].value, '2')
    assert.deepEqual(initial.actions[0].params, { title: 'Call', due_in_days: '1' })
    assert.equal(isDirty(initial, draftFromWorkflow(w)), false, 'the row keys differ between two opens but the words are the same')
    assert.equal(isDirty(initial, patchActionParam(initial, initial.actions[0].key, 'title', 'Call back')), true)
  })

  it('does not count spaces at the ends, or an empty parameter, as a change', () => {
    const initial = filled()
    const noise = { ...initial, name: `  ${initial.name} `, actions: initial.actions.map((a) => ({ ...a, params: { ...a.params, other: '   ' } })) }
    assert.equal(isDirty(initial, noise), false)
  })

  it('types the conditions from the catalog and sends the event only with a new automation', () => {
    const d = filled({ conditions: [{ key: 'a', field: 'lead.missing_count', op: 'gt', value: '2' }, { key: 'b', field: 'lead.has_email', op: 'eq', value: 'true' }, { key: 'c', field: 'lead.status', op: 'in', value: 'New, Qualified' }, { key: 'd', field: 'lead.company', op: 'not_empty', value: 'ignored' }] })
    const created = draftToInput(d, c, true)
    assert.equal(created.trigger_event, 'crm.lead.created')
    assert.deepEqual(created.conditions, [
      { field: 'lead.missing_count', op: 'gt', value: 2 },
      { field: 'lead.has_email', op: 'eq', value: true },
      { field: 'lead.status', op: 'in', value: ['New', 'Qualified'] },
      { field: 'lead.company', op: 'not_empty' },
    ])
    assert.equal('trigger_event' in draftToInput(d, c, false), false, 'the server refuses a changed event on an existing automation')
  })

  it('types the action parameters from the catalog and leaves a blank one out', () => {
    const defs = paramsOf(c.actions.create_lead_task)
    const body = actionToApi({ key: 'k', type: 'create_lead_task', params: { title: ' Call ', due_in_days: '3', link_to: '', only_if_empty: 'false', stray: 'x' } }, defs)
    assert.deepEqual(body, { type: 'create_lead_task', params: { title: 'Call', due_in_days: 3, only_if_empty: false } })
  })

  it('sends an object parameter as an object and a person as a number', () => {
    const agent = actionToApi({ key: 'k', type: 'run_agent', params: { agent: 'gtm-outreach', input: '{"account_id": "@account.id"}' } }, paramsOf(c.actions.run_agent))
    assert.deepEqual(agent.params, { agent: 'gtm-outreach', input: { account_id: '@account.id' } })
    const onboarding = actionToApi({ key: 'k', type: 'create_support_onboarding', params: { title: 'Onboard', assign_to_user_id: '42' } }, paramsOf(c.actions.create_support_onboarding))
    assert.equal(onboarding.params!.assign_to_user_id, 42)
  })

  it('duplicates as a copy of the same definition, within the 191-character name limit', () => {
    const copy = duplicateInput(workflow({ name: 'x'.repeat(191) }))
    assert.equal(copy.name.length, 191)
    assert.equal(duplicateInput(workflow({ name: 'Flag deals' })).name, 'Flag deals (copy)')
    assert.equal(duplicateInput(workflow()).trigger_event, 'crm.lead.reply_classified')
  })

  it('splits a list and falls back to 100 runs a day when the limit is not a number', () => {
    assert.deepEqual(splitList(' a, b ,, c '), ['a', 'b', 'c'])
    assert.equal(draftToInput(filled({ maxRunsPerDay: 'lots' }), c, true).max_runs_per_day, 100)
    assert.equal(draftToInput(filled({ maxRunsPerDay: '250' }), c, true).max_runs_per_day, 250)
  })
})

describe('editing the form', () => {
  it('clears the conditions and drops the steps that cannot follow the new event, and says how many', () => {
    let d = filled()
    d = addCondition(d, c)
    d = addAction(d, 'create_support_onboarding')
    const next = changeTrigger(d, c, 'crm.opportunity.stage_changed')
    assert.equal(next.draft.trigger, 'crm.opportunity.stage_changed')
    assert.deepEqual(next.draft.actions.map((a) => a.type), ['create_support_onboarding'], 'the lead note needs a lead, the onboarding needs nothing')
    assert.deepEqual([next.droppedSteps, next.droppedConditions], [1, 1])
    assert.deepEqual(next.draft.conditions, [])
  })

  it('adds a condition on the first fact with an operator that fits, and stops at ten', () => {
    let d = addCondition(filled(), c)
    assert.deepEqual([d.conditions[0].field, d.conditions[0].op], ['lead.company', 'eq'])
    for (let i = 0; i < 20; i += 1) d = addCondition(d, c)
    assert.equal(d.conditions.length, MAX_CONDITIONS)
    assert.equal(addCondition(emptyDraft(), c).conditions.length, 0, 'no event, no facts')
  })

  it('keeps the operator when the new fact allows it, and picks one that fits when it does not', () => {
    let d = addCondition(filled(), c)
    const key = d.conditions[0].key
    d = patchCondition(d, key, { op: 'contains', value: 'school' })
    d = changeConditionField(d, c, key, 'lead.status')
    assert.deepEqual([d.conditions[0].op, d.conditions[0].value], ['contains', ''], 'contains still works on a choice')
    d = changeConditionField(d, c, key, 'lead.missing_count')
    assert.equal(d.conditions[0].op, 'eq', 'a number cannot "contain"')
  })

  it('clears the value when the operator no longer takes one, or changes between one value and a list', () => {
    let d = addCondition(filled(), c)
    const key = d.conditions[0].key
    d = patchCondition(d, key, { value: 'x' })
    assert.equal(changeConditionOp(d, key, 'neq').conditions[0].value, 'x')
    assert.equal(changeConditionOp(d, key, 'in').conditions[0].value, '')
    assert.equal(changeConditionOp(d, key, 'empty').conditions[0].value, '')
  })

  it('adds and removes steps, up to six, and resets the details when the step changes', () => {
    let d = filled()
    d = changeActionType(d, d.actions[0].key, 'create_lead_task')
    assert.deepEqual(d.actions[0].params, {})
    for (let i = 0; i < 10; i += 1) d = addAction(d, 'add_lead_note')
    assert.equal(d.actions.length, MAX_ACTIONS)
    d = removeAction(d, d.actions[0].key)
    assert.equal(d.actions.length, MAX_ACTIONS - 1)
    assert.equal(removeCondition(addCondition(filled(), c), 'nope').conditions.length, 1)
  })

  it('puts a detail of the record into a text at the caret, or at the end', () => {
    assert.deepEqual(insertFact('Hi , welcome', 'lead.company', 3), { text: 'Hi {{lead.company}}, welcome', caret: 19 })
    assert.equal(insertFact('Hi', 'lead.company').text, 'Hi{{lead.company}}')
    assert.equal(insertFact('Hi', 'lead.company', 99).text, 'Hi{{lead.company}}')
  })

  it('shows two forms as the same when only their row keys differ', () => {
    const a = filled()
    const b = { ...a, actions: a.actions.map((x) => ({ ...x, key: 'other' })) }
    assert.equal(snapshot(a), snapshot(b))
  })
})

describe('what is missing before a save', () => {
  it('asks for a name, an event and at least one step, in plain words', () => {
    const p = validateDraft(emptyDraft(), c)
    assert.equal(p.name, 'Give the automation a name.')
    assert.equal(p.trigger, 'Choose what starts the automation.')
    assert.equal(p.steps, 'Add at least one step.')
    assert.deepEqual(p.all.length, 3)
  })

  it('passes a complete form', () => {
    assert.deepEqual(validateDraft(filled(), c).all, [])
  })

  it('asks for the required details of a step, naming the step and the detail', () => {
    let d = filled()
    d = changeActionType(d, d.actions[0].key, 'create_lead_task')
    const p = validateDraft(d, c)
    assert.deepEqual(p.params[d.actions[0].key], { title: 'Step 1: fill in “Task title”.' })
  })

  it('checks a number against the range the catalog gives, and a structured detail for its brackets', () => {
    let d = filled()
    d = changeActionType(d, d.actions[0].key, 'create_lead_task')
    d = patchActionParam(d, d.actions[0].key, 'title', 'Call')
    d = patchActionParam(d, d.actions[0].key, 'due_in_days', '120')
    assert.match(validateDraft(d, c).params[d.actions[0].key].due_in_days, /between 0 and 90/)
    d = patchActionParam(d, d.actions[0].key, 'due_in_days', 'soon')
    assert.match(validateDraft(d, c).params[d.actions[0].key].due_in_days, /needs a whole number/)
    d = patchActionParam(d, d.actions[0].key, 'due_in_days', '1.5')
    assert.match(validateDraft(d, c).params[d.actions[0].key].due_in_days, /needs a whole number/, 'the server takes whole numbers')
    let a = addAction({ ...emptyDraft(), name: 'n', trigger: 'crm.lead.created' }, 'run_agent')
    a = patchActionParam(a, a.actions[0].key, 'agent', 'gtm-outreach')
    a = patchActionParam(a, a.actions[0].key, 'input', '{oops')
    assert.match(validateDraft(a, c).params[a.actions[0].key].input, /Check the brackets and quotes/)
  })

  it('asks for a value in a condition, a number for a number fact, and a whole daily limit', () => {
    let d = addCondition(filled(), c)
    assert.match(validateDraft(d, c).conditions[d.conditions[0].key], /Condition 1: enter a value/)
    d = changeConditionField(d, c, d.conditions[0].key, 'lead.missing_count')
    d = patchCondition(d, d.conditions[0].key, { value: 'many' })
    assert.match(validateDraft(d, c).conditions[d.conditions[0].key], /use a number/)
    d = patchCondition(d, d.conditions[0].key, { op: 'empty' })
    assert.equal(validateDraft(d, c).conditions[d.conditions[0].key], undefined, 'no value needed')
    assert.match(validateDraft(filled({ maxRunsPerDay: '0' }), c).limit!, /from 1 to 1000/)
    assert.match(validateDraft(filled({ maxRunsPerDay: '1.5' }), c).limit!, /whole number/)
  })

  it('uses none of the banned words in what it says', () => {
    const p = validateDraft({ ...emptyDraft(), maxRunsPerDay: '0' }, c)
    for (const message of p.all) assert.ok(!/payload|trigger_event|flow_key|enforced|governed|chain|\bpoint\b|instant/i.test(message), message)
  })
})

describe('the value box of a condition', () => {
  const fields = c.triggers['crm.lead.created'].fields

  it('draws the control that fits the fact and the operator', () => {
    assert.equal(valueControl(fields['lead.has_email'], 'eq'), 'yesno')
    assert.equal(valueControl(fields['lead.status'], 'eq'), 'choice')
    assert.equal(valueControl(fields['lead.status'], 'in'), 'choices')
    assert.equal(valueControl(fields['lead.missing_count'], 'gt'), 'number')
    assert.equal(valueControl(fields['lead.missing_count'], 'in'), 'texts', 'a list of numbers is typed with commas')
    assert.equal(valueControl(fields['lead.company'], 'contains'), 'text')
    assert.equal(valueControl(fields['lead.company'], 'not_in'), 'texts')
    assert.equal(valueControl(fields['lead.company'], 'empty'), 'none')
    assert.equal(valueControl(undefined, 'eq'), 'text', 'a fact the catalog no longer has is typed as text')
  })
})

describe('the live sentence of the form', () => {
  it('reads as the form is filled in, with … for what is not there yet', () => {
    let d = { ...emptyDraft(), trigger: 'crm.lead.created' }
    assert.equal(draftSentence(d, c), 'When a lead is created, choose what should happen.')
    d = addCondition(d, c)
    d = changeConditionField(d, c, d.conditions[0].key, 'lead.missing_count')
    d = changeConditionOp(d, d.conditions[0].key, 'gt')
    assert.equal(draftSentence(d, c), 'When a lead is created and the details missing is more than …, choose what should happen.')
    d = patchCondition(d, d.conditions[0].key, { value: '2' })
    d = addAction(d, 'add_lead_note')
    assert.equal(draftSentence(d, c, 'en-US'), 'When a lead is created and the details missing is more than 2, add a note to the lead.')
  })

  it('does not read an empty yes/no as "no", and says "needs your approval" for a step that needs it or the switch', () => {
    let d = addCondition({ ...emptyDraft(), trigger: 'crm.lead.created' }, c)
    d = changeConditionField(d, c, d.conditions[0].key, 'lead.has_email')
    assert.match(draftSentence(d, c), /the lead has an email is …,/)
    d = addAction(d, 'book_lead_meeting')
    assert.equal(draftNeedsApproval(d, c), true)
    assert.match(draftSentence(d, c), /; needs your approval.$/)
    assert.equal(draftNeedsApproval({ ...emptyDraft(), requiresApproval: true }, c), true)
    assert.equal(draftNeedsApproval(emptyDraft(), c), false)
  })

  it('leaves out a step that has no action chosen yet, and asks for it before saving', () => {
    let d = { ...filled(), name: 'x' }
    d = addAction(d, '')
    assert.equal(draftSentence(d, c), 'When a lead is created, add a note to the lead.')
    const p = validateDraft(d, c)
    assert.equal(p.params[d.actions[1].key][STEP_TYPE], 'Step 2: choose what it should do.')
  })
})
