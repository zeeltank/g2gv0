import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent, says } from '../agent/assertions'
import { FAILING, REFUSAL_TEXT, attempt, claim, claimsAnswer, gateAnswer, message, readiness, wireChecks } from './fixtures'
import { BUSY_TEXT, CLAIMS_FORBIDDEN_TEXT, FORBIDDEN_TEXT, NETWORK_TEXT, NO_CLAIMS_TEXT, UNAVAILABLE_TEXT, UNREADABLE_TEXT } from './model'
import { gateCalls, screenKit, server, type Call, type Server } from './screen-kit'

/**
 * The GTM Outreach screen as a person meets it: the real list, the real message dialog, the real service clients, only the network replaced. The send,
 * approve and cancel controls in these tests are the screen's OWN, pressed only to see what the Checks section does with their answers.
 */

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

async function open(srv: Server = {}, opts: { openRow?: boolean } = {}) {
  const screen = await screenKit({ respond: server(srv) })
  const { OutreachView } = await import('../../components/domain/gtm/outreach-view')
  await screen.mount(screen.k.h(OutreachView, {}), 80)
  const { k } = screen
  ;(k.w as unknown as { confirm: () => boolean }).confirm = () => true
  const press = async (el: Element | null | undefined) => { assert.ok(el, 'the control exists'); await k.click(el); await k.tick(40) }
  const row = () => k.one('tbody tr')
  if (opts.openRow !== false) await press(row())
  const dialog = () => k.one('[role="dialog"]')
  const section = () => k.one('[data-outreach-checks]')
  const within = (selector: string) => Array.from(section()?.querySelectorAll(selector) ?? []) as HTMLElement[]
  const keys = () => within('li[data-check-key]').map((li) => li.getAttribute('data-check-key'))
  const verdicts = () => within('li[data-check-key]').map((li) => li.getAttribute('data-check-passed'))
  const summary = () => k.one('[data-checks-summary]')?.textContent?.trim() ?? null
  const button = (name: string) => (Array.from(dialog()?.querySelectorAll('button') ?? []) as HTMLElement[]).find((b) => b.textContent?.trim() === name) ?? null
  const dialogButtons = () => (Array.from(dialog()?.querySelectorAll('button') ?? []) as HTMLElement[]).map((b) => b.textContent?.trim() ?? '')
  const type = async (field: HTMLElement | null, text: string) => {
    assert.ok(field, 'the field exists')
    const proto = field.tagName === 'TEXTAREA' ? k.w.HTMLTextAreaElement.prototype : k.w.HTMLInputElement.prototype
    const set = Object.getOwnPropertyDescriptor(proto, 'value')!.set!
    await k.act(async () => { set.call(field, text); field.dispatchEvent(new k.w.Event('input', { bubbles: true })) })
    await k.tick(5)
  }
  return { ...screen, press, row, dialog, section, within, keys, verdicts, summary, button, dialogButtons, type }
}

const FAILING_ANSWER = () => gateAnswer(wireChecks(FAILING))

describe('opening a draft shows its checks', () => {
  afterEach(async () => { await disposeAll() })

  it('asks the server once, for this message, only when the draft is opened', async () => {
    const s = await open({ gate: FAILING_ANSWER() }, { openRow: false })
    assert.equal(gateCalls(s.calls).length, 0, 'the list alone runs no check')
    await s.press(s.row())
    const asked = gateCalls(s.calls)
    assert.equal(asked.length, 1)
    assert.equal(asked[0].method, 'GET')
    assert.equal(asked[0].query.get('table'), 'gtm_outreach_messages')
    assert.equal(asked[0].query.get('id'), '11')
    await s.k.tick(200)
    assert.equal(gateCalls(s.calls).length, 1, 'and does not ask again by itself')
    s.restore()
  })

  it('says in a line how many checks failed and that the message cannot be sent yet', async () => {
    const s = await open({ gate: FAILING_ANSWER() })
    assert.equal(s.summary(), '3 of 10 checks failed: you cannot send this yet.')
    s.restore()
  })

  it('lists the failed checks first, each as a sentence with Failed or Passed in words', async () => {
    const s = await open({ gate: FAILING_ANSWER() })
    assert.deepEqual(s.keys().slice(0, 3), ['banned_phrase', 'unapproved_claim', 'suppression'])
    assert.deepEqual(s.verdicts(), ['false', 'false', 'false', 'true', 'true', 'true', 'true', 'true', 'true', 'true'])
    const items = s.within('li[data-check-key]')
    says(items[0].textContent, 'Failed: The message uses a banned phrase.')
    says(items[1].textContent, 'Failed: The message states a claim nobody has approved.')
    says(items[2].textContent, 'Failed: The address, or its domain, is on the suppression list.')
    says(items[3].textContent, 'Passed: ')
    for (const li of items) assert.match(li.textContent ?? '', /^(Failed|Passed):/, 'the word comes first')
    s.restore()
  })

  it('shows the server\'s own words for why, under each failed check', async () => {
    const s = await open({ gate: FAILING_ANSWER() })
    const first = s.within('li[data-check-key]')[0]
    says(first.textContent, 'Contains “guaranteed results”.')
    says(s.within('li[data-check-key="suppression"]')[0].textContent, 'The address is on the suppression list (domain example.org, unsubscribed).')
    s.restore()
  })

  it('says all passed, with no failed item and no claims list, when everything passed', async () => {
    const s = await open({ gate: gateAnswer(wireChecks()) })
    assert.equal(s.summary(), 'All 10 checks passed.')
    assert.deepEqual(new Set(s.verdicts()), new Set(['true']))
    assert.doesNotMatch(s.section()!.textContent ?? '', /Failed/)
    absent(s.k.one('[data-outreach-claims]'), 'no failed claim check, no claims list')
    assert.equal(s.calls.filter((c) => c.path.endsWith('/outreach/claims')).length, 0, 'and the claims are not even asked for')
    s.restore()
  })

  it('shows when the checks ran', async () => {
    const s = await open({ gate: FAILING_ANSWER() })
    says(s.section()!.textContent, 'Checked 04 Nov 2026')
    s.restore()
  })

  it('an empty list of checks does not read as passed', async () => {
    const s = await open({ gate: gateAnswer([], { passed: true }) })
    assert.match(s.summary() ?? '', /^No check came back/)
    assert.doesNotMatch(s.summary() ?? '', /All|passed\./)
    assert.equal(s.within('li').length, 0)
    s.restore()
  })

  it('a server that says "not passed" with every check shown as passed is not shown as passed', async () => {
    const s = await open({ gate: gateAnswer(wireChecks(), { passed: false }) })
    assert.match(s.summary() ?? '', /did not pass/)
    assert.equal(s.k.one('[data-checks-summary]')!.getAttribute('data-checks-summary'), 'failed')
    s.restore()
  })

  it('a check this screen has no sentence for still appears, in the server\'s words', async () => {
    const s = await open({ gate: gateAnswer([...wireChecks(), { key: 'geo_fence', label: 'Inside the region', passed: false, detail: 'The contact is outside the region.' }]) })
    assert.equal(s.keys()[0], 'geo_fence')
    says(s.within('li')[0].textContent, 'Failed: Inside the region: this check failed.')
    assert.equal(s.summary(), '1 of 11 checks failed: you cannot send this yet.')
    s.restore()
  })
})

describe('Check again', () => {
  afterEach(async () => { await disposeAll() })

  it('runs the checks once more and shows the new answer', async () => {
    let n = 0
    const s = await open({ gate: () => (++n === 1 ? FAILING_ANSWER() : gateAnswer(wireChecks())) })
    assert.equal(s.summary(), '3 of 10 checks failed: you cannot send this yet.')
    await s.press(s.button('Check again'))
    assert.equal(gateCalls(s.calls).length, 2)
    assert.equal(s.summary(), 'All 10 checks passed.')
    await s.k.tick(200)
    assert.equal(gateCalls(s.calls).length, 2, 'one press, one call')
    s.restore()
  })

  it('keeps the old list and the button off while the new answer is on its way, and ignores a second press', async () => {
    const later = deferred<void>()
    let n = 0
    const s = await open({ gate: async () => { if (++n === 2) await later.promise; return FAILING_ANSWER() } })
    await s.press(s.button('Check again'))
    const again = s.button('Check again') as HTMLButtonElement
    assert.equal(again.disabled, true)
    says(s.section()!.textContent, 'Checking again…')
    assert.equal(s.summary(), '3 of 10 checks failed: you cannot send this yet.', 'the earlier answer stays until the new one comes')
    await s.k.click(again)
    assert.equal(gateCalls(s.calls).length, 2, 'a press while it is running asks nothing more')
    later.resolve()
    await s.k.tick(40)
    assert.equal((s.button('Check again') as HTMLButtonElement).disabled, false)
    absent(s.k.one('[data-checks-busy]'), 'the note goes with the wait')
    s.restore()
  })

  it('while the first answer is awaited it says it is checking and offers no button', async () => {
    const first = deferred<void>()
    const s = await open({ gate: async () => { await first.promise; return FAILING_ANSWER() } })
    says(s.k.one('[data-checks-loading]')?.textContent, 'Checking this message…')
    absent(s.button('Check again'), 'nothing to press yet')
    absent(s.k.one('[data-checks-summary]'), 'and no summary drawn from nothing')
    first.resolve()
    await s.k.tick(40)
    assert.equal(s.summary(), '3 of 10 checks failed: you cannot send this yet.')
    s.restore()
  })

  it('a slow answer to an earlier ask does not overwrite a newer one', async () => {
    const slow = deferred<void>()
    let n = 0
    // The first ask (on open) is held back; a refused send makes a second ask, which answers at once. When the first finally answers, the newer one stands.
    const s = await open({
      gate: async () => { const mine = ++n; if (mine === 1) { await slow.promise; return gateAnswer(wireChecks()) } return FAILING_ANSWER() },
      send: { __status: 422, status: 0, code: 'gate_blocked', message: REFUSAL_TEXT },
    })
    assert.ok(s.k.one('[data-checks-loading]'), 'the first ask is still pending')
    await s.press(s.button('Send now'))
    assert.equal(s.summary(), '3 of 10 checks failed: you cannot send this yet.')
    slow.resolve()
    await s.k.tick(40)
    assert.equal(s.summary(), '3 of 10 checks failed: you cannot send this yet.', 'the late, older answer ("all passed") did not replace it')
    s.restore()
  })
})

describe('when the checks cannot be shown', () => {
  afterEach(async () => { await disposeAll() })

  const baselineButtons = async () => {
    const s = await open({ gate: { __status: 404, status: 0, message: 'Not Found' } })
    const labels = s.dialogButtons()
    s.restore()
    await disposeAll()
    return labels
  }

  for (const [status, text] of [[404, UNAVAILABLE_TEXT], [403, FORBIDDEN_TEXT]] as const) {
    it(`a ${status} says the checks are not available on this server yet, offers no retry, and leaves the screen as it was`, async () => {
      const s = await open({ gate: { __status: status, status: 0, message: 'The server said no.' } })
      assert.equal(s.k.one('[data-checks-failed]')?.getAttribute('data-checks-failed'), 'unavailable')
      says(s.k.one('[data-checks-failed]')?.textContent, text)
      absent(s.button('Check again'), 'no Check again')
      absent(s.button('Retry'), 'and no Retry: it cannot help')
      assert.equal(gateCalls(s.calls).length, 1)
      says(s.dialog()?.textContent, 'Send attempts')
      says(s.dialog()?.textContent, 'A quick idea for Hillcrest')
      assert.ok(s.button('Save changes') && s.button('Cancel message') && s.button('Send now'), 'its own controls are all there')
      s.restore()
    })
  }

  it('a failure of the server offers Retry, and Retry asks again and shows the list', async () => {
    let n = 0
    const s = await open({ gate: () => (++n === 1 ? { __status: 500, status: 0, message: 'The checks broke.' } : FAILING_ANSWER()) })
    assert.equal(s.k.one('[data-checks-failed]')?.getAttribute('data-checks-failed'), 'error')
    says(s.k.one('[data-checks-failed]')?.textContent, 'The checks broke.')
    absent(s.button('Check again'), 'the button is called Retry here')
    await s.press(s.button('Retry'))
    assert.equal(gateCalls(s.calls).length, 2)
    absent(s.k.one('[data-checks-failed]'), 'the error is gone')
    assert.equal(s.summary(), '3 of 10 checks failed: you cannot send this yet.')
    s.restore()
  })

  it('a throttled answer (429) says to wait, and offers Retry', async () => {
    const s = await open({ gate: { __status: 429, status: 0, message: 'Too Many Attempts.' } })
    assert.equal(s.k.one('[data-checks-failed]')?.getAttribute('data-checks-failed'), 'busy')
    says(s.k.one('[data-checks-failed]')?.textContent, BUSY_TEXT)
    assert.ok(s.button('Retry'))
    s.restore()
  })

  it('a failure to reach the server says so, and offers Retry', async () => {
    const s = await open({ gate: () => { throw new TypeError('Failed to fetch') } })
    // the kit turns a throw into a 500 with the thrown message; the network text belongs to a TypeError the browser throws, covered in model.test.ts
    assert.equal(s.k.one('[data-checks-failed]')?.getAttribute('data-checks-failed'), 'error')
    assert.ok(s.button('Retry'))
    assert.notEqual(NETWORK_TEXT, '')
    s.restore()
  })

  it('an answer that is not the contract says so, never an empty list that looks like "nothing failed"', async () => {
    const s = await open({ gate: { status: 1, data: { passed: true } } })
    says(s.k.one('[data-checks-failed]')?.textContent, UNREADABLE_TEXT)
    absent(s.k.one('[data-checks-summary]'), 'no summary')
    assert.ok(s.button('Retry'))
    s.restore()
  })

  it('the failed states add exactly one control (Retry or nothing) to the dialog\'s own', async () => {
    const base = await baselineButtons()
    const s = await open({ gate: { __status: 500, status: 0, message: 'x' } })
    assert.deepEqual(s.dialogButtons().filter((l) => !base.includes(l)), ['Retry'])
    s.restore()
  })
})

describe('which drafts get checks', () => {
  afterEach(async () => { await disposeAll() })

  for (const status of ['draft', 'rejected', 'pending_approval', 'approved', 'failed']) {
    it(`a ${status} message has a Checks section`, async () => {
      const s = await open({ messages: [message({ status })], gate: FAILING_ANSWER() })
      assert.ok(s.section(), 'the section is there')
      assert.equal(gateCalls(s.calls).length, 1)
      s.restore()
    })
  }

  for (const status of ['sent', 'cancelled', 'sending']) {
    it(`a ${status} message has no Checks section and no check is run`, async () => {
      const s = await open({ messages: [message({ status, sent_at: status === 'sent' ? '2026-11-04 09:30:00' : null })], gate: FAILING_ANSWER() })
      absent(s.section(), 'no section')
      assert.equal(gateCalls(s.calls).length, 0)
      says(s.dialog()?.textContent, 'A quick idea for Hillcrest')
      s.restore()
    })
  }

  it('an empty list shows the empty state and runs no check', async () => {
    const s = await open({ messages: [] }, { openRow: false })
    says(s.k.bodyText(), 'No messages')
    assert.equal(gateCalls(s.calls).length, 0)
    s.restore()
  })

  it('opening a second message asks about that one', async () => {
    const s = await open({ messages: [message({ id: 11 }), message({ id: 12, subject: 'Second' })], gate: FAILING_ANSWER() }, { openRow: false })
    await s.press(s.k.all('tbody tr')[1])
    assert.equal(gateCalls(s.calls)[0].query.get('id'), '12')
    s.restore()
  })
})

describe('the text of the draft', () => {
  afterEach(async () => { await disposeAll() })

  it('with unsaved edits it says the checks read the saved message and does not offer Check again', async () => {
    const s = await open({ messages: [message({ status: 'draft' })], gate: FAILING_ANSWER() })
    assert.equal((s.button('Check again') as HTMLButtonElement).disabled, false)
    await s.type(s.dialog()!.querySelector('input'), 'A different subject')
    says(s.k.one('[data-checks-unsaved]')?.textContent, 'You have unsaved changes. The checks read the saved message')
    assert.equal((s.button('Check again') as HTMLButtonElement).disabled, true)
    assert.equal(gateCalls(s.calls).length, 1, 'typing runs no check')
    await s.type(s.dialog()!.querySelector('input'), 'A quick idea for Hillcrest')
    absent(s.k.one('[data-checks-unsaved]'), 'back to the saved text, no note')
    assert.equal((s.button('Check again') as HTMLButtonElement).disabled, false)
    s.restore()
  })

  it('after the change is saved the report is marked out of date, and Check again brings it up to date', async () => {
    const list = [message({ status: 'draft' })]
    let n = 0
    const s = await open({
      messages: list,
      gate: () => (++n === 1 ? FAILING_ANSWER() : gateAnswer(wireChecks())),
      other: (c: Call) => {
        if (c.method === 'PATCH') { list[0] = message({ status: 'draft', subject: 'A better subject' }); return { status: 1, data: { message: list[0] } } }
        return undefined
      },
    })
    absent(s.k.one('[data-checks-stale]'), 'a fresh report is not out of date')
    await s.type(s.dialog()!.querySelector('input'), 'A better subject')
    await s.press(s.button('Save changes'))
    await s.k.tick(40)
    says(s.k.one('[data-checks-stale]')?.textContent, 'This message changed after these checks ran')
    assert.equal(gateCalls(s.calls).length, 1, 'saving does not run the checks by itself')
    assert.equal(s.summary(), '3 of 10 checks failed: you cannot send this yet.', 'the old answer is still what is shown, and marked')
    await s.press(s.button('Check again'))
    assert.equal(gateCalls(s.calls).length, 2)
    absent(s.k.one('[data-checks-stale]'), 'up to date again')
    assert.equal(s.summary(), 'All 10 checks passed.')
    s.restore()
  })
})

describe('a send the checks refused', () => {
  afterEach(async () => { await disposeAll() })

  const refused = (message_ = REFUSAL_TEXT) => ({ __status: 422, status: 0, code: 'gate_blocked', message: message_, data: { message: message() }, checks: [{ key: 'banned_phrase', passed: false, detail: 'Contains “guaranteed results”.' }] })

  it('shows the refusal inside the Checks section, with the full list, and not as the generic red line', async () => {
    const s = await open({ gate: FAILING_ANSWER(), send: refused() })
    await s.press(s.button('Send now'))
    const box = s.k.one('[data-checks-refusal]')
    assert.ok(box, 'the refusal is in the section')
    says(box.textContent, 'The send was refused.')
    says(box.textContent, REFUSAL_TEXT)
    assert.equal(box.getAttribute('role'), 'alert')
    assert.equal((s.dialog()!.textContent ?? '').split(REFUSAL_TEXT).length - 1, 1, 'said once: not again as a generic error line')
    assert.equal(gateCalls(s.calls).length, 2, 'the list is read again, once, to show every check')
    assert.equal(s.summary(), '3 of 10 checks failed: you cannot send this yet.')
    assert.equal(s.within('li[data-check-key]').length, 10)
    s.restore()
  })

  it('a second refusal reads the list again', async () => {
    const s = await open({ gate: FAILING_ANSWER(), send: refused() })
    await s.press(s.button('Send now'))
    await s.press(s.button('Send now'))
    assert.equal(gateCalls(s.calls).length, 3)
    s.restore()
  })

  it('another refusal is shown the old way and does not run the checks', async () => {
    const s = await open({ gate: FAILING_ANSWER(), send: { __status: 422, status: 0, code: 'daily_cap', message: 'The daily cap of 50 emails was reached.' } })
    await s.press(s.button('Send now'))
    absent(s.k.one('[data-checks-refusal]'), 'not the gate')
    says(s.dialog()?.textContent, 'The daily cap of 50 emails was reached.')
    assert.equal(gateCalls(s.calls).length, 1)
    s.restore()
  })

  it('the refusal goes when the next action of the dialog starts', async () => {
    let sends = 0
    const s = await open({ gate: FAILING_ANSWER(), send: () => (++sends === 1 ? refused() : { status: 1, data: { message: message() } }) })
    await s.press(s.button('Send now'))
    assert.ok(s.k.one('[data-checks-refusal]'))
    await s.press(s.button('Send now'))
    absent(s.k.one('[data-checks-refusal]'), 'a notice about the last attempt does not outlive the next one')
    assert.equal(gateCalls(s.calls).length, 2, 'clearing a refusal asks nothing: one on open, one for the refusal')
    s.restore()
  })

  it('shows, next to an attempt the gate stopped, that it was held back, and nothing next to another', async () => {
    const s = await open({ gate: FAILING_ANSWER(), attempts: [attempt(), attempt({ id: 2, attempt: 2, code: 'daily_cap', detail: 'The daily cap was reached.' })] })
    const notes = s.k.all('[data-gate-blocked]')
    assert.equal(notes.length, 1)
    assert.equal(notes[0].textContent, 'Held back by the outreach checks. Nothing was sent.')
    s.restore()
  })
})

describe('the approved claims under a failed claim check', () => {
  afterEach(async () => { await disposeAll() })

  const claimCalls = (calls: Call[]) => calls.filter((c) => c.path.endsWith('/outreach/claims'))

  it('lists what is approved, for all products when the message names none', async () => {
    const s = await open({ gate: FAILING_ANSWER(), claims: claimsAnswer([claim(), claim({ id: 32, claim: 'Rolled out in 6 weeks.', product_name: 'School ERP', source_url: null })]) })
    const box = s.k.one('[data-outreach-claims]')
    assert.ok(box)
    assert.equal(box.querySelector('h4')?.textContent, 'Approved claims (all products)')
    assert.equal(box.querySelectorAll('li').length, 2)
    says(box.textContent, 'Used by over 200 schools in India.')
    says(box.textContent, 'School ERP · ')
    says(box.textContent, 'No source recorded')
    const asked = claimCalls(s.calls)
    assert.equal(asked.length, 1)
    assert.equal(asked[0].query.get('status'), 'approved')
    assert.equal(asked[0].query.get('limit'), '100')
    assert.equal(asked[0].query.get('product_master_id'), null)
    assert.doesNotMatch(box.textContent ?? '', /Showing/, 'everything that exists is shown, so there is no "showing" line')
    s.restore()
  })

  it('asks for the message\'s own product when it is declared', async () => {
    const s = await open({ messages: [message({ product_master_id: 9 })], gate: FAILING_ANSWER() })
    assert.equal(s.k.one('[data-outreach-claims] h4')?.textContent, 'Approved claims for this product')
    assert.equal(claimCalls(s.calls)[0].query.get('product_master_id'), '9')
    assert.doesNotMatch(s.k.one('[data-outreach-claims]')?.textContent ?? '', /School ERP/, 'the product is named only when the list spans products')
    s.restore()
  })

  it('links a source only when it is an http or https address', async () => {
    const s = await open({ gate: FAILING_ANSWER(), claims: claimsAnswer([claim({ id: 1 }), claim({ id: 2, source_url: 'javascript:alert(1)' })]) })
    const links = s.k.all('[data-outreach-claims] a')
    assert.equal(links.length, 1)
    assert.equal(links[0].getAttribute('href'), 'https://example.org/case-studies')
    assert.equal(links[0].getAttribute('rel'), 'noopener noreferrer')
    says(s.k.one('[data-claim-id="2"]')?.textContent, 'Source: javascript:alert(1)')
    s.restore()
  })

  it('says when nothing is approved, and why that matters', async () => {
    const s = await open({ gate: FAILING_ANSWER(), claims: claimsAnswer([]) })
    assert.equal(s.k.one('[data-claims-empty]')?.textContent, NO_CLAIMS_TEXT)
    s.restore()
  })

  it('says how many more there are than are shown', async () => {
    const s = await open({ gate: FAILING_ANSWER(), claims: claimsAnswer([claim()], 5) })
    says(s.k.one('[data-outreach-claims]')?.textContent, 'Showing 1 of 5 approved claims.')
    s.restore()
  })

  it('shows only the claims the server marks approved', async () => {
    const s = await open({ gate: FAILING_ANSWER(), claims: claimsAnswer([claim({ id: 1 }), claim({ id: 2, status: 'proposed', claim: 'Proposed only sentence here.' })]) })
    assert.equal(s.k.all('[data-outreach-claims] li').length, 1)
    assert.doesNotMatch(s.k.one('[data-outreach-claims]')?.textContent ?? '', /Proposed only/)
    s.restore()
  })

  it('a role without the Products right sees a plain note, no retry, and the checks above still work', async () => {
    const s = await open({ gate: FAILING_ANSWER(), claims: { __status: 403, status: 0, message: 'Forbidden' } })
    says(s.k.one('[data-claims-failed]')?.textContent, CLAIMS_FORBIDDEN_TEXT)
    absent(s.k.one('[data-claims-failed] button'), 'no retry')
    assert.equal(s.summary(), '3 of 10 checks failed: you cannot send this yet.')
    s.restore()
  })

  it('a failure offers Retry, which asks again', async () => {
    let n = 0
    const s = await open({ gate: FAILING_ANSWER(), claims: () => (++n === 1 ? { __status: 500, status: 0, message: 'The list broke.' } : claimsAnswer()) })
    says(s.k.one('[data-claims-failed]')?.textContent, 'The list broke.')
    await s.press(s.k.one('[data-claims-failed] button'))
    assert.equal(claimCalls(s.calls).length, 2)
    assert.equal(s.k.all('[data-outreach-claims] li').length, 1)
    s.restore()
  })

  it('is only a list: no button, no field, no way to propose or approve', async () => {
    const s = await open({ gate: FAILING_ANSWER() })
    const box = s.k.one('[data-outreach-claims]')!
    assert.equal(box.querySelectorAll('button, input, select, textarea, form').length, 0)
    assert.doesNotMatch(box.textContent ?? '', /\b(Propose|Approve|Retire)\b/)
    s.restore()
  })

  it('is not asked for when the claim check passed', async () => {
    const s = await open({ gate: gateAnswer(wireChecks({ banned_phrase: 'Contains “free”.' })) })
    assert.equal(claimCalls(s.calls).length, 0)
    absent(s.k.one('[data-outreach-claims]'), 'no list')
    s.restore()
  })
})

describe('the section adds no control that sends, schedules or switches anything on', () => {
  afterEach(async () => { await disposeAll() })

  it('adds exactly one button to the dialog, Check again, and no field', async () => {
    const without = await open({ gate: { __status: 404, status: 0, message: 'x' } })
    const base = without.dialogButtons()
    const inputsBase = without.dialog()!.querySelectorAll('input, select, textarea').length
    without.restore()
    await disposeAll()
    const s = await open({ gate: FAILING_ANSWER() })
    assert.deepEqual(s.dialogButtons().filter((l) => !base.includes(l)), ['Check again'])
    assert.equal(s.dialogButtons().length, base.length + 1)
    assert.equal(s.dialog()!.querySelectorAll('input, select, textarea').length, inputsBase)
    assert.deepEqual(Array.from(s.section()!.querySelectorAll('button')).map((b) => b.textContent?.trim()), ['Check again'])
    assert.equal(s.section()!.querySelectorAll('input, select, textarea, form').length, 0)
    assert.equal(Array.from(s.section()!.querySelectorAll('a')).filter((a) => !a.closest('[data-outreach-claims]')).length, 0, 'the only links are the claims\' sources')
    s.restore()
  })

  it('only ever reads: every request the section and the claims list make is a GET', async () => {
    const s = await open({ gate: FAILING_ANSWER() })
    await s.press(s.button('Check again'))
    const ours = s.calls.filter((c) => c.path.endsWith('/outreach/gate') || c.path.endsWith('/outreach/claims'))
    assert.ok(ours.length >= 3)
    assert.deepEqual([...new Set(ours.map((c) => c.method))], ['GET'])
    s.restore()
  })

  it('opening a draft and pressing Check again calls no send, approve, schedule or cancel route', async () => {
    const s = await open({ gate: FAILING_ANSWER() })
    await s.press(s.button('Check again'))
    const writes = s.calls.filter((c) => c.method !== 'GET')
    assert.deepEqual(writes.map((c) => `${c.method} ${c.path}`), [])
    s.restore()
  })

  it('shows no sentence that sending is allowed', async () => {
    const s = await open({ gate: gateAnswer(wireChecks()) })
    assert.doesNotMatch(s.section()!.textContent ?? '', /you can send|ready to send|safe to send|will be sent/i)
    s.restore()
  })
})

describe('the section for a person using the keyboard and a screen reader', () => {
  afterEach(async () => { await disposeAll() })

  it('has nothing for the accessibility rules to find, in a failed run, a passed run and each failed state', async () => {
    for (const gate of [FAILING_ANSWER(), gateAnswer(wireChecks()), gateAnswer([]), { __status: 404, status: 0, message: 'x' }, { __status: 500, status: 0, message: 'x' }]) {
      const s = await open({ gate })
      assert.ok(s.section(), 'the section is there to be checked')
      assert.deepEqual(await axeViolations(s.section()!), [], JSON.stringify(gate).slice(0, 60))
      s.restore()
      await disposeAll()
    }
  })

  it('adds no rule violation to the dialog as a whole', async () => {
    const plain = await open({ gate: { __status: 404, status: 0, message: 'x' } })
    const before = (await axeViolations(plain.k.w.document.body)).map((v) => v.split(':')[0])
    plain.restore()
    await disposeAll()
    const s = await open({ gate: FAILING_ANSWER() })
    const after = (await axeViolations(s.k.w.document.body)).map((v) => v.split(':')[0])
    s.restore()
    assert.deepEqual(after.filter((rule) => !before.includes(rule)), [], `before: ${before.join(', ')}`)
  })

  it('names the section by a heading, marks every verdict in words, and hides the icons from a screen reader', async () => {
    const s = await open({ gate: FAILING_ANSWER() })
    assert.equal(s.section()!.querySelector('h3')?.textContent, 'Checks')
    for (const svg of s.within('svg')) assert.equal(svg.getAttribute('aria-hidden'), 'true')
    assert.equal(s.within('svg').length, 10, 'one icon per check')
    assert.equal(s.k.one('[data-checks-summary]')!.getAttribute('role'), 'status')
    s.restore()
  })

  it('keeps the readiness panel of the screen as it was', async () => {
    const s = await open({ gate: FAILING_ANSWER() }, { openRow: false })
    says(s.k.bodyText(), 'Sending is enabled')
    s.restore()
    assert.equal(readiness().can_send, true)
  })
})
