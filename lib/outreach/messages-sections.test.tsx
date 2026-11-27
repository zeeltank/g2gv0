import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent, says } from '../agent/assertions'
import { smsEntry, smsLogAnswer, suppressionsAnswer } from './fixtures'
import { screenKit, server, type Call, type Server } from './screen-kit'

/**
 * What the move of the GTM Outreach screen into the Outreach tab ADDED to it (27 Nov 2026): the Messages view has three sections kept in `?section=`, the suppression list is one of
 * them (the Do not contact list), and the SMS log is the third, a read-only list of what other screens sent. The queue itself, with its checks, is tested in
 * lib/outreach/outreach-screen.test.tsx. The real component, the real service clients, only the network replaced.
 */

async function open(search = '', srv: Server = {}, opts: { administrator?: boolean } = {}) {
  const screen = await screenKit({ respond: server(srv), search })
  // `require`, not `import()`: the screens load these through the same loader, and a dynamic import would give this file a second copy of the auth context.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { AuthContext } = require('../../components/auth/gtg-auth') as typeof import('../../components/auth/gtg-auth')
  /* eslint-enable @typescript-eslint/no-require-imports */
  const { MessagesPanel } = await import('../../components/domain/signals/outreach/messages-panel')
  const { k } = screen
  const panel = k.h(MessagesPanel, {})
  await screen.mount(opts.administrator ? k.h(AuthContext.Provider, { value: { user: { role: 'administrator' } } as never }, panel) : panel, 80)
  const tabs = () => k.all('[role="tablist"][aria-label="Message sections"] [role="tab"]')
  const tabNames = () => tabs().map((t) => t.textContent?.trim() ?? '')
  const selected = () => tabs().filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.textContent?.trim())
  const buttons = () => k.all('button').map((b) => b.textContent?.trim() ?? '')
  const rows = () => k.all('tbody tr')
  const goTo = async (name: string) => {
    const tab = tabs().find((t) => t.textContent?.trim() === name)
    assert.ok(tab, `the section "${name}" is offered`)
    await k.click(tab)
    await k.tick(60)
  }
  const type = async (field: HTMLElement | null, text: string) => {
    assert.ok(field, 'the field exists')
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLInputElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(field, text); field.dispatchEvent(new k.w.Event('input', { bubbles: true })) })
    await k.tick(5)
  }
  const press = async (el: Element | null | undefined) => { assert.ok(el, 'the control exists'); await k.click(el); await k.tick(60) }
  const smsCalls = () => screen.calls.filter((c) => c.path.endsWith('/crm/sms-log'))
  /** The shared Select commits an option on pointer down, not on click. */
  const choose = async (label: string, optionText: string) => {
    const opener = k.all('[role="combobox"]').find((c) => c.getAttribute('aria-label') === label)
    assert.ok(opener, `the select "${label}" is on the screen`)
    await k.click(opener)
    await k.tick(10)
    const list = k.all('[role="listbox"]').filter((el) => el.getAttribute('aria-label') === label).pop()
    assert.ok(list, `the list of "${label}" is open`)
    const option = Array.from(list.querySelectorAll('[role="option"]')).find((o) => o.textContent?.trim() === optionText) as HTMLElement | undefined
    assert.ok(option, `${optionText} is among the choices`)
    await k.act(async () => { option.dispatchEvent(new k.w.Event('pointerdown', { bubbles: true, cancelable: true })) })
    await k.tick(60)
  }
  return { ...screen, tabs, tabNames, selected, buttons, rows, goTo, type, press, smsCalls, choose }
}

describe('the sections of the Messages view', () => {
  afterEach(async () => { await disposeAll() })

  it('offers the message queue, the do not contact list and the SMS log, opens on the queue and shows its messages', async () => {
    const s = await open()
    assert.deepEqual(s.tabNames(), ['Message queue', 'Do not contact list', 'SMS log'])
    assert.deepEqual(s.selected(), ['Message queue'])
    says(s.k.bodyText(), 'Asha Menon')
    says(s.k.bodyText(), 'Sending is enabled')
    says(s.k.bodyText(), 'Nothing is sent without a person approving that exact text')
    s.restore()
  })

  it('builds only the open section: the other two ask the server nothing until they are opened', async () => {
    const s = await open()
    assert.equal(s.to('/gtm/suppressions').length, 0)
    assert.equal(s.smsCalls().length, 0)
    await s.goTo('SMS log')
    assert.equal(s.smsCalls().length, 1)
    assert.equal(s.to('/gtm/suppressions').length, 0, 'the suppression list is still not asked for')
    s.restore()
  })

  it('opens the section by its tab, writes it into the address and keeps the view the address already named', async () => {
    const s = await open('view=messages')
    await s.goTo('Do not contact list')
    assert.deepEqual(s.selected(), ['Do not contact list'])
    assert.match(s.router.lastSearch(), /(^|&)section=suppressions(&|$)/)
    assert.match(s.router.lastSearch(), /(^|&)view=messages(&|$)/, 'the Outreach tab\'s own parameter is kept')
    assert.ok(!s.k.bodyText().includes('Asha Menon'), 'the queue is no longer drawn')
    says(s.k.bodyText(), 'example.org')
    await s.goTo('Message queue')
    assert.ok(!/section=/.test(s.router.lastSearch()), 'the first section is the default and is left out of the address')
    assert.match(s.router.lastSearch(), /(^|&)view=messages(&|$)/)
    says(s.k.bodyText(), 'Asha Menon')
    s.restore()
  })

  it('opens the section the address names, and the queue for one it does not know', async () => {
    const sms = await open('view=messages&section=sms')
    assert.deepEqual(sms.selected(), ['SMS log'])
    says(sms.k.bodyText(), '+91 98765 43210')
    sms.restore()
    await disposeAll()
    const odd = await open('section=nonsense')
    assert.deepEqual(odd.selected(), ['Message queue'])
    odd.restore()
  })

  it('moves between the sections with the arrow keys, as a tab bar should', async () => {
    const s = await open()
    const first = s.tabs()[0]
    await s.k.act(async () => { first.focus() })
    await s.k.press('ArrowRight', first)
    await s.k.tick(60)
    assert.deepEqual(s.selected(), ['Do not contact list'])
    s.restore()
  })
})

describe('the message queue inside its section', () => {
  afterEach(async () => { await disposeAll() })

  it('draws the statuses as filters with their counts, and asks the server for exactly the one pressed', async () => {
    const s = await open()
    const group = s.k.one('[role="group"][aria-label="Show messages that are"]')
    assert.ok(group, 'the filters are a named group')
    const chips = Array.from(group.querySelectorAll('button')) as HTMLElement[]
    assert.equal(chips[0].textContent?.trim(), 'All')
    assert.equal(chips[0].getAttribute('aria-pressed'), 'true')
    const approved = chips.find((c) => c.textContent?.trim() === 'approved (1)')
    assert.ok(approved, 'a status with messages shows how many')
    await s.press(approved)
    const asked = s.to('/gtm/outreach').filter((c) => c.method === 'GET' && c.query.get('status') === 'approved')
    assert.equal(asked.length >= 1, true, 'the list was asked for approved messages')
    assert.equal(approved.getAttribute('aria-pressed'), 'true')
    assert.equal(chips[0].getAttribute('aria-pressed'), 'false')
    s.restore()
  })

  it('offers New message to an Administrator only (the server refuses everyone else)', async () => {
    const reader = await open()
    assert.equal(reader.buttons().includes('New message'), false)
    reader.restore()
    await disposeAll()
    const admin = await open('', {}, { administrator: true })
    assert.equal(admin.buttons().includes('New message'), true)
    admin.restore()
  })
})

describe('the Do not contact list', () => {
  afterEach(async () => { await disposeAll() })

  it('lists the addresses and domains with their reasons, locks the ones a real event added and lets a person remove only their own', async () => {
    const s = await open('section=suppressions')
    assert.equal(s.rows().length, 2)
    says(s.rows()[0].textContent, 'example.org')
    says(s.rows()[0].textContent, 'unsubscribe')
    says(s.rows()[0].textContent, 'locked')
    says(s.rows()[1].textContent, 'blocked@example.net')
    says(s.rows()[1].textContent, 'asked us to stop')
    assert.ok(s.k.one('button[aria-label="Remove blocked@example.net"]'), 'an entry added by hand can be removed')
    absent(s.k.one('button[aria-label="Remove example.org"]'), 'an entry added by an unsubscribe cannot')
    says(s.k.bodyText(), '2 entries')
    s.restore()
  })

  it('adds an address by hand: the form\'s own values go to the server and the list is read again', async () => {
    const s = await open('section=suppressions')
    const field = s.k.one('input[placeholder="name@example.com"]')
    await s.type(field, 'stop@example.com')
    await s.press(s.k.withText('Add'))
    const writes = s.calls.filter((c) => c.method === 'POST')
    assert.equal(writes.length, 1, 'one write')
    assert.ok(writes[0].path.endsWith('/gtm/suppressions'), writes[0].path)
    assert.deepEqual(writes[0].body, { kind: 'email', value: 'stop@example.com' })
    assert.equal(s.to('/gtm/suppressions').filter((c) => c.method === 'GET').length >= 2, true, 'read once on opening and once after the add')
    s.restore()
  })

  it('says plainly when nothing is suppressed', async () => {
    const s = await open('section=suppressions', { suppressions: suppressionsAnswer([]) })
    says(s.k.bodyText(), 'Nothing suppressed')
    s.restore()
  })

  it('has nothing for the accessibility rules to find', async () => {
    const s = await open('section=suppressions')
    assert.deepEqual(await axeViolations(s.k.one('[role="tabpanel"]:not([hidden])')!), [])
    s.restore()
  })
})

describe('the SMS log', () => {
  afterEach(async () => { await disposeAll() })

  it('lists what was sent, in words: the number, the text, Sent or Failed, why it failed and when', async () => {
    const s = await open('section=sms')
    assert.equal(s.rows().length, 2)
    says(s.rows()[0].textContent, '+91 98765 43210')
    says(s.rows()[0].textContent, 'Your demo is booked for Monday at 11 am.')
    says(s.rows()[0].textContent, 'Sent')
    says(s.rows()[0].textContent, '2026-11-03 10:15:00')
    says(s.rows()[1].textContent, 'Failed')
    says(s.rows()[1].textContent, 'No SMS gateway configured for this tenant.')
    says(s.k.bodyText(), '2 messages')
    s.restore()
  })

  it('says SMS cannot be sent from here, and has no control that sends one', async () => {
    const s = await open('section=sms')
    says(s.k.bodyText(), 'SMS cannot be sent from here yet')
    assert.deepEqual(s.buttons().filter((name) => /send|schedule|approve/i.test(name)), [], `the buttons are: ${s.buttons().join(', ')}`)
    assert.deepEqual(s.calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`), [], 'opening it and reading it writes nothing')
    s.restore()
  })

  it('offers the existing export, for the same search and status', async () => {
    const s = await open('section=sms')
    const link = s.k.one('[data-export-href]')?.getAttribute('data-export-href') ?? ''
    assert.match(link, /\/crm\/sms-log\/export/)
    s.restore()
  })

  it('asks the server after a pause in typing, once, for the text typed, from page one', async () => {
    const s = await open('section=sms')
    const field = s.k.one('input[aria-label="Search phone number"]')
    await s.type(field, '9')
    await s.type(field, '98765')
    assert.equal(s.smsCalls().filter((c) => c.query.get('search')).length, 0, 'nothing is asked while typing')
    await s.k.tick(450)
    const asked = s.smsCalls().filter((c) => c.query.get('search'))
    assert.deepEqual(asked.map((c) => [c.query.get('search'), c.query.get('page')]), [['98765', '1']])
    s.restore()
  })

  it('asks for exactly the status chosen', async () => {
    const s = await open('section=sms')
    await s.choose('Status', 'Failed')
    const last = s.smsCalls().at(-1)!
    assert.equal(last.query.get('status'), 'failed')
    assert.equal(last.query.get('page'), '1')
    s.restore()
  })

  it('pages: twenty a page, Next asks for the next page, and Previous waits until there is one', async () => {
    const s = await open('section=sms', { sms: (c: Call) => smsLogAnswer(c.query.get('page') === '2' ? [smsEntry({ id: '90', toNumber: '+91 90000 00090' })] : undefined, 45) })
    says(s.k.bodyText(), 'Page 1 of 3')
    says(s.k.bodyText(), '45 messages')
    assert.equal((s.k.withText('Previous') as HTMLButtonElement).disabled, true)
    assert.equal(s.smsCalls()[0].query.get('per_page'), '20')
    await s.press(s.k.withText('Next'))
    assert.equal(s.smsCalls().at(-1)!.query.get('page'), '2')
    says(s.k.bodyText(), 'Page 2 of 3')
    says(s.k.bodyText(), '+91 90000 00090')
    assert.equal((s.k.withText('Previous') as HTMLButtonElement).disabled, false)
    s.restore()
  })

  it('tells a person what to do when nothing was sent yet, and when the search matches nothing', async () => {
    const none = await open('section=sms', { sms: smsLogAnswer([]) })
    says(none.k.bodyText(), 'No text messages have been sent yet.')
    none.restore()
    await disposeAll()
    const filtered = await open('section=sms', { sms: (c: Call) => (c.query.get('status') ? smsLogAnswer([]) : smsLogAnswer()) })
    await filtered.choose('Status', 'Waiting to send')
    says(filtered.k.bodyText(), 'No text messages match.')
    filtered.restore()
  })

  it('answers a person without the right in a sentence, with no Retry that could not help', async () => {
    const s = await open('section=sms', { sms: { __status: 403, status: 0, message: 'Forbidden' } })
    says(s.k.bodyText(), 'You do not have access to the SMS log.')
    assert.equal(s.buttons().includes('Retry'), false)
    s.restore()
  })

  it('shows another failure with its words and a Retry that asks again and shows the rows', async () => {
    let n = 0
    const s = await open('section=sms', { sms: () => (++n === 1 ? { __status: 500, status: 0, message: 'The SMS list broke.' } : smsLogAnswer()) })
    says(s.k.bodyText(), 'The SMS list broke.')
    await s.press(s.k.withText('Retry'))
    assert.equal(s.smsCalls().length, 2)
    says(s.k.bodyText(), '+91 98765 43210')
    s.restore()
  })

  it('has nothing for the accessibility rules to find', async () => {
    const s = await open('section=sms')
    assert.deepEqual(await axeViolations(s.k.one('[role="tabpanel"]:not([hidden])')!), [])
    s.restore()
  })
})

describe('the Messages view cannot send a text message', () => {
  const read = (file: string) => readFileSync(path.resolve(file), 'utf8')

  it('the SMS log reads through getSmsLog and the export address, and names no send call, dialog or bulk route', () => {
    const source = read('components/domain/signals/outreach/messages-sms-log.tsx')
    assert.match(source, /crmService\.getSmsLog\(/)
    assert.match(source, /crmService\.smsLogExportUrl\(/)
    assert.doesNotMatch(source, /sendSms|SendSmsDialog|bulkSendSms|bulk-message|sms-log\/send|apiClient\.(post|put|patch|delete)/i)
  })

  it('nothing in the panel imports the Send SMS dialog or the CRM sending calls', () => {
    const source = read('components/domain/signals/outreach/messages-panel.tsx')
    assert.doesNotMatch(source, /send-sms-dialog|SendSmsDialog|crmService\.(sendSms|bulkSendSms)/)
  })
})

describe('the Messages view at a phone width (390 px)', () => {
  // jsdom has no layout, so this reads the source, the way lib/outreach/mobile-width.test.ts does for the Checks section.
  const read = (file: string) => readFileSync(path.resolve('components/domain/signals/outreach', file), 'utf8')

  it('keeps every table in a box that scrolls on its own, and sets no nowrap text or fixed pixel width', () => {
    for (const file of ['messages-panel.tsx', 'messages-sms-log.tsx']) {
      const source = read(file)
      const tables = (source.match(/<table\b/gi) ?? []).length
      assert.ok(tables > 0, `${file} draws a table, so this test reads something`)
      assert.ok((source.match(/overflow-x-auto/g) ?? []).length >= tables, `${file}: each table is inside an overflow-x-auto box`)
      assert.deepEqual(source.split(/\r?\n/).filter((line) => /whitespace-nowrap|\bmin-w-\[|\bw-\[\d/.test(line)), [], file)
    }
  })

  it('lets the section filters, the status chips and the SMS log toolbar wrap onto more lines', () => {
    assert.match(read('messages-panel.tsx'), /role="group" aria-label="Show messages that are"/)
    assert.match(read('messages-panel.tsx'), /<div className="flex flex-wrap gap-1\.5" role="group"/)
    assert.match(read('messages-sms-log.tsx'), /<div className="flex flex-wrap items-center gap-2">/)
  })
})
