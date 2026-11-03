import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { parseRun, type SignalRun } from '../../services/signal-review/runs-service'

const NOW = new Date('2026-11-03T12:00:00Z')
const MANUAL_LINE = 'Runs are started by hand. No schedule is switched on.'

function run(over: Partial<SignalRun> = {}): SignalRun {
  return {
    id: 81, trigger: 'manual', status: 'success', started_at: '2026-11-03T09:00:00Z', completed_at: '2026-11-03T09:03:05Z', duration_seconds: 185,
    product_key: 'scholar', product_master_id: 7, product_name: 'Scholar', signals_found: 7, signals_new: 5,
    ai_input_tokens: 90_000, ai_output_tokens: 6_214, ai_cost_usd: 0.0412, search_requests: 38, search_credits: null,
    error_code: null, error_message: null, stage_message: null, ...over,
  }
}

async function setupView(props: Record<string, unknown> = {}) {
  const k = await kit()
  const { SignalRunsView } = await import('../../components/domain/crm/signal-runs-panel')
  const retries = { count: 0 }
  await k.render(k.h(SignalRunsView, { runs: [run()], loading: false, error: null, onRetry: () => { retries.count += 1 }, now: NOW, ...props }))
  /** The cells of the row for run `id`, by column name. */
  const row = (id: number) => {
    const tr = k.all('tbody tr').find((r) => r.querySelector('td')!.textContent === `#${id}`)
    assert.ok(tr, `a row for run #${id}`)
    const [runId, started, trigger, status, duration, product, found, tokens, cost, searches] = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent ?? '')
    return { runId, started, trigger, status, duration, product, found, tokens, cost, searches, text: tr.textContent ?? '' }
  }
  const count = (key: string) => k.one(`[data-count="${key}"] b`)?.textContent
  return { k, retries, row, count }
}

describe('SignalRunsView: states', () => {
  afterEach(disposeAll)

  it('shows a loading skeleton and no table while loading', async () => {
    const { k } = await setupView({ loading: true, runs: null })
    assert.ok(k.one('[role="status"]')!.textContent!.includes('Loading runs'))
    assert.equal(k.one('table'), null)
  })

  it('shows the error with a Retry button that retries', async () => {
    const { k, retries } = await setupView({ error: 'The server did not answer.', runs: null })
    assert.ok(k.one('[role="alert"]')!.textContent!.includes('The server did not answer.'))
    assert.equal(k.one('table'), null)
    await k.click(k.withText('Retry')!)
    assert.equal(retries.count, 1)
  })

  it('says there are no runs yet, without a table and without claiming anything about a schedule', async () => {
    const { k } = await setupView({ runs: [] })
    assert.ok(k.bodyText().includes('No research runs yet'))
    assert.equal(k.one('table'), null)
    assert.ok(!k.bodyText().includes(MANUAL_LINE), 'nothing was loaded to say it from')
  })
})

describe('SignalRunsView: the table', () => {
  afterEach(disposeAll)

  it('has the columns the screen promises', async () => {
    const { k } = await setupView()
    assert.deepEqual(
      k.all('thead th').map((th) => th.textContent),
      ['Run', 'Started', 'Trigger', 'Status', 'Duration', 'Product', 'Signals found', 'AI tokens', 'Cost (USD)', 'Search requests'],
    )
  })

  it('shows a run\'s figures', async () => {
    const { row } = await setupView()
    const r = row(81)
    assert.equal(r.trigger, 'manual')
    assert.equal(r.status, 'Success')
    assert.equal(r.duration, '3 min 05 s')
    assert.equal(r.product, 'Scholar')
    assert.ok(r.found.startsWith('7') && r.found.endsWith('5 new'), `7 found, of which 5 new: ${r.found}`)
    assert.equal(r.tokens, '96,214')
    assert.equal(r.cost, '$0.0412')
    assert.equal(r.searches, '38')
  })

  it('shows an unknown cost, token count and search count as a dash, never as zero', async () => {
    const { row, k } = await setupView({ runs: [run({ id: 5, ai_cost_usd: null, ai_input_tokens: null, ai_output_tokens: null, search_requests: null })] })
    const r = row(5)
    assert.equal(r.cost, '—')
    assert.equal(r.tokens, '—')
    assert.equal(r.searches, '—')
    assert.ok(!k.one('tbody')!.textContent!.includes('$0'), 'no invented zero cost')
  })

  it('shows a recorded zero as zero, because a run that used no AI really cost nothing', async () => {
    const { row } = await setupView({ runs: [run({ id: 6, ai_cost_usd: 0, ai_input_tokens: 0, ai_output_tokens: 0, search_requests: 0 })] })
    const r = row(6)
    assert.equal(r.cost, '$0.00')
    assert.equal(r.tokens, '0')
    assert.equal(r.searches, '0')
  })

  it('spells out why a failed or skipped run stopped, and says so when it recorded no reason', async () => {
    const { row } = await setupView({
      runs: [
        run({ id: 4, status: 'failed', error_message: 'The search quota is used up.', stage_message: 'ignored' }),
        run({ id: 3, status: 'skipped', error_message: null, stage_message: 'Another run held the slot.' }),
        run({ id: 2, status: 'failed', error_message: null, stage_message: null, error_code: null }),
        run({ id: 1, status: 'success', stage_message: 'Completed in 3 minutes.' }),
      ],
    })
    assert.ok(row(4).status.includes('Failed') && row(4).status.includes('The search quota is used up.'))
    assert.ok(row(3).status.includes('Skipped') && row(3).status.includes('Another run held the slot.'))
    assert.ok(row(2).status.includes('No reason recorded.'))
    assert.equal(row(1).status, 'Success', 'a run that worked has no reason line')
  })

  it('shows a run still going as in progress', async () => {
    const { row } = await setupView({ runs: [run({ id: 8, status: 'running', duration_seconds: null, completed_at: null })] })
    assert.equal(row(8).duration, 'In progress')
    assert.equal(row(8).status, 'Running')
  })

  it('falls back from the product name to the key to a dash', async () => {
    const { row } = await setupView({
      runs: [run({ id: 3, product_name: null, product_key: 'scholar' }), run({ id: 2, product_name: null, product_key: null, product_master_id: null }), run({ id: 1 })],
    })
    assert.deepEqual([row(3).product, row(2).product, row(1).product], ['scholar', '—', 'Scholar'])
  })

  it('lists the newest run first', async () => {
    const { k } = await setupView({
      runs: [run({ id: 1, started_at: '2026-11-01T10:00:00Z' }), run({ id: 3, started_at: '2026-11-03T10:00:00Z' }), run({ id: 2, started_at: '2026-11-02T10:00:00Z' })],
    })
    assert.deepEqual(k.all('tbody tr').map((tr) => tr.querySelector('td')!.textContent), ['#3', '#2', '#1'])
  })

  it('scrolls the table sideways inside its own container', async () => {
    const { k } = await setupView()
    const holder = k.one('table')!.parentElement!
    assert.ok(holder.className.split(' ').includes('overflow-x-auto'))
    assert.ok(k.one('table')!.className.includes('min-w-'), 'the table keeps its width instead of squeezing at phone width')
  })
})

describe('SignalRunsView: run health', () => {
  afterEach(disposeAll)

  it('says runs are started by hand while every loaded run is manual', async () => {
    const { k } = await setupView({ runs: [run({ id: 2 }), run({ id: 1 })] })
    assert.ok(k.bodyText().includes(MANUAL_LINE))
  })

  it('drops that line, and says how many were scheduled, as soon as one run is not manual', async () => {
    const { k } = await setupView({ runs: [run({ id: 3 }), run({ id: 2, trigger: 'scheduled' }), run({ id: 1 })] })
    assert.ok(!k.bodyText().includes(MANUAL_LINE))
    assert.ok(k.bodyText().includes('1 of 3 runs were started on a schedule.'))
  })

  it('shows the last run\'s status and how long ago it started', async () => {
    const { k } = await setupView({ runs: [run({ id: 1, started_at: '2026-11-03T09:00:00Z', status: 'success' }), run({ id: 2, started_at: '2026-11-03T10:30:00Z', status: 'failed' })] })
    const tile = k.all('section[aria-label="Run health"] > div > div')[0]
    assert.ok(tile.textContent!.includes('Last run'))
    assert.ok(tile.textContent!.includes('Failed'), 'the newest run, not the first in the list')
    assert.ok(tile.textContent!.includes('1 hour ago'))
  })

  it('counts successes, partial runs and failures of the loaded runs', async () => {
    const { count } = await setupView({
      runs: [run({ id: 6 }), run({ id: 5 }), run({ id: 4, status: 'partial' }), run({ id: 3, status: 'failed' }), run({ id: 2, status: 'failed' }), run({ id: 1, status: 'skipped' })],
    })
    assert.deepEqual([count('success'), count('partial'), count('failed'), count('skipped')], ['2', '1', '2', '1'])
    assert.equal(count('other'), undefined, 'no "other" unless some run is neither')
  })

  it('adds up cost over the runs that have one and says how many have none', async () => {
    const { k } = await setupView({
      runs: [run({ id: 3, ai_cost_usd: 0.04 }), run({ id: 2, ai_cost_usd: null }), run({ id: 1, ai_cost_usd: 0.01 })],
    })
    const tile = k.all('section[aria-label="Run health"] > div > div').find((t) => t.textContent!.includes('AI cost'))!
    assert.ok(tile.textContent!.includes('$0.0500'), tile.textContent!)
    assert.ok(tile.textContent!.includes('1 of 3 runs has no cost recorded'))
  })

  it('shows an unknown total, not $0.00, when no run has a cost recorded', async () => {
    const { k } = await setupView({ runs: [run({ id: 2, ai_cost_usd: null }), run({ id: 1, ai_cost_usd: null })] })
    const tile = k.all('section[aria-label="Run health"] > div > div').find((t) => t.textContent!.includes('AI cost'))!
    assert.ok(tile.textContent!.includes('—'))
    assert.ok(!tile.textContent!.includes('$0'))
    assert.ok(tile.textContent!.includes('No run has a cost recorded'))
  })

  it('says every run has a cost when none is missing', async () => {
    const { k } = await setupView({ runs: [run({ id: 2 }), run({ id: 1 })] })
    const tile = k.all('section[aria-label="Run health"] > div > div').find((t) => t.textContent!.includes('AI cost'))!
    assert.ok(tile.textContent!.includes('All 2 runs have a cost recorded'))
  })
})

describe('parseRun', () => {
  it('reads the server\'s row, naming the fields the screen uses', () => {
    const parsed = parseRun({
      id: 81, trigger: 'manual', status: 'partial', started_at: '2026-11-03T09:00:00+05:30', completed_at: '2026-11-03T09:03:05+05:30',
      duration_seconds: 185, product_key: 'scholar', product_master_id: 7, opportunities_qualified: 7, opportunities_new: 5,
      ai_input_tokens: 90000, ai_output_tokens: 6214, ai_cost_usd: 0.0412, search_requests: 38, search_credits: 2.5,
      error_code: 'x', error_message: 'y', stage_message: 'z',
    }, new Map([[7, 'Scholar']]))
    assert.deepEqual(parsed, {
      id: 81, trigger: 'manual', status: 'partial', started_at: '2026-11-03T09:00:00+05:30', completed_at: '2026-11-03T09:03:05+05:30',
      duration_seconds: 185, product_key: 'scholar', product_master_id: 7, product_name: 'Scholar', signals_found: 7, signals_new: 5,
      ai_input_tokens: 90000, ai_output_tokens: 6214, ai_cost_usd: 0.0412, search_requests: 38, search_credits: 2.5,
      error_code: 'x', error_message: 'y', stage_message: 'z',
    })
  })

  it('keeps what was never recorded as null, not zero', () => {
    const parsed = parseRun({ id: 1, trigger: 'manual', status: 'success', ai_cost_usd: null, search_requests: null })
    for (const key of ['ai_input_tokens', 'ai_output_tokens', 'ai_cost_usd', 'search_requests', 'search_credits', 'duration_seconds', 'product_master_id', 'signals_found'] as const) {
      assert.equal(parsed[key], null, key)
    }
    assert.equal(parsed.product_name, null)
  })

  it('reads a DECIMAL sent as a string, and treats text that is not a number as unknown', () => {
    assert.equal(parseRun({ ai_cost_usd: '0.041200' }).ai_cost_usd, 0.0412)
    assert.equal(parseRun({ ai_cost_usd: '0.000000' }).ai_cost_usd, 0)
    assert.equal(parseRun({ ai_cost_usd: 'n/a' }).ai_cost_usd, null)
    assert.equal(parseRun({ ai_cost_usd: '' }).ai_cost_usd, null)
  })

  it('takes the duration from duration_ms when the server does not send seconds yet', () => {
    assert.equal(parseRun({ duration_ms: 185_400 }).duration_seconds, 185)
    assert.equal(parseRun({ duration_seconds: 10, duration_ms: 99_000 }).duration_seconds, 10)
    assert.equal(parseRun({ duration_ms: null }).duration_seconds, null)
  })
})

/** The panel itself, against a stand-in for the server: it fetches, retries, and explains a refusal. */
describe('SignalRunsPanel', () => {
  const realFetch = globalThis.fetch
  const urls: string[] = []
  afterEach(async () => { globalThis.fetch = realFetch; urls.length = 0; await disposeAll() })

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const serverRow = (over: Record<string, unknown> = {}) => ({
    id: 81, trigger: 'manual', status: 'success', started_at: '2026-11-03T09:00:00+05:30', duration_ms: 185_000, product_key: 'scholar', product_master_id: 7,
    opportunities_qualified: 7, opportunities_new: 5, ai_input_tokens: 90_000, ai_output_tokens: 6_214, ai_cost_usd: '0.041200', search_requests: 38, ...over,
  })
  const OPTIONS = { status: 1, data: [{ id: 7, key: 'scholar', name: 'Scholar', kind: 'product', parentId: null, label: 'Scholar' }] }
  const stub = (handler: (url: string) => Response) => {
    globalThis.fetch = (async (input: unknown) => { const url = String(input); urls.push(url); return handler(url) }) as typeof fetch
  }
  const mount = async () => {
    const k = await kit()
    const { SignalRunsPanel } = await import('../../components/domain/crm/signal-runs-panel')
    await k.render(k.h(SignalRunsPanel))
    for (let i = 0; i < 4; i += 1) await k.tick(5)
    return k
  }

  it('loads the runs with the token only, and shows them with the product name from the Product Master', async () => {
    stub((url) => (url.includes('/signals/research/runs') ? json({ status: 1, data: [serverRow()] }) : json(OPTIONS)))
    const k = await mount()
    const runsCall = urls.find((u) => u.includes('/signals/research/runs'))
    assert.ok(runsCall, `asked for the runs: ${urls.join(', ')}`)
    assert.ok(!/sub_institute_id|token=/.test(runsCall), 'the organisation comes from the token, not the address')
    const cells = Array.from(k.one('tbody tr')!.querySelectorAll('td')).map((td) => td.textContent)
    assert.equal(cells[5], 'Scholar')
    assert.equal(cells[4], '3 min 05 s')
    assert.equal(cells[8], '$0.0412', 'a DECIMAL sent as text is still a cost')
  })

  it('still shows the runs when the Product Master list is refused, with the product key instead of a name', async () => {
    stub((url) => (url.includes('/signals/research/runs') ? json({ status: 1, data: [serverRow()] }) : json({ message: 'Forbidden' }, 403)))
    const k = await mount()
    assert.equal(k.one('tbody tr')!.querySelectorAll('td')[5].textContent, 'scholar')
  })

  it('explains a refusal in plain words and loads again on Retry', async () => {
    let allow = false
    stub((url) => {
      if (!url.includes('/signals/research/runs')) return json(OPTIONS)
      return allow ? json({ status: 1, data: [serverRow()] }) : json({ message: 'Forbidden' }, 403)
    })
    const k = await mount()
    assert.ok(k.bodyText().includes('You do not have access to the run history.'))
    assert.equal(k.one('table'), null)

    allow = true
    await k.click(k.withText('Retry')!)
    for (let i = 0; i < 4; i += 1) await k.tick(5)
    assert.equal(k.one('[role="alert"]'), null)
    assert.ok(k.one('table'))
  })

  it('shows the server\'s own message for any other failure', async () => {
    stub((url) => (url.includes('/signals/research/runs') ? json({ message: 'Database unavailable' }, 500) : json(OPTIONS)))
    const k = await mount()
    assert.ok(k.bodyText().includes('Database unavailable'))
  })

  it('shows an answer it cannot read as an error rather than as an empty list', async () => {
    stub((url) => (url.includes('/signals/research/runs') ? json({ status: 1, data: 'oops' }) : json(OPTIONS)))
    const k = await mount()
    assert.ok(k.bodyText().includes('cannot read'))
    assert.ok(!k.bodyText().includes('No research runs yet'))
  })
})
