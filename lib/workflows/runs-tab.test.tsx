import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { run, runDetail, workflow } from './fixtures'
import { mountTab, type Kit } from './screen-kit'

const WAITING = run({ id: 30, status: 'pending_approval', created_at: '2026-11-26 09:00:00', finished_at: null })
const DONE = run({ id: 31, status: 'succeeded' })
const FAILED = run({ id: 32, status: 'failed', attempts: 3, error: 'Step 1 (convert_lead): The lead has no company.', workflow_name: 'Convert qualified leads', workflow_id: 2 })
const SKIPPED = run({ id: 33, status: 'skipped', error: 'The daily limit of 100 runs for this workflow was reached.', created_at: '2026-11-20 08:00:00' })
const items = [workflow({ id: 1, status: 'active' }), workflow({ id: 2, name: 'Convert qualified leads', status: 'active', actions: [{ type: 'convert_lead', params: {} }] })]
const world = { items, runs: [WAITING, DONE, FAILED, SKIPPED], counts: { pending_approval: 1, succeeded: 1, failed: 1, skipped: 1 } }

const detailsOf = (k: Kit, id: number) => k.one(`li[data-run="${id}"] button[aria-label^="Details"]`) as HTMLElement

describe('Runs tab: populated', () => {
  afterEach(disposeAll)

  it('puts what waits for the administrator first, with Approve and Reject, and the rest in a timeline by day', async () => {
    const { k, runRows } = await mountTab('runs', world)
    const text = k.bodyText()
    assert.ok(text.indexOf('Waiting for you (1)') < text.indexOf('What happened'))
    const waiting = k.one('li[data-run="30"]')!
    assert.ok(waiting.textContent!.includes('Book a meeting when the reply is positive'))
    assert.ok(waiting.textContent!.includes('Lead 12'))
    assert.ok(waiting.textContent!.includes('Approve'))
    assert.ok(waiting.textContent!.includes('Reject'))
    assert.equal(runRows().length, 4, 'one waiting card and three timeline rows')
    assert.ok(k.all('h3').some((h) => /20 Nov/.test(h.textContent ?? '')), 'a day heading for an older day')
  })

  it('leaves the waiting run out of the timeline, so it is not shown twice', async () => {
    const { k } = await mountTab('runs', world)
    assert.equal(k.all('li[data-run="30"]').length, 1)
  })

  it('says what happened in plain words: the status as a word, and why a run failed or was skipped', async () => {
    const { k } = await mountTab('runs', world)
    const failed = k.one('li[data-run="32"]')!.textContent!
    assert.ok(failed.includes('Failed'))
    assert.ok(failed.includes('Failed after 3 tries: Step 1: The lead has no company.'))
    assert.ok(!failed.includes('convert_lead'))
    const skipped = k.one('li[data-run="33"]')!.textContent!
    assert.ok(skipped.includes('Skipped'))
    assert.ok(skipped.includes('The daily limit of 100 runs for this automation was reached.'))
    assert.ok(k.one('li[data-run="31"]')!.textContent!.includes('Done'))
  })

  it('shows no snake_case name and no status code', async () => {
    const { k } = await mountTab('runs', world)
    assert.ok(!/\b[a-z]+_[a-z]+\b/.test(k.bodyText()))
    assert.ok(!k.bodyText().includes('pending_approval'))
  })

  it('says the data is organisation-wide', async () => {
    const { k } = await mountTab('runs', world)
    assert.ok(k.bodyText().includes('Automations apply to your whole organisation, not only to this module.'))
  })

  it('approves only after asking, says what it will do and on which record, and sends the approval', async () => {
    const { k, calls, press } = await mountTab('runs', world)
    await press('Approve')
    assert.deepEqual(calls.approve, [], 'nothing is sent until the person answers')
    const ask = k.one('[role="alertdialog"]')!.textContent!
    assert.ok(ask.includes('Approve this run on Lead 12?'))
    assert.ok(ask.includes('This cannot be undone.'))
    await k.click(k.withText('Approve and run')!); await k.tick(30)
    assert.deepEqual(calls.approve, [{ id: 30, note: '' }])
    assert.ok(k.bodyText().includes('Approved. The run is now: done.'))
  })

  it('does not approve when the person cancels the question', async () => {
    const { k, calls, press } = await mountTab('runs', world)
    await press('Approve')
    await k.click(k.withText('Cancel')!); await k.tick(30)
    assert.deepEqual(calls.approve, [])
  })

  it('opens a run in a drawer with what it checked and what it did, in plain words', async () => {
    const detail = runDetail({}, [{ id: 1, step: 1, action: 'add_lead_note', status: 'succeeded', result: { reason: 'Added', comment_id: 7 }, error: null, started_at: '2026-11-26 08:00:10', finished_at: '2026-11-26 08:00:20' }])
    const { k } = await mountTab('runs', { ...world, detail })
    await k.click(detailsOf(k, 31)); await k.tick(30)
    const text = k.one('[role="dialog"]')!.textContent!
    assert.ok(text.includes('What it checked'))
    assert.ok(text.includes('Matches: the reply type is meeting requested'))
    assert.ok(text.includes('What it did'))
    assert.ok(text.includes('Add a note to the lead'))
    assert.ok(text.includes('Done'))
    assert.ok(text.includes('Reason'))
    assert.ok(!text.includes('add_lead_note'))
  })

  it('rejects only with a reason, and only after asking', async () => {
    const detail = runDetail({ id: 30, status: 'pending_approval' })
    const { k, calls, press } = await mountTab('runs', { ...world, detail })
    await press('Reject')
    const dialog = k.one('[role="dialog"]')!
    assert.ok(dialog.textContent!.includes('Why are you rejecting it?'))
    const drawerReject = k.all('[role="dialog"] button').find((b) => b.textContent === 'Reject') as HTMLButtonElement
    assert.equal(drawerReject.disabled, true, 'a reason is needed')
    const box = k.one('textarea[name="reason"]') as HTMLTextAreaElement
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLTextAreaElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(box, 'Wrong contact'); box.dispatchEvent(new k.w.Event('input', { bubbles: true })) }); await k.tick(10)
    await k.click(drawerReject); await k.tick(30)
    assert.deepEqual(calls.reject, [], 'asked first')
    assert.ok(k.one('[role="alertdialog"]')!.textContent!.includes('Reject this run on Lead 12?'))
    await k.click(k.withText('Reject run')!); await k.tick(30)
    assert.deepEqual(calls.reject, [{ id: 30, note: 'Wrong contact' }])
  })

  it('offers Retry on a failed run and Cancel on one that has not started, and nothing on a finished one', async () => {
    const failed = await mountTab('runs', { ...world, detail: runDetail({ id: 32, status: 'failed', error: 'x' }) })
    await failed.k.click(detailsOf(failed.k, 32)); await failed.k.tick(30)
    const names = failed.k.all('[role="dialog"] button').map((b) => (b.textContent ?? '').trim())
    assert.ok(names.includes('Retry'))
    assert.ok(!names.includes('Cancel run'))
    await failed.k.click(failed.k.withText('Retry', '[role="dialog"] button')!); await failed.k.tick(30)
    assert.deepEqual(failed.calls.retry, [32])
    await disposeAll()

    const done = await mountTab('runs', { ...world, detail: runDetail({ id: 31, status: 'succeeded' }) })
    await done.k.click(detailsOf(done.k, 31)); await done.k.tick(30)
    const doneNames = done.k.all('[role="dialog"] button').map((b) => (b.textContent ?? '').trim())
    for (const name of ['Retry', 'Cancel run', 'Approve', 'Reject']) assert.ok(!doneNames.includes(name), name)
  })

  it('filters by outcome through the address, and asks the server for that status', async () => {
    const { k, calls, choose, router } = await mountTab('runs', world)
    await choose(k.one('select[name="outcome"]') as HTMLSelectElement, 'failed')
    assert.equal(router.lastSearch(), 'outcome=failed')
    assert.ok(calls.runs.some((r) => r.status === 'failed'))
    assert.ok(k.bodyText().includes('Convert qualified leads'))
  })

  it('opens at the filters the address names, and says when nothing matches', async () => {
    const { k, runRows } = await mountTab('runs', { ...world, search: 'outcome=rejected' })
    assert.equal(runRows().length, 0)
    assert.ok(k.bodyText().includes('No runs match'))
  })

  it('filters by automation through the address', async () => {
    const { k, calls, choose, router } = await mountTab('runs', world)
    await choose(k.one('select[name="automation"]') as HTMLSelectElement, '2')
    assert.equal(router.lastSearch(), 'automation=2')
    assert.ok(calls.runs.some((r) => r.workflow_id === 2))
  })

  it('gives a person who may only read no way to approve, reject, retry or cancel', async () => {
    const { k, button } = await mountTab('runs', { ...world, role: 'executive' })
    assert.equal(button('Approve'), undefined)
    assert.equal(button('Reject'), undefined)
    assert.ok(k.bodyText().includes('Waiting for you (1)'), 'they can still see what waits')
  })
})

describe('Runs tab: empty and failing', () => {
  afterEach(disposeAll)

  it('invites a first step when nothing has ever run, with a link to the Automations tab', async () => {
    const { k } = await mountTab('runs', { items: [], runs: [], counts: {}, search: 'module=crm' })
    assert.ok(k.bodyText().includes('Nothing has run yet'))
    const link = k.all('a').find((a) => a.textContent === 'Go to Automations') as HTMLAnchorElement
    assert.ok(link)
    assert.match(link.getAttribute('href')!, /tab=automations/)
    assert.match(link.getAttribute('href')!, /module=crm/, 'the module stays in the address')
  })

  it('says nothing waits when nothing waits, and keeps the timeline', async () => {
    const { k } = await mountTab('runs', { items, runs: [DONE], counts: { succeeded: 1 } })
    assert.ok(k.bodyText().includes('Nothing is waiting for your approval.'))
    assert.ok(k.one('li[data-run="31"]'))
  })

  it('shows an error with a retry, and the runs once the retry works', async () => {
    const { k, press, calls } = await mountTab('runs', { ...world, listFailsTimes: 1 })
    assert.ok(k.bodyText().includes('The runs could not be loaded'))
    await press('Retry')
    assert.ok(k.bodyText().includes('Waiting for you (1)'))
    assert.equal(calls.list, 2)
  })
})
