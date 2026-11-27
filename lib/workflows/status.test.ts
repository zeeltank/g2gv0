import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { catalog, workflow } from './fixtures'
import { archiveQuestion, filterAutomations, lastOutcomeParts, rowMenu, runStatusChip, SHOW_FILTERS, switchPlan, turnOnQuestion, workflowStatusChip } from './status'

const c = catalog()
const NOW = new Date('2026-11-26T10:00:00Z')

describe('the status chip: the word carries the meaning', () => {
  it('says Draft, On, Paused or Archived', () => {
    assert.deepEqual(['draft', 'active', 'paused', 'archived'].map((s) => workflowStatusChip(s).word), ['Draft', 'On', 'Paused', 'Archived'])
  })

  it('never shows a draft or a paused automation as "Coming soon"', () => {
    for (const s of ['draft', 'paused']) assert.notEqual(workflowStatusChip(s).word, 'Coming soon')
  })

  it('gives each a tone that is only a border colour, and a run its own words', () => {
    assert.equal(workflowStatusChip('active').tone, 'positive')
    assert.equal(workflowStatusChip('paused').tone, 'caution')
    assert.equal(workflowStatusChip('archived').tone, 'muted')
    assert.deepEqual(runStatusChip('pending_approval'), { word: 'Waiting for you', tone: 'caution' })
    assert.deepEqual(runStatusChip('failed'), { word: 'Failed', tone: 'problem' })
    assert.deepEqual(runStatusChip('succeeded'), { word: 'Done', tone: 'positive' })
  })
})

describe('the last outcome of a row', () => {
  it('says "Never run" when nothing has run, or when the server sends nothing', () => {
    assert.deepEqual(lastOutcomeParts(null, NOW), ['Never run'])
    assert.deepEqual(lastOutcomeParts(undefined, NOW), ['Never run'])
    assert.deepEqual(lastOutcomeParts({ status: null, at: null, done_7d: 0, failed_7d: 0, waiting: 0 }, NOW), ['Never run'])
  })

  it('says when it last ran and how it went', () => {
    assert.deepEqual(lastOutcomeParts({ status: 'succeeded', at: '2026-11-26 08:00:00', done_7d: 4, failed_7d: 0, waiting: 0 }, NOW), ['Last run 2 hours ago: done'])
  })

  it('says how many wait for the person, and how many failed this week', () => {
    assert.deepEqual(lastOutcomeParts({ status: 'succeeded', at: '2026-11-26 08:00:00', done_7d: 4, failed_7d: 3, waiting: 2 }, NOW), ['Last run 2 hours ago: done', '2 waiting for you', '3 failed this week'])
  })

  it('does not say the same thing twice when the last run is the one that waits', () => {
    assert.deepEqual(lastOutcomeParts({ status: 'pending_approval', at: '2026-11-26 09:00:00', done_7d: 0, failed_7d: 0, waiting: 2 }, NOW), ['2 waiting for you'])
  })

  it('uses no snake_case word and no claim of instant', () => {
    for (const status of ['succeeded', 'failed', 'retry_wait', 'pending_approval', 'cancelled']) {
      const text = lastOutcomeParts({ status, at: '2026-11-26 08:00:00', done_7d: 1, failed_7d: 1, waiting: 1 }, NOW).join(' ')
      assert.ok(!/_/.test(text) && !/instant/i.test(text), text)
    }
  })
})

describe('the On/Off switch', () => {
  const draft = workflow({ status: 'draft', actions: [{ type: 'add_lead_note' }], trigger_event: 'crm.lead.created', conditions: [] })
  const needs = workflow({ status: 'paused' })

  it('turns a draft that needs no approval on straight away, with no question', () => {
    const plan = switchPlan(draft, c, true)
    assert.deepEqual([plan.checked, plan.next, plan.confirm, plan.disabledReason], [false, 'active', null, null])
  })

  it('asks before turning ON an automation whose runs wait for approval, and says what approving does', () => {
    const plan = switchPlan(needs, c, true)
    assert.equal(plan.next, 'active')
    assert.ok(plan.confirm)
    assert.equal(plan.confirm!.title, 'Turn on “Book a meeting when the reply is positive”?')
    assert.match(plan.confirm!.description, /waits in Runs for an administrator to approve it/)
    assert.match(plan.confirm!.description, /it will hold the first proposed time on the owner’s calendar on that record/)
    assert.match(plan.confirm!.description, /from now on, not to past ones/)
    assert.equal(plan.confirm!.confirmLabel, 'Turn on')
  })

  it('asks nothing when turning OFF, even for an automation that needs approval', () => {
    const plan = switchPlan(workflow({ status: 'active' }), c, true)
    assert.deepEqual([plan.checked, plan.next, plan.confirm], [true, 'paused', null])
  })

  it('asks when the approval switch alone makes the runs wait', () => {
    const plan = switchPlan({ ...draft, requires_approval: 1 }, c, true)
    assert.ok(plan.confirm)
    assert.match(plan.confirm!.description, /its steps run on that record/, 'no consequential action to name')
  })

  it('cannot be used by someone who may not write, or on an archived automation, and says why', () => {
    assert.match(switchPlan(draft, c, false).disabledReason!, /Only administrators/)
    assert.equal(switchPlan(draft, c, false).next, null)
    assert.match(switchPlan(workflow({ status: 'archived' }), c, true).disabledReason!, /archived/i)
  })

  it('words the question for archiving with what happens to the waiting runs', () => {
    assert.match(archiveQuestion({ name: 'X' }, 2).description, /The 2 runs waiting for you will be cancelled/)
    assert.match(archiveQuestion({ name: 'X' }, 1).description, /The 1 run waiting for you/)
    assert.match(archiveQuestion({ name: 'X' }, 0).description, /Any run that has not started will be cancelled/)
    assert.equal(archiveQuestion({ name: 'X' }, 0).confirmLabel, 'Archive')
    assert.equal(turnOnQuestion({ name: 'X', actions: [] }, c).confirmLabel, 'Turn on')
  })
})

describe('the row menu', () => {
  it('offers Edit only while the automation is a draft or paused, as the engine requires', () => {
    assert.equal(rowMenu('draft', true).edit, 'enabled')
    assert.equal(rowMenu('paused', true).edit, 'enabled')
    assert.equal(rowMenu('active', true).edit, 'disabled', 'turn it off first')
    assert.equal(rowMenu('archived', true).edit, 'hidden')
  })

  it('offers Try it, Duplicate and Archive on a live automation, and nothing on an archived one but Duplicate', () => {
    assert.deepEqual(rowMenu('active', true), { edit: 'disabled', tryIt: true, duplicate: true, archive: true })
    assert.deepEqual(rowMenu('archived', true), { edit: 'hidden', tryIt: false, duplicate: true, archive: false })
  })

  it('offers nothing to someone who may only read', () => {
    assert.deepEqual(rowMenu('active', false), { edit: 'hidden', tryIt: false, duplicate: false, archive: false })
  })
})

describe('the search and the status filter', () => {
  const rows = [
    workflow({ id: 1, name: 'Flag stalled deals', status: 'active' }),
    workflow({ id: 2, name: 'Welcome new leads', status: 'draft', description: 'Greets every new lead' }),
    workflow({ id: 3, name: 'Chase invoices', status: 'paused' }),
  ]
  const sentenceOf = (w: { id: number }) => `Sentence of ${w.id}`

  it('shows every row for "all" and a blank search', () => {
    assert.equal(filterAutomations(rows, { q: '', show: 'all' }, sentenceOf).length, 3)
  })

  it('filters by status', () => {
    assert.deepEqual(filterAutomations(rows, { q: '', show: 'paused' }, sentenceOf).map((w) => w.id), [3])
    assert.deepEqual(SHOW_FILTERS, ['all', 'active', 'paused', 'draft'])
  })

  it('searches the name, the description and the sentence, ignoring case', () => {
    assert.deepEqual(filterAutomations(rows, { q: 'STALLED', show: 'all' }, sentenceOf).map((w) => w.id), [1])
    assert.deepEqual(filterAutomations(rows, { q: 'greets', show: 'all' }, sentenceOf).map((w) => w.id), [2])
    assert.deepEqual(filterAutomations(rows, { q: 'sentence of 3', show: 'all' }, sentenceOf).map((w) => w.id), [3])
    assert.deepEqual(filterAutomations(rows, { q: 'zzz', show: 'all' }, sentenceOf), [])
  })

  it('combines the search and the filter', () => {
    assert.deepEqual(filterAutomations(rows, { q: 'leads', show: 'active' }, sentenceOf), [])
    assert.deepEqual(filterAutomations(rows, { q: 'leads', show: 'draft' }, sentenceOf).map((w) => w.id), [2])
  })
})
