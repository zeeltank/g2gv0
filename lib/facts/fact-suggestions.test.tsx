import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent, same } from '../agent/assertions'
import { ApiError } from '../../services/core'
import type { FactsApi } from '../../services/facts/api-types'
import { FactsApiError } from '../../services/facts/errors'
import type { FactDecisionResult, FactsEnvelope, FactsQueueData } from '../../services/facts/types'
import { fakeFactsService } from './fake-service'
import { appliedFact, dismissedFact, fact, phoneFact, queueData, websiteFact } from './fixtures'
import { screenKit } from './screen-kit'

interface Setup {
  overrides?: Partial<FactsApi>
  session?: boolean
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

/** The Suggestions scope on a page in a fake browser, with a signed-in session and the facts API replaced by a fake. */
async function setup(options: Setup = {}) {
  const screen = await screenKit()
  const { FactSuggestions } = await import('../../components/domain/crm/fact-suggestions')
  if (options.session === false) screen.k.w.localStorage.clear()
  const { service, calls } = fakeFactsService(options.overrides)
  let changed = 0
  await screen.mount(screen.k.h(FactSuggestions, { service, onChanged: () => { changed += 1 } }), 20)

  const { k } = screen
  const button = (label: string) => k.all('button').find((b) => b.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined
  const press = async (target: Element | null | undefined) => { assert.ok(target, 'the control exists'); await k.click(target); await k.tick(10) }
  const card = (id: number) => k.one(`li[data-fact="${id}"]`)
  const within = (root: Element | null) => ({
    button: (label: string) => Array.from(root?.querySelectorAll('button') ?? []).find((b) => b.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined,
  })
  const notice = () => k.one('[role="status"][tabindex], [role="alert"][tabindex]')
  const type = async (field: HTMLTextAreaElement, text: string) => {
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLTextAreaElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(field, text); field.dispatchEvent(new k.w.Event('input', { bubbles: true })) })
    await k.tick(5)
  }
  const choose = async (value: string) => {
    const select = k.one('select') as HTMLSelectElement
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLSelectElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(select, value); select.dispatchEvent(new k.w.Event('change', { bubbles: true })) })
    await k.tick(15)
  }
  return { ...screen, service, calls, button, press, card, within, notice, type, choose, changed: () => changed }
}

/** A queue that answers one page of rows per call (the last for every call after). */
const sequence = (...pages: FactsEnvelope<FactsQueueData>[]): Partial<FactsApi> => {
  let n = 0
  return { queue: async () => pages[Math.min(n++, pages.length - 1)] }
}

describe('Suggestions: opening', () => {
  afterEach(disposeAll)

  it('says it is opening before the first answer, and asks for what is waiting, page 1, 25 at a time, of every kind', async () => {
    const s = await setup({ overrides: { queue: () => new Promise(() => undefined) } })
    assert.ok(s.k.bodyText().includes('Opening the suggestions…'))
    assert.equal(s.k.one('section[aria-busy="true"]') !== null, true)
    assert.deepEqual(s.calls.queue, [{ status: 'proposed', page: 1, per_page: 25 }])
    s.restore()
  })

  it('lists what waits, newest first as the server sent it, each with the name and kind of its record and its evidence', async () => {
    const s = await setup()
    assert.equal(s.k.one('h2')!.textContent, 'Suggestions')
    assert.deepEqual(s.k.all('li[data-fact]').map((li) => li.getAttribute('data-fact')), ['1', '2', '3'])
    assert.ok(s.card(1)!.textContent!.includes('Asha Menon'))
    assert.ok(s.card(3)!.textContent!.includes('Hillcrest Academy'))
    assert.ok(s.card(3)!.textContent!.includes('Organisation'), 'the kind of record')
    assert.ok(s.k.one('[data-total]')!.textContent!.includes('3 waiting for you'))
    assert.ok(s.k.bodyText().includes('Nothing changes until you accept it'))
    assert.ok(s.card(1)!.querySelectorAll('li[data-evidence]').length === 2, 'the evidence is listed')
    s.restore()
  })

  it('links each record through the person\'s own menu', async () => {
    const s = await setup()
    assert.equal(s.card(1)!.querySelector('[data-record] a')!.getAttribute('href'), '/module/crm/marketing/contacts/31')
    assert.equal(s.card(3)!.querySelector('[data-record] a')!.getAttribute('href'), '/module/crm/marketing/organizations/135')
    s.restore()
  })

  it('says nothing is waiting, in words, when the queue is empty', async () => {
    const s = await setup({ overrides: { queue: async () => queueData([]) } })
    assert.ok(s.k.one('[data-empty]')!.textContent!.includes('Nothing is waiting for you.'))
    assert.ok(s.k.one('[data-total]')!.textContent!.includes('Nothing is waiting'))
    absent(s.button('Previous'), 'no paging on an empty queue')
    s.restore()
  })

  it('shows an error with Retry, and Retry opens the queue', async () => {
    let attempts = 0
    const s = await setup({ overrides: { queue: async () => { attempts += 1; if (attempts === 1) throw new ApiError('The server is busy.', 500); return queueData() } } })
    assert.ok(s.k.bodyText().includes('The suggestions could not be loaded.'))
    assert.ok(s.k.bodyText().includes('The server is busy.'))
    assert.equal(s.k.one('[role="alert"]') !== null, true)
    await s.press(s.button('Retry'))
    assert.equal(s.calls.queue.length, 2)
    assert.ok(s.k.bodyText().includes('3 waiting for you'))
    s.restore()
  })

  it('says plainly there is no access on a 403, with no Retry, and that it is not set up on a 503', async () => {
    const forbidden = await setup({ overrides: { queue: async () => { throw new ApiError('no', 403) } } })
    assert.ok(forbidden.k.bodyText().includes('You do not have access to suggestions here.'))
    absent(forbidden.button('Retry'), 'no Retry when there is no access')
    assert.equal(forbidden.k.one('[data-queue-state]')!.getAttribute('data-queue-state'), 'forbidden')
    await disposeAll()
    const unavailable = await setup({ overrides: { queue: async () => { throw new ApiError('no', 503) } } })
    assert.ok(unavailable.k.bodyText().includes('Suggestions are not set up on this server yet.'))
    absent(unavailable.button('Retry'), 'no Retry when it is not set up')
    unavailable.restore()
  })

  it('says the session is unavailable, and calls nothing, when nobody is signed in', async () => {
    const s = await setup({ session: false })
    assert.ok(s.k.bodyText().includes('Your ERP session is unavailable. Please sign in again.'))
    assert.deepEqual(s.calls.queue, [])
    s.restore()
  })

  it('shows only the answer for the page that is open when a slower answer for the one before arrives late', async () => {
    const first = deferred<FactsEnvelope<FactsQueueData>>()
    const second = deferred<FactsEnvelope<FactsQueueData>>()
    // The opening read answers at once; then the person picks one kind (a slow answer), and another kind before the first has come back.
    const answers = [Promise.resolve(queueData()), first.promise, second.promise]
    const s = await setup({ overrides: { queue: () => answers.shift()! } })
    await s.choose('contact')
    await s.choose('organization')
    second.resolve(queueData([fact({ id: 21, entity_name: 'SECOND list row' })]))
    await s.k.tick(10)
    first.resolve(queueData([fact({ id: 11, entity_name: 'FIRST list row' })]))
    await s.k.tick(10)
    assert.ok(s.k.bodyText().includes('SECOND list row'))
    assert.equal(s.k.bodyText().includes('FIRST list row'), false, 'the late answer was dropped')
    s.restore()
  })
})

describe('Suggestions: the filter and the pages', () => {
  afterEach(disposeAll)

  it('narrows to one kind of record, going back to page 1, and asks the server for that kind', async () => {
    const s = await setup({ overrides: sequence(queueData([fact()], { pagination: { page: 1, per_page: 25, total: 60 } })) })
    await s.press(s.button('Next'))
    assert.deepEqual(s.calls.queue.at(-1), { status: 'proposed', page: 2, per_page: 25 })
    await s.choose('organization')
    assert.deepEqual(s.calls.queue.at(-1), { status: 'proposed', page: 1, per_page: 25, type: 'organization' })
    await s.choose('')
    assert.deepEqual(s.calls.queue.at(-1), { status: 'proposed', page: 1, per_page: 25 }, 'All records sends no kind')
    s.restore()
  })

  it('keeps the filter and the list on screen while another kind is read (the focus is not lost), and nothing can be decided meanwhile', async () => {
    const gate = deferred<FactsEnvelope<FactsQueueData>>()
    const answers = [Promise.resolve(queueData()), gate.promise]
    const s = await setup({ overrides: { queue: () => answers.shift()! } })
    const select = s.k.one('select') as HTMLSelectElement
    select.focus()
    await s.choose('contact')
    same(s.k.one('select'), select, 'the same filter element is still there')
    same(s.k.w.document.activeElement, select, 'and it still has the focus')
    assert.ok(s.card(1), 'the list that was on screen stays until the new one arrives')
    assert.equal(s.k.one('section')!.getAttribute('aria-busy'), 'true')
    assert.ok(s.k.one('p.sr-only[role="status"]')!.textContent!.includes('Loading the list…'))
    assert.equal(s.k.all('button').filter((b) => b.textContent?.trim() === 'Accept').every((b) => (b as HTMLButtonElement).disabled), true, 'nothing can be accepted while the rows may change')
    gate.resolve(queueData([fact({ id: 41, entity_name: 'Only a contact' })]))
    await s.k.tick(10)
    assert.ok(s.card(41))
    absent(s.card(1), 'the old rows are replaced')
    assert.equal(s.k.one('section')!.getAttribute('aria-busy'), 'false')
    s.restore()
  })

  it('offers the kinds in words', async () => {
    const s = await setup()
    assert.deepEqual(Array.from((s.k.one('select') as HTMLSelectElement).options).map((o) => o.textContent), ['All records', 'Contacts', 'Organisations', 'Leads'])
    assert.equal(s.k.w.document.querySelector(`label[for="${s.k.one('select')!.id}"]`)!.textContent, 'Show')
    s.restore()
  })

  it('says a filter that matches nothing is empty for that kind', async () => {
    const s = await setup({ overrides: { queue: async (params) => queueData(params.type ? [] : [fact()]) } })
    await s.choose('lead')
    assert.ok(s.k.one('[data-empty]')!.textContent!.includes('in this kind of record'))
    s.restore()
  })

  it('pages: Previous is off on the first page and Next on the last, with the range and the page count in words', async () => {
    const s = await setup({ overrides: { queue: async (params) => queueData([fact({ id: 30 + (params.page ?? 1) })], { pagination: { page: params.page ?? 1, per_page: 25, total: 51 } }) } })
    assert.equal(s.button('Previous')!.disabled, true)
    assert.ok(s.k.bodyText().includes('Page 1 of 3'))
    assert.ok(s.k.bodyText().includes('Showing 1–1 of 51'))
    await s.press(s.button('Next'))
    await s.press(s.button('Next'))
    assert.ok(s.k.bodyText().includes('Page 3 of 3'))
    assert.equal(s.button('Next')!.disabled, true)
    await s.press(s.button('Previous'))
    assert.deepEqual(s.calls.queue.at(-1), { status: 'proposed', page: 2, per_page: 25 })
    s.restore()
  })

  it('steps back to the last page that has rows when the page the person was on empties', async () => {
    let decided = false
    const s = await setup({
      overrides: {
        queue: async (params) => {
          const page = params.page ?? 1
          if (page === 2 && decided) return queueData([], { pagination: { page: 2, per_page: 25, total: 25 } })
          if (page === 2) return queueData([fact({ id: 99, entity_name: 'Only row on page two' })], { pagination: { page: 2, per_page: 25, total: 26 } })
          return queueData([fact({ id: 1 })], { pagination: { page: 1, per_page: 25, total: decided ? 25 : 26 } })
        },
        accept: async () => { decided = true; return { status: 1, data: { outcome: 'applied', fact: fact({ id: 99, status: 'applied', column_written: true }) } } },
      },
    })
    await s.press(s.button('Next'))
    assert.ok(s.k.bodyText().includes('Only row on page two'))
    await s.press(s.within(s.card(99)).button('Accept'))
    await s.k.tick(20)
    assert.ok(s.k.bodyText().includes('Page 1 of 1'), 'back on a page that has rows')
    assert.ok(s.card(1), 'its rows are shown, not an empty list')
    s.restore()
  })
})

describe('Suggestions: accepting', () => {
  afterEach(disposeAll)

  it('accepts the fact that was pressed, reads the queue again so it leaves the list, and says whether the record was written', async () => {
    const s = await setup({
      overrides: {
        ...sequence(queueData([fact({ id: 1 }), phoneFact()]), queueData([phoneFact()])),
        accept: async () => ({ status: 1, data: { outcome: 'applied', fact: fact({ id: 1, status: 'applied', column_written: true, decided_by_name: 'Anil Shah' }) } }),
      },
    })
    await s.press(s.within(s.card(1)).button('Accept'))
    assert.deepEqual(s.calls.queue.length, 2, 'the queue was read again')
    absent(s.card(1), 'the accepted fact has left the list')
    assert.ok(s.card(2), 'the other one is still there')
    assert.equal(s.notice()!.textContent!.includes('Accepted. The email address was written to the record.'), true)
    assert.equal(s.notice()!.getAttribute('role'), 'status')
    assert.ok(s.changed() >= 1, 'the switch that counts what waits is told')
    s.restore()
  })

  it('says the record was NOT changed when the fact was kept in the ledger only', async () => {
    const s = await setup({ overrides: { accept: async () => ({ status: 1, data: { outcome: 'applied', fact: phoneFact({ status: 'applied', column_written: false, record_value: '+91 11111 22222' }) } }) } })
    await s.press(s.within(s.card(2)).button('Accept'))
    assert.ok(s.notice()!.textContent!.includes('Accepted and kept as a fact. The record was not changed because it already holds “+91 11111 22222”.'))
    s.restore()
  })

  it('moves the focus to the message once the button that was pressed has left the page', async () => {
    const s = await setup({ overrides: sequence(queueData([fact({ id: 1 })]), queueData([])) })
    await s.press(s.within(s.card(1)).button('Accept'))
    same(s.k.w.document.activeElement, s.notice(), 'the focus is on the message, not lost')
    s.restore()
  })

  it('disables every button while it works and ignores a second press, until the answer is in', async () => {
    const gate = deferred<FactDecisionResult>()
    const s = await setup({ overrides: { accept: () => gate.promise } })
    await s.press(s.within(s.card(1)).button('Accept'))
    assert.equal(s.calls.accept.length, 1)
    assert.equal(s.k.all('button').filter((b) => /^(Accept|Dismiss)/.test(b.textContent?.trim() ?? '')).every((b) => (b as HTMLButtonElement).disabled), true, 'nothing can be decided meanwhile')
    assert.ok(s.k.one('p.sr-only[role="status"]')!.textContent!.includes('Working…'), 'a screen reader is told')
    assert.equal(s.k.one('section')!.getAttribute('aria-busy'), 'true')
    await s.press(s.within(s.card(2)).button('Accept'))
    assert.equal(s.calls.accept.length, 1, 'a second press changed nothing')
    gate.resolve({ status: 1, data: { outcome: 'applied', fact: fact({ status: 'applied', column_written: true }) } })
    await s.k.tick(10)
    assert.equal(s.k.all('button').filter((b) => /^Accept/.test(b.textContent?.trim() ?? '')).every((b) => !(b as HTMLButtonElement).disabled), true)
    s.restore()
  })

  it('ignores two presses in the same tick (the second does not reach the server)', async () => {
    const gate = deferred<FactDecisionResult>()
    const s = await setup({ overrides: { accept: () => gate.promise } })
    const [one, two] = [s.within(s.card(1)).button('Accept')!, s.within(s.card(2)).button('Accept')!]
    await s.k.act(async () => {
      one.dispatchEvent(new s.k.w.MouseEvent('click', { bubbles: true, cancelable: true }))
      two.dispatchEvent(new s.k.w.MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    assert.equal(s.calls.accept.length, 1)
    gate.resolve({ status: 1, data: { outcome: 'applied', fact: fact({ status: 'applied' }) } })
    await s.k.tick(10)
    s.restore()
  })

  it('reads the queue again and says in words when the fact was decided meanwhile (409 not_pending), changing nothing', async () => {
    const cause = new FactsApiError('Already decided.', 409, undefined, undefined, 'not_pending', dismissedFact({ id: 1 }))
    const s = await setup({ overrides: { ...sequence(queueData([fact({ id: 1 }), phoneFact()]), queueData([phoneFact()])), accept: async () => { throw cause } } })
    await s.press(s.within(s.card(1)).button('Accept'))
    assert.equal(s.notice()!.getAttribute('role'), 'alert')
    assert.ok(s.notice()!.textContent!.includes('Someone had already decided this: it is now dismissed. Nothing was changed.'))
    assert.equal(s.calls.queue.length, 2, 'the queue was read again so it shows what became of it')
    absent(s.card(1), 'and the decided fact is not offered any more')
    s.restore()
  })

  it('says the record was removed (409 entity_gone) and reads again', async () => {
    const s = await setup({ overrides: { accept: async () => { throw new FactsApiError('Gone.', 409, undefined, undefined, 'entity_gone', null) } } })
    await s.press(s.within(s.card(1)).button('Accept'))
    assert.ok(s.notice()!.textContent!.includes('The record this belongs to has been removed, so nothing was changed.'))
    assert.equal(s.calls.queue.length, 2)
    s.restore()
  })

  it('says a 404 and a lost connection in words', async () => {
    const first = await setup({ overrides: { accept: async () => { throw new ApiError('Not found.', 404) } } })
    await first.press(first.within(first.card(1)).button('Accept'))
    assert.ok(first.notice()!.textContent!.includes('can no longer be found'))
    await disposeAll()
    const second = await setup({ overrides: { accept: async () => { throw new TypeError('Failed to fetch') } } })
    await second.press(second.within(second.card(1)).button('Accept'))
    assert.ok(second.notice()!.textContent!.includes('did not reach the server'))
    second.restore()
  })

  it('a refused accept (403) takes the buttons away from that kind of record and says why, leaving the other kinds alone', async () => {
    const s = await setup({ overrides: { accept: async () => { throw new FactsApiError('No.', 403, undefined, undefined, 'no_right', null) } } })
    await s.press(s.within(s.card(1)).button('Accept'))
    assert.ok(s.notice()!.textContent!.includes('needs the edit right'))
    absent(s.within(s.card(1)).button('Accept'), 'no buttons on another contact fact')
    absent(s.within(s.card(2)).button('Accept'), 'no buttons on the other contact fact')
    assert.ok(s.within(s.card(3)).button('Accept'), 'the organisation fact still has its buttons: that right was not refused')
    assert.ok(s.card(1)!.querySelector('[data-view-only]')!.textContent!.includes('needs the edit right on Contacts'), 'and the contact facts say why')
    s.restore()
  })

  it('drops an accept that finishes after the list has been replaced by another one (nothing announced, nothing changed)', async () => {
    const gate = deferred<FactDecisionResult>()
    const s = await setup({ overrides: { accept: () => gate.promise } })
    await s.press(s.within(s.card(1)).button('Accept'))
    // The suggestions scope goes away (the person left it) and comes back as a fresh one.
    await s.k.render(s.wrap(s.k.h('p', null, 'another screen')))
    await s.k.tick(10)
    gate.resolve({ status: 1, data: { outcome: 'applied', fact: fact({ status: 'applied', column_written: true }) } })
    await s.k.tick(10)
    absent(s.notice(), 'nothing is announced on the screen that replaced it')
    s.restore()
  })
})

describe('Suggestions: dismissing', () => {
  afterEach(disposeAll)

  it('opens the reason form without deciding, focuses it, and Dismiss this suggestion sends the trimmed reason', async () => {
    const s = await setup({ overrides: sequence(queueData([fact({ id: 1 }), phoneFact()]), queueData([phoneFact()])) })
    await s.press(s.within(s.card(1)).button('Dismiss'))
    assert.equal(s.calls.dismiss.length, 0, 'opening the form decides nothing')
    const area = s.k.one('textarea') as HTMLTextAreaElement
    same(s.k.w.document.activeElement, area, 'the focus is in the reason box')
    await s.type(area, '  That is the school office  ')
    await s.press(s.k.withText('Dismiss this suggestion'))
    assert.deepEqual(s.calls.dismiss, [{ id: 1, reason: '  That is the school office  ' }], 'the screen sends what was typed; the service trims it')
    absent(s.card(1), 'the dismissed fact has left the list')
    assert.ok(s.notice()!.textContent!.includes('Dismissed. This value will not be suggested again.'))
    absent(s.k.one('textarea'), 'the form is closed')
    s.restore()
  })

  it('dismisses with no reason when none was typed', async () => {
    const s = await setup()
    await s.press(s.within(s.card(1)).button('Dismiss'))
    await s.press(s.k.withText('Dismiss this suggestion'))
    assert.deepEqual(s.calls.dismiss, [{ id: 1, reason: '' }])
    s.restore()
  })

  it('Escape closes the form, keeps the fact, discards the half-typed reason and returns the focus to the Dismiss button', async () => {
    const s = await setup()
    await s.press(s.within(s.card(1)).button('Dismiss'))
    await s.type(s.k.one('textarea') as HTMLTextAreaElement, 'half a reason')
    await s.k.press('Escape', s.k.one('textarea')!)
    await s.k.tick(5)
    absent(s.k.one('textarea'), 'the form is closed')
    assert.equal(s.calls.dismiss.length, 0)
    same(s.k.w.document.activeElement, s.within(s.card(1)).button('Dismiss'), 'the focus is back on the button that opened it')
    await s.press(s.within(s.card(1)).button('Dismiss'))
    assert.equal((s.k.one('textarea') as HTMLTextAreaElement).value, '', 'a reopened form is empty')
    s.restore()
  })

  it('only one reason form is open at a time', async () => {
    const s = await setup()
    await s.press(s.within(s.card(1)).button('Dismiss'))
    await s.press(s.within(s.card(2)).button('Dismiss'))
    assert.equal(s.k.all('textarea').length, 1)
    assert.ok(s.card(2)!.querySelector('textarea'))
    s.restore()
  })

  it('keeps the form open, with what was typed, when the connection failed, so the person can try again', async () => {
    const s = await setup({ overrides: { dismiss: async () => { throw new TypeError('Failed to fetch') } } })
    await s.press(s.within(s.card(1)).button('Dismiss'))
    await s.type(s.k.one('textarea') as HTMLTextAreaElement, 'keep this text')
    await s.press(s.k.withText('Dismiss this suggestion'))
    assert.ok(s.notice()!.textContent!.includes('did not reach the server'))
    assert.equal((s.k.one('textarea') as HTMLTextAreaElement).value, 'keep this text')
    s.restore()
  })

  it('closes the form and says what became of the fact when it was decided meanwhile (409)', async () => {
    const s = await setup({ overrides: { dismiss: async () => { throw new FactsApiError('Already decided.', 409, undefined, undefined, 'not_pending', appliedFact({ id: 1 })) } } })
    await s.press(s.within(s.card(1)).button('Dismiss'))
    await s.press(s.k.withText('Dismiss this suggestion'))
    assert.ok(s.notice()!.textContent!.includes('it is now accepted'))
    absent(s.k.one('textarea'), 'the form has nothing left to ask about')
    s.restore()
  })
})

describe('Suggestions: who may decide', () => {
  afterEach(disposeAll)

  it('shows a person who may only read what waits and says what they need to decide it, with no buttons', async () => {
    const s = await setup({ overrides: { queue: async () => queueData([fact(), phoneFact()], { can: { decide: false } }) } })
    absent(s.button('Accept'), 'no Accept for a person who may not decide')
    absent(s.button('Dismiss'), 'no Dismiss')
    assert.ok(s.k.one('[data-view-only]')!.textContent!.includes('needs the edit right on this screen'))
    assert.ok(s.card(1)!.textContent!.includes('Asha Menon'), 'but they can read what is waiting')
    assert.equal(s.card(1)!.querySelectorAll('li[data-evidence]').length, 2, 'and its evidence')
    s.restore()
  })

  it('offers the buttons only for the kinds of record the server lists in decide_types, and says why on the others', async () => {
    const s = await setup({ overrides: { queue: async () => queueData([fact(), phoneFact(), websiteFact()], { can: { decide: true, decide_types: ['contact'] } }) } })
    assert.ok(s.within(s.card(1)).button('Accept'), 'a contact fact: the edit right on Contacts')
    assert.ok(s.within(s.card(2)).button('Accept'))
    absent(s.within(s.card(3)).button('Accept'), 'an organisation fact: no edit right on Organizations')
    absent(s.within(s.card(3)).button('Dismiss'), 'nor Dismiss')
    assert.ok(s.card(3)!.querySelector('[data-view-only]')!.textContent!.includes('needs the edit right on Organisations'))
    absent(s.card(1)!.querySelector('[data-view-only]'), 'no note on a fact that can be decided')
    s.restore()
  })

  it('says nothing is decidable, once, when decide_types is empty', async () => {
    const s = await setup({ overrides: { queue: async () => queueData([fact(), websiteFact()], { can: { decide: false, decide_types: [] } }) } })
    absent(s.button('Accept'), 'no Accept anywhere')
    assert.equal(s.k.all('[data-view-only]').length, 1, 'one sentence for the whole list, not one per card')
    s.restore()
  })

  it('offers the buttons when the server does not say (it decides, and a 403 turns the card view-only)', async () => {
    const s = await setup()
    assert.equal(s.k.all('button').filter((b) => b.textContent?.trim() === 'Accept').length, 3)
    s.restore()
  })
})

describe('Suggestions: accessibility', () => {
  afterEach(disposeAll)

  it('has no axe violations when listing, with a reason form open, when empty, in error and when view-only', async () => {
    const s = await setup({ overrides: { queue: async () => queueData([fact(), phoneFact(), websiteFact(), appliedFact({ id: 8, status: 'proposed' })]) } })
    assert.deepEqual(await axeViolations(s.k.one('section')!), [], 'listing')
    await s.press(s.within(s.card(1)).button('Dismiss'))
    assert.deepEqual(await axeViolations(s.k.one('section')!), [], 'with the reason form open')
    await disposeAll()

    const empty = await setup({ overrides: { queue: async () => queueData([]) } })
    assert.deepEqual(await axeViolations(empty.k.one('section')!), [], 'empty')
    await disposeAll()

    const failed = await setup({ overrides: { queue: async () => { throw new ApiError('boom', 500) } } })
    assert.deepEqual(await axeViolations(failed.k.one('section')!), [], 'in error')
    await disposeAll()

    const viewOnly = await setup({ overrides: { queue: async () => queueData([fact()], { can: { decide: false } }) } })
    assert.deepEqual(await axeViolations(viewOnly.k.one('section')!), [], 'view-only')
  })
})
