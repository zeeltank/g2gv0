import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { catalog, run } from './fixtures'
import {
  approveQuestion, canCancel, canDecide, canRetry, cancelQuestion, decisionNotice, describeStep, groupRunsByDay, OUTCOME_VALUES, outcomeOptions, rejectQuestion, runReason,
  runSubject, summarizeResult,
} from './runs'

const c = catalog()
const NOW = new Date('2026-11-26T10:00:00Z')

describe('who a run was about', () => {
  it('names the record the way a person does', () => {
    assert.equal(runSubject(run({ entity_type: 'crm_leads', entity_id: 12 })), 'Lead 12')
    assert.equal(runSubject(run({ entity_type: null, entity_id: null })), 'Record')
  })
})

describe('a plain reason for a run that did not simply finish', () => {
  it('says nothing for a run that is done or running', () => {
    assert.equal(runReason(run({ status: 'succeeded' }), c, NOW), null)
    assert.equal(runReason(run({ status: 'running' }), c, NOW), null)
  })

  it('explains a skipped run in the server\'s words, made plain', () => {
    assert.equal(runReason(run({ status: 'skipped', error: 'The daily limit of 100 runs for this workflow was reached.' }), c, NOW), 'The daily limit of 100 runs for this automation was reached.')
    assert.equal(runReason(run({ status: 'skipped', error: 'The record this event is about no longer exists.' }), c, NOW), 'The record this event is about no longer exists.')
  })

  it('says a failed run failed, how often it tried, and why, with no action code', () => {
    const text = runReason(run({ status: 'failed', attempts: 3, error: 'Step 1 (convert_lead): The lead has no company.' }), c, NOW)!
    assert.equal(text, 'Failed after 3 tries: Step 1: The lead has no company.')
    assert.equal(runReason(run({ status: 'failed', attempts: 1, error: null }), c, NOW), 'Failed.')
  })

  it('says when a run that hit a temporary problem will try again', () => {
    assert.match(runReason(run({ status: 'retry_wait', next_attempt_at: '2026-11-26 10:10:00' }), c, NOW)!, /^Hit a temporary problem\. It will try again in 10 minutes\./)
  })

  it('says why a run was rejected, and that a waiting one waits for an administrator', () => {
    assert.equal(runReason(run({ status: 'rejected', decision_note: 'Wrong contact' }), c, NOW), 'Rejected: Wrong contact')
    assert.equal(runReason(run({ status: 'pending_approval' }), c, NOW), 'Waiting for an administrator to approve it.')
    assert.equal(runReason(run({ status: 'cancelled' }), c, NOW), 'Cancelled before it ran.')
  })
})

describe('what the engine lets a person do with a run', () => {
  it('lets them approve or reject only a run that waits, retry only a failed one, cancel one that has not started', () => {
    assert.deepEqual(['pending_approval', 'queued', 'retry_wait', 'running', 'succeeded', 'failed', 'rejected'].map(canDecide), [true, false, false, false, false, false, false])
    assert.deepEqual(['failed', 'succeeded', 'pending_approval'].map(canRetry), [true, false, false])
    assert.deepEqual(['pending_approval', 'queued', 'retry_wait', 'running', 'succeeded', 'failed'].map(canCancel), [true, true, true, false, false, false])
  })
})

describe('the timeline', () => {
  it('groups runs by the day they started, newest first, under Today and Yesterday', () => {
    const groups = groupRunsByDay([
      run({ id: 5, created_at: '2026-11-26 09:00:00' }), run({ id: 4, created_at: '2026-11-26 08:00:00' }),
      run({ id: 3, created_at: '2026-11-25 09:00:00' }), run({ id: 2, created_at: '2026-11-20 09:00:00' }),
    ], NOW)
    assert.deepEqual(groups.map((g) => g.runs.map((r) => r.id)), [[5, 4], [3], [2]])
    assert.deepEqual(groups.slice(0, 2).map((g) => g.heading), ['Today', 'Yesterday'])
    assert.match(groups[2].heading, /20 Nov/)
  })

  it('offers only the outcomes that exist, with their counts, after "All outcomes"', () => {
    const options = outcomeOptions({ succeeded: 12, failed: 2, pending_approval: 3, cancelled: 0 })
    assert.deepEqual(options, [
      { value: 'all', label: 'All outcomes' },
      { value: 'pending_approval', label: 'Waiting for you (3)' },
      { value: 'failed', label: 'Failed (2)' },
      { value: 'succeeded', label: 'Done (12)' },
    ])
    assert.ok(OUTCOME_VALUES.includes('all') && OUTCOME_VALUES.includes('retry_wait'))
  })
})

describe('questions before a decision', () => {
  it('says what approving does, on which record, and that it cannot be undone', () => {
    const q = approveQuestion(run({ entity_type: 'crm_leads', entity_id: 12 }), ['convert the lead', 'prepare a draft quote'])
    assert.equal(q.title, 'Approve this run on Lead 12?')
    assert.equal(q.description, 'It will convert the lead and prepare a draft quote now, on Lead 12. This cannot be undone.')
    assert.equal(q.confirmLabel, 'Approve and run')
    assert.match(approveQuestion(run(), []).description, /^Its steps will run now/)
  })

  it('says rejecting and cancelling do nothing to the record, with the same verb on the button', () => {
    assert.equal(rejectQuestion(run()).confirmLabel, 'Reject run')
    assert.match(rejectQuestion(run()).description, /Nothing will be done to Lead 12/)
    assert.equal(cancelQuestion(run()).confirmLabel, 'Cancel run')
  })

  it('names the result with the same verb as the button', () => {
    assert.equal(decisionNotice('approve', 'succeeded'), 'Approved. The run is now: done.')
    assert.equal(decisionNotice('reject', 'rejected'), 'Rejected. The run is now: rejected.')
    assert.equal(decisionNotice('retry', 'queued'), 'Retried. The run is now: queued.')
    assert.equal(decisionNotice('cancel', 'cancelled'), 'Cancelled. The run is now: cancelled.')
  })
})

describe('what a step did', () => {
  it('names the step by its action and shows the plain details of its result, reason first', () => {
    const line = describeStep({ id: 1, step: 1, action: 'add_lead_note', status: 'succeeded', result: { comment_id: 7, reason: 'Added', nested: { a: 1 } }, error: null, started_at: '2026-11-26 08:00:00', finished_at: '2026-11-26 08:00:05' }, c, NOW)
    assert.equal(line.title, 'Add a note to the lead')
    assert.deepEqual(line.details, [{ label: 'Reason', value: 'Added' }, { label: 'Comment id', value: '7' }])
    assert.equal(line.when, '2 hours ago')
  })

  it('names an action the catalog no longer has without showing its code', () => {
    const line = describeStep({ id: 2, step: 2, action: 'old_action_type', status: 'failed', result: null, error: 'Step 2 (old_action_type): it broke', started_at: null, finished_at: null }, c, NOW)
    assert.equal(line.title, 'Old action type')
    assert.equal(line.error, 'Step 2 (old action type): it broke')
    assert.equal(line.when, null)
  })

  it('summarizes a result that is not an object, and nothing for an empty one', () => {
    assert.deepEqual(summarizeResult('Done'), [{ label: 'Result', value: 'Done' }])
    assert.deepEqual(summarizeResult(null), [])
    assert.deepEqual(summarizeResult({ items: [1, 2] }), [])
  })
})
