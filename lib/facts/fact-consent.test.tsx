import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent } from '../agent/assertions'
import { ApiError } from '../../services/core'
import type { FactsApi } from '../../services/facts/api-types'
import type { ConsentData, FactEntityType, FactsEnvelope } from '../../services/facts/types'
import { fakeFactsService } from './fake-service'
import { consentData } from './fixtures'
import { screenKit } from './screen-kit'

interface Setup {
  type?: FactEntityType
  id?: number | string
  overrides?: Partial<FactsApi>
  session?: boolean
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

async function setup(options: Setup = {}) {
  const screen = await screenKit()
  const { ConsentLine } = await import('../../components/domain/crm/fact-consent')
  if (options.session === false) screen.k.w.localStorage.clear()
  const { service, calls } = fakeFactsService(options.overrides)
  const props = { entityType: options.type ?? 'contact', entityId: options.id ?? 31, service }
  await screen.mount(screen.k.h(ConsentLine, props), 20)
  const channel = (key: string) => screen.k.one(`li[data-channel="${key}"]`)
  return { ...screen, service, calls, channel, props }
}

describe('the consent line', () => {
  afterEach(disposeAll)

  it('says it is checking before the first answer, and reads the consent of the record it was given', async () => {
    const s = await setup({ overrides: { consent: () => new Promise(() => undefined) } })
    assert.ok(s.k.bodyText().includes('Checking consent…'))
    assert.equal(s.k.one('section[aria-busy="true"]') !== null, true)
    assert.deepEqual(s.calls.consent, [{ type: 'contact', id: 31 }])
    s.restore()
  })

  it('says for each channel, in a word, whether it may be used, with the reason when it may not', async () => {
    const s = await setup()
    assert.equal(s.k.one('[data-consent-summary]')!.textContent, 'Email allowed · SMS not allowed · WhatsApp not allowed')
    assert.deepEqual(s.k.all('li[data-channel]').map((li) => li.getAttribute('data-channel')), ['email', 'sms', 'whatsapp'])
    assert.ok(s.channel('email')!.textContent!.includes('Allowed'))
    assert.equal(s.channel('email')!.getAttribute('data-allowed'), 'true')
    assert.ok(s.channel('sms')!.textContent!.includes('Not allowed'))
    assert.ok(s.channel('sms')!.textContent!.includes('No consent has been recorded for this channel.'))
    assert.equal(s.channel('sms')!.getAttribute('data-allowed'), 'false')
    assert.ok(s.channel('whatsapp')!.textContent!.includes('No phone number on record.'))
    s.restore()
  })

  it('says nothing blocks an allowed channel by saying nothing about a reason for it', async () => {
    const s = await setup()
    assert.equal(s.channel('email')!.textContent, 'EmailAllowed')
    s.restore()
  })

  it('names the places the answer was read from, in words', async () => {
    const s = await setup({ overrides: { consent: async () => consentData({ sources: [{ source: 'email_opt_out', value: '1', at: null }, { source: 'gtm_suppressions', value: 'bounced (email)', at: '2026-11-03T15:22:57+00:00' }] }) } })
    const list = s.k.one('ul[aria-label="Where this was read from"]')!
    assert.deepEqual(Array.from(list.querySelectorAll('li')).map((li) => li.textContent!.replace(/\(3 Nov 2026.*\)/, '(3 Nov 2026)')), ['Email opt-out flag: opted out', 'Suppression list: bounced (email) (3 Nov 2026)'])
    s.restore()
  })

  it('leaves out the list of places when there are none, and says Nothing is sent from this screen', async () => {
    const s = await setup({ overrides: { consent: async () => consentData({ sources: [] }) } })
    absent(s.k.one('ul[aria-label="Where this was read from"]'), 'no list')
    assert.ok(s.k.bodyText().includes("Nothing is sent from this screen, and nothing here changes anyone's consent."))
    s.restore()
  })

  it('never assumes a channel the server did not report is allowed', async () => {
    const s = await setup({ overrides: { consent: async () => consentData({ channels: { email: { allowed: true, reason: null, code: null } } }) } })
    assert.deepEqual(s.k.all('li[data-channel]').map((li) => li.getAttribute('data-channel')), ['email'])
    assert.equal(s.k.one('[data-consent-summary]')!.textContent, 'Email allowed')
    await disposeAll()
    const none = await setup({ type: 'organization', overrides: { consent: async () => consentData({ channels: {} }) } })
    assert.equal(none.k.one('[data-consent-summary]')!.textContent, 'No channel was reported for this organisation.')
    absent(none.k.one('ul[aria-label="Channels"]'), 'no list of channels')
    none.restore()
  })

  it('reads an organisation\'s and a lead\'s consent through their own paths', async () => {
    const org = await setup({ type: 'organization', id: '135' })
    assert.deepEqual(org.calls.consent, [{ type: 'organization', id: '135' }])
    await disposeAll()
    const lead = await setup({ type: 'lead', id: 7 })
    assert.deepEqual(lead.calls.consent, [{ type: 'lead', id: 7 }])
    lead.restore()
  })

  it('shows an error with Retry, and Retry opens it', async () => {
    let attempts = 0
    const s = await setup({ overrides: { consent: async () => { attempts += 1; if (attempts === 1) throw new ApiError('The server is busy.', 500); return consentData() } } })
    assert.ok(s.k.bodyText().includes('Consent could not be loaded.'))
    assert.equal(s.k.one('[role="alert"]') !== null, true)
    await s.k.click(s.k.withText('Retry')!)
    await s.k.tick(10)
    assert.equal(s.calls.consent.length, 2)
    assert.ok(s.k.one('[data-consent-summary]'))
    s.restore()
  })

  it('says plainly there is no access on a 403, that the record is gone on a 404, that it is not set up on a 503; no Retry', async () => {
    const cases: Array<[number, string, string]> = [[403, 'You do not have access to consent information here.', 'forbidden'], [404, 'This record could not be found.', 'notFound'], [503, 'Consent information are not set up on this server yet.', 'unavailable']]
    for (const [status, text, state] of cases) {
      const s = await setup({ overrides: { consent: async () => { throw new ApiError('x', status) } } })
      assert.ok(s.k.bodyText().includes(text), `${status}: ${text}`)
      absent(s.k.withText('Retry'), `no Retry on ${status}`)
      assert.equal(s.k.one('[data-consent-state]')!.getAttribute('data-consent-state'), state)
      await disposeAll()
    }
  })

  it('says the session is unavailable, and calls nothing, when nobody is signed in', async () => {
    const s = await setup({ session: false })
    assert.ok(s.k.bodyText().includes('Your ERP session is unavailable. Please sign in again.'))
    assert.deepEqual(s.calls.consent, [])
    s.restore()
  })

  it('shows only the answer for the record that is open when a slower answer for the one before arrives late', async () => {
    const first = deferred<FactsEnvelope<ConsentData>>()
    const second = deferred<FactsEnvelope<ConsentData>>()
    const queue = [first, second]
    const s = await setup({ overrides: { consent: () => queue.shift()!.promise } })
    const { ConsentLine } = await import('../../components/domain/crm/fact-consent')
    await s.k.render(s.wrap(s.k.h(ConsentLine, { ...s.props, entityId: 32 })))
    await s.k.tick(10)
    second.resolve(consentData({ channels: { email: { allowed: true, reason: null } } }))
    await s.k.tick(10)
    first.resolve(consentData({ channels: { email: { allowed: false, reason: 'FIRST record opted out.', code: 'opted_out' } } }))
    await s.k.tick(10)
    assert.equal(s.k.one('[data-consent-summary]')!.textContent, 'Email allowed')
    assert.equal(s.k.bodyText().includes('FIRST record opted out.'), false, 'the late answer was dropped')
    s.restore()
  })

  it('shows no buttons at all: reading consent changes nothing', async () => {
    const s = await setup()
    assert.equal(s.k.all('section button').length, 0)
    s.restore()
  })

  it('has no axe violations when ready, in error and when forbidden', async () => {
    const ready = await setup()
    assert.deepEqual(await axeViolations(ready.k.one('section')!), [], 'ready')
    await disposeAll()
    const failed = await setup({ overrides: { consent: async () => { throw new ApiError('boom', 500) } } })
    assert.deepEqual(await axeViolations(failed.k.one('section')!), [], 'in error')
    await disposeAll()
    const forbidden = await setup({ overrides: { consent: async () => { throw new ApiError('no', 403) } } })
    assert.deepEqual(await axeViolations(forbidden.k.one('section')!), [], 'forbidden')
  })
})
