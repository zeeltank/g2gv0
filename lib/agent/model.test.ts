import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError } from '../../services/core'
import { AgentApiError } from '../../services/agent/errors'
import {
  acceptNotice, actionLabel, appliedByAgent, autonomySentence, codeOf, countsText, dismissNotice, durationText, evidenceItems, failureText, filterProblem, formatCost, formatTokens, formatWhen,
  isWaiting, loadFailure, mergedInto, NO_RUN_RIGHT_TEXT, outcomeLabel, proposalStatus, refusalText, runGate, runNotice, runsParams, runStatus, safeInternalPath, stepLabel, successRate,
  triggerText, EMPTY_FILTERS, RUNS_PER_PAGE,
} from './model'
import { CRM_ORG, DEAL, orgState, PAIR, SELF, SIGNAL } from './fixtures'

describe('words for actions and statuses', () => {
  it('names the three actions, and an unknown one by its own name made readable', () => {
    assert.equal(actionLabel('add_note'), 'Add a note')
    assert.equal(actionLabel('add_task'), 'Add a follow-up task')
    assert.equal(actionLabel('confirm_link'), 'Confirm a probable link')
    assert.equal(actionLabel('update_stage'), 'Update stage')
    assert.equal(actionLabel(''), 'Action')
  })

  it('says every proposal state in words, and who applied an applied one', () => {
    assert.deepEqual(proposalStatus({ status: 'pending', applied_via: null, decided_by_name: null }), { label: 'Waiting for you', tone: 'pending' })
    assert.deepEqual(proposalStatus({ status: 'applied', applied_via: 'policy', decided_by_name: null }), { label: 'Applied by the agent', tone: 'success' })
    assert.deepEqual(proposalStatus({ status: 'applied', applied_via: 'user', decided_by_name: 'Bela Nair' }), { label: 'Applied after Bela Nair accepted it', tone: 'success' })
    assert.deepEqual(proposalStatus({ status: 'applied', applied_via: 'user', decided_by_name: null }), { label: 'Applied after it was accepted', tone: 'success' })
    assert.deepEqual(proposalStatus({ status: 'dismissed', applied_via: null, decided_by_name: null }), { label: 'Dismissed', tone: 'inactive' })
    assert.deepEqual(proposalStatus({ status: 'failed', applied_via: null, decided_by_name: null }), { label: 'Could not be applied', tone: 'error' })
  })

  it('marks only what the agent did itself as the agent\'s', () => {
    assert.equal(appliedByAgent({ status: 'applied', applied_via: 'policy' }), true)
    assert.equal(appliedByAgent({ status: 'applied', applied_via: 'user' }), false)
    assert.equal(appliedByAgent({ status: 'pending', applied_via: 'policy' }), false)
    assert.equal(isWaiting('pending'), true)
    assert.equal(isWaiting('applied'), false)
  })

  it('says every run state in words, a state it does not know as it is, and a missing one as a dash', () => {
    assert.equal(runStatus('completed').label, 'Completed')
    assert.equal(runStatus('running').label, 'Running')
    assert.equal(runStatus('unavailable').label, 'Unavailable')
    assert.equal(runStatus('failed').label, 'Failed')
    assert.equal(runStatus('paused').label, 'paused')
    assert.equal(runStatus('').label, '—')
  })

  it('says what the agent may do alone, what waits for a person and what is off', () => {
    assert.equal(autonomySentence({ add_note: 'alone', add_task: 'alone', confirm_link: 'approval' }), 'On its own: add a note, add a follow-up task. Waits for you: confirm a probable link.')
    assert.equal(autonomySentence({ add_note: 'off', add_task: 'suggest', confirm_link: 'draft' }), 'Waits for you: add a follow-up task, confirm a probable link. Switched off: add a note.')
    assert.equal(autonomySentence({}), '')
  })
})

describe('money, numbers and time', () => {
  it('writes a cost in the currency it was priced in, with at least two decimals and at most four, and says unknown for a cost that is not known', () => {
    assert.equal(formatCost(0.075, 'INR'), '₹0.075')
    assert.equal(formatCost(0.0691, 'INR'), '₹0.0691')
    assert.equal(formatCost(2, 'INR'), '₹2.00')
    assert.equal(formatCost(0.1, 'USD'), '$0.10')
    assert.equal(formatCost(1234.5, 'INR'), '₹1234.50')
    assert.equal(formatCost(0.00001, 'INR'), '₹0.00', 'below a hundredth of a paisa it rounds to zero, and is still a number')
    assert.equal(formatCost(3.1, 'CHF'), 'CHF 3.10')
    assert.equal(formatCost(0, 'INR'), '₹0.00', 'a run that used no tokens cost nothing, which is not the same as unknown')
    assert.equal(formatCost(null, 'INR'), 'Cost unknown')
    assert.equal(formatCost(Number.NaN, 'INR'), 'Cost unknown')
    assert.equal(formatCost(null, null), 'Cost unknown')
    assert.equal(formatCost(0.5, null), '0.50')
  })

  it('writes tokens, and a dash when none were counted', () => {
    assert.equal(formatTokens(1232, 343), '1,232 in · 343 out')
    assert.equal(formatTokens(null, null), '—')
    assert.equal(formatTokens(5, null), '5 in · — out')
  })

  it('writes a day and time, in the zone it is asked for, and a dash for nothing or nonsense', () => {
    assert.equal(formatWhen('2026-11-03T15:22:57+00:00', 'UTC'), '3 Nov 2026, 15:22')
    assert.equal(formatWhen('2026-11-03T15:22:57+00:00', 'Asia/Kolkata'), '3 Nov 2026, 20:52')
    assert.equal(formatWhen(null), '—')
    assert.equal(formatWhen('not a date'), '—')
  })

  it('writes how long a run took, and a dash while it has not finished', () => {
    assert.equal(durationText('2026-11-03T15:22:48+00:00', '2026-11-03T15:22:59+00:00'), '11 s')
    assert.equal(durationText('2026-11-03T15:22:00+00:00', '2026-11-03T15:23:04+00:00'), '1 min 4 s')
    assert.equal(durationText('2026-11-03T15:22:48+00:00', null), '—')
    assert.equal(durationText(null, null), '—')
    assert.equal(durationText('2026-11-03T15:22:48+00:00', '2026-11-03T15:20:00+00:00'), '—', 'a run cannot finish before it starts')
  })

  it('counts proposals in words and names who started a run', () => {
    assert.equal(countsText({ pending: 2, applied: 1, dismissed: 0, failed: 0 }), '1 applied, 2 waiting')
    assert.equal(countsText({ pending: 0, applied: 0, dismissed: 3, failed: 1 }), '3 dismissed, 1 failed')
    assert.equal(countsText({ pending: 0, applied: 0, dismissed: 0, failed: 0 }), 'No proposals')
    assert.equal(triggerText('manual'), 'Run agent button')
    assert.equal(triggerText('cli'), 'Command line')
    assert.equal(triggerText('schedule'), 'schedule')
  })

  it('works out the share of runs that finished well, and none when nothing has finished', () => {
    assert.equal(successRate({ completed: 3, failed: 1, unavailable: 0 }), 75)
    assert.equal(successRate({ completed: 1, failed: 0, unavailable: 2 }), 33)
    assert.equal(successRate({ completed: 0, failed: 0, unavailable: 0 }), null)
  })
})

describe('evidence: only a path inside this application is ever a link', () => {
  it('accepts a path from the root and nothing else', () => {
    assert.equal(safeInternalPath('/module/crm/marketing/organizations/135'), '/module/crm/marketing/organizations/135')
    assert.equal(safeInternalPath('/module/crm/signal-review?status=all&q=Hillcrest%20School'), '/module/crm/signal-review?status=all&q=Hillcrest%20School')
    for (const bad of ['https://evil.example/x', 'http://evil.example', '//evil.example/x', '/\\evil.example', 'javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,<script>', 'module/crm', '', ' /x', '/x y', '/x\ny', null, undefined, 5, {}]) {
      assert.equal(safeInternalPath(bad), null, `not a link: ${String(bad)}`)
    }
  })

  it('links a record inside the application, and shows the organisation itself and a possible link as text', () => {
    const items = evidenceItems([SIGNAL, CRM_ORG, DEAL, SELF, PAIR])
    assert.deepEqual(items.map((i) => [i.typeLabel, i.href]), [
      ['Signal', '/module/crm/signal-review?status=all&q=Hillcrest'], ['CRM organisation', '/module/crm/marketing/organizations/135'], ['Deal', '/gtm/deals/125'],
      ['This organisation', null], ['Possible link', null],
    ])
  })

  it('never links an address that is not a plain path, whatever the server sent', () => {
    const items = evidenceItems([
      { type: 'signal', id: '1', label: 'A', url: 'javascript:alert(1)' }, { type: 'signal', id: '2', label: 'B', url: 'https://evil.example' }, { type: 'signal', id: '3', label: 'C', url: null },
      { type: 'signal', id: '4', label: 'D', url: '//evil.example' },
    ])
    assert.deepEqual(items.map((i) => i.href), [null, null, null, null])
  })

  it('has a label even when the server gave none, and a type word even for a type it does not know', () => {
    const [item] = evidenceItems([{ type: 'brand_new', id: '9', label: '  ', url: null }])
    assert.deepEqual([item.typeLabel, item.label], ['Record', 'Record 9'])
  })
})

describe('whether the agent may be run now, and what a run or a decision says', () => {
  it('allows a run when the person may, the agent is on, it has a model and the day\'s cap is not spent', () => {
    assert.deepEqual(runGate(orgState()), { allowed: true })
  })

  it('says why not, in a sentence, for each reason', () => {
    const base = orgState()
    assert.deepEqual(runGate({ ...base, can: { run: false, decide: false } }), { allowed: false, reason: NO_RUN_RIGHT_TEXT })
    assert.deepEqual(runGate({ ...base, agent: { ...base.agent, enabled: false, unavailable_reason: 'The agent is switched off for your organisation.' } }), { allowed: false, reason: 'The agent is switched off for your organisation.' })
    assert.deepEqual(runGate({ ...base, agent: { ...base.agent, enabled: false, unavailable_reason: null } }), { allowed: false, reason: 'The agent is switched off for your organisation.' })
    assert.deepEqual(runGate({ ...base, agent: { ...base.agent, unavailable_reason: 'The model "x" has no price set.' } }), { allowed: false, reason: 'The model "x" has no price set.' })
    assert.deepEqual(runGate({ ...base, agent: { ...base.agent, runs_today: 10, daily_cap: 10 } }), { allowed: false, reason: 'The agent has already run 10 times today on this organisation. Try again tomorrow.' })
    assert.equal(runGate({ ...base, agent: { ...base.agent, runs_today: 9, daily_cap: 10 } }).allowed, true)
  })

  it('puts the missing right first, because nothing else matters to a person who may not run it', () => {
    const base = orgState()
    assert.equal((runGate({ can: { run: false, decide: false }, agent: { ...base.agent, enabled: false, unavailable_reason: 'off' } }) as { reason: string }).reason, NO_RUN_RIGHT_TEXT)
  })

  it('says after a run what the agent did alone and what it left, or why it did not run', () => {
    const counts = { pending: 0, applied: 0, dismissed: 0, failed: 0 }
    const completed = (over: Partial<typeof counts>) => ({ status: 'completed' as const, message: null, proposal_counts: { ...counts, ...over } })
    assert.deepEqual(runNotice(completed({})), { tone: 'success', text: 'The agent finished. It found nothing that needs doing.' })
    assert.equal(runNotice(completed({ applied: 1 })).text, 'The agent finished. It did 1 thing on its own.')
    assert.equal(runNotice(completed({ pending: 2 })).text, 'The agent finished. It left 2 proposals for you.')
    assert.equal(runNotice(completed({ applied: 2, pending: 1 })).text, 'The agent finished. It did 2 things on its own and left 1 proposal for you.')
    assert.deepEqual(runNotice({ status: 'unavailable', message: 'No AI model is set up.', proposal_counts: counts }), { tone: 'error', text: 'No AI model is set up.' })
    assert.deepEqual(runNotice({ status: 'failed', message: null, proposal_counts: counts }), { tone: 'error', text: 'The run failed.' })
  })

  it('says after a decision what was done', () => {
    assert.equal(acceptNotice('add_note', 'applied'), 'The note was added to the organisation.')
    assert.equal(acceptNotice('add_task', 'applied'), 'The follow-up task was added to the organisation’s schedule.')
    assert.equal(acceptNotice('confirm_link', 'applied'), 'The records were linked as one organisation.')
    assert.equal(acceptNotice('add_note', 'already_applied'), 'This had already been applied.')
    assert.equal(acceptNotice('other', 'applied'), 'Done.')
    assert.equal(dismissNotice('dismissed'), 'Dismissed. The agent will not suggest this again.')
    assert.equal(dismissNotice('already_dismissed'), 'This had already been dismissed.')
  })

  it('tells when a confirmed link made this identity part of another one', () => {
    assert.equal(mergedInto('g2g_org_accounts:3', 7), 3)
    assert.equal(mergedInto('g2g_org_accounts:7', 7), null, 'this identity is the survivor')
    assert.equal(mergedInto('task_management_calendar_events:470', 7), null)
    assert.equal(mergedInto(null, 7), null)
  })
})

describe('failures', () => {
  it('uses the server\'s own sentence when there is one, and a plain one for a status or a lost connection', () => {
    assert.equal(failureText(new AgentApiError('The agent has already run 10 times today on this organisation. Try again tomorrow.', 429, undefined, undefined, 'daily_cap', null), 'x'), 'The agent has already run 10 times today on this organisation. Try again tomorrow.')
    assert.equal(failureText(new ApiError('This action is unauthorized.', 403), 'x'), NO_RUN_RIGHT_TEXT)
    assert.equal(failureText(new ApiError('Proposal not found.', 404), 'x'), 'This organisation or proposal can no longer be found. It may have been removed.')
    assert.equal(failureText(new ApiError('', 500), 'x'), 'The server answered 500.')
    assert.equal(failureText(new TypeError('Failed to fetch'), 'x'), 'The request did not reach the server. Check your connection and try again.')
    assert.equal(failureText(new Error('boom'), 'x'), 'boom')
    assert.equal(failureText('nothing useful', 'The fallback.'), 'The fallback.')
    assert.equal(codeOf(new AgentApiError('m', 409, undefined, undefined, 'already_decided', null)), 'already_decided')
    assert.equal(codeOf(new Error('m')), null)
  })

  it('tells a read that is not allowed (no retry helps) from one that is not found and one that may work next time', () => {
    assert.equal(loadFailure(new ApiError('no', 403), 'f').kind, 'forbidden')
    assert.equal(loadFailure(new ApiError('no', 404), 'f').kind, 'notFound')
    assert.equal(loadFailure(new ApiError('busy', 503), 'f').kind, 'error')
    assert.equal(loadFailure(new TypeError('x'), 'f').kind, 'error')
    assert.equal(loadFailure(new ApiError('no', 403), 'f').message, 'You do not have access to the agent.')
  })
})

describe('the run history\'s filters', () => {
  it('asks for only what was chosen', () => {
    assert.deepEqual(runsParams(EMPTY_FILTERS, 1), { page: 1, per_page: RUNS_PER_PAGE })
    assert.deepEqual(runsParams({ status: 'failed', dateFrom: '2026-11-01', dateTo: '2026-11-03' }, 3), { page: 3, per_page: RUNS_PER_PAGE, status: 'failed', date_from: '2026-11-01', date_to: '2026-11-03' })
  })

  it('refuses dates that are not days and an end before the start, and accepts one day', () => {
    assert.equal(filterProblem(EMPTY_FILTERS), null)
    assert.equal(filterProblem({ status: '', dateFrom: '2026-11-03', dateTo: '2026-11-03' }), null)
    assert.equal(filterProblem({ status: '', dateFrom: '', dateTo: '2026-11-03' }), null)
    assert.equal(filterProblem({ status: '', dateFrom: '3 Nov', dateTo: '' }), 'Dates are written year-month-day.')
    assert.equal(filterProblem({ status: '', dateFrom: '2026-11-04', dateTo: '2026-11-03' }), 'The end date is before the start date.')
  })
})

describe('the audit trail in words', () => {
  it('names a step, and says plainly that a name it does not know is an action that does not exist', () => {
    assert.equal(stepLabel('read_context'), 'Read the organisation’s records')
    assert.equal(stepLabel('add_task'), 'Add a follow-up task')
    assert.equal(stepLabel('send_email'), '“send_email” (not an action that exists)')
  })

  it('says each outcome and each reason for a refusal in a sentence, and a reason it does not know as it was written', () => {
    assert.equal(outcomeLabel('applied'), 'Done')
    assert.equal(outcomeLabel('denied'), 'Refused')
    assert.equal(outcomeLabel('mystery'), 'mystery')
    assert.equal(refusalText('unknown_tool'), 'Not an action the agent has.')
    assert.equal(refusalText('unknown_evidence_ref'), 'It cited a record the agent was never shown.')
    assert.equal(refusalText('some_new_code'), 'some_new_code')
    assert.equal(refusalText(null), null)
    assert.equal(refusalText(''), null)
  })
})
