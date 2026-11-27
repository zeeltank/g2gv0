import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { screenKit, type Call } from '../leads/screen-kit'
import type { SignalConvertBody, SignalFunnelApi } from '../../services/signal-review/signal-funnel-service'
import type { Opportunity } from '../../services/signals/opportunities'

/**
 * The funnel on a signal card (S20) as a person meets it: "Convert to opportunity" and its pop-up, built from the same three cards as Convert Lead. The real components,
 * a fake network and a fake funnel service that records what it was asked.
 */

const pick = (value: string, label = value, isDefault = false) => ({ value, label, sortOrder: 1, isDefault })
const PICKLISTS = {
  organizations: { industry: [pick('Education'), pick('Retail')] },
  contacts: { contact_role: [pick('Decision maker'), pick('Billing')] },
  opportunities: { sales_stage: [pick('Prospecting', 'Prospecting', true), pick('Proposal/Quotation')] },
}

const SIGNAL = { id: 7, title: 'Opens a new campus', company_name: 'Greenfield School', industry: 'Education', review_status: 'New', likely_stakeholder: 'The principal' } as unknown as Opportunity

interface Fake extends SignalFunnelApi {
  converted: Array<{ id: number; body: SignalConvertBody }>
}

function fakeFunnel(): Fake {
  const fake: Fake = {
    converted: [],
    async convertToOpportunity(id, body) {
      fake.converted.push({ id, body })
      return { status: 1, data: { opportunity_id: 9, opportunity_name: body.opportunity?.name ?? null, organization_id: 3, created: true } }
    },
  }
  return fake
}

async function open(initial: Opportunity, funnel: Fake) {
  const screen = await screenKit({
    pathname: '/signals',
    respond: (call: Call) => {
      if (call.path.endsWith('/table_data')) return [{ id: 2, first_name: 'Anil', last_name: 'Shah' }]
      if (call.method === 'GET' && call.path.endsWith('/crm/picklist-values')) return { status: 1, message: 'ok', data: PICKLISTS }
      return undefined
    },
  })
  const React = await import('react')
  const { SignalFunnelActions, FunnelFeedbackMessage, useSignalFunnel } = await import('../../components/domain/signals/signal-funnel')
  function Harness() {
    const [row, setRow] = React.useState<Opportunity>(initial)
    const state = useSignalFunnel({ signal: row, funnel, onChanged: setRow })
    return screen.k.h(React.Fragment, null, screen.k.h(SignalFunnelActions, { funnel: state, signal: row, disabled: false }), screen.k.h(FunnelFeedbackMessage, { feedback: state.feedback }))
  }
  await screen.mount(screen.k.h(Harness, null), 80)
  const { k } = screen
  const write = async (el: Element, text: string, kind: 'input' | 'select' = 'input') => {
    const proto = kind === 'select' ? k.w.HTMLSelectElement.prototype : k.w.HTMLInputElement.prototype
    await k.act(async () => {
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, text)
      el.dispatchEvent(new k.w.Event(kind === 'select' ? 'change' : 'input', { bubbles: true }))
    })
    await k.tick(30)
  }
  const link = (label: string) => k.all('a').find((a) => a.textContent?.trim() === label) ?? null
  return { ...screen, write, link }
}

describe('Convert to opportunity', () => {
  afterEach(async () => { await disposeAll() })

  it('is the only funnel action on a card: no status, button or link about Prospecting, even when the server still sends an account', async () => {
    const s = await open({ ...SIGNAL, prospecting: { account_id: 41, stage: 'target', contacts_count: 2 } } as unknown as Opportunity, fakeFunnel())
    assert.ok(s.k.withText('Convert to opportunity'))
    assert.ok(!s.k.bodyText().includes('Prospecting'), 'nothing says Prospecting')
    assert.equal(s.k.all('a').length, 0, 'and there is no link to open an account')
  })

  it('opens the pop-up built from the shared cards: the organization from the signal\'s company, the person optional, the opportunity named after both', async () => {
    const s = await open(SIGNAL, fakeFunnel())
    await s.k.click(s.k.withText('Convert to opportunity')!)
    await s.k.tick(80)

    const dialog = s.k.one('[role="dialog"]')!
    assert.ok(dialog.textContent?.includes('Add a person (optional)'))
    assert.ok(dialog.textContent?.includes('The signal suggests: The principal'), 'the stakeholder text is only a suggestion')
    assert.equal((s.k.one('[name="convert-opp-name"]') as HTMLInputElement).value, 'Greenfield School - Opens a new campus')
    // The new lifecycle (27 Nov 2026): no organization now, it is made when the opportunity is won. A switch brings it back, prefilled from the signal's company.
    assert.equal((s.k.one('#convert-org') as HTMLInputElement).checked, false, 'the organization is off to begin with')
    assert.equal(s.k.one('[name="convert-org-name"]'), null, 'no organization fields while it is off')
    assert.ok(dialog.textContent?.includes('No organization is made now. It is created automatically when the opportunity is won.'))
    assert.equal(s.k.one('#convert-opportunity'), null, 'the opportunity is always made: no switch')
    await s.k.click(s.k.one('#convert-org')!)
    await s.k.tick(40)
    assert.equal((s.k.one('[name="convert-org-name"]') as HTMLInputElement).value, 'Greenfield School')
    assert.equal((s.k.one('[name="convert-org-industry"]') as HTMLSelectElement).value, 'Education')
    assert.equal(s.k.one('[data-new-person]'), null, 'no person fields until a person is added')
  })

  it('sends the opportunity alone, with no organization, when no person is added, then shows the opportunity, its link and "Opportunity created"', async () => {
    const funnel = fakeFunnel()
    const s = await open(SIGNAL, funnel)
    await s.k.click(s.k.withText('Convert to opportunity')!)
    await s.k.tick(80)

    await s.k.click(s.k.withText('Convert')!)
    await s.k.tick(60)

    assert.equal(funnel.converted.length, 1)
    assert.deepEqual(funnel.converted[0], {
      id: 7,
      body: { createOrganization: false, opportunity: { name: 'Greenfield School - Opens a new campus', stage: 'Prospecting' } },
    })
    assert.ok(s.k.bodyText().includes('Opportunity created'))
    assert.equal(s.link('Open opportunity')?.getAttribute('href'), '/module/crm/sales/opportunities/9')
    assert.equal(s.link('Greenfield School - Opens a new campus')?.getAttribute('href'), '/module/crm/sales/opportunities/9', 'the card now shows "Opportunity: <name>" as a link')
    assert.equal(s.k.withText('Convert to opportunity'), null, 'a second opportunity cannot be made from here')
  })

  it('adds a new person when asked, with the last name required', async () => {
    const funnel = fakeFunnel()
    const s = await open(SIGNAL, funnel)
    await s.k.click(s.k.withText('Convert to opportunity')!)
    await s.k.tick(80)
    await s.k.click(s.k.one('#convert-contact')!)
    await s.k.tick(40)
    assert.ok(s.k.one('[data-new-person]'), 'person fields appear once a person is added')

    await s.k.click(s.k.withText('Convert')!)
    await s.k.tick(40)
    assert.equal(s.k.one('[role="dialog"] [role="alert"]')?.textContent, 'A new person needs a last name.')
    assert.equal(funnel.converted.length, 0, 'nothing was sent')

    await s.write(s.k.one('[name="convert-person-last"]')!, 'Rao')
    await s.write(s.k.one('[name="convert-person-first"]')!, 'Asha')
    await s.k.click(s.k.withText('Convert')!)
    await s.k.tick(60)

    assert.deepEqual(funnel.converted[0].body.person, { lastName: 'Rao', firstName: 'Asha' })
  })

  it('shows the server\'s sentence when it refuses (an organization that is not the organisation\'s own) and sends nothing twice', async () => {
    const funnel = fakeFunnel()
    funnel.convertToOpportunity = async () => { throw Object.assign(new Error('Choose a company from the list.'), { status: 422 }) }
    const s = await open(SIGNAL, funnel)
    await s.k.click(s.k.withText('Convert to opportunity')!)
    await s.k.tick(80)
    await s.k.click(s.k.withText('Convert')!)
    await s.k.tick(60)

    assert.equal(s.k.one('[role="dialog"] [role="alert"]')?.textContent, 'Choose a company from the list.')
    assert.ok(s.k.one('[role="dialog"]'), 'the pop-up stays open so it can be corrected')
  })
})

describe('Convert to opportunity: an organization is still possible, by choice', () => {
  afterEach(async () => { await disposeAll() })

  it('makes the organization now when the switch is on, and sends its name and industry', async () => {
    const funnel = fakeFunnel()
    const s = await open(SIGNAL, funnel)
    await s.k.click(s.k.withText('Convert to opportunity')!)
    await s.k.tick(80)
    await s.k.click(s.k.one('#convert-org')!)
    await s.k.tick(40)

    await s.k.click(s.k.withText('Convert')!)
    await s.k.tick(60)

    assert.deepEqual(funnel.converted[0].body, { createOrganization: true, organizationName: 'Greenfield School', industry: 'Education', opportunity: { name: 'Greenfield School - Opens a new campus', stage: 'Prospecting' } })
  })
})
