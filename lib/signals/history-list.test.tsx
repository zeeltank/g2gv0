import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { formatDateTime } from './format'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'

const NOW = new Date('2026-11-03T12:00:00Z')

function entry(over: Record<string, unknown> = {}) {
  return {
    id: 1, decision: 'dismissed', reason_code: 'stale', reason_label: 'Too old to act on', note: null, from_status: 'New', to_status: 'Dismissed',
    via: 'signal_review', decided_by: 3, decided_by_name: 'Milan Baldaniya', decided_at: '2026-11-03T10:15:00+05:30', ...over,
  }
}

async function setup(props: Record<string, unknown> = {}) {
  const k = await kit()
  const { SignalHistoryList } = await import('../../components/domain/crm/signal-history-list')
  const retries = { count: 0 }
  const show = (patch: Record<string, unknown> = {}) => k.render(k.h(SignalHistoryList, {
    entries: [entry()], loading: false, error: null, onRetry: () => { retries.count += 1 }, now: NOW, ...props, ...patch,
  }))
  await show()
  const items = () => k.all('li')
  return { k, show, retries, items }
}

describe('SignalHistoryList: states', () => {
  afterEach(disposeAll)

  it('shows a loading skeleton, and no entries, while loading', async () => {
    const { k, items } = await setup({ loading: true })
    assert.ok(k.one('[role="status"]')!.textContent!.includes('Loading history'))
    assert.equal(items().length, 0)
    assert.ok(!k.bodyText().includes('No decisions yet.'))
  })

  it('shows the skeleton too before anything has been asked for', async () => {
    const { k } = await setup({ entries: null })
    assert.ok(k.one('[role="status"]'))
  })

  it('shows the error with a Retry button that retries', async () => {
    const { k, retries, items } = await setup({ error: 'The server did not answer.' })
    assert.ok(k.bodyText().includes('The history could not be loaded.'))
    assert.ok(k.bodyText().includes('The server did not answer.'))
    assert.equal(items().length, 0, 'no stale entries beside an error')
    await k.click(k.withText('Retry')!)
    assert.equal(retries.count, 1)
  })

  it('says "No decisions yet." when there are none', async () => {
    const { k, items } = await setup({ entries: [] })
    assert.ok(k.bodyText().includes('No decisions yet.'))
    assert.equal(items().length, 0)
    assert.equal(k.one('[role="status"]'), null)
  })

  it('shows loading rather than an old list while the next one is being fetched', async () => {
    const { k, items } = await setup({ loading: true, entries: [entry()] })
    assert.equal(items().length, 0)
    assert.ok(k.one('[role="status"]'))
  })
})

describe('SignalHistoryList: an entry', () => {
  afterEach(disposeAll)

  it('says what was decided, how the status moved, why, who decided and when', async () => {
    const { items } = await setup({ entries: [entry({ note: 'Looks like an ERP, not a school system.' })] })
    const text = items()[0].textContent!
    assert.ok(text.includes('Not relevant'))
    assert.ok(text.includes('Needs decision'), 'from')
    assert.ok(text.includes('→'))
    assert.ok(text.includes('Reason: Too old to act on'))
    assert.ok(text.includes('“Looks like an ERP, not a school system.”'))
    assert.ok(text.includes('by Milan Baldaniya'))
    assert.ok(text.includes(formatDateTime('2026-11-03T10:15:00+05:30')), 'an absolute date and time')
    assert.ok(text.includes('7 hours ago'), `a relative phrase (04:45 UTC against a 12:00 UTC "now"): ${text}`)
  })

  it('labels every decision in the screen\'s words, with Follow-up as Contacted', async () => {
    const { items } = await setup({
      entries: [
        entry({ id: 5, decision: 'promoted', from_status: 'Follow-up', to_status: 'Follow-up', reason_code: null, reason_label: null, decided_at: '2026-11-03T11:00:00Z' }),
        entry({ id: 4, decision: 'reopened', from_status: 'Dismissed', to_status: 'New', reason_code: null, reason_label: null, decided_at: '2026-11-03T10:00:00Z' }),
        entry({ id: 3, decision: 'follow_up', from_status: 'New', to_status: 'Follow-up', reason_code: null, reason_label: null, decided_at: '2026-11-03T09:00:00Z' }),
        entry({ id: 2, decision: 'reviewed', from_status: 'New', to_status: 'Reviewed', reason_code: null, reason_label: null, decided_at: '2026-11-03T08:00:00Z' }),
      ],
    })
    const heads = items().map((li) => li.querySelector('span.font-semibold')!.textContent)
    assert.deepEqual(heads, ['Promoted to lead', 'Reopened', 'Contacted', 'Reviewed'])
    assert.ok(!items().some((li) => li.textContent!.includes('Follow-up')), 'the stored word never reaches the screen')
  })

  it('shows one status chip, marked unchanged, when the decision did not move the status', async () => {
    const { items } = await setup({ entries: [entry({ decision: 'promoted', from_status: 'Follow-up', to_status: 'Follow-up', reason_code: null, reason_label: null, note: 'Lead #12 created' })] })
    const text = items()[0].textContent!
    assert.ok(text.includes('status unchanged'))
    assert.ok(!text.includes('→'))
    assert.ok(text.includes('Lead #12 created'))
  })

  it('falls back to the raw reason code when the label is gone, and shows no reason line when there is neither', async () => {
    const { items, show } = await setup({ entries: [entry({ reason_label: null, reason_code: 'retired_code' })] })
    assert.ok(items()[0].textContent!.includes('Reason: retired_code'))
    await show({ entries: [entry({ reason_label: null, reason_code: null })] })
    assert.ok(!items()[0].textContent!.includes('Reason'))
  })

  it('says "by someone (not recorded)" when the decider is unknown', async () => {
    const { items } = await setup({ entries: [entry({ decided_by: null, decided_by_name: null })] })
    assert.ok(items()[0].textContent!.includes('by someone (not recorded)'))
  })

  it('tags an original-screen row and an earlier record honestly, and tags nothing else', async () => {
    const { items } = await setup({
      entries: [
        entry({ id: 4, via: 'legacy_screen', reason_code: null, reason_label: null, decided_at: '2026-11-03T11:00:00Z' }),
        entry({ id: 3, via: 'backfill', reason_code: null, reason_label: null, decided_at: '2026-11-03T10:00:00Z' }),
        entry({ id: 2, via: 'signal_review', decided_at: '2026-11-03T09:00:00Z' }),
        entry({ id: 1, via: 'promote', decision: 'promoted', decided_at: '2026-11-03T08:00:00Z' }),
      ],
    })
    const [legacy, backfill, own, promote] = items().map((li) => li.textContent!)
    assert.ok(legacy.includes('original screen'))
    assert.ok(backfill.includes('earlier record'))
    for (const text of [own, promote]) assert.ok(!text.includes('original screen') && !text.includes('earlier record'))
    assert.ok(items()[0].querySelector('[title]')!.getAttribute('title')!.includes('does not ask for a reason'), 'and says what the tag means')
  })

  it('lists the newest first, whatever order it is given', async () => {
    const { items } = await setup({
      entries: [
        entry({ id: 1, decision: 'reviewed', to_status: 'Reviewed', reason_code: null, reason_label: null, decided_at: '2026-11-01T10:00:00Z' }),
        entry({ id: 3, decision: 'reopened', from_status: 'Dismissed', to_status: 'New', reason_code: null, reason_label: null, decided_at: '2026-11-03T10:00:00Z' }),
        entry({ id: 2, decision: 'dismissed', decided_at: '2026-11-02T10:00:00Z' }),
      ],
    })
    assert.deepEqual(items().map((li) => li.querySelector('span.font-semibold')!.textContent), ['Reopened', 'Not relevant', 'Reviewed'])
  })
})
