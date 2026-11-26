import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { screenKit, type Call } from '../leads/screen-kit'
import type { GtmContact } from '../../services/gtm/gtm'
import type { SignalConvertBody, SignalFunnelApi } from '../../services/signal-review/signal-funnel-service'
import type { Opportunity } from '../../services/signals/opportunities'

/**
 * The funnel on a signal card (S20) as a person meets it: "In Prospecting" with its link, or "Add to Prospecting"; "Convert to opportunity" and its pop-up, built from the
 * same three cards as Convert Lead; and the question "which person" before a lead. The real components, a fake network and a fake funnel service that records what it was asked.
 */

const pick = (value: string, label = value, isDefault = false) => ({ value, label, sortOrder: 1, isDefault })
const PICKLISTS = {
  organizations: { industry: [pick('Education'), pick('Retail')] },
  contacts: { contact_role: [pick('Decision maker'), pick('Billing')] },
  opportunities: { sales_stage: [pick('Prospecting', 'Prospecting', true), pick('Proposal/Quotation')] },
}

const SIGNAL = { id: 7, title: 'Opens a new campus', company_name: 'Greenfield School', industry: 'Education', review_status: 'New', likely_stakeholder: 'The principal' } as unknown as Opportunity

const contact = (id: number, over: Partial<GtmContact> = {}): GtmContact => ({
  id, account_id: 41, full_name: `Person ${id}`, title: null, email: null, phone: null, linkedin_url: null, role_in_deal: null, status: 'active', ...over,
})

interface Fake extends SignalFunnelApi {
  sent: number[]
  converted: Array<{ id: number; body: SignalConvertBody }>
}

function fakeFunnel(answer: { created?: boolean; accountId?: number } = {}): Fake {
  const fake: Fake = {
    sent: [],
    converted: [],
    async sendToProspecting(id) { fake.sent.push(id); return { status: 1, data: { account_id: answer.accountId ?? 41, created: answer.created ?? true } } },
    async convertToOpportunity(id, body) {
      fake.converted.push({ id, body })
      return { status: 1, data: { opportunity_id: 9, opportunity_name: body.opportunity?.name ?? null, organization_id: 3, account_id: 41, created: true } }
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

describe('the Prospecting status of a signal', () => {
  afterEach(async () => { await disposeAll() })

  it('says "In Prospecting" with a link that opens the account, and offers no Add to Prospecting', async () => {
    const s = await open({ ...SIGNAL, prospecting: { account_id: 41, stage: 'target', contacts_count: 0 } } as Opportunity, fakeFunnel())
    assert.ok(s.k.bodyText().includes('In Prospecting'))
    assert.equal(s.link('Open in Prospecting')?.getAttribute('href'), '/gtm/prospecting?account=41')
    assert.equal(s.k.withText('Add to Prospecting'), null)
  })

  it('offers Add to Prospecting when the company is not there; pressing it asks the server once, then says so and links to the account', async () => {
    const funnel = fakeFunnel()
    const s = await open(SIGNAL, funnel)
    assert.equal(s.link('Open in Prospecting'), null)

    await s.k.click(s.k.withText('Add to Prospecting')!)
    await s.k.tick(40)

    assert.deepEqual(funnel.sent, [7], 'the signal\'s own id, once')
    assert.ok(s.k.bodyText().includes('Added to Prospecting'))
    assert.equal(s.link('Open in Prospecting')?.getAttribute('href'), '/gtm/prospecting?account=41')
    assert.equal(s.k.withText('Add to Prospecting'), null, 'the button goes once the company is in')
  })

  it('says "Already in Prospecting" for a company whose account was already there', async () => {
    const s = await open(SIGNAL, fakeFunnel({ created: false }))
    await s.k.click(s.k.withText('Add to Prospecting')!)
    await s.k.tick(40)
    assert.ok(s.k.bodyText().includes('Already in Prospecting'))
  })
})

describe('Convert to opportunity', () => {
  afterEach(async () => { await disposeAll() })

  it('opens the pop-up built from the shared cards: the organization from the signal\'s company, the person optional, the opportunity named after both', async () => {
    const s = await open(SIGNAL, fakeFunnel())
    await s.k.click(s.k.withText('Convert to opportunity')!)
    await s.k.tick(80)

    const dialog = s.k.one('[role="dialog"]')!
    assert.ok(dialog.textContent?.includes('Add a person (optional)'))
    assert.ok(dialog.textContent?.includes('The signal suggests: The principal'), 'the stakeholder text is only a suggestion')
    assert.equal((s.k.one('[name="convert-org-name"]') as HTMLInputElement).value, 'Greenfield School')
    assert.equal((s.k.one('[name="convert-org-industry"]') as HTMLSelectElement).value, 'Education')
    assert.equal((s.k.one('[name="convert-opp-name"]') as HTMLInputElement).value, 'Greenfield School - Opens a new campus')
    assert.equal(s.k.one('#convert-org'), null, 'the organization is always made or chosen: no switch')
    assert.equal(s.k.one('#convert-opportunity'), null, 'and so is the opportunity')
    assert.equal(s.k.one('[data-new-person]'), null, 'no person fields until a person is added')
  })

  it('sends the organization and the opportunity alone when no person is added, then shows the opportunity, its links and "Opportunity created"', async () => {
    const funnel = fakeFunnel()
    const s = await open({ ...SIGNAL, prospecting: { account_id: 41, stage: 'target', contacts_count: 0 } } as Opportunity, funnel)
    await s.k.click(s.k.withText('Convert to opportunity')!)
    await s.k.tick(80)

    await s.k.click(s.k.withText('Convert')!)
    await s.k.tick(60)

    assert.equal(funnel.converted.length, 1)
    assert.deepEqual(funnel.converted[0], {
      id: 7,
      body: { organizationName: 'Greenfield School', industry: 'Education', opportunity: { name: 'Greenfield School - Opens a new campus', stage: 'Prospecting' } },
    })
    assert.ok(s.k.bodyText().includes('Opportunity created'))
    assert.equal(s.link('Open opportunity')?.getAttribute('href'), '/module/crm/sales/opportunities/9')
    assert.equal(s.link('Open in Prospecting')?.getAttribute('href'), '/gtm/prospecting?account=41')
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

describe('Convert to lead: which person', () => {
  afterEach(async () => { await disposeAll() })

  async function ask() {
    const screen = await screenKit({ pathname: '/signals' })
    const { LeadPersonDialog } = await import('../../components/domain/signals/signal-lead')
    const chosen: Array<number | null> = []
    let cancelled = 0
    const people = [contact(3, { full_name: 'Dee Enn', status: 'do_not_contact' }), contact(4, { full_name: 'Rahul Verma', title: 'Principal' })]
    await screen.mount(screen.k.h(LeadPersonDialog, { people, onChoose: (id: number | null) => { chosen.push(id) }, onCancel: () => { cancelled += 1 } }), 60)
    const radios = () => screen.k.all('[role="dialog"] input[type="radio"]') as HTMLInputElement[]
    const labelOf = (r: HTMLInputElement) => screen.k.w.document.querySelector(`label[for="${r.id}"]`)?.textContent?.trim() ?? ''
    return { ...screen, chosen, cancelled: () => cancelled, radios, labelOf }
  }

  it('lists the people, the one who asked not to be contacted disabled with the reason, and "No person yet" as the last choice', async () => {
    const s = await ask()
    const rows = s.radios().map((r) => ({ label: s.labelOf(r), disabled: r.disabled }))
    assert.deepEqual(rows, [
      { label: 'Rahul Verma · Principal', disabled: false },
      { label: 'Dee Enn — asked not to be contacted', disabled: true },
      { label: 'No person yet', disabled: false },
    ])
    assert.equal((s.k.withText('Convert') as HTMLButtonElement).disabled, true, 'a choice is needed first, even if it is "No person yet"')
  })

  it('converts for the chosen person, or with no person at all', async () => {
    const s = await ask()
    await s.k.click(s.radios()[0])
    await s.k.tick(20)
    await s.k.click(s.k.withText('Convert')!)
    assert.deepEqual(s.chosen, [4])

    await s.k.click(s.radios()[2])
    await s.k.tick(20)
    await s.k.click(s.k.withText('Convert')!)
    assert.deepEqual(s.chosen, [4, null])
  })

  it('cancelling asks nothing', async () => {
    const s = await ask()
    await s.k.click(s.k.withText('Cancel')!)
    assert.deepEqual([s.chosen, s.cancelled()], [[], 1])
  })
})
