import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent, same } from '../agent/assertions'
import type { Fact } from '../../services/facts/types'
import { appliedFact, dismissedFact, evidence, fact, phoneFact, websiteFact } from './fixtures'
import { screenKit } from './screen-kit'

interface Props {
  fact: Fact
  showRecord?: boolean
  recordHref?: string | null
  canDecide?: boolean
  viewOnlyNote?: boolean
  busy?: 'accept' | 'dismiss' | null
  anyBusy?: boolean
  dismissing?: boolean
  reason?: string
}

/** One fact card on a page in a fake browser; every callback is recorded. */
async function setup(options: Props) {
  const screen = await screenKit()
  const { FactCard } = await import('../../components/domain/crm/fact-parts')
  const events: string[] = []
  const props = {
    canDecide: true, busy: null, anyBusy: false, dismissing: false, reason: '', showRecord: false, recordHref: null, viewOnlyNote: false,
    onReason: (text: string) => events.push(`reason:${text}`),
    onAccept: (f: Fact) => events.push(`accept:${f.id}`),
    onOpenDismiss: (f: Fact) => events.push(`open:${f.id}`),
    onCancelDismiss: (back: () => void) => { events.push('cancel'); back() },
    onConfirmDismiss: (f: Fact) => events.push(`confirm:${f.id}`),
    ...options,
  }
  await screen.mount(screen.k.h('ul', null, screen.k.h(FactCard, props)))
  const card = () => screen.k.one('li[data-fact]')!
  const button = (label: string) => screen.k.all('button').find((b) => b.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined
  return { ...screen, events, card, button }
}

describe('FactCard: what a waiting fact shows', () => {
  afterEach(disposeAll)

  it('shows the field, the value, the band and score in words, and why, in text', async () => {
    const s = await setup({ fact: fact() })
    const text = s.card().textContent!
    assert.ok(text.includes('Email address'))
    assert.equal(s.k.one('[data-value]')!.textContent, 'asha.menon@hillcrest.example.edu')
    assert.ok(text.includes('Probable · 87% sure'), 'the band and the score are words')
    assert.ok(text.includes('Personal address'), 'a personal address says so')
    assert.ok(text.includes('More likely than not'), 'the meaning of the band')
    assert.ok(text.includes('Two independent sources agree'), 'the server\'s rationale')
    assert.equal(s.card().getAttribute('data-status'), 'proposed')
    s.restore()
  })

  it('says a role address is one, and says nothing for a field where it does not apply', async () => {
    const role = await setup({ fact: fact({ value: 'principal@hillcrest.example.edu', value_kind: 'role' }) })
    assert.ok(role.card().textContent!.includes('Role address'))
    await disposeAll()
    const none = await setup({ fact: phoneFact() })
    assert.equal(none.card().textContent!.includes('Role address'), false)
    assert.equal(none.card().textContent!.includes('Personal address'), false)
    none.restore()
  })

  it('lists every piece of evidence with what it is, how much it counts, the quote and where it came from', async () => {
    const s = await setup({ fact: fact() })
    const items = s.k.all('li[data-evidence]')
    assert.deepEqual(items.map((i) => i.getAttribute('data-evidence')), ['site.own-page', 'profile.email-match'])
    assert.ok(items[0].textContent!.includes("The organisation's own website states it"))
    assert.ok(items[0].textContent!.includes('Strength 80%'))
    assert.ok(items[0].textContent!.includes('“Write to the principal at principal@hillcrest.example.edu”'))
    assert.ok(items[0].textContent!.includes('hillcrest.example.edu/contact'))
    assert.ok(items[0].textContent!.includes('Retrieved 3 Nov 2026'))
    assert.ok(s.k.bodyText().includes('Evidence (2)'))
    s.restore()
  })

  it('says plainly when a fact has no evidence recorded', async () => {
    const s = await setup({ fact: fact({ evidence: [] }) })
    assert.ok(s.k.one('[data-no-evidence]')!.textContent!.includes('No evidence was recorded'))
    assert.ok(s.k.bodyText().includes('Evidence (0)'))
    s.restore()
  })

  it('shows what the record holds beside the suggestion, and says accepting will not replace it', async () => {
    const s = await setup({ fact: phoneFact() })
    assert.ok(s.k.one('[data-record-line]')!.textContent!.includes('The record holds “+91 11111 22222”. Accepting keeps this as a fact and does not replace it.'))
    s.restore()
  })

  it('shows whose fact it is, with a link to the record, only when asked to (the queue does, a record\'s own section does not)', async () => {
    const queue = await setup({ fact: fact(), showRecord: true, recordHref: '/module/crm/marketing/contacts/31' })
    const rec = queue.k.one('[data-record]')!
    assert.ok(rec.textContent!.includes('Contact'))
    assert.equal(rec.querySelector('a')!.getAttribute('href'), '/module/crm/marketing/contacts/31')
    assert.equal(rec.querySelector('a')!.textContent, 'Asha Menon')
    await disposeAll()
    const own = await setup({ fact: fact() })
    absent(own.k.one('[data-record]'), 'no record line in a record\'s own section')
    own.restore()
  })

  it('names the record by its kind and id when the queue row has no name, and does not link a record with no page', async () => {
    const s = await setup({ fact: fact({ entity_name: null, entity_id: 77 }), showRecord: true, recordHref: null })
    const rec = s.k.one('[data-record]')!
    assert.ok(rec.textContent!.includes('Contact 77'))
    absent(rec.querySelector('a'), 'no link without an address')
    s.restore()
  })
})

describe('FactCard: everything a model or the web wrote is text', () => {
  afterEach(disposeAll)

  const evil = '<img src=x onerror=alert(1)><script>alert(2)</script>'

  it('draws a value, a quote, a label, a rationale and a source as text, never as markup', async () => {
    const s = await setup({
      fact: fact({
        value: evil, rationale: evil, proposed_by: evil, field_label: evil,
        evidence: [evidence({ label: evil, quote: evil, source_url: evil })],
      }),
    })
    assert.equal(s.card().querySelector('img'), null, 'no element was made from the text')
    assert.equal(s.card().querySelector('script'), null)
    assert.ok(s.card().textContent!.includes('<img src=x onerror=alert(1)>'), 'the markup is shown as the characters it is')
    s.restore()
  })

  it('makes a source a link only for http or https (new tab, no opener) and shows anything else as plain text', async () => {
    const s = await setup({
      fact: fact({
        evidence: [
          evidence({ kind: 'a', source_url: 'https://example.org/team', quote: null }),
          evidence({ kind: 'b', source_url: 'javascript:alert(1)', quote: null }),
          evidence({ kind: 'c', source_url: 'data:text/html;base64,AAAA', quote: null }),
          evidence({ kind: 'd', source_url: '//evil.example/x', quote: null }),
          evidence({ kind: 'e', source_url: '/module/crm/marketing/contacts/31', quote: null }),
        ],
      }),
    })
    const item = (kind: string) => s.k.one(`li[data-evidence="${kind}"]`)!
    const web = item('a').querySelector('a')!
    assert.equal(web.getAttribute('href'), 'https://example.org/team')
    assert.equal(web.getAttribute('target'), '_blank')
    assert.equal(web.getAttribute('rel'), 'noopener noreferrer')
    assert.ok(web.textContent!.includes('(opens in a new tab)'), 'a screen reader is told')
    for (const kind of ['b', 'c', 'd']) {
      absent(item(kind).querySelector('a'), `${kind} is not a link`)
      assert.equal(item(kind).querySelector('[data-source]')!.getAttribute('data-source'), 'text')
    }
    assert.equal(item('e').querySelector('a')!.getAttribute('href'), '/module/crm/marketing/contacts/31', 'a path inside the application is a link')
    s.restore()
  })

  it('links a website value only when it is an http(s) address, and shows an email value as text with no mailto or tel link', async () => {
    const good = await setup({ fact: websiteFact() })
    const link = good.k.one('[data-value] a')!
    assert.equal(link.getAttribute('href'), 'https://hillcrest.example.edu/')
    assert.equal(link.getAttribute('rel'), 'noopener noreferrer')
    await disposeAll()
    const bad = await setup({ fact: websiteFact({ value: 'javascript:alert(1)' }) })
    absent(bad.k.one('[data-value] a'), 'a javascript: website is not a link')
    assert.equal(bad.k.one('[data-value]')!.textContent, 'javascript:alert(1)')
    await disposeAll()
    const email = await setup({ fact: fact() })
    absent(email.k.one('[data-value] a'), 'an email value is text')
    assert.equal(email.card().querySelectorAll('a[href^="mailto:"], a[href^="tel:"]').length, 0)
    email.restore()
  })
})

describe('FactCard: deciding', () => {
  afterEach(disposeAll)

  it('offers Accept and Dismiss on a fact that waits, and neither on a decided one', async () => {
    const waiting = await setup({ fact: fact() })
    assert.ok(waiting.button('Accept') && waiting.button('Dismiss'))
    await disposeAll()
    for (const decided of [appliedFact(), dismissedFact(), fact({ status: 'superseded' })]) {
      const s = await setup({ fact: decided })
      absent(s.button('Accept'), `no Accept on a ${decided.status} fact`)
      absent(s.button('Dismiss'), `no Dismiss on a ${decided.status} fact`)
      await disposeAll()
    }
  })

  it('offers neither to a person who may not decide, and says why only when asked to', async () => {
    const quiet = await setup({ fact: fact(), canDecide: false })
    absent(quiet.button('Accept'), 'no Accept')
    absent(quiet.k.one('[data-view-only]'), 'no note unless asked')
    await disposeAll()
    const noted = await setup({ fact: fact({ entity_type: 'organization' }), canDecide: false, viewOnlyNote: true })
    assert.ok(noted.k.one('[data-view-only]')!.textContent!.includes('needs the edit right on Organisations'))
    noted.restore()
  })

  it('Accept calls back with the fact; Dismiss opens the reason form instead of deciding', async () => {
    const s = await setup({ fact: fact({ id: 7 }) })
    await s.k.click(s.button('Accept')!)
    await s.k.click(s.button('Dismiss')!)
    assert.deepEqual(s.events, ['accept:7', 'open:7'])
    s.restore()
  })

  it('shows the reason form when dismissing, with a label, a count, and Dismiss this suggestion / Keep it', async () => {
    const s = await setup({ fact: fact({ id: 7 }), dismissing: true, reason: 'abc' })
    const area = s.k.one('textarea')!
    assert.equal(area.getAttribute('maxlength'), '500')
    assert.ok(s.k.bodyText().includes('3 of 500 characters'))
    assert.ok(s.k.bodyText().includes('Why are you dismissing this? (optional)'))
    assert.equal(s.k.w.document.querySelector(`label[for="${area.id}"]`)!.textContent, 'Why are you dismissing this? (optional)')
    assert.ok(s.button('Dismiss this suggestion') && s.button('Keep it'))
    same(s.k.w.document.activeElement, area, 'the focus is in the reason box when it opens')
    s.restore()
  })

  it('submitting the form confirms; Escape and Keep it cancel and put the focus back on the Dismiss button', async () => {
    const s = await setup({ fact: fact({ id: 7 }), dismissing: true })
    await s.k.click(s.button('Dismiss this suggestion')!)
    assert.deepEqual(s.events, ['confirm:7'])

    await s.k.press('Escape', s.k.one('textarea')!)
    await s.k.tick(5)
    assert.equal(s.events.at(-1), 'cancel')
    same(s.k.w.document.activeElement, s.button('Dismiss'), 'Escape returns the focus to the button that opened the form')

    ;(s.button('Dismiss') as HTMLElement).blur()
    await s.k.click(s.button('Keep it')!)
    await s.k.tick(5)
    assert.equal(s.events.at(-1), 'cancel')
    same(s.k.w.document.activeElement, s.button('Dismiss'), 'Keep it returns the focus too')
    s.restore()
  })

  it('disables every button while anything is in flight, and marks the one that is working', async () => {
    const s = await setup({ fact: fact(), anyBusy: true, busy: 'accept' })
    assert.equal(s.button('Accept')!.disabled, true)
    assert.equal(s.button('Dismiss')!.disabled, true)
    await s.k.click(s.button('Accept')!)
    assert.deepEqual(s.events, [], 'a disabled button does nothing')
    s.restore()
  })

  it('ties the buttons to the fact they decide (aria-describedby) and the Dismiss button to its form', async () => {
    const s = await setup({ fact: fact(), dismissing: true })
    const summary = s.card().querySelector('[id$="-summary"]')!
    assert.equal(s.button('Accept')!.getAttribute('aria-describedby'), summary.id)
    const dismiss = s.button('Dismiss')!
    assert.equal(dismiss.getAttribute('aria-expanded'), 'true')
    assert.ok(s.k.w.document.getElementById(dismiss.getAttribute('aria-controls')!), 'the form it controls exists')
    s.restore()
  })
})

describe('FactCard: a decided fact', () => {
  afterEach(disposeAll)

  it('says in words who accepted it, whether the record was written, and keeps the evidence behind a disclosure', async () => {
    const s = await setup({ fact: appliedFact() })
    assert.ok(s.card().textContent!.includes('Accepted by Anil Shah'))
    assert.ok(s.k.one('[data-record-line]')!.textContent!.includes('Written to the record.'))
    assert.ok(s.k.one('[data-decision]')!.textContent!.startsWith('Accepted on 3 Nov 2026'))
    const details = s.card().querySelector('details')!
    assert.ok(details.querySelector('summary')!.textContent!.includes('Evidence (1)'))
    assert.ok(details.querySelector('li[data-evidence]'), 'the evidence is in the page, behind the disclosure')
    s.restore()
  })

  it('says in words that a dismissed fact is dismissed, by whom, and the reason that was given', async () => {
    const s = await setup({ fact: dismissedFact() })
    assert.ok(s.card().textContent!.includes('Dismissed by Anil Shah'))
    assert.ok(s.k.one('[data-decision]')!.textContent!.includes('Reason given: That is the school office, not her.'))
    s.restore()
  })

  it('says a fact kept only in the ledger was not written to the record', async () => {
    const s = await setup({ fact: appliedFact({ column_written: false, record_value: 'Head of school' }) })
    assert.ok(s.k.one('[data-record-line]')!.textContent!.includes('The record already held “Head of school”'))
    s.restore()
  })
})

describe('FactCard: accessibility', () => {
  afterEach(disposeAll)

  it('has no axe violations for a waiting fact with the reason form open, a decided fact and a view-only fact', async () => {
    for (const props of [{ fact: fact(), dismissing: true, reason: 'x', showRecord: true, recordHref: '/module/crm/marketing/contacts/31' }, { fact: appliedFact() }, { fact: dismissedFact() }, { fact: phoneFact(), canDecide: false, viewOnlyNote: true }]) {
      const s = await setup(props)
      assert.deepEqual(await axeViolations(s.card()), [], `${props.fact.status} fact`)
      await disposeAll()
    }
  })
})
