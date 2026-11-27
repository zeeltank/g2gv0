import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { DryRunResult } from '../../services/gtm/workflows'
import { catalog } from './fixtures'
import { describeDryRun, NOTHING_CHANGED } from './try-it'

const c = catalog()

function result(over: Partial<DryRunResult> = {}): DryRunResult {
  return { dry_run: true, would_run: true, conditions: [], needs_approval: false, actions: [], facts: {}, ...over }
}

describe('Try it, as plain steps', () => {
  it('says what it would run, and that it needs approval, in the words of the brief', () => {
    const view = describeDryRun(result({
      needs_approval: true,
      actions: [{ type: 'book_lead_meeting', label: 'Book a meeting', consequential: true, params: {} }],
    }), 'crm.lead.reply_classified', c)
    assert.deepEqual(view.steps.map((s) => s.text), ['Would run: book a meeting (needs your approval)'])
    assert.equal(view.headline, 'It would run for this record, after you approve it.')
    assert.equal(view.wouldRun, true)
  })

  it('says it would run with no approval when none is needed', () => {
    const view = describeDryRun(result({ actions: [{ type: 'add_lead_note', label: 'Add a note to the lead', consequential: false, params: {} }] }), 'crm.lead.created', c)
    assert.deepEqual(view.steps.map((s) => s.text), ['Would run: add a note to the lead'])
    assert.equal(view.headline, 'It would run for this record.')
  })

  it('says why a condition did not hold, with the real value and the one it needed', () => {
    const view = describeDryRun(result({
      would_run: false,
      conditions: [{ field: 'opportunity.amount', op: 'gt', expected: 50000, actual: 30000, pass: false }],
      actions: [{ type: 'add_lead_note', label: 'Add a note to the lead', consequential: false, params: {} }],
    }), 'crm.opportunity.stage_changed', c, 'en-US')
    assert.deepEqual(view.checks.map((l) => l.text), ['Skipped: the deal amount 30,000 is not more than 50,000'])
    assert.equal(view.headline, 'It would not run for this record.')
    assert.deepEqual(view.steps, [], 'nothing would be done, so no steps are listed')
  })

  it('lists the conditions that held, and words an empty value and an empty-check plainly', () => {
    const view = describeDryRun(result({
      conditions: [
        { field: 'lead.company', op: 'not_empty', expected: null, actual: 'Acme School', pass: true },
        { field: 'lead.missing_count', op: 'gt', expected: 2, actual: null, pass: false },
        { field: 'lead.company', op: 'empty', expected: null, actual: 'Acme School', pass: false },
        { field: 'lead.status', op: 'in', expected: ['New', 'Qualified'], actual: 'Won', pass: false },
      ],
    }), 'crm.lead.created', c)
    assert.deepEqual(view.checks.map((l) => l.text), [
      'Matches: the lead company is not empty',
      'Skipped: the details missing is empty, so it is not more than 2',
      'Skipped: the lead company is not empty',
      'Skipped: the lead status Won is not one of New or Qualified',
    ])
    assert.deepEqual(view.checks.map((l) => l.tone), ['matched', 'skipped', 'skipped', 'skipped'])
  })

  it('shows what each step would use, with the record\'s details filled in, in plain labels', () => {
    const view = describeDryRun(result({
      actions: [{ type: 'create_lead_task', label: 'Create a follow-up task for the lead', consequential: false, params: { title: 'Call Acme School', due_in_days: 1, description: '', link_to: null } }],
    }), 'crm.lead.created', c)
    assert.deepEqual(view.steps[0].details, [{ label: 'Title', value: 'Call Acme School' }, { label: 'Due in days', value: '1' }])
  })

  it('has one constant for the reassurance, so every place says the same thing', () => {
    assert.equal(NOTHING_CHANGED, 'Nothing was changed.')
  })

  it('shows a structured detail as compact text, never "[object Object]"', () => {
    const view = describeDryRun(result({ actions: [{ type: 'run_agent', label: 'Run a GTM agent', consequential: false, params: { agent: 'gtm-outreach', input: { account_id: '@account.id' } } }] }), 'crm.lead.created', c)
    assert.deepEqual(view.steps[0].details, [{ label: 'Agent', value: 'gtm-outreach' }, { label: 'Input', value: '{"account_id":"@account.id"}' }])
  })
})
