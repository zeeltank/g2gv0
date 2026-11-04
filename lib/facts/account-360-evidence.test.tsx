import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent } from '../agent/assertions'
import { orgState } from '../agent/fixtures'
import { fakeService } from '../org-accounts/fake-service'
import { meta, oldAccount360, org360WithCrm } from '../org-accounts/fixtures'
import { DEFAULT_LINKS } from '../org-accounts/links'
import { entityData, websiteFact } from './fixtures'
import { screenKit, type Call } from './screen-kit'

/**
 * The Evidence section inside the Account 360 tab of an Organization: placed right after the linked records, the tab otherwise as it was. First the tab
 * with a stand-in for the section (what it hands over, and where it sits), then the real tab and the real section over a faked network.
 */

interface Slot { organizationId: string; onWroteRecord?: () => void }

async function openView(options: { onRecordWritten?: () => void; withEvidence?: boolean } = {}) {
  const screen = await screenKit({ pathname: '/module/crm/marketing/organizations/11' })
  const { Account360View } = await import('../../components/domain/crm/account-360')
  const { service, calls } = fakeService({ forCrm: async () => ({ status: 1, created: false, data: org360WithCrm() }) })
  const slots: Slot[] = []
  const props = {
    organizationId: '11', service, loadOld: async () => oldAccount360(), links: DEFAULT_LINKS, owners: [],
    ...(options.onRecordWritten ? { onRecordWritten: options.onRecordWritten } : {}),
    ...(options.withEvidence === false ? {} : { evidence: (slot: Slot) => { slots.push(slot); return screen.k.h('section', { 'data-section': 'Evidence', 'data-stub': slot.organizationId }, 'evidence stub') } }),
  }
  await screen.mount(screen.k.h(Account360View, props), 40)
  return { ...screen, slots, calls, props }
}

describe('the Account 360 tab: where the Evidence section sits', () => {
  afterEach(async () => { await disposeAll() })

  it('puts it right after the linked records and before the signals, so the tab keeps its order', async () => {
    const s = await openView()
    const order = Array.from(s.k.all('section')).map((el) => el.getAttribute('data-section') ?? (el.querySelector('h3')?.textContent ?? ''))
    const at = (name: string) => order.findIndex((n) => n === name)
    assert.ok(at('Linked records') >= 0, 'linked records are there')
    assert.equal(at('Evidence'), at('Linked records') + 1, 'Evidence is the very next section')
    assert.equal(at('Signals'), at('Evidence') + 1, 'and the signals follow it')
    assert.ok(at('Contacts') > at('Signals'), 'the rest of the tab is where it was')
    s.restore()
  })

  it('hands it the CRM organization (the record the facts are about), once', async () => {
    const s = await openView()
    assert.ok(s.slots.length >= 1, 'it was rendered')
    assert.deepEqual([...new Set(s.slots.map((slot) => slot.organizationId))], ['11'], 'always for organization 11, never for the identity id')
    assert.equal(s.k.all('[data-stub]').length, 1, 'and only one section is on the tab')
    s.restore()
  })

  it('shows nothing extra when no Evidence component is given (the tab\'s own behaviour is unchanged)', async () => {
    const s = await openView({ withEvidence: false })
    absent(s.k.one('[data-section="Evidence"]'), 'no Evidence section')
    assert.ok(s.k.one('[data-section="Signals"]'), 'the tab is as it was')
    s.restore()
  })

  it('does not hand over a "something was written" callback when the page gave none, so the section asks for a reload itself', async () => {
    const s = await openView()
    assert.equal(s.slots.at(-1)!.onWroteRecord, undefined)
    s.restore()
  })

  it('hands one over when the page can use it, tells the page when it is called, and reads the 360 again', async () => {
    let told = 0
    const s = await openView({ onRecordWritten: () => { told += 1 } })
    const reads = s.calls.forCrm.length
    assert.equal(typeof s.slots.at(-1)!.onWroteRecord, 'function')
    s.slots.at(-1)!.onWroteRecord!()
    await s.k.tick(20)
    assert.equal(told, 1)
    assert.equal(s.calls.forCrm.length, reads + 1, 'the 360 was read again')
    s.restore()
  })
})

describe('the real Account 360 tab with the real Evidence section', () => {
  afterEach(async () => { await disposeAll() })

  const respond = (facts: unknown) => (call: Call): unknown => {
    if (call.path.endsWith('/org-accounts/for-crm/11')) return { status: 1, created: false, data: org360WithCrm() }
    if (call.path.endsWith('/crm/account360/11')) return { status: 1, data: oldAccount360() }
    if (call.path.includes('/agent/organisations/')) return { status: 1, data: orgState() }
    if (call.path.endsWith('/org-accounts/meta')) return { status: 1, data: meta() }
    if (call.path.endsWith('/org-accounts/suggestions')) return { status: 1, data: [] }
    if (call.path.endsWith('/facts/entity/organization/11')) return facts
    return undefined
  }

  async function openReal(facts: unknown = { status: 1, data: entityData({ entity: { type: 'organization', id: 11, name: 'Hillcrest Academy' }, facts: [websiteFact({ entity_id: 11 })], counts: { proposed: 1, applied: 0, dismissed: 0 } }).data }, extra: { onRecordWritten?: () => void } = {}) {
    const screen = await screenKit({ pathname: '/module/crm/marketing/organizations/11', respond: respond(facts) })
    const { Account360 } = await import('../../components/domain/crm/account-360')
    const { getLaravelContext } = await import('../laravel-context')
    await screen.mount(screen.k.h(Account360, { organizationId: '11', context: getLaravelContext(), ...extra }), 60)
    await screen.k.tick(40)
    return screen
  }

  it('reads the facts of THIS organization through the organization path and lists them with their evidence, after the linked records', async () => {
    const s = await openReal()
    assert.equal(s.to('/facts/entity/organization/11').length, 1)
    const section = s.k.one('[data-section="Evidence"]')!
    assert.ok(section, 'the section is on the tab')
    assert.ok(section.textContent!.includes('https://hillcrest.example.edu'))
    assert.ok(section.textContent!.includes('found about this organisation'))
    assert.equal(section.querySelectorAll('li[data-evidence]').length, 1)
    const linked = s.k.all('section').find((el) => el.querySelector('h3')?.textContent === 'Linked records')!
    assert.equal(linked.nextElementSibling, section, 'right after the linked records')
    s.restore()
  })

  it('accepts a fact through the real service (a POST to the fact\'s accept path) and asks for a reload when the page cannot show the written field', async () => {
    const accepted = websiteFact({ entity_id: 11, status: 'applied', column_written: true, decided_by_name: 'Anil Shah' })
    const screen = await screenKit({
      pathname: '/module/crm/marketing/organizations/11',
      respond: (call) => {
        if (call.path.endsWith('/facts/3/accept')) return { status: 1, data: { outcome: 'applied', fact: accepted } }
        return respond({ status: 1, data: entityData({ entity: { type: 'organization', id: 11, name: 'Hillcrest Academy' }, facts: [websiteFact({ entity_id: 11 })], counts: { proposed: 1, applied: 0, dismissed: 0 } }).data })(call)
      },
    })
    const { Account360 } = await import('../../components/domain/crm/account-360')
    const { getLaravelContext } = await import('../laravel-context')
    await screen.mount(screen.k.h(Account360, { organizationId: '11', context: getLaravelContext() }), 60)
    await screen.k.tick(40)
    const accept = Array.from(screen.k.one('[data-section="Evidence"]')!.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Accept')!
    await screen.k.click(accept)
    await screen.k.tick(40)
    const posts = screen.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/facts/3/accept'))
    assert.equal(posts.length, 1)
    assert.deepEqual(posts[0].body, {})
    assert.ok(screen.k.bodyText().includes('Reload the page to see it in the details above.'), 'this page has not been wired to refresh, so the message says so')
    screen.restore()
  })

  it('a failing evidence read never breaks the rest of the tab', async () => {
    const s = await openReal({ __status: 500, status: 0, message: 'The server is busy.' })
    assert.ok(s.k.bodyText().includes('The evidence could not be loaded.'))
    assert.ok(s.k.one('[data-section="Signals"]'), 'the signals are there')
    assert.ok(s.k.one('[data-section="Contacts"]'), 'and the contacts')
    s.restore()
  })

  it('has no axe violations on the Evidence section inside the tab', async () => {
    const s = await openReal()
    assert.deepEqual(await axeViolations(s.k.one('[data-section="Evidence"]')!), [])
    s.restore()
  })
})
