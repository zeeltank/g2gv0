import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { ApiError } from '../../services/core'
import type { AgentApi } from '../../services/agent/api-types'
import type { AgentRunsResponse } from '../../services/agent/types'
import { axeViolations } from './a11y'
import { absent, same } from './assertions'
import { fakeAgentService } from './fake-service'
import { dismissed, proposal, run, runsResponse, runSummary, taskApplied } from './fixtures'

interface Setup {
  overrides?: Partial<AgentApi>
  session?: boolean
}

/** Agent Run History in a fake browser, with a signed-in session and the server replaced by a fake. */
async function setup(options: Setup = {}) {
  const k = await kit()
  const { AgentRunsView } = await import('../../components/domain/crm/agent-runs-view')
  if (options.session !== false) k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
  else k.w.localStorage.clear()
  const { service, calls } = fakeAgentService(options.overrides)
  await k.render(k.h(AgentRunsView, { service }))
  await k.tick(10)

  const button = (label: string) => k.all('button').find((b) => b.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined
  const press = async (target: Element | null | undefined) => { assert.ok(target, 'the control exists'); await k.click(target); await k.tick(10) }
  const label = (text: string) => k.all('label').find((l) => l.textContent?.trim() === text)
  const field = <T extends HTMLElement>(text: string) => k.w.document.getElementById(label(text)!.getAttribute('for')!) as T
  const choose = async (text: string, value: string) => {
    const select = field<HTMLSelectElement>(text)
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLSelectElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(select, value); select.dispatchEvent(new k.w.Event('change', { bubbles: true })) })
    await k.tick(10)
  }
  const typeDate = async (text: string, value: string) => {
    const input = field<HTMLInputElement>(text)
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLInputElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(input, value); input.dispatchEvent(new k.w.Event('input', { bubbles: true })) })
    await k.tick(10)
  }
  const rows = () => k.all('tbody tr[data-run]')
  const dialog = () => k.one('[role="dialog"]')
  return { k, service, calls, button, press, label, field, choose, typeDate, rows, dialog }
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const many = (count: number): AgentRunsResponse => runsResponse(
  Array.from({ length: count }, (_, i) => runSummary({ id: 100 - i })),
  { meta: { page: 1, per_page: 20, total: 45, last_page: 3 } },
)

describe('Agent Run History: what it shows', () => {
  afterEach(disposeAll)

  it('says it is opening before the first answer', async () => {
    const { k } = await setup({ overrides: { runs: () => new Promise(() => undefined) } })
    assert.ok(k.bodyText().includes('Opening the run history…'))
  })

  it('lists the runs the server answered with, newest first, with the organisation, the status in words, the proposals, the model and the cost', async () => {
    const { k, rows, calls } = await setup()
    assert.equal(k.one('h1')!.textContent, 'Agent run history')
    assert.equal(rows().length, 2)
    const first = rows()[0].textContent!
    assert.ok(first.includes('#10'))
    assert.ok(first.includes('Hillcrest Academy'))
    assert.ok(first.includes('Completed'))
    assert.ok(first.includes('1 applied, 2 waiting'))
    assert.ok(first.includes('deepseek-flash'))
    assert.ok(first.includes('₹0.075'))
    assert.ok(first.includes('Run agent button · for Anil Shah'))
    assert.ok(first.includes('9 s'))
    const second = rows()[1].textContent!
    assert.ok(second.includes('Unavailable'))
    assert.ok(second.includes('No AI model is set up for your organisation'))
    assert.ok(second.includes('Cost unknown'), 'a run with no known cost says so, never 0')
    assert.deepEqual(calls.runs, [{ page: 1, per_page: 20 }])
  })

  it('shows the totals the server counted, not totals of its own', async () => {
    const { k } = await setup({ overrides: { runs: async () => runsResponse(undefined, { summary: { total: 57, completed: 40, failed: 6, unavailable: 10, running: 1, proposals_pending: 8, actions_applied: 23 } }) } })
    const stat = (name: string) => k.one(`[data-stat="${name}"]`)!.textContent
    assert.deepEqual(['total', 'completed', 'waiting', 'applied'].map(stat), ['57', '40', '8', '23'])
    assert.ok(k.bodyText().includes('71% of the runs that finished'))
    assert.ok(k.bodyText().includes('6 failed, 10 unavailable'))
  })

  it('shows none of the demonstration data this screen used to show', async () => {
    const { k } = await setup()
    for (const old of ['Apex Consortium', 'Greenfield Academy Network', 'Deal Coach', 'Outreach Agent', 'Signal Classifier', 'Prospecting', '100%', 'Run Deal Coach', 'MEDDPICC', '1.8s']) {
      assert.equal(k.bodyText().includes(old), false, `no "${old}"`)
    }
  })

  it('shows an organisation with no run as an empty list with a way forward, not as demonstration rows', async () => {
    const { k, rows } = await setup({ overrides: { runs: async () => runsResponse([], { summary: { total: 0, completed: 0, failed: 0, unavailable: 0, running: 0, proposals_pending: 0, actions_applied: 0 } }) } })
    assert.equal(rows().length, 0)
    assert.ok(k.bodyText().includes('No agent runs yet'))
    assert.ok(k.bodyText().includes('press Run agent'))
    assert.ok(k.bodyText().includes('None has finished yet'))
  })

  it('says whose clock the days are counted on, and that the times shown are the person\'s own', async () => {
    const { k } = await setup()
    assert.ok(k.bodyText().includes('Days are counted on the server’s clock (UTC); the times in the list are shown in your own time zone.'))
  })

  it('does not look anything up without a session', async () => {
    const { k, calls } = await setup({ session: false })
    assert.ok(k.bodyText().includes('Your ERP session is unavailable. Please sign in again.'))
    assert.deepEqual(calls.runs, [])
  })

  it('shows an error with Retry, and Retry reads the list again', async () => {
    let attempts = 0
    const { k, rows, button, press } = await setup({ overrides: { runs: async () => { attempts += 1; if (attempts === 1) throw new ApiError('The server is busy.', 503); return runsResponse() } } })
    assert.ok(k.bodyText().includes('The run history could not be opened.'))
    assert.ok(k.bodyText().includes('The server is busy.'))
    await press(button('Retry'))
    assert.equal(attempts, 2)
    assert.equal(rows().length, 2)
  })

  it('says plainly there is no access on a 403, with no Retry', async () => {
    const { k, button } = await setup({ overrides: { runs: async () => { throw new ApiError('Your role does not have access to this screen.', 403) } } })
    assert.ok(k.bodyText().includes('You do not have access to the agent.'))
    absent(button('Retry'), 'there is no Retry button')
  })
})

describe('Agent Run History: filtering and paging', () => {
  afterEach(disposeAll)

  it('asks for one status when it is chosen, and clears it again', async () => {
    const { k, calls, choose, button, press } = await setup()
    await choose('Status', 'failed')
    assert.deepEqual(calls.runs[1], { page: 1, per_page: 20, status: 'failed' })
    assert.ok(k.bodyText().includes('Clear filters'))
    await press(button('Clear filters'))
    assert.deepEqual(calls.runs[2], { page: 1, per_page: 20 })
  })

  it('asks for the days a run started within, and says so when the end is before the start, without asking', async () => {
    const { k, calls, typeDate } = await setup()
    await typeDate('Started from', '2026-11-01')
    await typeDate('Started until', '2026-11-03')
    assert.deepEqual(calls.runs.at(-1), { page: 1, per_page: 20, date_from: '2026-11-01', date_to: '2026-11-03' })

    const before = calls.runs.length
    await typeDate('Started from', '2026-11-09')
    assert.ok(k.bodyText().includes('The end date is before the start date.'))
    assert.equal(calls.runs.length, before, 'nothing was asked for a range that cannot be right')
  })

  it('goes back to the first page when a filter changes', async () => {
    const { calls, choose, press, button } = await setup({ overrides: { runs: async (params) => ({ ...many(20), meta: { page: params.page ?? 1, per_page: 20, total: 45, last_page: 3 } }) } })
    await press(button('Next'))
    assert.equal(calls.runs.at(-1)!.page, 2)
    await choose('Status', 'completed')
    assert.equal(calls.runs.at(-1)!.page, 1)
  })

  it('pages through the runs and disables Previous on the first page and Next on the last', async () => {
    const { k, calls, press, button } = await setup({ overrides: { runs: async (params) => ({ ...many(20), meta: { page: params.page ?? 1, per_page: 20, total: 45, last_page: 3 } }) } })
    assert.ok(k.bodyText().includes('Page 1 of 3 (45 runs)'))
    assert.equal(button('Previous')?.disabled, true)
    await press(button('Next'))
    assert.deepEqual(calls.runs.at(-1), { page: 2, per_page: 20 })
    assert.equal(button('Previous')?.disabled, false)
    await press(button('Next'))
    assert.equal(button('Next')?.disabled, true)
    await press(button('Previous'))
    assert.deepEqual(calls.runs.at(-1), { page: 2, per_page: 20 })
  })

  it('says no run matches when a filter finds nothing, with a way to clear it', async () => {
    const { k, button, press, choose } = await setup({ overrides: { runs: async (params) => (params.status ? runsResponse([]) : runsResponse()) } })
    await choose('Status', 'failed')
    assert.ok(k.bodyText().includes('No runs match these filters'))
    await press(button('Clear filters'))
    assert.ok(k.bodyText().length > 0)
    assert.equal(k.all('tbody tr[data-run]').length, 2)
  })

  it('shows only the answer for the filter that is chosen when a slower answer for the one before arrives late', async () => {
    const first = deferred<AgentRunsResponse>()
    const second = deferred<AgentRunsResponse>()
    const queue = [Promise.resolve(runsResponse()), first.promise, second.promise]
    const { k, choose, rows } = await setup({ overrides: { runs: () => queue.shift()! } })

    await choose('Status', 'failed')
    await choose('Status', 'completed')
    second.resolve(runsResponse([runSummary({ id: 22, subject: { type: 'org_account', id: 1, name: 'ANSWER FOR COMPLETED' } })]))
    await k.tick(10)
    first.resolve(runsResponse([runSummary({ id: 11, subject: { type: 'org_account', id: 1, name: 'ANSWER FOR FAILED' } })]))
    await k.tick(10)

    assert.deepEqual(rows().map((r) => r.getAttribute('data-run')), ['22'])
    assert.equal(k.bodyText().includes('ANSWER FOR FAILED'), false)
  })

  it('refreshes on request', async () => {
    const { calls, button, press } = await setup()
    await press(button('Refresh'))
    assert.equal(calls.runs.length, 2)
  })
})

describe('Agent Run History: one run', () => {
  afterEach(disposeAll)

  it('opens the run in a dialog with its brief, its proposals, what the agent did itself marked Agent, and its audit trail including what was refused', async () => {
    const detail = run({ proposals: [taskApplied(), proposal(), dismissed()] })
    const { k, calls, press, dialog } = await setup({ overrides: { runDetail: async () => ({ status: 1, data: detail }) } })

    await press(k.one('[data-run="10"] button')!)

    assert.deepEqual(calls.runDetail, [10])
    const d = dialog()!
    assert.ok(d.textContent!.includes('Agent run #10'))
    assert.ok(d.textContent!.includes('Hillcrest is opening a new campus and has an open deal with no next step.'))
    assert.ok(d.textContent!.includes('Proposals (3)'))
    assert.equal(d.querySelectorAll('[data-agent-mark]').length, 1, 'only the task the agent did itself is marked')
    assert.ok(d.textContent!.includes('Applied by the agent'))
    assert.ok(d.textContent!.includes('Waiting for you'))
    assert.ok(d.textContent!.includes('Cost₹0.075') || d.textContent!.includes('₹0.075'))
    assert.ok(d.textContent!.includes('deepseek / deepseek-flash'))
    assert.ok(d.textContent!.includes('1,232 in · 343 out'))
    assert.ok(d.textContent!.includes('Audit trail (5 steps)'))
    assert.ok(d.textContent!.includes('“send_email” (not an action that exists)'))
    assert.ok(d.textContent!.includes('Not an action the agent has.'))
    assert.ok(d.textContent!.includes('wrote task_management_calendar_events:470'))
    assert.ok(d.textContent!.includes('Proposals that are waiting are accepted or dismissed on the organisation’s own page.'))
  })

  it('says why a run that did not complete did not, and that it kept no brief', async () => {
    const detail = run({ status: 'unavailable', message: 'No AI model is set up for your organisation, so the agent cannot run.', brief: null, brief_evidence: [], proposals: [], trace: [] })
    const { k, press, dialog } = await setup({ overrides: { runDetail: async () => ({ status: 1, data: detail }) } })
    await press(k.one('[data-run="10"] button')!)
    assert.ok(dialog()!.textContent!.includes('No AI model is set up for your organisation, so the agent cannot run.'))
    assert.ok(dialog()!.textContent!.includes('No brief was kept for this run.'))
    assert.ok(dialog()!.textContent!.includes('The agent proposed nothing in this run.'))
  })

  it('shows a loading state, then an error with Retry that opens the run', async () => {
    let attempts = 0
    const { k, press, dialog, button } = await setup({ overrides: { runDetail: async () => { attempts += 1; if (attempts === 1) throw new ApiError('The server is busy.', 503); return { status: 1, data: run() } } } })
    await press(k.one('[data-run="10"] button')!)
    assert.ok(dialog()!.textContent!.includes('The server is busy.'))
    await press(button('Retry'))
    assert.equal(attempts, 2)
    assert.ok(dialog()!.textContent!.includes('Brief'))
  })

  it('says a run that cannot be found is not found, with no Retry', async () => {
    const { k, press, dialog, button } = await setup({ overrides: { runDetail: async () => { throw new ApiError('Run not found.', 404) } } })
    await press(k.one('[data-run="10"] button')!)
    assert.ok(dialog()!.textContent!.includes('could not be found'))
    absent(button('Retry'), 'there is no Retry button')
  })

  it('closes on Escape and puts the focus back on the button that opened it', async () => {
    const { k, press, dialog } = await setup()
    const opener = k.one('[data-run="10"] button') as HTMLButtonElement
    await press(opener)
    assert.ok(dialog())

    await k.press('Escape')
    await k.tick(20)

    absent(dialog(), 'the dialog is closed')
    same(k.w.document.activeElement, opener, 'the focus is back on the button that opened the run')
  })

  it('shows only the run that is open when a slower answer for another one arrives late', async () => {
    const first = deferred<{ status: 1; data: ReturnType<typeof run> }>()
    const second = deferred<{ status: 1; data: ReturnType<typeof run> }>()
    const queue = [first, second]
    const { k, press, dialog } = await setup({ overrides: { runDetail: () => queue.shift()!.promise } })

    await press(k.one('[data-run="10"] button')!)
    await k.press('Escape')
    await k.tick(20)
    await press(k.one('[data-run="9"] button')!)
    second.resolve({ status: 1, data: run({ id: 9, brief: 'Brief of run NINE.' }) })
    await k.tick(10)
    first.resolve({ status: 1, data: run({ id: 10, brief: 'Brief of run TEN.' }) })
    await k.tick(10)

    assert.ok(dialog()!.textContent!.includes('Brief of run NINE.'))
    assert.equal(dialog()!.textContent!.includes('Brief of run TEN.'), false)
  })

  it('shows what a model wrote as text, never as markup', async () => {
    const evil = '<img src=x onerror="window.__pwned = 1"><script>window.__pwned = 2</script>'
    const { k, press, dialog } = await setup({ overrides: { runDetail: async () => ({ status: 1, data: run({ brief: `Brief ${evil}`, proposals: [proposal({ summary: `Add a note: ${evil}`, reason: `Because ${evil}` })] }) }) } })
    await press(k.one('[data-run="10"] button')!)
    assert.equal(dialog()!.querySelectorAll('img, script').length, 0)
    assert.ok(dialog()!.textContent!.includes(evil))
  })
})

describe('Agent Run History: accessibility', () => {
  afterEach(disposeAll)

  it('has real buttons, labelled filters, a table with a caption and column headers', async () => {
    const { k } = await setup()
    assert.equal(k.all('[role="button"]').length, 0)
    assert.equal(k.all('table caption').length, 1)
    assert.ok(k.all('th[scope="col"]').length >= 6)
    assert.ok(['Status', 'Started from', 'Started until'].every((text) => k.all('label').some((l) => l.textContent?.trim() === text)))
    assert.ok(k.all('tbody button').every((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim().length > 0))
  })

  it('has no accessibility violations in its main states', async () => {
    const states: Array<[string, Setup]> = [
      ['the list', {}],
      ['no runs', { overrides: { runs: async () => runsResponse([]) } }],
      ['could not be opened', { overrides: { runs: async () => { throw new ApiError('busy', 503) } } }],
      ['forbidden', { overrides: { runs: async () => { throw new ApiError('no', 403) } } }],
      ['loading', { overrides: { runs: () => new Promise(() => undefined) } }],
    ]
    for (const [label, options] of states) {
      const { k } = await setup(options)
      const root = k.one('h1')?.closest('div.mx-auto') as HTMLElement | null
      assert.ok(root, `${label}: the screen is on the page`)
      assert.deepEqual(await axeViolations(root), [], label)
      await disposeAll()
    }
  })

  it('has no accessibility violations with a run open', async () => {
    const { k, press, dialog } = await setup()
    await press(k.one('[data-run="10"] button')!)
    assert.ok(dialog()!.textContent!.includes('Audit trail'))
    assert.deepEqual(await axeViolations(dialog()!), [])
  })
})
