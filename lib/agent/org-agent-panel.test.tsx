import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { ApiError } from '../../services/core'
import type { AgentApi } from '../../services/agent/api-types'
import { AgentApiError } from '../../services/agent/errors'
import type { AgentEnvelope, AgentOrgState, AgentRunDetail } from '../../services/agent/types'
import { axeViolations } from './a11y'
import { absent, same } from './assertions'
import { fakeAgentService } from './fake-service'
import { CRM_ORG, dismissed, failed, freshState, linkPending, ORG_ID, orgState, PAIR, proposal, run, SELF, SIGNAL, taskApplied } from './fixtures'

interface Setup {
  props?: Record<string, unknown>
  overrides?: Partial<AgentApi>
  session?: boolean
}

/** The panel on a page in a fake browser, with a signed-in session and the server replaced by a fake. */
async function setup(options: Setup = {}) {
  const k = await kit()
  const { OrgAgentPanel } = await import('../../components/domain/crm/org-agent-panel')
  if (options.session !== false) k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
  else k.w.localStorage.clear()

  const { service, calls } = fakeAgentService(options.overrides)
  const changed: string[] = []
  const props = { orgAccountId: ORG_ID, service, onRecordsChanged: () => changed.push('records'), onOrganisationChanged: (id: number) => changed.push(`organisation:${id}`), ...options.props }
  await k.render(k.h(OrgAgentPanel, props))
  await k.tick(10)

  const within = (root: Element | null) => ({
    button: (label: string) => Array.from(root?.querySelectorAll('button') ?? []).find((b) => b.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined,
  })
  const button = (label: string) => k.all('button').find((b) => b.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined
  const press = async (target: Element | null | undefined) => { assert.ok(target, 'the control exists'); await k.click(target); await k.tick(10) }
  const notice = () => k.one('[role="status"][tabindex], [role="alert"][tabindex]')
  const card = (id: number) => k.one(`[data-proposal="${id}"]`)
  const focused = () => k.w.document.activeElement
  const type = async (field: HTMLTextAreaElement, text: string) => {
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLTextAreaElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(field, text); field.dispatchEvent(new k.w.Event('input', { bubbles: true })) })
    await k.tick(5)
  }
  return { k, OrgAgentPanel, service, calls, changed, within, button, press, notice, card, focused, type, props }
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

/** The panel's own element, checked to be the panel: an accessibility check on the wrong element would pass without having looked at anything. */
const panelRoot = (k: { one: (selector: string) => HTMLElement | null }): HTMLElement => {
  const root = k.one('section[aria-labelledby]')
  assert.ok(root && root.textContent?.includes('Organisation agent'), 'the panel is on the page')
  return root
}

/** A state() that answers one state per call, the last one for every call after. */
const sequence = (...states: AgentOrgState[]): Partial<AgentApi> => {
  let n = 0
  return { state: async () => ({ status: 1, data: states[Math.min(n++, states.length - 1)] }) }
}

describe('OrgAgentPanel: opening', () => {
  afterEach(disposeAll)

  it('says it is opening before the first answer, and reads the panel of the organisation it was given', async () => {
    const { k, calls } = await setup({ overrides: { state: () => new Promise(() => undefined) } })
    assert.ok(k.bodyText().includes('Opening the agent…'))
    assert.deepEqual(calls.state, [ORG_ID])
    assert.equal(k.one('section[aria-busy="true"]') !== null, true)
  })

  it('shows the brief with its evidence, what waits for the person and what the agent has done', async () => {
    const { k } = await setup()
    assert.equal(k.one('h2')!.textContent, 'Organisation agent')
    assert.ok(k.bodyText().includes('Why now'))
    assert.ok(k.bodyText().includes('Hillcrest is opening a new campus'))
    assert.ok(k.bodyText().includes('Waiting for you (2)'))
    assert.ok(k.bodyText().includes('What the agent has done'))
    assert.ok(k.bodyText().includes('Run #10'))
    assert.ok(k.bodyText().includes('₹0.075'), 'the cost of the last run, in rupees')
    assert.ok(k.bodyText().includes('1,232 in · 343 out'))
    assert.ok(k.bodyText().includes('1 of 10 runs today'))
  })

  it('says what the agent may do alone and what waits for a person', async () => {
    const { k } = await setup()
    assert.ok(k.one('[data-autonomy]')!.textContent!.includes('On its own: add a note, add a follow-up task. Waits for you: confirm a probable link.'))
  })

  it('finds the identity of a CRM organisation when that is all the page knows, then reads that identity\'s panel', async () => {
    const { calls } = await setup({ props: { orgAccountId: undefined, crmOrganizationId: 135 } })
    assert.deepEqual(calls.resolve, ['135'])
    assert.deepEqual(calls.state, [7])
  })

  it('does not look anything up when the identity is given', async () => {
    const { calls } = await setup({ props: { crmOrganizationId: 135 } })
    assert.deepEqual(calls.resolve, [])
  })

  it('says there is no such organisation when a CRM organisation cannot be found, with no retry', async () => {
    const { k, button } = await setup({ props: { orgAccountId: undefined, crmOrganizationId: 135 }, overrides: { resolve: async () => { throw new ApiError('Organisation not found.', 404) } } })
    assert.ok(k.bodyText().includes('This organisation could not be found'))
    absent(button('Retry'), 'there is no Retry button')
    absent(button('Run agent'), 'there is no Run agent button')
  })

  it('asks again when the lookup failed for a reason that may pass, and then opens the panel', async () => {
    let attempts = 0
    const { k, calls, button, press } = await setup({
      props: { orgAccountId: undefined, crmOrganizationId: 135 },
      overrides: { resolve: async () => { attempts += 1; if (attempts === 1) throw new ApiError('The server is busy.', 503); return { status: 1, data: { org_account_id: 7 } } } },
    })
    assert.ok(k.bodyText().includes('The server is busy.'))
    await press(button('Retry'))
    assert.equal(attempts, 2)
    assert.deepEqual(calls.state, [7])
    assert.ok(k.bodyText().includes('Why now'))
  })

  it('shows an error with Retry, and Retry opens the panel', async () => {
    let attempts = 0
    const { k, calls, button, press } = await setup({ overrides: { state: async () => { attempts += 1; if (attempts === 1) throw new ApiError('The server is busy.', 503); return { status: 1, data: orgState() } } } })
    assert.ok(k.bodyText().includes('The agent could not be opened.'))
    assert.ok(k.bodyText().includes('The server is busy.'))
    assert.equal(k.one('[role="alert"]') !== null, true)
    await press(button('Retry'))
    assert.equal(calls.state.length, 2)
    assert.ok(k.bodyText().includes('Why now'))
    assert.ok(!k.bodyText().includes('The server is busy.'))
  })

  it('says plainly there is no access on a 403, with no Retry and nothing to press', async () => {
    const { k, button } = await setup({ overrides: { state: async () => { throw new ApiError('Your role does not have access to this screen.', 403) } } })
    assert.ok(k.bodyText().includes('You do not have access to the agent.'))
    absent(button('Retry'), 'there is no Retry button')
    absent(button('Run agent'), 'there is no Run agent button')
  })

  it('says it could not be found on a 404', async () => {
    const { k } = await setup({ overrides: { state: async () => { throw new ApiError('Organisation not found.', 404) } } })
    assert.ok(k.bodyText().includes('could not be found'))
  })

  it('says the session is unavailable, and calls nothing, when nobody is signed in', async () => {
    const { k, calls } = await setup({ session: false })
    assert.ok(k.bodyText().includes('Your ERP session is unavailable. Please sign in again.'))
    assert.deepEqual(calls.state, [])
  })

  it('shows an organisation the agent has never run on as empty, with a way to start', async () => {
    const { k, button } = await setup({ overrides: { state: async () => ({ status: 1, data: freshState() }) } })
    assert.ok(k.bodyText().includes('The agent has not run on this organisation yet.'))
    assert.equal(k.bodyText().includes('Waiting for you'), false)
    assert.equal(k.bodyText().includes('What the agent has done'), false)
    assert.equal(button('Run agent')?.disabled, false)
  })

  it('shows only the answer for the organisation that is open when a slower answer for the one before arrives late', async () => {
    const first = deferred<AgentEnvelope<AgentOrgState>>()
    const second = deferred<AgentEnvelope<AgentOrgState>>()
    const queue = [first, second]
    const { k, OrgAgentPanel, props } = await setup({ overrides: { state: () => queue.shift()!.promise } })
    await k.render(k.h(OrgAgentPanel, { ...props, orgAccountId: 8 }))
    await k.tick(10)

    second.resolve({ status: 1, data: orgState({ org_account: { id: 8, name: 'Second School', has_crm_organization: true }, last_run: run({ brief: 'Brief of the SECOND school.' }) }) })
    await k.tick(10)
    first.resolve({ status: 1, data: orgState({ org_account: { id: 7, name: 'First School', has_crm_organization: true }, last_run: run({ brief: 'Brief of the FIRST school.' }) }) })
    await k.tick(10)

    assert.ok(k.bodyText().includes('Brief of the SECOND school.'))
    assert.equal(k.bodyText().includes('Brief of the FIRST school.'), false, 'the late answer was dropped')
  })
})

describe('OrgAgentPanel: when the page moves on to another organisation', () => {
  afterEach(disposeAll)

  it('starts clean: a message, an open reason form and a typed reason belong to the organisation before', async () => {
    const { k, OrgAgentPanel, props, button, press, within, card, type, notice } = await setup()
    await press(button('Run agent'))
    assert.ok(notice(), 'a message is showing for the first organisation')
    await press(within(card(1)).button('Dismiss'))
    await type(k.one('textarea') as HTMLTextAreaElement, 'half a reason')

    await k.render(k.h(OrgAgentPanel, { ...props, orgAccountId: 8 }))
    await k.tick(15)

    absent(notice(), 'no message is showing')
    absent(k.one('textarea'), 'the reason form is closed')
    assert.equal(k.bodyText().includes('half a reason'), false)
  })

  it('lets a late answer for the organisation before change nothing on the one that is open', async () => {
    const gate = deferred<AgentEnvelope<AgentRunDetail>>()
    const { k, OrgAgentPanel, props, calls, changed, button, press, notice } = await setup({ overrides: { run: () => gate.promise } })
    await press(button('Run agent'))
    await k.render(k.h(OrgAgentPanel, { ...props, orgAccountId: 8 }))
    await k.tick(15)
    const reads = calls.state.length

    gate.resolve({ status: 1, data: run({ proposal_counts: { pending: 0, applied: 2, dismissed: 0, failed: 0 } }) })
    await k.tick(15)

    absent(notice(), 'the first organisation\'s result is not announced on the second')
    assert.equal(calls.state.length, reads, 'and the second organisation is not read again for it')
    assert.deepEqual(changed, [], 'nor is the page told that something changed')
  })
})

describe('OrgAgentPanel: who may run it, and whether it can be run now', () => {
  afterEach(disposeAll)

  it('shows a person who may only read the work, and says what they need to run it', async () => {
    const { k, button } = await setup({ overrides: { state: async () => ({ status: 1, data: orgState({ can: { run: false, decide: false } }) }) } })
    assert.equal(button('Run agent')?.disabled, true)
    assert.ok(k.bodyText().includes('needs the edit right on Organizations'))
    absent(button('Accept'), 'no Accept for a person who may not decide')
    absent(button('Dismiss'), 'there is no Dismiss button')
    assert.ok(k.bodyText().includes('Waiting for you (2)'), 'but they can read what is waiting')
  })

  it('shows why a run is not possible beside the disabled button, in text, and ties the two together', async () => {
    const reason = 'The model "deepseek-flash" has no price set, so the agent will not run it: its cost could not be shown.'
    const { k, button } = await setup({ overrides: { state: async () => ({ status: 1, data: orgState({ agent: { ...orgState().agent, unavailable_reason: reason } }) }) } })
    const run = button('Run agent')!
    assert.equal(run.disabled, true)
    const described = k.w.document.getElementById(run.getAttribute('aria-describedby')!)
    assert.equal(described?.textContent, reason)
  })

  it('says the agent is switched off when the organisation\'s kill switch is on', async () => {
    const { k, button } = await setup({ overrides: { state: async () => ({ status: 1, data: orgState({ agent: { ...orgState().agent, enabled: false, unavailable_reason: 'The agent is switched off for your organisation.', autonomy: { add_note: 'off', add_task: 'off', confirm_link: 'off' } } }) }) } })
    assert.equal(button('Run agent')?.disabled, true)
    assert.ok(k.bodyText().includes('The agent is switched off for your organisation.'))
    assert.ok(k.one('[data-autonomy]')!.textContent!.includes('Switched off: add a note, add a follow-up task, confirm a probable link.'))
  })

  it('disables the button when the day\'s cap is spent and says how many runs it has had', async () => {
    const { k, button } = await setup({ overrides: { state: async () => ({ status: 1, data: orgState({ agent: { ...orgState().agent, runs_today: 10, daily_cap: 10 } }) }) } })
    assert.equal(button('Run agent')?.disabled, true)
    assert.ok(k.bodyText().includes('has already run 10 times today'))
    assert.ok(k.bodyText().includes('10 of 10 runs today'))
  })
})

describe('OrgAgentPanel: running the agent', () => {
  afterEach(disposeAll)

  it('says the agent is working, disables everything, and ignores a second press, until the run is over', async () => {
    const gate = deferred<AgentEnvelope<AgentRunDetail>>()
    const { k, calls, button, press } = await setup({ overrides: { run: () => gate.promise } })

    await press(button('Run agent'))
    assert.equal(calls.run.length, 1)
    const busy = button('Running…')!
    assert.equal(busy.disabled, true)
    assert.equal(busy.getAttribute('aria-busy'), 'true')
    assert.ok(k.one('p.sr-only[role="status"]')!.textContent!.includes('The agent is reading this organisation'), 'a screen reader is told')
    assert.equal(k.all('button').filter((b) => /^(Accept|Dismiss)/.test(b.textContent?.trim() ?? '')).every((b) => (b as HTMLButtonElement).disabled), true, 'no decision can be made while it works')

    await press(busy)
    assert.equal(calls.run.length, 1, 'a second press changed nothing')

    gate.resolve({ status: 1, data: run() })
    await k.tick(10)
    assert.equal(button('Run agent')?.disabled, false)
  })

  it('says what the agent did alone and what it left, reads the panel again and moves the focus to the message', async () => {
    const { k, calls, changed, button, press, notice, focused } = await setup({ overrides: { run: async () => ({ status: 1, data: run({ proposal_counts: { pending: 2, applied: 1, dismissed: 0, failed: 0 } }) }) } })

    await press(button('Run agent'))

    assert.equal(notice()!.textContent!.includes('The agent finished. It did 1 thing on its own and left 2 proposals for you.'), true)
    assert.equal(notice()!.getAttribute('role'), 'status')
    assert.equal(calls.state.length, 2, 'the panel was read again')
    same(focused(), notice(), 'the focus is on the message, not lost')
    assert.deepEqual(changed, ['records'], 'the page is told that something it shows has changed')
    assert.ok(k.bodyText().length > 0)
  })

  it('does not tell the page anything changed when the agent did nothing on its own', async () => {
    const { changed, button, press } = await setup({ overrides: { run: async () => ({ status: 1, data: run({ proposal_counts: { pending: 2, applied: 0, dismissed: 0, failed: 0 } }) }) } })
    await press(button('Run agent'))
    assert.deepEqual(changed, [])
  })

  it('says why a run that could not be made was not made, as an alert', async () => {
    const message = 'No AI model is set up for your organisation, so the agent cannot run. An administrator can add one under AI & Intelligence.'
    const { button, press, notice } = await setup({ overrides: { run: async () => ({ status: 1, data: run({ status: 'unavailable', message, brief: null, brief_evidence: [], proposals: [], proposal_counts: { pending: 0, applied: 0, dismissed: 0, failed: 0 } }) }) } })
    await press(button('Run agent'))
    assert.equal(notice()!.textContent!.includes(message), true)
    assert.equal(notice()!.getAttribute('role'), 'alert')
  })

  it('says a failed run failed, with the server\'s sentence', async () => {
    const { button, press, notice } = await setup({ overrides: { run: async () => ({ status: 1, data: run({ status: 'failed', message: 'The model could not be reached or did not answer. Try again in a moment.' }) }) } })
    await press(button('Run agent'))
    assert.equal(notice()!.textContent!.includes('The model could not be reached or did not answer.'), true)
    assert.equal(notice()!.getAttribute('role'), 'alert')
  })

  it('says a refusal before a run in the server\'s words and reads the counts again, so the button reflects the cap', async () => {
    const cause = new AgentApiError('The agent has already run 10 times today on this organisation. Try again tomorrow.', 429, undefined, undefined, 'daily_cap', null)
    const { k, calls, button, press, notice } = await setup({
      overrides: { run: async () => { throw cause }, ...sequence(orgState(), orgState({ agent: { ...orgState().agent, runs_today: 10 } })) },
    })
    await press(button('Run agent'))
    assert.equal(notice()!.textContent!.includes('has already run 10 times today'), true)
    assert.equal(calls.state.length, 2)
    assert.equal(button('Run agent')?.disabled, true)
    assert.ok(k.bodyText().includes('10 of 10 runs today'))
  })

  it('says a 403 in words and a lost connection in words', async () => {
    const first = await setup({ overrides: { run: async () => { throw new ApiError('This action is unauthorized.', 403) } } })
    await first.press(first.button('Run agent'))
    assert.ok(first.notice()!.textContent!.includes('needs the edit right on Organizations'))
    await disposeAll()

    const second = await setup({ overrides: { run: async () => { throw new TypeError('Failed to fetch') } } })
    await second.press(second.button('Run agent'))
    assert.ok(second.notice()!.textContent!.includes('The request did not reach the server.'))
    assert.equal(second.button('Run agent')?.disabled, false, 'it can be tried again')
  })

  it('lets the message be closed', async () => {
    const { button, press, notice } = await setup()
    await press(button('Run agent'))
    assert.ok(notice())
    await press(button('Close message'))
    absent(notice(), 'no message is showing')
  })
})

describe('OrgAgentPanel: accepting a proposal', () => {
  afterEach(disposeAll)

  it('accepts that one proposal, reads the panel again, says what was done, moves the focus to the message and tells the page', async () => {
    const after = orgState({ pending: [linkPending()], recent: [proposal({ status: 'applied', applied_via: 'user', decided_by_name: 'Anil Shah', summary: 'Add a note: Hiring a principal for the new campus.' }), taskApplied()] })
    const { k, calls, changed, within, card, press, notice, focused } = await setup({ overrides: sequence(orgState(), after) })

    await press(within(card(1)).button('Accept: add the note'))

    assert.deepEqual(calls.accept, [1])
    assert.equal(notice()!.textContent!.includes('The note was added to the organisation.'), true)
    same(focused(), notice(), 'the focus is on the message')
    absent(card(1), 'it is no longer waiting')
    assert.ok(k.bodyText().includes('Waiting for you (1)'))
    assert.ok(k.bodyText().includes('Applied after Anil Shah accepted it'))
    assert.deepEqual(changed, ['records'])
  })

  it('disables every button while it is being applied, and no second accept goes out', async () => {
    const gate = deferred<import('../../services/agent/types').AgentDecisionResult>()
    const { k, calls, within, card, press } = await setup({ overrides: { accept: () => gate.promise } })

    await press(within(card(1)).button('Accept: add the note'))
    assert.equal(k.all('button').filter((b) => /^(Accept|Dismiss|Run)/.test(b.textContent?.trim() ?? '')).every((b) => (b as HTMLButtonElement).disabled), true)
    await press(within(card(1)).button('Accept: add the note'))
    await press(within(card(3)).button('Accept: link the records'))
    assert.deepEqual(calls.accept, [1])

    gate.resolve({ status: 1, data: { outcome: 'applied', proposal: proposal({ status: 'applied' }) } })
    await k.tick(10)
  })

  it('says what became of a proposal that could not be applied, reads the panel again to show it, and does not tell the page', async () => {
    const reasonText = 'Both organisations already have a record from the same source, so they cannot be one.'
    const after = orgState({ pending: [proposal()], recent: [failed({ error: reasonText })] })
    const { k, calls, changed, within, card, press, notice } = await setup({
      overrides: { accept: async () => { throw new AgentApiError(reasonText, 409, undefined, undefined, 'could_not_apply', failed({ error: reasonText })) }, ...sequence(orgState(), after) },
    })

    await press(within(card(3)).button('Accept: link the records'))

    assert.equal(notice()!.getAttribute('role'), 'alert')
    assert.equal(notice()!.textContent!.includes(reasonText), true)
    assert.equal(calls.state.length, 2)
    assert.ok(k.bodyText().includes('Could not be applied'))
    assert.deepEqual(changed, [])
  })

  it('reads the panel again after ANY refusal, so it shows the truth (here: the action was switched off meanwhile)', async () => {
    const switchedOff = new AgentApiError('This kind of action is switched off for your organisation.', 409, undefined, undefined, 'policy_off', null)
    const after = orgState({ agent: { ...orgState().agent, autonomy: { add_note: 'off', add_task: 'alone', confirm_link: 'approval' } } })
    const { k, calls, within, card, press, notice } = await setup({ overrides: { accept: async () => { throw switchedOff }, ...sequence(orgState(), after) } })

    await press(within(card(1)).button('Accept: add the note'))

    assert.equal(notice()!.textContent!.includes('This kind of action is switched off for your organisation.'), true)
    assert.equal(calls.state.length, 2)
    assert.ok(k.one('[data-autonomy]')!.textContent!.includes('Switched off: add a note.'))
  })

  it('says "already applied" when somebody else got there first', async () => {
    const { within, card, press, notice } = await setup({ overrides: { accept: async () => ({ status: 1, data: { outcome: 'already_applied', proposal: proposal({ status: 'applied' }) } }) } })
    await press(within(card(1)).button('Accept: add the note'))
    assert.equal(notice()!.textContent!.includes('This had already been applied.'), true)
  })

  it('says a link merged this record into another one, tells the page which, and does not read the removed record again', async () => {
    const merged = { status: 1 as const, data: { outcome: 'applied' as const, proposal: linkPending({ status: 'applied', applied_via: 'user', result_ref: 'g2g_org_accounts:3' }) } }
    const { calls, changed, within, card, press, notice } = await setup({ overrides: { accept: async () => merged } })

    await press(within(card(3)).button('Accept: link the records'))

    assert.equal(notice()!.textContent!.includes('now part of another one'), true)
    assert.deepEqual(changed, ['organisation:3', 'records'])
    assert.equal(calls.state.length, 1, 'this identity is gone: reading it again would only say not found')
  })

  it('does not say the identity changed when the link kept this one', async () => {
    const kept = { status: 1 as const, data: { outcome: 'applied' as const, proposal: linkPending({ status: 'applied', applied_via: 'user', result_ref: `g2g_org_accounts:${ORG_ID}` }) } }
    const { calls, changed, within, card, press, notice } = await setup({ overrides: { accept: async () => kept } })
    await press(within(card(3)).button('Accept: link the records'))
    assert.equal(notice()!.textContent!.includes('The records were linked as one organisation.'), true)
    assert.deepEqual(changed, ['records'])
    assert.equal(calls.state.length, 2)
  })
})

describe('OrgAgentPanel: dismissing a proposal', () => {
  afterEach(disposeAll)

  it('opens a small form with the focus in it, and the Dismiss button says it is expanded', async () => {
    const { k, within, card, press, focused } = await setup()
    const dismiss = within(card(1)).button('Dismiss')!
    assert.equal(dismiss.getAttribute('aria-expanded'), 'false')

    await press(dismiss)

    const field = k.one('textarea') as HTMLTextAreaElement
    assert.ok(field)
    same(focused(), field, 'the focus is in the reason field')
    assert.equal(dismiss.getAttribute('aria-expanded'), 'true')
    assert.equal(k.w.document.getElementById(dismiss.getAttribute('aria-controls')!)?.tagName, 'FORM')
    assert.equal(k.w.document.querySelector(`label[for="${field.id}"]`)?.textContent, 'Why are you dismissing this? (optional)')
    assert.equal(field.maxLength, 500)
  })

  it('sends the reason, reads the panel again, says it will not be suggested again and moves the focus to the message', async () => {
    const after = orgState({ pending: [linkPending()], recent: [taskApplied(), dismissed({ summary: 'Add a note: Hiring a principal for the new campus.' })] })
    const { k, calls, within, card, press, notice, focused, type } = await setup({ overrides: sequence(orgState(), after) })

    await press(within(card(1)).button('Dismiss'))
    await type(k.one('textarea') as HTMLTextAreaElement, 'We already know this.')
    assert.ok(k.bodyText().includes('21 of 500 characters.'))
    await press(within(card(1)).button('Dismiss this proposal'))

    assert.deepEqual(calls.dismiss, [{ id: 1, reason: 'We already know this.' }])
    assert.equal(notice()!.textContent!.includes('Dismissed. The agent will not suggest this again.'), true)
    same(focused(), notice(), 'the focus is on the message')
    absent(k.one('textarea'), 'the form is closed')
    absent(card(1), 'the proposal is no longer waiting')
  })

  it('dismisses without a reason when none is given', async () => {
    const { calls, within, card, press } = await setup()
    await press(within(card(1)).button('Dismiss'))
    await press(within(card(1)).button('Dismiss this proposal'))
    assert.deepEqual(calls.dismiss, [{ id: 1, reason: '' }])
  })

  it('closes the form on Escape and puts the focus back on the Dismiss button that opened it, sending nothing', async () => {
    const { k, calls, within, card, press, focused } = await setup()
    const dismiss = within(card(1)).button('Dismiss')!
    await press(dismiss)

    await k.press('Escape', k.one('textarea')!)
    await k.tick(10)

    absent(k.one('textarea'), 'the reason form is closed')
    same(focused(), dismiss, 'the focus is back on the Dismiss button that opened the form')
    assert.deepEqual(calls.dismiss, [])
  })

  it('closes the form with "Keep it" and keeps the proposal waiting', async () => {
    const { k, calls, within, card, press, focused } = await setup()
    const dismiss = within(card(1)).button('Dismiss')!
    await press(dismiss)
    await press(within(card(1)).button('Keep it'))
    absent(k.one('textarea'), 'the reason form is closed')
    same(focused(), dismiss, 'the focus is back on the Dismiss button that opened the form')
    assert.ok(card(1))
    assert.deepEqual(calls.dismiss, [])
  })

  it('has only one form open at a time, and an empty one when it is opened again', async () => {
    const { k, within, card, press, type } = await setup()
    await press(within(card(1)).button('Dismiss'))
    await type(k.one('textarea') as HTMLTextAreaElement, 'first reason')
    await press(within(card(3)).button('Dismiss'))
    assert.equal(k.all('textarea').length, 1)
    assert.equal((k.one('textarea') as HTMLTextAreaElement).value, '', 'the reason typed for the other proposal did not follow')
    assert.ok(within(card(3)).button('Dismiss this proposal'))
    absent(within(card(1)).button('Dismiss this proposal'), 'no form on the other proposal')
  })

  it('says why a dismissal was refused, as an alert, and reads the panel again when the server says what became of the proposal', async () => {
    const { k, calls, within, card, press, notice } = await setup({
      overrides: { dismiss: async () => { throw new AgentApiError('This proposal was already applied.', 409, undefined, undefined, 'already_decided', proposal({ status: 'applied' })) }, ...sequence(orgState(), orgState({ pending: [linkPending()] })) },
    })
    await press(within(card(1)).button('Dismiss'))
    await press(within(card(1)).button('Dismiss this proposal'))
    assert.equal(notice()!.getAttribute('role'), 'alert')
    assert.equal(notice()!.textContent!.includes('This proposal was already applied.'), true)
    assert.equal(calls.state.length, 2)
    absent(k.one('textarea'), 'the reason form is closed')
  })
})

describe('OrgAgentPanel: what a person is shown', () => {
  afterEach(disposeAll)

  it('marks what the agent did itself with "Agent", and what a person decided or what failed with words', async () => {
    const { k } = await setup({ overrides: { state: async () => ({ status: 1, data: orgState({ pending: [], recent: [taskApplied(), dismissed(), failed()] }) }) } })
    const item = (id: number) => k.one(`[data-activity="${id}"]`)!

    assert.equal(item(2).getAttribute('data-by-agent'), 'true')
    assert.equal(item(2).querySelector('[data-agent-mark]')?.textContent, 'Agent')
    assert.ok(item(2).textContent!.includes('Applied by the agent'))
    assert.equal(item(4).getAttribute('data-by-agent'), 'false')
    absent(item(4).querySelector('[data-agent-mark]'), 'a dismissed item is not marked Agent')
    assert.ok(item(4).textContent!.includes('Dismissed'))
    assert.ok(item(4).textContent!.includes('Reason given: Already knew this'))
    assert.ok(item(5).textContent!.includes('Could not be applied'))
    assert.ok(item(5).textContent!.includes('Why not: Both organisations already have a record from the same source'))
  })

  it('never shows a state as colour only: every state is a word, and so is the waiting one', async () => {
    const { k } = await setup()
    const pills = k.all('[data-tone]').map((el) => el.textContent!.trim())
    assert.ok(pills.length >= 4)
    assert.equal(pills.every((text) => text.length > 3), true, 'every state pill has words in it')
    assert.ok(pills.includes('Waiting for you'))
    assert.ok(pills.includes('Applied by the agent'))
  })

  it('shows what the last run was when it did not complete, instead of an empty brief', async () => {
    const message = 'No AI model is set up for your organisation, so the agent cannot run.'
    const { k } = await setup({ overrides: { state: async () => ({ status: 1, data: orgState({ pending: [], recent: [], last_run: run({ status: 'unavailable', brief: null, brief_evidence: [], message, proposals: [] }) }) }) } })
    assert.ok(k.bodyText().includes(message))
    assert.ok(k.bodyText().includes('Unavailable'))
  })

  it('shows a cost that is not known as unknown, never as zero', async () => {
    const { k } = await setup({ overrides: { state: async () => ({ status: 1, data: orgState({ last_run: run({ cost: null, cost_currency: null }) }) }) } })
    assert.ok(k.bodyText().includes('Cost unknown'))
    assert.equal(k.bodyText().includes('₹0.00'), false)
  })

  it('lists the first few finished things and shows all of them on request', async () => {
    const many = Array.from({ length: 6 }, (_, i) => dismissed({ id: 100 + i, summary: `Add a note: item ${i}` }))
    const { k, button, press } = await setup({ overrides: { state: async () => ({ status: 1, data: orgState({ pending: [], recent: many }) }) } })
    assert.equal(k.all('[data-activity]').length, 4)
    const more = button('Show all 6')!
    assert.equal(more.getAttribute('aria-expanded'), 'false')
    await press(more)
    assert.equal(k.all('[data-activity]').length, 6)
    assert.equal(button('Show fewer')?.getAttribute('aria-expanded'), 'true')
  })

  it('links a record inside the application and shows the organisation itself and a possible link as text', async () => {
    const { k, card } = await setup({ overrides: { state: async () => ({ status: 1, data: orgState({ pending: [proposal({ evidence: [SIGNAL, CRM_ORG, SELF, PAIR] })], recent: [] }) }) } })
    const links = Array.from(card(1)!.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    assert.deepEqual(links, ['/module/crm/signal-review?status=all&q=Hillcrest', '/module/crm/marketing/organizations/135'])
    assert.ok(card(1)!.textContent!.includes('This organisation: Hillcrest Academy'))
    assert.ok(card(1)!.textContent!.includes('Possible link: Possible link: Hillcrest Academy Pvt'))
    assert.ok(k.bodyText().length > 0)
  })
})

describe('OrgAgentPanel: what a model wrote is text, never markup and never a link', () => {
  afterEach(disposeAll)

  it('shows markup in a brief, a note, a reason and a label as the characters it is made of', async () => {
    const evil = '<img src=x onerror="window.__pwned = 1"><script>window.__pwned = 2</script><b>bold</b>'
    const state = orgState({
      last_run: run({ brief: `Brief ${evil}`, brief_evidence: [{ type: 'signal', id: '1', label: `Label ${evil}`, url: '/module/crm/signal-review' }] }),
      pending: [proposal({ summary: `Add a note: ${evil}`, reason: `Because ${evil}`, evidence: [{ type: 'signal', id: '1', label: `Cited ${evil}`, url: '/x' }] })], recent: [dismissed({ decision_note: `Note ${evil}` })],
    })
    const { k } = await setup({ overrides: { state: async () => ({ status: 1, data: state }) } })

    const panel = k.one('[data-agent-panel]')!
    assert.equal(panel.querySelectorAll('img, script, b').length, 0, 'no element was made from the text')
    assert.ok(panel.textContent!.includes(evil), 'the characters are all there')
    assert.equal((k.w as unknown as { __pwned?: number }).__pwned, undefined)
  })

  it('never makes a link from an address that is not a path inside the application', async () => {
    const refs = ['javascript:alert(1)', 'https://evil.example/x', '//evil.example', 'data:text/html,x'].map((url, i) => ({ type: 'signal', id: String(i), label: `Evil ${i}`, url }))
    const { k } = await setup({ overrides: { state: async () => ({ status: 1, data: orgState({ last_run: run({ brief_evidence: refs }), pending: [proposal({ evidence: refs })], recent: [] }) }) } })
    assert.deepEqual(k.all('[data-agent-panel] a').map((a) => a.getAttribute('href')), [])
    assert.ok(k.bodyText().includes('Evil 0'), 'the label is still shown, as text')
  })

  it('keeps line breaks of a brief and does not turn them into markup', async () => {
    const { k } = await setup({ overrides: { state: async () => ({ status: 1, data: orgState({ last_run: run({ brief: 'Line one.\nLine two.' }) }) }) } })
    const brief = Array.from(k.all('[data-last-run] p')).find((p) => p.textContent === 'Line one.\nLine two.')
    assert.ok(brief, 'one paragraph with the break kept in its text')
    assert.ok(brief.className.includes('whitespace-pre-line'))
  })
})

describe('OrgAgentPanel: it can be used and understood without a mouse or without colour', () => {
  afterEach(disposeAll)

  it('uses real buttons for everything that can be pressed, and a heading and a labelled region', async () => {
    const { k } = await setup()
    assert.equal(k.all('[role="button"]').length, 0)
    assert.ok(k.all('button').length >= 5)
    const section = k.one('section[aria-labelledby]')!
    assert.equal(k.w.document.getElementById(section.getAttribute('aria-labelledby')!)?.textContent, 'Organisation agent')
  })

  it('has no accessibility violations in its main states', async () => {
    const states: Array<[string, Setup]> = [
      ['ready with waiting proposals', {}],
      ['never run', { overrides: { state: async () => ({ status: 1, data: freshState() }) } }],
      ['not allowed to run', { overrides: { state: async () => ({ status: 1, data: orgState({ can: { run: false, decide: false }, agent: { ...orgState().agent, unavailable_reason: 'No AI model is set up.' } }) }) } }],
      ['loading', { overrides: { state: () => new Promise(() => undefined) } }],
      ['could not be opened', { overrides: { state: async () => { throw new ApiError('The server is busy.', 503) } } }],
      ['forbidden', { overrides: { state: async () => { throw new ApiError('no', 403) } } }],
    ]
    for (const [label, options] of states) {
      const { k } = await setup(options)
      assert.deepEqual(await axeViolations(panelRoot(k)), [], label)
      await disposeAll()
    }
  })

  it('has no accessibility violations with the dismiss form open, with a message showing and while it runs', async () => {
    const opened = await setup()
    await opened.press(opened.within(opened.card(1)).button('Dismiss'))
    assert.deepEqual(await axeViolations(panelRoot(opened.k)), [], 'dismiss form open')
    await disposeAll()

    const messaged = await setup()
    await messaged.press(messaged.button('Run agent'))
    assert.ok(messaged.notice())
    assert.deepEqual(await axeViolations(panelRoot(messaged.k)), [], 'message showing')
    await disposeAll()

    const gate = deferred<AgentEnvelope<AgentRunDetail>>()
    const working = await setup({ overrides: { run: () => gate.promise } })
    await working.press(working.button('Run agent'))
    assert.deepEqual(await axeViolations(panelRoot(working.k)), [], 'while it runs')
  })
})
