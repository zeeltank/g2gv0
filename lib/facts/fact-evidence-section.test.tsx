import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent, same } from '../agent/assertions'
import { ApiError } from '../../services/core'
import type { FactsApi } from '../../services/facts/api-types'
import { FactsApiError } from '../../services/facts/errors'
import type { Fact, FactDecisionResult, FactEntityType, FactsEntityData, FactsEnvelope } from '../../services/facts/types'
import { fakeFactsService } from './fake-service'
import { appliedFact, CONTACT_ID, dismissedFact, entityData, fact, phoneFact, websiteFact } from './fixtures'
import { screenKit } from './screen-kit'

interface Setup {
  type?: FactEntityType
  id?: number | string
  overrides?: Partial<FactsApi>
  session?: boolean
  onWroteRecord?: (fact: Fact) => void
  wired?: boolean
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

/** A record's Evidence section on a page in a fake browser, with a signed-in session and the facts API replaced by a fake. */
async function setup(options: Setup = {}) {
  const screen = await screenKit()
  const { FactEvidenceSection } = await import('../../components/domain/crm/fact-evidence-section')
  if (options.session === false) screen.k.w.localStorage.clear()
  const { service, calls } = fakeFactsService(options.overrides)
  const written: Fact[] = []
  const props = { entityType: options.type ?? 'contact', entityId: options.id ?? CONTACT_ID, service, ...(options.wired === false ? {} : { onWroteRecord: options.onWroteRecord ?? ((f: Fact) => written.push(f)) }) }
  await screen.mount(screen.k.h(FactEvidenceSection, props), 20)

  const { k } = screen
  const button = (label: string) => k.all('button').find((b) => b.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined
  const press = async (target: Element | null | undefined) => { assert.ok(target, 'the control exists'); await k.click(target); await k.tick(10) }
  const card = (id: number) => k.one(`li[data-fact="${id}"]`)
  const within = (root: Element | null) => ({
    button: (label: string) => Array.from(root?.querySelectorAll('button') ?? []).find((b) => b.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined,
  })
  const notice = () => k.one('[role="status"][tabindex], [role="alert"][tabindex]')
  const group = (key: string) => k.one(`[data-group="${key}"]`)
  return { ...screen, service, calls, written, button, press, card, within, notice, group, props }
}

describe('Evidence section: opening', () => {
  afterEach(disposeAll)

  it('says it is opening before the first answer, and reads the facts of the record it was given', async () => {
    const s = await setup({ overrides: { entity: () => new Promise(() => undefined) } })
    assert.ok(s.k.bodyText().includes('Opening the evidence…'))
    assert.equal(s.k.one('section[aria-busy="true"]') !== null, true)
    assert.deepEqual(s.calls.entity, [{ type: 'contact', id: CONTACT_ID }])
    s.restore()
  })

  it('reads an organisation\'s facts through the organisation path, and says organisation in its words', async () => {
    const s = await setup({ type: 'organization', id: '135', overrides: { entity: async () => entityData({ entity: { type: 'organization', id: 135, name: 'Hillcrest Academy' }, facts: [websiteFact()], counts: { proposed: 1, applied: 0, dismissed: 0 } }) } })
    assert.deepEqual(s.calls.entity, [{ type: 'organization', id: '135' }])
    assert.ok(s.k.bodyText().includes('found about this organisation'))
    s.restore()
  })

  it('shows what waits first, then what was accepted, dismissed, with the counts in words and a heading each', async () => {
    const s = await setup()
    assert.equal(s.k.one('h3')!.textContent, 'Evidence')
    assert.ok(s.k.one('[data-counts]')!.textContent!.includes('2 waiting, 1 accepted, 1 dismissed'))
    assert.deepEqual(s.k.all('[data-group] h4').map((h) => h.textContent), ['Waiting for you (2)', 'Accepted (1)', 'Dismissed (1)'])
    assert.deepEqual(s.k.all('li[data-fact]').map((li) => li.getAttribute('data-fact')), ['1', '2', '4', '5'])
    assert.ok(s.k.bodyText().includes('Nothing changes the record until you accept it'))
    s.restore()
  })

  it('lists the evidence of every fact: open for what waits, behind a disclosure for what was decided', async () => {
    const s = await setup()
    assert.equal(s.card(1)!.querySelectorAll('li[data-evidence]').length, 2)
    assert.equal(s.card(1)!.querySelectorAll('details').length, 0, 'a waiting fact\'s evidence is not hidden')
    assert.equal(s.card(4)!.querySelectorAll('details').length, 1, 'a decided fact\'s evidence sits behind a disclosure')
    assert.equal(s.card(4)!.querySelectorAll('li[data-evidence]').length, 1, 'but it is in the page')
    s.restore()
  })

  it('has no record line in each card (the section is the record\'s own) and says nothing of the record kind', async () => {
    const s = await setup()
    absent(s.k.one('[data-record]'), 'no "whose fact is it" line')
    s.restore()
  })

  it('says, when a record has no facts, in words, how they come about, and shows no groups', async () => {
    const s = await setup({ overrides: { entity: async () => entityData({ facts: [], counts: { proposed: 0, applied: 0, dismissed: 0 } }) } })
    assert.ok(s.k.one('[data-empty]')!.textContent!.includes('No facts have been suggested for this contact yet.'))
    assert.ok(s.k.one('[data-counts]')!.textContent!.includes('No facts yet'))
    assert.equal(s.k.all('[data-group]').length, 0)
    s.restore()
  })

  it('says when the server cut the list short', async () => {
    const s = await setup({ overrides: { entity: async () => entityData({ counts: { proposed: 200, applied: 40, dismissed: 10 } }) } })
    assert.ok(s.k.one('[data-capped]')!.textContent!.includes('Showing the 4 newest of 250 facts.'))
    s.restore()
  })

  it('shows an error with Retry, and Retry opens the section', async () => {
    let attempts = 0
    const s = await setup({ overrides: { entity: async () => { attempts += 1; if (attempts === 1) throw new ApiError('The server is busy.', 500); return entityData() } } })
    assert.ok(s.k.bodyText().includes('The evidence could not be loaded.'))
    assert.ok(s.k.bodyText().includes('The server is busy.'))
    assert.equal(s.k.one('[role="alert"]') !== null, true)
    await s.press(s.button('Retry'))
    assert.equal(s.calls.entity.length, 2)
    assert.ok(s.card(1))
    assert.equal(s.k.bodyText().includes('The server is busy.'), false)
    s.restore()
  })

  it('says plainly there is no access on a 403, that the record is gone on a 404, that it is not set up on a 503; none has a Retry and none breaks the page', async () => {
    const cases: Array<[number, string, string]> = [[403, 'You do not have access to the evidence here.', 'forbidden'], [404, 'This record could not be found.', 'notFound'], [503, 'The evidence are not set up on this server yet.', 'unavailable']]
    for (const [status, text, state] of cases) {
      const s = await setup({ overrides: { entity: async () => { throw new ApiError('x', status) } } })
      assert.ok(s.k.bodyText().includes(text), `${status}: ${text}`)
      absent(s.button('Retry'), `no Retry on ${status}`)
      assert.equal(s.k.one('[data-evidence-state]')!.getAttribute('data-evidence-state'), state)
      await disposeAll()
    }
  })

  it('says the session is unavailable, and calls nothing, when nobody is signed in', async () => {
    const s = await setup({ session: false })
    assert.ok(s.k.bodyText().includes('Your ERP session is unavailable. Please sign in again.'))
    assert.deepEqual(s.calls.entity, [])
    s.restore()
  })

  it('shows only the answer for the record that is open when a slower answer for the one before arrives late', async () => {
    const first = deferred<FactsEnvelope<FactsEntityData>>()
    const second = deferred<FactsEnvelope<FactsEntityData>>()
    const queue = [first, second]
    const s = await setup({ overrides: { entity: () => queue.shift()!.promise } })
    const { FactEvidenceSection } = await import('../../components/domain/crm/fact-evidence-section')
    await s.k.render(s.wrap(s.k.h(FactEvidenceSection, { ...s.props, entityId: 32 })))
    await s.k.tick(10)
    second.resolve(entityData({ facts: [fact({ id: 21, value: 'second@example.org' })] }))
    await s.k.tick(10)
    first.resolve(entityData({ facts: [fact({ id: 11, value: 'first@example.org' })] }))
    await s.k.tick(10)
    assert.ok(s.k.bodyText().includes('second@example.org'))
    assert.equal(s.k.bodyText().includes('first@example.org'), false, 'the late answer was dropped')
    s.restore()
  })
})

describe('Evidence section: another record', () => {
  afterEach(disposeAll)

  it('starts clean: a message, an open reason form and a half-typed reason belong to the record before', async () => {
    const s = await setup()
    await s.press(s.within(s.card(1)).button('Accept'))
    assert.ok(s.notice(), 'a message is showing for the first record')
    await s.press(s.within(s.card(2)).button('Dismiss'))
    const area = s.k.one('textarea') as HTMLTextAreaElement
    const set = Object.getOwnPropertyDescriptor(s.k.w.HTMLTextAreaElement.prototype, 'value')!.set!
    await s.k.act(async () => { set.call(area, 'half a reason'); area.dispatchEvent(new s.k.w.Event('input', { bubbles: true })) })

    const { FactEvidenceSection } = await import('../../components/domain/crm/fact-evidence-section')
    await s.k.render(s.wrap(s.k.h(FactEvidenceSection, { ...s.props, entityId: 32 })))
    await s.k.tick(20)

    absent(s.notice(), 'no message is showing')
    absent(s.k.one('textarea'), 'the reason form is closed')
    assert.equal(s.k.bodyText().includes('half a reason'), false)
    s.restore()
  })

  it('lets a late accept for the record before change nothing on the one that is open', async () => {
    const gate = deferred<FactDecisionResult>()
    const s = await setup({ overrides: { accept: () => gate.promise } })
    await s.press(s.within(s.card(1)).button('Accept'))
    const { FactEvidenceSection } = await import('../../components/domain/crm/fact-evidence-section')
    await s.k.render(s.wrap(s.k.h(FactEvidenceSection, { ...s.props, entityId: 32 })))
    await s.k.tick(20)
    const reads = s.calls.entity.length

    gate.resolve({ status: 1, data: { outcome: 'applied', fact: fact({ status: 'applied', column_written: true }) } })
    await s.k.tick(20)

    absent(s.notice(), 'the first record\'s result is not announced on the second')
    assert.equal(s.calls.entity.length, reads, 'and the second record is not read again for it')
    assert.deepEqual(s.written, [], 'nor is the page told that a field changed')
    s.restore()
  })
})

describe('Evidence section: accepting', () => {
  afterEach(disposeAll)

  it('accepts the fact that was pressed, reads the record again so it moves to Accepted, says the record was written, and tells the page', async () => {
    const accepted = fact({ id: 1, status: 'applied', column_written: true, decided_by_name: 'Anil Shah', record_value: 'asha.menon@hillcrest.example.edu' })
    const s = await setup({
      overrides: {
        accept: async () => ({ status: 1, data: { outcome: 'applied', fact: accepted } }),
        entity: (() => { let n = 0; return async () => (n++ === 0 ? entityData() : entityData({ facts: [accepted, phoneFact(), appliedFact(), dismissedFact()], counts: { proposed: 1, applied: 2, dismissed: 1 } })) })(),
      },
    })
    await s.press(s.within(s.card(1)).button('Accept'))
    assert.deepEqual(s.calls.accept, [1])
    assert.equal(s.calls.entity.length, 2, 'the record was read again')
    assert.equal(s.card(1)!.parentElement!.closest('[data-group]')!.getAttribute('data-group'), 'applied', 'it moved to Accepted')
    assert.ok(s.notice()!.textContent!.includes('Accepted. The email address was written to the record.'))
    assert.equal(s.notice()!.textContent!.includes('Reload the page'), false, 'a page that shows the new value itself does not ask for a reload')
    assert.deepEqual(s.written.map((f) => f.id), [1], 'the page is told which fact wrote a field, so it can show the new value')
    same(s.k.w.document.activeElement, s.notice(), 'the focus is on the message')
    s.restore()
  })

  it('does NOT tell the page a field changed when the fact was kept in the ledger only, and says so', async () => {
    const s = await setup({ overrides: { accept: async () => ({ status: 1, data: { outcome: 'applied', fact: phoneFact({ status: 'applied', column_written: false, record_value: '+91 11111 22222' }) } }) } })
    await s.press(s.within(s.card(2)).button('Accept'))
    assert.deepEqual(s.written, [])
    assert.ok(s.notice()!.textContent!.includes('Accepted and kept as a fact. The record was not changed because it already holds “+91 11111 22222”.'))
    s.restore()
  })

  it('asks for a reload, in the message, when a field was written and the page cannot show it itself', async () => {
    const s = await setup({ wired: false, overrides: { accept: async () => ({ status: 1, data: { outcome: 'applied', fact: fact({ id: 1, status: 'applied', column_written: true }) } }) } })
    await s.press(s.within(s.card(1)).button('Accept'))
    assert.ok(s.notice()!.textContent!.includes('Reload the page to see it in the details above.'))
    s.restore()
  })

  it('does not ask for a reload when nothing was written to the record', async () => {
    const s = await setup({ wired: false, overrides: { accept: async () => ({ status: 1, data: { outcome: 'applied', fact: fact({ id: 1, status: 'applied', column_written: false }) } }) } })
    await s.press(s.within(s.card(1)).button('Accept'))
    assert.equal(s.notice()!.textContent!.includes('Reload the page'), false)
    s.restore()
  })

  it('disables every button while it works, ignores a second press, and tells a screen reader', async () => {
    const gate = deferred<FactDecisionResult>()
    const s = await setup({ overrides: { accept: () => gate.promise } })
    await s.press(s.within(s.card(1)).button('Accept'))
    assert.equal(s.k.all('button').filter((b) => /^(Accept|Dismiss)/.test(b.textContent?.trim() ?? '')).every((b) => (b as HTMLButtonElement).disabled), true)
    assert.ok(s.k.one('p.sr-only[role="status"]')!.textContent!.includes('Working…'))
    await s.press(s.within(s.card(2)).button('Accept'))
    assert.equal(s.calls.accept.length, 1)
    gate.resolve({ status: 1, data: { outcome: 'applied', fact: fact({ status: 'applied' }) } })
    await s.k.tick(10)
    s.restore()
  })

  it('says in words, and reads again, when it was decided meanwhile (409 not_pending): nothing is announced as done', async () => {
    const cause = new FactsApiError('Already decided.', 409, undefined, undefined, 'not_pending', dismissedFact({ id: 1 }))
    const s = await setup({ overrides: { accept: async () => { throw cause } } })
    await s.press(s.within(s.card(1)).button('Accept'))
    assert.equal(s.notice()!.getAttribute('role'), 'alert')
    assert.ok(s.notice()!.textContent!.includes('Someone had already decided this: it is now dismissed. Nothing was changed.'))
    assert.equal(s.calls.entity.length, 2)
    assert.deepEqual(s.written, [])
    s.restore()
  })

  it('a refused accept (403) takes the buttons away from this record\'s waiting facts and says why', async () => {
    const s = await setup({ overrides: { accept: async () => { throw new FactsApiError('No.', 403, undefined, undefined, 'no_right', null) } } })
    await s.press(s.within(s.card(1)).button('Accept'))
    assert.ok(s.notice()!.textContent!.includes('needs the edit right'))
    absent(s.button('Accept'), 'no Accept left')
    assert.ok(s.k.one('[data-view-only]')!.textContent!.includes('needs the edit right'))
    s.restore()
  })

  it('says a lost connection in words and offers the buttons again', async () => {
    const s = await setup({ overrides: { accept: async () => { throw new TypeError('Failed to fetch') } } })
    await s.press(s.within(s.card(1)).button('Accept'))
    assert.ok(s.notice()!.textContent!.includes('did not reach the server'))
    assert.ok(s.within(s.card(1)).button('Accept'))
    s.restore()
  })
})

describe('Evidence section: dismissing', () => {
  afterEach(disposeAll)

  it('opens the reason form, focuses it, and dismisses with the reason; the fact moves to Dismissed and says it will not be suggested again', async () => {
    const gone = fact({ id: 1, status: 'dismissed', decided_by_name: 'Anil Shah', decision_note: 'wrong person' })
    let reads = 0
    const s = await setup({
      overrides: {
        entity: async () => (reads++ === 0 ? entityData() : entityData({ facts: [gone, phoneFact(), appliedFact(), dismissedFact()], counts: { proposed: 1, applied: 1, dismissed: 2 } })),
        dismiss: async () => ({ status: 1, data: { outcome: 'dismissed', fact: gone } }),
      },
    })
    await s.press(s.within(s.card(1)).button('Dismiss'))
    const area = s.k.one('textarea') as HTMLTextAreaElement
    same(s.k.w.document.activeElement, area, 'the focus is in the reason box')
    const set = Object.getOwnPropertyDescriptor(s.k.w.HTMLTextAreaElement.prototype, 'value')!.set!
    await s.k.act(async () => { set.call(area, 'wrong person'); area.dispatchEvent(new s.k.w.Event('input', { bubbles: true })) })
    await s.press(s.k.withText('Dismiss this suggestion'))
    assert.deepEqual(s.calls.dismiss, [{ id: 1, reason: 'wrong person' }])
    assert.equal(s.card(1)!.closest('[data-group]')!.getAttribute('data-group'), 'dismissed')
    assert.ok(s.notice()!.textContent!.includes('Dismissed. This value will not be suggested again.'))
    absent(s.k.one('textarea'), 'the form is closed')
    s.restore()
  })

  it('Escape closes the form without dismissing and returns the focus to the Dismiss button', async () => {
    const s = await setup()
    await s.press(s.within(s.card(1)).button('Dismiss'))
    await s.k.press('Escape', s.k.one('textarea')!)
    await s.k.tick(5)
    absent(s.k.one('textarea'), 'closed')
    assert.equal(s.calls.dismiss.length, 0)
    same(s.k.w.document.activeElement, s.within(s.card(1)).button('Dismiss'), 'the focus is back')
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

describe('Evidence section: who may decide', () => {
  afterEach(disposeAll)

  it('shows a person who may only read the facts and their evidence, says what they need, and offers no buttons', async () => {
    const s = await setup({ overrides: { entity: async () => entityData({ can: { decide: false } }) } })
    absent(s.button('Accept'), 'no Accept')
    absent(s.button('Dismiss'), 'no Dismiss')
    assert.ok(s.k.one('[data-view-only]')!.textContent!.includes('needs the edit right'))
    assert.equal(s.card(1)!.querySelectorAll('li[data-evidence]').length, 2, 'the evidence is still readable')
    s.restore()
  })

  it('says nothing about rights when nothing waits (nothing to decide)', async () => {
    const s = await setup({ overrides: { entity: async () => entityData({ facts: [appliedFact()], counts: { proposed: 0, applied: 1, dismissed: 0 }, can: { decide: false } }) } })
    absent(s.k.one('[data-view-only]'), 'no note')
    s.restore()
  })
})

describe('Evidence section: accessibility', () => {
  afterEach(disposeAll)

  it('has no axe violations when listing, with a reason form open, empty, in error and view-only', async () => {
    const s = await setup()
    assert.deepEqual(await axeViolations(s.k.one('section')!), [], 'listing')
    await s.press(s.within(s.card(1)).button('Dismiss'))
    assert.deepEqual(await axeViolations(s.k.one('section')!), [], 'with the reason form open')
    await disposeAll()

    const empty = await setup({ overrides: { entity: async () => entityData({ facts: [], counts: { proposed: 0, applied: 0, dismissed: 0 } }) } })
    assert.deepEqual(await axeViolations(empty.k.one('section')!), [], 'empty')
    await disposeAll()

    const failed = await setup({ overrides: { entity: async () => { throw new ApiError('boom', 500) } } })
    assert.deepEqual(await axeViolations(failed.k.one('section')!), [], 'in error')
    await disposeAll()

    const viewOnly = await setup({ overrides: { entity: async () => entityData({ can: { decide: false } }) } })
    assert.deepEqual(await axeViolations(viewOnly.k.one('section')!), [], 'view-only')
  })
})
