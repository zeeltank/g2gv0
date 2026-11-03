import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { DecisionConflictError } from '../../services/signal-review/decision-error'
import type { SignalReviewApi } from '../../services/signal-review/signal-review-service'
import type { SignalDecisionResponse, SignalRow } from '../../services/signal-review/signal-types'
import type { DecisionDialogProps, DecisionRequest, HistoryListProps, ReviewHistoryEntry } from '../../services/signal-review/types'
import { FORBIDDEN_TEXT, NETWORK_TEXT } from './decision-failure'
import { historyEntry, REASONS, signalRow } from './signal-fixtures'

/**
 * The drawer in a fake browser, with the dialog and the history list swapped for stand-ins that record the props they are given. That is how the
 * wiring is checked exactly (what the dialog gets on a 422, a 409, a 403), without these tests depending on the other parts' wording.
 * One test at the end uses the real dialog.
 */
interface Setup {
  signal?: SignalRow
  history?: () => Promise<{ status: number; data: ReviewHistoryEntry[] }>
  decide?: (id: number, body: DecisionRequest) => Promise<SignalDecisionResponse>
  get?: (id: number) => Promise<{ status: number; data: SignalRow }>
  reasons?: typeof REASONS
  real?: boolean
}

async function setup(options: Setup = {}) {
  const k = await kit()
  const { SignalReviewDrawer } = await import('../../components/domain/crm/signal-review-drawer')

  const signal = options.signal ?? signalRow()
  const decideCalls: Array<{ id: number; body: DecisionRequest }> = []
  const historyCalls: number[] = []
  const getCalls: number[] = []
  const changed: SignalRow[] = []
  let closed = 0
  const seen: { dialog: DecisionDialogProps | null; list: HistoryListProps | null; dialogRenders: DecisionDialogProps[] } = { dialog: null, list: null, dialogRenders: [] }

  const service: Pick<SignalReviewApi, 'decide' | 'get' | 'history'> = {
    history: async (id) => { historyCalls.push(id); return options.history ? options.history() : { status: 1, data: [historyEntry({ id: 1, decision: 'follow_up' })] } },
    get: async (id) => { getCalls.push(id); return options.get ? options.get(id) : { status: 1, data: signal } },
    decide: async (id, body) => {
      decideCalls.push({ id, body })
      if (options.decide) return options.decide(id, body)
      return { status: 1, data: { ...signal, review_status: 'Follow-up' }, review: historyEntry({ id: 99 }) }
    },
  }

  const FakeDialog = (props: DecisionDialogProps) => {
    seen.dialog = props
    seen.dialogRenders.push(props)
    return props.open ? k.h('div', { role: 'dialog', 'aria-label': 'stand-in dialog' }, `mode:${props.mode} saving:${props.saving} conflict:${props.conflict ? 'yes' : 'no'}`) : null
  }
  const FakeHistory = (props: HistoryListProps) => {
    seen.list = props
    return k.h('div', { 'data-testid': 'history' }, props.loading ? 'history loading' : props.error ? `history error: ${props.error}` : `history entries: ${props.entries?.length ?? 'none'}`)
  }

  const element = (over: Record<string, unknown> = {}) => k.h(SignalReviewDrawer, {
    signal, open: true, service, reasons: options.reasons ?? REASONS, onChanged: (next: SignalRow) => { changed.push(next) }, onClose: () => { closed += 1 },
    ...(options.real ? {} : { parts: { DecisionDialog: FakeDialog, HistoryList: FakeHistory } }),
    ...over,
  })

  await k.render(element())
  await k.tick(5)

  return { k, signal, service, decideCalls, historyCalls, getCalls, changed, seen, closes: () => closed, element }
}

describe('SignalReviewDrawer', () => {
  afterEach(disposeAll)

  it('shows the title, the organisation, the status, why it matters and the evidence', async () => {
    const { k } = await setup()
    const text = k.bodyText()
    assert.ok(text.includes('District office invites bids for a school management system'))
    assert.ok(text.includes('Example School District'))
    assert.ok(text.includes('Needs decision'))
    assert.ok(text.includes('Why it matters'))
    assert.ok(text.includes('A district office is asking for bids'))
    assert.ok(text.includes('“invites sealed bids for the supply and rollout of a school management system across 14 schools”'))
    assert.ok(text.includes('Event 12 Oct 2026'))
    assert.ok(text.includes('The source states the date the event happens or happened.'))
    assert.ok(text.includes('2 Nov 2026 by run #81'))
    assert.ok(text.includes('Scholar'))
    assert.ok(text.includes('Score 24'))
    assert.ok(text.includes('Confirmed'))
  })

  it('opens the source in a new tab without handing it the page', async () => {
    const { k } = await setup()
    const link = k.all('a').find((a) => a.textContent?.includes('Tender notice 42'))!
    assert.equal(link.getAttribute('href'), 'https://district-notices.example/tenders/42')
    assert.equal(link.getAttribute('target'), '_blank')
    assert.match(link.getAttribute('rel') ?? '', /noopener/)
    assert.ok(link.textContent!.includes('opens in a new tab'), 'a screen reader is told it leaves the page')
  })

  it('does not turn an unsafe stored address into a link, and says what is missing', async () => {
    const { k } = await setup({ signal: signalRow({ source_url: 'javascript:alert(1)', primary_source: null, assessment: null, date_info: { status: 'undated', date: null }, scores: null, business_fit: null, product_master_name: null }) })
    assert.equal(k.all('a').filter((a) => a.getAttribute('href')?.startsWith('javascript')).length, 0)
    const text = k.bodyText()
    assert.ok(text.includes('No web address recorded.'))
    assert.ok(text.includes('No wording from the source was kept for this signal.'))
    assert.ok(text.includes('Date unknown'))
    assert.ok(text.includes('No date could be found on the source'))
    assert.ok(text.includes('None'))
    assert.ok(text.includes('Not recorded'))
  })

  it('fetches the history when it opens and hands it to the history list', async () => {
    const { k, historyCalls, seen } = await setup()
    assert.deepEqual(historyCalls, [1])
    assert.equal(seen.list?.entries?.length, 1)
    assert.ok(k.bodyText().includes('history entries: 1'))
  })

  it('shows the history error with a way to retry, and the retry fetches again', async () => {
    let attempts = 0
    const { k, historyCalls, seen } = await setup({ history: async () => { attempts += 1; if (attempts === 1) throw new Error('History is down'); return { status: 1, data: [] } } })
    assert.ok(k.bodyText().includes('history error: History is down'))
    await k.act(async () => { seen.list!.onRetry() })
    await k.tick(5)
    assert.equal(historyCalls.length, 2)
    assert.ok(k.bodyText().includes('history entries: 0'))
  })

  it('offers the decisions that fit the status: Reopen only on a dismissed signal', async () => {
    const fresh = await setup()
    assert.deepEqual(fresh.k.all('[role="group"] button').map((b) => b.textContent), ['Contacted', 'Reviewed', 'Not relevant…'])
    await disposeAll()
    const dismissed = await setup({ signal: signalRow({ review_status: 'Dismissed' }) })
    assert.deepEqual(dismissed.k.all('[role="group"] button').map((b) => b.textContent), ['Reopen…'])
    assert.ok(dismissed.k.bodyText().includes('Not relevant'), 'the status chip')
  })

  it('shows "Follow-up" as Contacted', async () => {
    const { k } = await setup({ signal: signalRow({ review_status: 'Follow-up' }) })
    assert.ok(k.bodyText().includes('Contacted'))
    assert.ok(!k.bodyText().includes('Follow-up'))
  })

  it('opens the dialog for the decision that was pressed, with the reasons and the status in view', async () => {
    const { k, seen } = await setup()
    await k.click(k.withText('Not relevant…')!)
    assert.equal(seen.dialog?.open, true)
    assert.equal(seen.dialog?.mode, 'dismissed')
    assert.equal(seen.dialog?.currentStatus, 'New')
    assert.equal(seen.dialog?.signalTitle, 'District office invites bids for a school management system')
    assert.deepEqual(seen.dialog?.reasons, REASONS)
    assert.equal(seen.dialog?.saving, false)
    assert.equal(seen.dialog?.conflict, null)
  })

  it('cannot dismiss when the reasons did not load, and says so', async () => {
    const { k } = await setup({ reasons: [] })
    assert.equal((k.withText('Not relevant…') as HTMLButtonElement).disabled, true)
    assert.ok(k.bodyText().includes('which has not loaded'))
    assert.equal((k.withText('Contacted') as HTMLButtonElement).disabled, false)
  })

  it('sends the status the person was looking at, and the answer from the dialog', async () => {
    const { k, seen, decideCalls } = await setup({ signal: signalRow({ review_status: 'Reviewed' }) })
    await k.click(k.withText('Not relevant…')!)
    await k.act(async () => { seen.dialog!.onSubmit({ decision: 'dismissed', reason_code: 'wrong_product', note: 'ERP, not a school system.' }) })
    await k.tick(5)
    assert.deepEqual(decideCalls, [{ id: 1, body: { decision: 'dismissed', reason_code: 'wrong_product', note: 'ERP, not a school system.', expected_status: 'Reviewed' } }])
  })

  it('shows saving while the request runs: buttons and dialog are told, and a second press sends nothing', async () => {
    let finish!: (value: SignalDecisionResponse) => void
    const { k, seen, decideCalls } = await setup({ decide: () => new Promise((resolve) => { finish = resolve }) })
    await k.click(k.withText('Contacted')!)
    await k.act(async () => { seen.dialog!.onSubmit({ decision: 'follow_up' }) })
    assert.equal(seen.dialog?.saving, true)
    assert.equal((k.withText('Reviewed') as HTMLButtonElement).disabled, true)
    await k.act(async () => { seen.dialog!.onSubmit({ decision: 'follow_up' }) })
    assert.equal(decideCalls.length, 1, 'a second submit while saving is ignored')
    await k.act(async () => { finish({ status: 1, data: signalRow({ review_status: 'Follow-up' }), review: historyEntry({ id: 99 }) }) })
    await k.tick(5)
    assert.equal(seen.dialog?.saving, false)
  })

  it('on success: updates the signal and the history in place, confirms in words, and closes the dialog', async () => {
    const { k, seen, changed, historyCalls } = await setup()
    await k.click(k.withText('Contacted')!)
    await k.act(async () => { seen.dialog!.onSubmit({ decision: 'follow_up', note: 'Called.' }) })
    await k.tick(5)
    assert.equal(changed.length, 1)
    assert.equal(changed[0].review_status, 'Follow-up')
    assert.equal(changed[0].title, 'District office invites bids for a school management system', 'fields the answer leaves out keep their value')
    assert.equal(seen.dialog?.open, false)
    assert.equal(seen.dialog?.mode, 'follow_up', 'the closing dialog keeps its form while it fades out')
    assert.ok(k.bodyText().includes('Marked as contacted.'))
    assert.equal(seen.list?.entries?.[0].id, 99, 'the new history row is at the top')
    assert.equal(seen.list?.entries?.length, 2)
    assert.equal(historyCalls.length, 1, 'no second history fetch')
  })

  it('on a 422: passes the field messages to the dialog and keeps it open', async () => {
    const error = Object.assign(new Error('Validation failed'), { status: 422, errors: { reason_code: ['Choose a reason.'], note: ['Add a note.'] } })
    const { k, seen, changed } = await setup({ decide: async () => { throw error } })
    await k.click(k.withText('Not relevant…')!)
    await k.act(async () => { seen.dialog!.onSubmit({ decision: 'dismissed', reason_code: 'other' }) })
    await k.tick(5)
    assert.deepEqual(seen.dialog?.serverErrors, { reason_code: 'Choose a reason.', note: 'Add a note.' })
    assert.equal(seen.dialog?.formError, null)
    assert.equal(seen.dialog?.open, true)
    assert.equal(seen.dialog?.saving, false)
    assert.equal(changed.length, 0)
  })

  it('on a 409 conflict: passes the decision that got there first, and puts the current status on the row', async () => {
    const theirs = historyEntry({ id: 50, decision: 'reviewed', to_status: 'Reviewed', decided_by_name: 'Anil' })
    const { k, seen, changed } = await setup({ decide: async () => { throw new DecisionConflictError({ status: 0, code: 'conflict', message: 'Someone decided first.', current: theirs }) } })
    await k.click(k.withText('Contacted')!)
    await k.act(async () => { seen.dialog!.onSubmit({ decision: 'follow_up' }) })
    await k.tick(5)
    assert.deepEqual(seen.dialog?.conflict, theirs)
    assert.equal(changed.at(-1)?.review_status, 'Reviewed')
    assert.equal(seen.dialog?.open, true)
  })

  it('"Continue anyway" sends the same answer against the status the other person left', async () => {
    const theirs = historyEntry({ id: 50, decision: 'reviewed', to_status: 'Reviewed' })
    let first = true
    const { k, seen, decideCalls } = await setup({
      decide: async () => {
        if (first) { first = false; throw new DecisionConflictError({ status: 0, code: 'conflict', message: 'x', current: theirs }) }
        return { status: 1, data: signalRow({ review_status: 'Follow-up' }), review: historyEntry({ id: 99 }) }
      },
    })
    await k.click(k.withText('Contacted')!)
    await k.act(async () => { seen.dialog!.onSubmit({ decision: 'follow_up', note: 'Called.' }) })
    await k.tick(5)
    await k.act(async () => { seen.dialog!.onResolveConflict('continue') })
    await k.tick(5)
    assert.equal(decideCalls.length, 2)
    assert.equal(decideCalls[0].body.expected_status, 'New')
    assert.deepEqual(decideCalls[1].body, { decision: 'follow_up', note: 'Called.', expected_status: 'Reviewed' })
    assert.equal(seen.dialog?.conflict, null)
    assert.equal(seen.dialog?.open, false)
  })

  it('"Cancel" on a conflict closes the dialog and sends nothing more', async () => {
    const theirs = historyEntry({ id: 50, to_status: 'Reviewed' })
    const { k, seen, decideCalls } = await setup({ decide: async () => { throw new DecisionConflictError({ status: 0, code: 'conflict', message: 'x', current: theirs }) } })
    await k.click(k.withText('Contacted')!)
    await k.act(async () => { seen.dialog!.onSubmit({ decision: 'follow_up' }) })
    await k.tick(5)
    await k.act(async () => { seen.dialog!.onResolveConflict('cancel') })
    await k.tick(5)
    assert.equal(decideCalls.length, 1)
    assert.equal(seen.dialog?.open, false)
    assert.equal(seen.dialog?.conflict, null)
  })

  it('on a 409 "unchanged": shows the server\'s sentence on the form and re-reads the signal', async () => {
    const { k, seen, getCalls } = await setup({ decide: async () => { throw new DecisionConflictError({ status: 0, code: 'unchanged', message: 'It is already contacted.', current: historyEntry() }) } })
    await k.click(k.withText('Contacted')!)
    await k.act(async () => { seen.dialog!.onSubmit({ decision: 'follow_up' }) })
    await k.tick(5)
    assert.equal(seen.dialog?.formError, 'It is already contacted.')
    assert.equal(seen.dialog?.conflict, null)
    assert.deepEqual(getCalls, [1])
  })

  it('on a 403: says the person may view but not decide, and stops offering the buttons', async () => {
    const { k, seen } = await setup({ decide: async () => { throw Object.assign(new Error('Forbidden'), { status: 403 }) } })
    await k.click(k.withText('Contacted')!)
    await k.act(async () => { seen.dialog!.onSubmit({ decision: 'follow_up' }) })
    await k.tick(5)
    assert.equal(FORBIDDEN_TEXT, 'You can view signals but you are not allowed to decide on them.')
    assert.equal(seen.dialog?.formError, FORBIDDEN_TEXT)
    assert.ok(k.all('[role="alert"]').some((el) => el.textContent === FORBIDDEN_TEXT))
    assert.ok(k.all('[role="group"] button').every((b) => (b as HTMLButtonElement).disabled))
  })

  it('on a network failure: shows a message on the form and lets the same answer be sent again', async () => {
    let attempts = 0
    const { k, seen, decideCalls } = await setup({
      decide: async () => {
        attempts += 1
        if (attempts === 1) throw new TypeError('Failed to fetch')
        return { status: 1, data: signalRow({ review_status: 'Follow-up' }), review: historyEntry({ id: 99 }) }
      },
    })
    await k.click(k.withText('Contacted')!)
    await k.act(async () => { seen.dialog!.onSubmit({ decision: 'follow_up' }) })
    await k.tick(5)
    assert.equal(seen.dialog?.formError, NETWORK_TEXT)
    assert.equal(seen.dialog?.open, true)
    await k.act(async () => { seen.dialog!.onSubmit({ decision: 'follow_up' }) })
    await k.tick(5)
    assert.equal(decideCalls.length, 2)
    assert.equal(seen.dialog?.open, false)
    assert.equal(seen.dialog?.formError, null)
  })

  it('works with the real dialog: pick a reason, submit, and the request carries it', async () => {
    const { k, decideCalls } = await setup({ real: true })
    await k.click(k.withText('Not relevant…')!)
    await k.tick(5)
    const select = k.one('select') as HTMLSelectElement
    assert.ok(select, 'the reason list')
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLSelectElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(select, 'wrong_product'); select.dispatchEvent(new k.w.Event('change', { bubbles: true })) })
    await k.click(k.withText('Mark not relevant')!)
    await k.tick(5)
    assert.deepEqual(decideCalls[0].body, { decision: 'dismissed', reason_code: 'wrong_product', expected_status: 'New' })
  })
})
