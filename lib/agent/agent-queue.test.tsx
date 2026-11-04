import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { ApiError } from '../../services/core'
import { AgentApiError } from '../../services/agent/errors'
import type { AgentApi } from '../../services/agent/api-types'
import type { AgentDecisionResult } from '../../services/agent/types'
import { axeViolations } from './a11y'
import { absent, same, says } from './assertions'
import { autonomyResponse, proposal, proposalsPage, queuedLink, queuedProposal } from './fixtures'
import { agentScreen, deferred, type ScreenOptions } from './screen-kit'
import { NETWORK_TEXT } from './model'

/** The Waiting for you tab, opened by its address, over a fake server. */
async function waiting(options: ScreenOptions = {}) {
  const s = await agentScreen({ search: 'tab=waiting', ...options })
  const card = (id: number) => s.k.one(`li[data-proposal="${id}"]`)
  const within = (root: Element | null) => (label: string) => s.button(label, root ?? s.k.w.document)
  const notice = () => s.k.one('[role="status"][tabindex], [role="alert"][tabindex]')
  const ids = () => s.k.all('li[data-proposal]').map((li) => Number(li.getAttribute('data-proposal')))
  return { ...s, card, within, notice, ids }
}

const applied = (over = {}): AgentDecisionResult => ({ status: 1, data: { outcome: 'applied', proposal: proposal({ status: 'applied', applied_via: 'user', ...over }) } })

/**
 * A queue that answers one page of rows per read of the list (the last for every read after). The screen also asks for the tab's number with one row; that
 * read is answered from the first page's total and does not use up a page.
 */
const sequence = (...pages: ReturnType<typeof proposalsPage>[]): Partial<AgentApi> => {
  let n = 0
  return { proposals: async (params) => (params.per_page === 1 ? proposalsPage([queuedProposal()], { total: pages[0].data.pagination.total }) : pages[Math.min(n++, pages.length - 1)]) }
}

describe('Waiting for you: opening', () => {
  afterEach(disposeAll)

  it('says it is opening before the first answer, and asks for what nobody has decided, page 1, 25 at a time', async () => {
    const s = await waiting({ overrides: { proposals: () => new Promise(() => undefined) } })
    says(s.k.bodyText(), 'Opening the waiting list…')
    assert.equal(s.k.one('section[aria-busy="true"]') !== null, true)
    assert.deepEqual(s.calls.proposals.at(-1), { status: 'pending', page: 1, per_page: 25 })
  })

  it('lists what waits, newest first as the server sent it, each saying which organisation it is about, what the agent wants to do, why, and what it rests on', async () => {
    const s = await waiting()
    assert.equal(s.k.one('h2')!.textContent, 'Waiting for you')
    assert.deepEqual(s.ids(), [1, 3])
    const note = s.card(1)!.textContent!
    says(note, 'Organisation: Hillcrest Academy')
    assert.ok(note.includes('Add a note'), 'the action in words')
    assert.ok(note.includes('Add a note: Hiring a principal for the new campus.'), 'the proposal\'s own summary')
    says(note, 'Why: A fresh hiring signal is not in the notes yet.')
    assert.ok(note.includes('Hillcrest is opening a new CBSE campus'), 'the evidence it rests on')
    says(note, 'Waiting for you')
    says(note, 'Run #10')
    const link = s.card(3)!.textContent!
    says(link, 'Organisation: Greenfield Academy')
    says(link, 'Confirm a probable link')
  })

  it('says how many are waiting, and shows the number on the tab', async () => {
    const s = await waiting()
    assert.equal(s.k.one('[data-total]')!.textContent, '2 waiting for you')
    assert.deepEqual(s.tabNames(), ['Runs', 'Waiting for you2', 'Autonomy'])
  })

  it('links the organisation by its page, inside this application, and shows what a person needs to know when it has gone', async () => {
    const rows = [
      queuedProposal({ id: 1 }),
      queuedProposal({ id: 2, organisation: { id: 9, name: 'Old Name School', href_hint: null, removed: true } }),
      queuedProposal({ id: 3, organisation: { id: 10, name: null, href_hint: null, removed: true } }),
      queuedProposal({ id: 4, organisation: { id: 11, name: 'No CRM Yet', href_hint: null, removed: false } }),
    ]
    const s = await waiting({ overrides: { proposals: async () => proposalsPage(rows) } })
    const a = s.card(1)!.querySelector('[data-organisation] a') as HTMLAnchorElement
    assert.equal(a.getAttribute('href'), '/module/crm/marketing/organizations/135')
    assert.equal(a.textContent, 'Hillcrest Academy')
    absent(s.card(2)!.querySelector('[data-organisation] a'), 'a removed organisation has no page to open')
    says(s.card(2)!.textContent!, 'Old Name School')
    says(s.card(2)!.textContent!, 'removed or merged into another one. You can still dismiss the proposal.')
    says(s.card(3)!.textContent!, 'Organisation: Not found')
    says(s.card(3)!.textContent!, 'can no longer be found. You can still dismiss the proposal.')
    assert.ok(s.within(s.card(2))('Dismiss'), 'a proposal of a removed organisation can still be dismissed')
    assert.ok(s.within(s.card(3))('Dismiss'))
    absent(s.card(4)!.querySelector('[data-organisation] a'), 'no CRM record, no page, no link')
    assert.deepEqual(s.ids(), [1, 2, 3, 4], 'no row is dropped silently')
  })

  it('says nothing is waiting, with what will appear here, when nothing is', async () => {
    const s = await waiting({ overrides: { proposals: async () => proposalsPage([]) } })
    says(s.k.one('[data-empty]')!.textContent!, 'Nothing is waiting for you.')
    assert.equal(s.k.one('[data-total]')!.textContent, 'Nothing is waiting')
    assert.deepEqual(s.tabNames(), ['Runs', 'Waiting for you0', 'Autonomy'])
  })

  it('shows an error with Retry, and Retry reads the list again', async () => {
    let attempts = 0
    const s = await waiting({ overrides: { proposals: async (params) => { if (params.per_page === 25) { attempts += 1; if (attempts === 1) throw new ApiError('The server is busy.', 503) } return proposalsPage() } } })
    says(s.k.bodyText(), 'The waiting list could not be opened.')
    says(s.k.bodyText(), 'The server is busy.')
    await s.press(s.button('Retry'))
    assert.equal(attempts, 2)
    assert.deepEqual(s.ids(), [1, 3])
  })

  it('says plainly there is no access on a 403, with no Retry', async () => {
    const s = await waiting({ overrides: { proposals: async () => { throw new ApiError('no', 403) } } })
    says(s.panel()!.textContent!, 'You do not have access to the agent.')
    absent(s.button('Retry'), 'there is no Retry button')
  })

  it('says a lost connection in words', async () => {
    const s = await waiting({ overrides: { proposals: async () => { throw new TypeError('Failed to fetch') } } })
    says(s.k.bodyText(), NETWORK_TEXT)
  })

  it('does not look anything up without a session', async () => {
    const s = await waiting({ session: false })
    assert.deepEqual(s.calls.proposals, [])
    says(s.k.bodyText(), 'Your ERP session is unavailable. Please sign in again.')
  })

  it('refreshes on request', async () => {
    const s = await waiting()
    const before = s.calls.proposals.length
    await s.press(s.button('Refresh', s.panel()!))
    assert.equal(s.calls.proposals.length, before + 1)
  })
})

describe('Waiting for you: accepting a proposal', () => {
  afterEach(disposeAll)

  it('accepts that one proposal through the existing accept route, reads the list again, says what was done and moves the focus to the message', async () => {
    const s = await waiting({ overrides: { ...sequence(proposalsPage([queuedProposal({ id: 1 }), queuedLink()]), proposalsPage([queuedLink()])), accept: async () => applied() } })
    const accept = s.within(s.card(1))('Accept')!
    assert.equal(accept.textContent!.trim(), 'Accept: add the note')
    accept.focus()
    await s.press(accept)

    assert.deepEqual(s.calls.accept, [1])
    assert.deepEqual(s.ids(), [3], 'the list was read again and the accepted one is gone')
    assert.equal(s.notice()!.textContent!.includes('The note was added to the organisation.'), true)
    same(s.focused(), s.notice(), 'the button that was pressed left the page, so the focus goes to the message')
    assert.equal(s.notice()!.getAttribute('role'), 'status')
  })

  it('says each kind of accept in its own words', async () => {
    const s = await waiting({ overrides: { accept: async () => applied() } })
    await s.press(s.within(s.card(3))('Accept'))
    says(s.notice()!.textContent!, 'The records were linked as one organisation.')
  })

  it('says "already applied" when somebody else got there first', async () => {
    const s = await waiting({ overrides: { accept: async () => ({ status: 1, data: { outcome: 'already_applied', proposal: proposal({ status: 'applied' }) } }) } })
    await s.press(s.within(s.card(1))('Accept'))
    says(s.notice()!.textContent!, 'This had already been applied.')
  })

  it('ignores a second press within the same tick: one request goes out, and every other button waits meanwhile', async () => {
    const answer = deferred<AgentDecisionResult>()
    const s = await waiting({ overrides: { accept: () => answer.promise } })
    const first = s.within(s.card(1))('Accept')!
    const other = s.within(s.card(3))('Accept')!
    await s.k.act(async () => {
      first.dispatchEvent(new s.k.w.MouseEvent('click', { bubbles: true, cancelable: true }))
      first.dispatchEvent(new s.k.w.MouseEvent('click', { bubbles: true, cancelable: true }))
      other.dispatchEvent(new s.k.w.MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    assert.deepEqual(s.calls.accept, [1], 'two presses of one button and a press of another, one request')
    for (const b of s.k.all('li[data-proposal] button')) assert.equal((b as HTMLButtonElement).disabled, true, 'every button waits')
    assert.equal(s.k.one('section[aria-busy="true"]') !== null, true)
    answer.resolve(applied())
    await s.k.tick(20)
    assert.deepEqual(s.calls.accept, [1])
  })

  it('says what became of a proposal that could not be applied, in the server\'s words, and reads the list again so it shows it', async () => {
    const reason = 'Both organisations already have a record from the same source, so they cannot be one.'
    const s = await waiting({ overrides: { ...sequence(proposalsPage(), proposalsPage([queuedProposal({ id: 1 })])), accept: async () => { throw new AgentApiError(reason, 409, undefined, undefined, 'could_not_apply', proposal({ id: 3, status: 'failed', error: reason })) } } })
    await s.press(s.within(s.card(3))('Accept'))
    assert.equal(s.notice()!.getAttribute('role'), 'alert')
    says(s.notice()!.textContent!, reason)
    assert.deepEqual(s.ids(), [1], 'read again: the failed one is no longer waiting')
  })

  it('says another person decided it first, and reads the list again', async () => {
    const s = await waiting({ overrides: { ...sequence(proposalsPage(), proposalsPage([queuedLink()])), accept: async () => { throw new AgentApiError('This proposal was already dismissed.', 409, undefined, undefined, 'already_decided', proposal({ status: 'dismissed' })) } } })
    await s.press(s.within(s.card(1))('Accept'))
    says(s.notice()!.textContent!, 'This proposal was already dismissed.')
    assert.deepEqual(s.ids(), [3])
  })

  it('says the agent is switched off when accepting is refused for that, and reads the settings again so the list can say so too', async () => {
    let off = false
    const s = await waiting({
      overrides: {
        autonomy: async () => autonomyResponse({ kill_switch: off ? { on: true, scope: 'organisation' } : { on: false, scope: null } }),
        accept: async () => { off = true; throw new AgentApiError('The agent is switched off for your organisation.', 409, undefined, undefined, 'agent_off', null) },
      },
    })
    absent(s.k.one('[data-agent-off]'), 'running when the list opened')
    await s.press(s.within(s.card(1))('Accept'))
    says(s.notice()!.textContent!, 'The agent is switched off for your organisation.')
    says(s.k.one('[data-agent-off]')!.textContent!, 'cannot be accepted until an administrator switches it back on')
    assert.deepEqual(s.ids(), [1, 3], 'the proposals are still there: only a person can dismiss them now')
  })

  it('takes the buttons away and says why when the server says this person may not decide', async () => {
    const s = await waiting({ overrides: { accept: async () => { throw new ApiError('Your role does not have access to this screen.', 403) } } })
    await s.press(s.within(s.card(1))('Accept'))
    says(s.notice()!.textContent!, 'needs the edit right on Organizations')
    assert.equal(s.k.all('li[data-proposal] button').length, 0, 'no button is offered that the server has just refused')
    assert.ok(s.k.one('[data-view-only]'))
  })

  it('says a proposal that has gone is gone', async () => {
    const s = await waiting({ overrides: { ...sequence(proposalsPage(), proposalsPage([queuedLink()])), accept: async () => { throw new ApiError('Proposal not found.', 404) } } })
    await s.press(s.within(s.card(1))('Accept'))
    says(s.notice()!.textContent!, 'This proposal can no longer be found. It may have been removed.')
    assert.deepEqual(s.ids(), [3])
  })

  it('says a lost connection in words and keeps the list as it is', async () => {
    const s = await waiting({ overrides: { accept: async () => { throw new TypeError('Failed to fetch') } } })
    await s.press(s.within(s.card(1))('Accept'))
    says(s.notice()!.textContent!, NETWORK_TEXT)
    assert.deepEqual(s.ids(), [1, 3])
    assert.equal(s.within(s.card(1))('Accept')!.disabled, false, 'it can be tried again')
  })

  it('lets the message be closed', async () => {
    const s = await waiting()
    await s.press(s.within(s.card(1))('Accept'))
    await s.press(s.button('Close message'))
    absent(s.notice(), 'it is not there')
  })
})

describe('Waiting for you: dismissing a proposal', () => {
  afterEach(disposeAll)

  it('opens a small form with the focus in it, and the Dismiss button says it is expanded', async () => {
    const s = await waiting()
    const dismiss = s.within(s.card(1))('Dismiss')!
    assert.equal(dismiss.getAttribute('aria-expanded'), 'false')
    await s.press(dismiss)
    assert.equal(dismiss.getAttribute('aria-expanded'), 'true')
    const form = s.card(1)!.querySelector('form')!
    says(form.textContent!, 'Why are you dismissing this? (optional)')
    same(s.focused(), form.querySelector('textarea'), 'the focus is in the reason field')
  })

  it('sends the reason, reads the list again, says it will not be suggested again and moves the focus to the message', async () => {
    const s = await waiting({ overrides: sequence(proposalsPage(), proposalsPage([queuedLink()])) })
    await s.press(s.within(s.card(1))('Dismiss'))
    await s.type(s.card(1)!.querySelector('textarea') as HTMLElement, 'We already know this')
    await s.press(s.within(s.card(1))('Dismiss this proposal'))
    assert.deepEqual(s.calls.dismiss, [{ id: 1, reason: 'We already know this' }])
    assert.deepEqual(s.ids(), [3])
    says(s.notice()!.textContent!, 'Dismissed. The agent will not suggest this again.')
    same(s.focused(), s.notice(), 'the focus is on the message')
  })

  it('dismisses without a reason when none is given', async () => {
    const s = await waiting()
    await s.press(s.within(s.card(1))('Dismiss'))
    await s.press(s.within(s.card(1))('Dismiss this proposal'))
    assert.deepEqual(s.calls.dismiss, [{ id: 1, reason: '' }])
  })

  it('closes the form on Escape and puts the focus back on the Dismiss button that opened it, sending nothing', async () => {
    const s = await waiting()
    const dismiss = s.within(s.card(1))('Dismiss')!
    await s.press(dismiss)
    await s.k.press('Escape')
    await s.k.tick(20)
    absent(s.card(1)!.querySelector('form'), 'it is not there')
    same(s.focused(), dismiss, 'the focus is back on the button that opened the form')
    assert.deepEqual(s.calls.dismiss, [])
  })

  it('ignores a second press of the confirming button within the same tick: one request goes out', async () => {
    const answer = deferred<AgentDecisionResult>()
    const s = await waiting({ overrides: { dismiss: () => answer.promise } })
    await s.press(s.within(s.card(1))('Dismiss'))
    const confirm = s.within(s.card(1))('Dismiss this proposal')!
    await s.k.act(async () => {
      confirm.dispatchEvent(new s.k.w.MouseEvent('click', { bubbles: true, cancelable: true }))
      confirm.dispatchEvent(new s.k.w.MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    assert.deepEqual(s.calls.dismiss.map((c) => c.id), [1])
    for (const b of s.k.all('li[data-proposal] button')) assert.equal((b as HTMLButtonElement).disabled, true, 'every button waits')
    answer.resolve({ status: 1, data: { outcome: 'dismissed', proposal: proposal({ status: 'dismissed' }) } })
    await s.k.tick(20)
    assert.deepEqual(s.calls.dismiss.map((c) => c.id), [1])
  })

  it('closes the form with "Keep it" and keeps the proposal waiting', async () => {
    const s = await waiting()
    await s.press(s.within(s.card(1))('Dismiss'))
    await s.press(s.within(s.card(1))('Keep it'))
    absent(s.card(1)!.querySelector('form'), 'it is not there')
    assert.deepEqual(s.ids(), [1, 3])
  })

  it('has one form open at a time, and an empty one when it is opened again', async () => {
    const s = await waiting()
    await s.press(s.within(s.card(1))('Dismiss'))
    await s.type(s.card(1)!.querySelector('textarea') as HTMLElement, 'typed for the first')
    await s.press(s.within(s.card(3))('Dismiss'))
    assert.equal(s.k.all('form').length, 1)
    assert.equal(s.card(3)!.querySelectorAll('form').length, 1)
    assert.equal((s.card(3)!.querySelector('textarea') as HTMLTextAreaElement).value, '', 'what was typed for the other one is not carried over')
  })

  it('keeps the form open, with what was typed, when the connection was lost, so it can be sent again', async () => {
    const s = await waiting({ overrides: { dismiss: async () => { throw new TypeError('Failed to fetch') } } })
    await s.press(s.within(s.card(1))('Dismiss'))
    await s.type(s.card(1)!.querySelector('textarea') as HTMLElement, 'Not now')
    await s.press(s.within(s.card(1))('Dismiss this proposal'))
    says(s.notice()!.textContent!, NETWORK_TEXT)
    assert.equal((s.card(1)!.querySelector('textarea') as HTMLTextAreaElement).value, 'Not now')
  })

  it('closes the form, says what became of it and reads the list again when the server says it was decided meanwhile', async () => {
    const s = await waiting({ overrides: { ...sequence(proposalsPage(), proposalsPage([queuedLink()])), dismiss: async () => { throw new AgentApiError('This proposal was already applied.', 409, undefined, undefined, 'already_decided', proposal({ status: 'applied' })) } } })
    await s.press(s.within(s.card(1))('Dismiss'))
    await s.press(s.within(s.card(1))('Dismiss this proposal'))
    says(s.notice()!.textContent!, 'This proposal was already applied.')
    assert.deepEqual(s.ids(), [3])
    assert.equal(s.k.all('form').length, 0)
  })

  it('closes the form and forgets what was typed when the server says the proposal was decided meanwhile, even when the list still shows it', async () => {
    const s = await waiting({ overrides: { dismiss: async () => { throw new AgentApiError('This proposal was already applied.', 409, undefined, undefined, 'already_decided', proposal({ status: 'applied' })) } } })
    await s.press(s.within(s.card(1))('Dismiss'))
    await s.type(s.card(1)!.querySelector('textarea') as HTMLElement, 'Not now')
    await s.press(s.within(s.card(1))('Dismiss this proposal'))
    assert.deepEqual(s.ids(), [1, 3], 'the (stale) list still shows it')
    absent(s.card(1)!.querySelector('form'), 'but there is nothing left to ask about it')
    await s.press(s.within(s.card(1))('Dismiss'))
    assert.equal((s.card(1)!.querySelector('textarea') as HTMLTextAreaElement).value, '', 'and the reason typed for the answer that was refused is gone')
  })

  it('still lets a proposal be dismissed while the agent is switched off, and says that Accept cannot be used', async () => {
    const s = await waiting({ overrides: { autonomy: async () => autonomyResponse({ kill_switch: { on: true, scope: 'platform' } }), ...sequence(proposalsPage(), proposalsPage([queuedLink()])) } })
    says(s.k.one('[data-agent-off]')!.textContent!, 'switched off for every organisation by the platform')
    await s.press(s.within(s.card(1))('Dismiss'))
    await s.press(s.within(s.card(1))('Dismiss this proposal'))
    assert.deepEqual(s.calls.dismiss.map((c) => c.id), [1])
  })
})

describe('Waiting for you: who may decide', () => {
  afterEach(disposeAll)

  it('shows the proposals without Accept and Dismiss, with a sentence saying what is needed, when the server says nobody here may decide', async () => {
    const rows = [queuedProposal({ id: 1, can: { decide: false } }), queuedLink({ can: { decide: false } })]
    const s = await waiting({ overrides: { proposals: async () => proposalsPage(rows) } })
    assert.deepEqual(s.ids(), [1, 3])
    assert.equal(s.k.all('li[data-proposal] button').length, 0)
    says(s.k.one('[data-view-only]')!.textContent!, 'needs the edit right on Organizations')
  })

  it('shows the buttons only on the rows that may be decided, and says nothing extra when some may', async () => {
    const rows = [queuedProposal({ id: 1, can: { decide: false } }), queuedLink()]
    const s = await waiting({ overrides: { proposals: async () => proposalsPage(rows) } })
    absent(s.within(s.card(1))('Accept'), 'it is not there')
    assert.ok(s.within(s.card(3))('Accept'))
    absent(s.k.one('[data-view-only]'), 'only when NOBODY may decide')
  })
})

describe('Waiting for you: pages', () => {
  afterEach(disposeAll)

  const page = (n: number, total = 60): ReturnType<typeof proposalsPage> => proposalsPage([queuedProposal({ id: 100 + n })], { page: n, total, last_page: 3, per_page: 25 })

  it('pages through the list, says which rows are on screen, and disables Previous on the first page and Next on the last', async () => {
    const s = await waiting({ overrides: { proposals: async (params) => page(params.page ?? 1) } })
    says(s.k.bodyText(), 'Showing 1–1 of 60')
    says(s.k.bodyText(), 'Page 1 of 3')
    assert.equal(s.button('Previous')?.disabled, true)
    await s.press(s.button('Next'))
    assert.deepEqual(s.calls.proposals.at(-1), { status: 'pending', page: 2, per_page: 25 })
    says(s.k.bodyText(), 'Page 2 of 3')
    await s.press(s.button('Next'))
    assert.equal(s.button('Next')?.disabled, true)
    await s.press(s.button('Previous'))
    assert.deepEqual(s.calls.proposals.at(-1), { status: 'pending', page: 2, per_page: 25 })
  })

  it('lets nothing be paged or decided while another page is being read, because the rows on screen may be about to change', async () => {
    const next = deferred<ReturnType<typeof proposalsPage>>()
    const s = await waiting({ overrides: { proposals: (params) => (params.per_page === 1 ? Promise.resolve(page(1)) : params.page === 2 ? next.promise : Promise.resolve(page(1))) } })
    await s.press(s.button('Next'))
    assert.equal(s.k.one('section[aria-busy="true"]') !== null, true)
    assert.equal(s.button('Next')?.disabled, true)
    assert.equal(s.button('Previous')?.disabled, true)
    for (const b of s.k.all('li[data-proposal] button')) assert.equal((b as HTMLButtonElement).disabled, true, 'a decision waits too')
    next.resolve(page(2))
    await s.k.tick(20)
    assert.deepEqual(s.ids(), [102])
    assert.equal(s.button('Previous')?.disabled, false)
  })

  it('steps back to the last page that has rows when the page the person was on has emptied', async () => {
    let emptied = false
    const s = await waiting({
      overrides: {
        proposals: async (params) => {
          if (params.per_page === 1) return page(1, 26)
          if (emptied && params.page === 2) return proposalsPage([], { page: 2, total: 25, last_page: 1, per_page: 25 })
          if (emptied) return proposalsPage([queuedProposal({ id: 7 })], { page: 1, total: 25, last_page: 1, per_page: 25 })
          return page(params.page ?? 1)
        },
        accept: async () => { emptied = true; return applied() },
      },
    })
    await s.press(s.button('Next'))
    says(s.k.bodyText(), 'Page 2 of 3')
    await s.press(s.within(s.card(102))('Accept'))
    await s.k.tick(20)
    assert.deepEqual(s.ids(), [7], 'back on the page that still has a proposal')
    says(s.k.bodyText(), 'Page 1 of 1')
  })
})

describe('Waiting for you: what a model wrote is text, never markup and never a link', () => {
  afterEach(disposeAll)

  it('shows markup in a summary, a reason and an organisation name as the characters it is made of', async () => {
    const evil = '<img src=x onerror="window.__pwned = 1"><script>window.__pwned = 2</script>'
    const row = queuedProposal({ summary: `Add a note: ${evil}`, reason: `Because ${evil}`, organisation: { id: 7, name: `Evil ${evil}`, href_hint: null, removed: false } })
    const s = await waiting({ overrides: { proposals: async () => proposalsPage([row]) } })
    assert.equal(s.panel()!.querySelectorAll('img, script').length, 0)
    says(s.panel()!.textContent!, evil)
  })

  it('never makes a link from an address that is not a plain path inside the application', async () => {
    const rows = ['https://evil.example/x', '//evil.example/x', 'javascript:alert(1)'].map((href, i) => queuedProposal({ id: 10 + i, organisation: { id: 7, name: 'Hillcrest', href_hint: href, removed: false }, evidence: [{ type: 'signal', id: String(i), label: 'A signal', url: href }] }))
    const s = await waiting({ overrides: { proposals: async () => proposalsPage(rows) } })
    assert.equal(s.panel()!.querySelectorAll('a').length, 0)
  })
})

describe('Waiting for you: it can be used and understood without a mouse or without colour', () => {
  afterEach(disposeAll)

  it('uses real buttons, one list of proposals with a name, and a heading', async () => {
    const s = await waiting()
    assert.equal(s.k.all('[role="button"]').length, 0)
    assert.equal(s.k.all('ul[aria-label="Proposals waiting for you"]').length, 1)
    assert.ok(s.k.all('li[data-proposal]').every((li) => li.querySelectorAll('button').length === 2))
  })

  it('names every state in words: the proposal is "Waiting for you", never only a colour', async () => {
    const s = await waiting()
    for (const pill of s.k.all('li[data-proposal] [data-tone]')) assert.ok(pill.textContent!.trim().length > 0)
  })

  it('has no accessibility violations in its main states', async () => {
    const states: Array<[string, ScreenOptions]> = [
      ['the list', {}],
      ['empty', { overrides: { proposals: async () => proposalsPage([]) } }],
      ['view only', { overrides: { proposals: async () => proposalsPage([queuedProposal({ can: { decide: false } })]) } }],
      ['removed and missing organisations', { overrides: { proposals: async () => proposalsPage([queuedProposal({ organisation: { id: 1, name: 'Gone', href_hint: null, removed: true } }), queuedLink({ organisation: { id: 2, name: null, href_hint: null, removed: true } })]) } }],
      ['agent off', { overrides: { autonomy: async () => autonomyResponse({ kill_switch: { on: true, scope: 'organisation' } }) } }],
      ['could not be opened', { overrides: { proposals: async () => { throw new ApiError('busy', 503) } } }],
      ['forbidden', { overrides: { proposals: async () => { throw new ApiError('no', 403) } } }],
      ['loading', { overrides: { proposals: () => new Promise<ReturnType<typeof proposalsPage>>(() => undefined) } }],
    ]
    for (const [label, options] of states) {
      const s = await waiting(options)
      const root = s.panel()
      assert.ok(root && root.textContent!.includes('Waiting for you'), `${label}: the tab is on the page`)
      assert.deepEqual(await axeViolations(root), [], label)
      await disposeAll()
    }
  })

  it('has no accessibility violations with the dismiss form open and with a message showing', async () => {
    const s = await waiting()
    await s.press(s.within(s.card(1))('Dismiss'))
    assert.deepEqual(await axeViolations(s.panel()!), [], 'form open')
    await s.press(s.within(s.card(1))('Dismiss this proposal'))
    assert.ok(s.notice())
    assert.deepEqual(await axeViolations(s.panel()!), [], 'message showing')
  })
})
