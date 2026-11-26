import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError } from '../../services/core'
import { catalog } from './fixtures'
import { plainMessage, readServerProblems, workflowErrorMessage } from './messages'

const c = catalog()

describe('the server\'s words, in the screen\'s words', () => {
  it('says step, automation and turn on, never action, workflow or activate', () => {
    assert.equal(plainMessage('Invalid workflow: Action 1: text of 1-1000 characters is required.'), 'Invalid automation: Step 1: text of 1-1000 characters is required.')
    assert.equal(plainMessage('This workflow cannot be activated: x'), 'This automation cannot be turned on: x')
    assert.equal(plainMessage('Pause the workflow before editing it, so it is never half-edited while live.'), 'Pause the automation before editing it, so it is never half-edited while live.')
  })

  it('swaps an action\'s code for its name, with or without the brackets, and keeps details of the record untouched', () => {
    assert.equal(plainMessage('Action 2 (convert_lead) needs a lead, which this trigger does not provide.', c), 'Step 2 needs a lead, which this event does not provide.')
    assert.ok(!/convert_lead/.test(plainMessage('The convert_lead step failed', c)), 'a bare code is swapped for the name too')
    assert.equal(plainMessage('Action 1: \'{{lead.old_fact}}\' is not a fact this trigger provides.', c), 'Step 1: \'{{lead.old_fact}}\' is not a fact this event provides.')
  })

  it('makes any other snake_case name readable', () => {
    assert.equal(plainMessage('Action 1: due_in_days must be a whole number from 0 to 90.'), 'Step 1: due in days must be a whole number from 0 to 90.')
    assert.ok(!/_/.test(plainMessage('max_runs_per_day must be at most 1000')))
  })
})

describe('a failed call, in one sentence', () => {
  it('turns a refusal of rights into what to do about it', () => {
    assert.equal(workflowErrorMessage(new ApiError('Forbidden', 403), 'x'), 'Only administrators can change automations. Ask an administrator to do this.')
  })

  it('keeps the server\'s explanation and its detail', () => {
    assert.equal(workflowErrorMessage(new ApiError('Not possible.', 422, undefined, 'Pause the workflow first.'), 'x'), 'Not possible. Pause the automation first.')
  })

  it('falls back to a sentence of its own when there is nothing to say', () => {
    assert.equal(workflowErrorMessage(new ApiError('', 500), 'The list could not be loaded. Try again.'), 'The list could not be loaded. Try again.')
    assert.equal(workflowErrorMessage('boom', 'The list could not be loaded. Try again.'), 'The list could not be loaded. Try again.')
  })
})

describe('what a refused save is about', () => {
  it('puts a message on the step or the condition it names, and the rest on the form', () => {
    const e = new ApiError('Invalid workflow: Action 2 (convert_lead) needs a lead', 422, {
      definition: ['Action 2 (convert_lead) needs a lead, which this trigger does not provide.', 'Condition 1: unknown operator \'x\'.', 'Add at least one action.'],
      name: ['The name field is required.'],
    })
    const p = readServerProblems(e, c)
    assert.deepEqual(p.steps, { 1: ['Needs a lead, which this event does not provide.'] })
    assert.deepEqual(p.conditions, { 0: ['Unknown operator \'x\'.'] })
    assert.deepEqual(p.general, ['Add at least one action.'])
    assert.deepEqual(p.fields, { name: ['The name field is required.'] })
  })

  it('shows each message once', () => {
    const p = readServerProblems(new ApiError('x', 422, { definition: ['Add at least one action.', 'Add at least one action.'] }), c)
    assert.equal(p.general.length, 1)
  })

  it('says what went wrong when the server gave no list', () => {
    const p = readServerProblems(new ApiError('The daily limit is too high.', 422), c)
    assert.deepEqual(p.general, ['The daily limit is too high.'])
  })

  it('does not blame the person for a network failure, and tells them what to do', () => {
    const p = readServerProblems(new TypeError(''), c)
    assert.match(p.general[0], /Check your connection and try again/)
  })

  it('explains a refusal of rights', () => {
    assert.match(readServerProblems(new ApiError('Forbidden', 403), c).general[0], /Only administrators/)
  })
})
