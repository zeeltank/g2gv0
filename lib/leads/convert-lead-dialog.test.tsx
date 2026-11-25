import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import type { Lead } from '../../types/crm'
import { lead } from './fixtures'
import { screenKit, type Call } from './screen-kit'

/**
 * The one Convert Lead pop-up (S19) as a person meets it: the real dialog and service client, only the network replaced. What is pinned: the structure of the
 * three cards, the prefilled organization name and industry, the existing-organization path, the person's star and role, the opportunity fields (sent only when
 * the opportunity is on), the transfer targets (only ones that will exist), the exact request, the sentence that follows, accessibility, and the phone width.
 */

const pick = (value: string, label = value, isDefault = false) => ({ value, label, sortOrder: 1, isDefault })

const PICKLISTS = {
  organizations: { industry: [pick('Education'), pick('Retail')] },
  contacts: { contact_role: [pick('Decision maker'), pick('Billing')] },
  opportunities: { sales_stage: [pick('Prospecting', 'Prospecting', true), pick('Proposal/Quotation')] },
}

const ORGANIZATIONS = [{ id: '12', name: 'Acme Schools', industry: 'Education' }, { id: '13', name: 'Acorn Trust', industry: null }]

const ANSWER = { organizationId: '5', contactId: '6', opportunityId: '7' }

/** The keys of the request this dialog owns (the service adds its token and organisation id beside them). */
const KEYS = ['createOrganization', 'createContact', 'organizationName', 'industry', 'existingOrganizationId', 'existingContactId', 'makePrimary', 'contactRole', 'createOpportunity', 'opportunity', 'transferRelatedTo', 'assignedTo']

interface Setup {
  lead?: Lead
  answer?: unknown
  hasRealName?: boolean
}

async function open(setup: Setup = {}) {
  const screen = await screenKit({
    pathname: '/module/crm/marketing/leads/41',
    respond: (call: Call) => {
      if (call.path.endsWith('/table_data')) return [{ id: 2, first_name: 'Anil', last_name: 'Shah' }]
      if (call.method === 'GET' && call.path.endsWith('/crm/picklist-values')) return { status: 1, message: 'ok', data: PICKLISTS }
      if (call.method === 'GET' && call.path.endsWith('/crm/organizations')) {
        const term = (call.query.get('search') ?? '').toLowerCase()
        return { status: 1, message: 'ok', data: { items: ORGANIZATIONS.filter((o) => o.name.toLowerCase().includes(term)), pagination: { current_page: 1, last_page: 1, per_page: 10, total: 2 } } }
      }
      if (call.method === 'POST' && call.path.endsWith('/crm/leads/41/convert')) return setup.answer ?? { status: 1, message: 'Lead converted.', data: ANSWER }
      return undefined
    },
  })
  const { ConvertLeadDialog } = await import('../../components/domain/crm/convert-lead-dialog')
  const converted: string[] = []
  let closed = 0
  const theLead = setup.lead ?? lead({ assignedTo: '2', industry: 'Education', ...(setup.hasRealName === false ? { hasRealName: false } : {}) })
  await screen.mount(screen.k.h(ConvertLeadDialog, { isOpen: true, onClose: () => { closed += 1 }, onConverted: (m: string) => { converted.push(m) }, lead: theLead }), 120)
  const { k } = screen
  const doc = k.w.document

  /** The control a label names (the app's Field ties the two with a generated id). */
  const control = (text: string) => {
    const label = k.all('[role="dialog"] label').find((l) => l.textContent?.replace('*', '').trim() === text)
    assert.ok(label, `a label "${text}" is drawn`)
    const el = doc.getElementById(label.getAttribute('for') ?? '')
    assert.ok(el, `"${text}" names a control`)
    return el as HTMLInputElement & HTMLSelectElement
  }
  const has = (text: string) => k.all('[role="dialog"] label').some((l) => l.textContent?.replace('*', '').trim() === text)
  const flip = async (id: string) => { await k.click(k.one(`#${id}`)!); await k.tick(40) }
  const write = async (el: Element, text: string, kind: 'input' | 'select' = 'input') => {
    const proto = kind === 'select' ? k.w.HTMLSelectElement.prototype : k.w.HTMLInputElement.prototype
    await k.act(async () => {
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, text)
      el.dispatchEvent(new k.w.Event(kind === 'select' ? 'change' : 'input', { bubbles: true }))
    })
    await k.tick(30)
  }
  const type = (text: string, value: string) => write(control(text), value)
  const choose = (text: string, value: string) => write(control(text), value, 'select')
  const radios = () => k.all('[data-transfer] input[type="radio"]')
  const radioLabels = () => radios().map((r) => doc.querySelector(`label[for="${r.id}"]`)?.textContent?.trim() ?? '')
  const callsTo = (pattern: RegExp) => screen.calls.filter((c) => c.method === 'GET' && pattern.test(c.path))
  const checkedRadio = () => radios().find((r) => (r as HTMLInputElement).checked)
  const convert = async () => { await k.click(k.withText('Convert')!); await k.tick(80) }
  const posts = () => screen.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/crm/leads/41/convert'))
  const sent = () => {
    const body = posts()[0]?.body as Record<string, unknown> | undefined
    assert.ok(body, 'a request was sent')
    return Object.fromEntries(Object.entries(body).filter(([key]) => KEYS.includes(key)))
  }
  const error = () => k.one('[role="dialog"] [role="alert"]')?.textContent ?? null
  return { ...screen, callsTo, control, has, flip, write, type, choose, radios, radioLabels, checkedRadio, convert, posts, sent, error, converted, closed: () => closed, lead: theLead }
}

describe('the Convert Lead pop-up: structure', () => {
  afterEach(async () => { await disposeAll() })

  it('has the three cards, the assignee, and the transfer choice; the organization is prefilled from the lead and editable', async () => {
    const s = await open()
    const text = s.k.bodyText()
    for (const words of ['Convert Lead', 'Create organization', 'Create person', 'Create opportunity', 'Assigned To', 'Transfer related records to', 'Use an existing organization instead', 'Attach to an existing person instead']) {
      assert.ok(text.includes(words), words)
    }
    assert.equal((s.control('Organization name') as HTMLInputElement).value, 'Hillcrest Academy', 'the lead\'s company')
    assert.equal(s.control('Industry').value, 'Education', 'the lead\'s industry, chosen from the organization industries')
    const industries = Array.from((s.control('Industry') as HTMLSelectElement).options).map((o) => o.textContent)
    assert.deepEqual(industries, ['—', 'Education', 'Retail'])
    assert.equal((s.k.one('#convert-org') as HTMLInputElement).checked, true)
    assert.equal((s.k.one('#convert-opportunity') as HTMLInputElement).checked, false)
    assert.equal(s.k.one('[data-details="opportunity"]'), null, 'no opportunity fields while it is off')
    s.restore()
  })

  it('says so when the lead has no company, and then starts with the organization off', async () => {
    const s = await open({ lead: lead({ assignedTo: '2', company: null }) })
    assert.ok(s.k.bodyText().includes('This lead has no company name'))
    assert.equal((s.k.one('#convert-org') as HTMLInputElement).checked, false)
    assert.equal(s.k.one('[data-details="organization"]'), null)
    s.restore()
  })

  it('keeps the labels and result of the old pop-up callable: Cancel closes, Convert is the one button that converts', async () => {
    const s = await open()
    await s.k.click(s.k.withText('Cancel')!)
    assert.equal(s.closed(), 1)
    assert.ok(s.k.withText('Convert'))
    s.restore()
  })
})

describe('the Convert Lead pop-up: the organization', () => {
  afterEach(async () => { await disposeAll() })

  it('sends the edited name and the chosen industry of the new organization', async () => {
    const s = await open()
    await s.type('Organization name', 'Hillcrest Education Trust')
    await s.choose('Industry', 'Retail')
    await s.convert()
    const body = s.sent()
    assert.equal(body.organizationName, 'Hillcrest Education Trust')
    assert.equal(body.industry, 'Retail')
    assert.equal(body.createOrganization, true)
    assert.equal('existingOrganizationId' in body, false)
    s.restore()
  })

  it('needs an organization name when one is created: nothing is sent, and the sentence says why', async () => {
    const s = await open()
    await s.type('Organization name', '   ')
    await s.convert()
    assert.equal(s.posts().length, 0, 'no request')
    assert.equal(s.error(), 'Organization name is required.')
    await s.type('Organization name', 'Hillcrest Education Trust')
    await s.convert()
    assert.equal(s.posts().length, 1)
    s.restore()
  })

  it('uses an existing organization found by searching, and then sends its id and no name or industry', async () => {
    const s = await open()
    await s.flip('convert-org-existing')
    assert.equal(s.has('Organization name'), false, 'the new-organization fields are gone')
    const first = s.callsTo(/\/crm\/organizations$/)
    assert.equal(first.length, 1, 'the first ten are listed at once')
    assert.equal(first[0].query.get('per_page'), '10')

    await s.convert()
    assert.equal(s.posts().length, 0)
    assert.equal(s.error(), 'Choose which existing organization to use.')

    await s.write(s.k.one('#convert-org-search')!, 'Acme')
    await s.k.tick(300)
    assert.equal(s.callsTo(/\/crm\/organizations$/).at(-1)!.query.get('search'), 'Acme', 'the search goes to the server')
    const options = s.k.all('[role="option"]')
    assert.deepEqual(options.map((o) => o.textContent), ['Acme SchoolsEducation'])
    await s.k.click(options[0])
    await s.k.tick(30)
    assert.equal(s.k.one('[data-chosen-organization]')!.textContent?.includes('Acme Schools'), true)

    await s.convert()
    const body = s.sent()
    assert.equal(body.existingOrganizationId, '12')
    assert.equal(body.createOrganization, false)
    assert.equal('organizationName' in body, false)
    assert.equal('industry' in body, false)
    assert.equal(s.converted[0].includes('Added to the existing organization.'), true)
    assert.equal(s.converted[0].includes('Created organization'), false, 'it is not said to have been created')
    s.restore()
  })
})

describe('the Convert Lead pop-up: the person', () => {
  afterEach(async () => { await disposeAll() })

  it('asks for the star and the role only when there is a company, and sends them', async () => {
    const s = await open()
    assert.deepEqual(Array.from((s.control('Role') as HTMLSelectElement).options).map((o) => o.textContent), ['—', 'Decision maker', 'Billing'])
    await s.flip('convert-primary')
    await s.choose('Role', 'Decision maker')
    await s.convert()
    assert.equal(s.sent().makePrimary, true)
    assert.equal(s.sent().contactRole, 'Decision maker')
    s.restore()
  })

  it('has neither the star nor the role when the organization is off, and sends neither', async () => {
    const s = await open()
    await s.flip('convert-primary')
    await s.flip('convert-org')
    assert.equal(s.k.one('#convert-primary'), null)
    assert.equal(s.has('Role'), false)
    await s.convert()
    const body = s.sent()
    assert.equal('makePrimary' in body, false)
    assert.equal('contactRole' in body, false)
    assert.equal(body.createContact, true)
    s.restore()
  })

  it('refuses a conversion that makes neither an organization nor a person, in the words it always used', async () => {
    const s = await open()
    await s.flip('convert-org')
    await s.flip('convert-contact')
    await s.convert()
    assert.equal(s.posts().length, 0)
    assert.equal(s.error(), 'Select at least one of Organization or Contact to create.')
    s.restore()
  })

  it('needs an owner, as before', async () => {
    const s = await open({ lead: lead({ assignedTo: null }) })
    await s.convert()
    assert.equal(s.posts().length, 0)
    assert.equal(s.error(), 'Assigned To is required.')
    s.restore()
  })
})

describe('the Convert Lead pop-up: the opportunity', () => {
  afterEach(async () => { await disposeAll() })

  it('sends no opportunity fields while the opportunity is off, even after they were filled in and switched away', async () => {
    const s = await open()
    await s.flip('convert-opportunity')
    await s.type('Amount', '5000')
    await s.flip('convert-opportunity')
    await s.convert()
    const body = s.sent()
    assert.equal(body.createOpportunity, false)
    assert.equal('opportunity' in body, false, 'nothing about a deal that was not asked for')
    s.restore()
  })

  it('prefills the name as "<Company> - <Lead name>", follows the company until it is typed over, and sends the amount, currency, close date and stage', async () => {
    const s = await open()
    await s.flip('convert-opportunity')
    assert.equal((s.control('Opportunity name') as HTMLInputElement).value, 'Hillcrest Academy - Asha Menon')
    await s.type('Organization name', 'Hillcrest Trust')
    assert.equal((s.control('Opportunity name') as HTMLInputElement).value, 'Hillcrest Trust - Asha Menon', 'it follows the company')
    assert.equal(s.control('Stage').value, 'Prospecting', 'the picklist\'s default stage')
    assert.ok(s.k.bodyText().includes('organization\'s default is used when you choose none'))

    await s.type('Amount', '125000.5')
    await s.choose('Currency', 'USD')
    await s.type('Expected close date', '2026-12-31')
    await s.choose('Stage', 'Proposal/Quotation')
    await s.convert()
    assert.deepEqual(s.sent().opportunity, { name: 'Hillcrest Trust - Asha Menon', amount: 125000.5, currency: 'USD', closeDate: '2026-12-31', stage: 'Proposal/Quotation' })
    assert.equal(s.sent().createOpportunity, true)
    s.restore()
  })

  it('keeps a name that was typed, and leaves out the amount, currency and date that were not', async () => {
    const s = await open()
    await s.flip('convert-opportunity')
    await s.type('Opportunity name', 'ERP rollout')
    await s.type('Organization name', 'Hillcrest Trust')
    assert.equal((s.control('Opportunity name') as HTMLInputElement).value, 'ERP rollout')
    await s.convert()
    assert.deepEqual(s.sent().opportunity, { name: 'ERP rollout', stage: 'Prospecting' })
    s.restore()
  })

  it('refuses a negative amount before anything is sent', async () => {
    const s = await open()
    await s.flip('convert-opportunity')
    await s.type('Amount', '-5')
    await s.convert()
    assert.equal(s.posts().length, 0)
    assert.equal(s.error(), 'Amount must be a number, zero or more.')
    s.restore()
  })
})

describe('the Convert Lead pop-up: transfer related records to', () => {
  afterEach(async () => { await disposeAll() })

  it('offers only what will exist: Organization and Person to begin with, Opportunity once it is on, never a target that is switched off', async () => {
    const s = await open()
    assert.deepEqual(s.radioLabels(), ['Organization', 'Person', 'Do not move them'])
    await s.flip('convert-opportunity')
    assert.deepEqual(s.radioLabels(), ['Organization', 'Person', 'Opportunity', 'Do not move them'])
    await s.flip('convert-contact')
    assert.deepEqual(s.radioLabels(), ['Organization', 'Opportunity', 'Do not move them'])
    await s.flip('convert-org')
    assert.deepEqual(s.radioLabels(), ['Opportunity', 'Do not move them'])
    await s.flip('convert-opportunity')
    assert.deepEqual(s.radioLabels(), ['Do not move them'])
    assert.ok(s.k.bodyText().includes('Moves the comments, emails, documents and scheduled events of this lead'))
    s.restore()
  })

  it('does not offer a person for a lead that names none, and a person who is attached instead counts again', async () => {
    const s = await open({ hasRealName: false })
    assert.deepEqual(s.radioLabels(), ['Organization', 'Do not move them'])
    assert.ok(s.k.bodyText().includes('This lead names no person'))
    s.restore()
  })

  it('defaults to the person and sends the choice', async () => {
    const s = await open()
    assert.equal((s.checkedRadio() as HTMLInputElement).value, 'contact')
    await s.convert()
    assert.equal(s.sent().transferRelatedTo, 'contact')
    s.restore()
  })

  it('defaults to the organization when no person is made, and "Do not move them" sends nothing', async () => {
    const s = await open()
    await s.flip('convert-contact')
    assert.equal((s.checkedRadio() as HTMLInputElement).value, 'organization', 'no person: the organization')
    await s.k.click(s.radios().find((r) => (r as HTMLInputElement).value === 'none')!)
    await s.k.tick(30)
    assert.equal((s.checkedRadio() as HTMLInputElement).value, 'none')
    await s.convert()
    assert.equal('transferRelatedTo' in s.sent(), false, 'nothing moves')
    s.restore()
  })

  it('falls back to the default when the chosen target is switched off', async () => {
    const s = await open()
    await s.flip('convert-opportunity')
    await s.k.click(s.radios().find((r) => (r as HTMLInputElement).value === 'opportunity')!)
    await s.k.tick(30)
    assert.equal((s.checkedRadio() as HTMLInputElement).value, 'opportunity')
    await s.flip('convert-opportunity')
    assert.equal((s.checkedRadio() as HTMLInputElement).value, 'contact')
    await s.convert()
    assert.equal(s.sent().transferRelatedTo, 'contact')
    s.restore()
  })
})

describe('the Convert Lead pop-up: the request and the answer', () => {
  afterEach(async () => { await disposeAll() })

  it('sends exactly this for the plain conversion, and calls onConverted and onClose', async () => {
    const s = await open()
    await s.convert()
    assert.deepEqual(s.sent(), {
      createOrganization: true, createContact: true, assignedTo: '2', createOpportunity: false, organizationName: 'Hillcrest Academy', industry: 'Education', transferRelatedTo: 'contact',
    })
    assert.equal(s.converted.length, 1)
    assert.equal(s.closed(), 1)
    s.restore()
  })

  it('says what was made, whether the person is the primary contact, and what moved where', async () => {
    const s = await open({ answer: { status: 1, message: 'Lead converted.', data: { ...ANSWER, primarySet: true, transferred: { comments: 2, emails: 1, documents: 0, events: 0 } } } })
    await s.flip('convert-opportunity')
    await s.flip('convert-primary')
    await s.convert()
    assert.equal(s.converted[0], 'Lead converted. Created organization, person and opportunity. Set as the primary contact of the company. Moved 2 comments and 1 email to the person.')
    s.restore()
  })

  it('keeps the server\'s notice when no person was made, as the lead page always showed it', async () => {
    const s = await open({ answer: { status: 1, message: 'Lead converted.', data: { organizationId: '5', contactId: null, opportunityId: null, contactSkipped: true, notice: 'No contact was created: the lead names no person.' } } })
    await s.convert()
    assert.equal(s.converted[0], 'No contact was created: the lead names no person.')
    s.restore()
  })

  it('shows the server\'s refusal in the pop-up and stays open', async () => {
    const s = await open({ answer: { __status: 422, status: 0, message: 'Choose a company from the list.' } })
    await s.convert()
    assert.ok(s.error()?.includes('Choose a company from the list.'))
    assert.equal(s.closed(), 0)
    assert.equal(s.converted.length, 0)
    s.restore()
  })
})

describe('the Convert Lead pop-up: accessibility and the phone width', () => {
  afterEach(async () => { await disposeAll() })

  it('has no axe violations, plain, with the opportunity on, and with the organization search open', async () => {
    const s = await open()
    assert.deepEqual(await axeViolations(s.k.one('[role="dialog"]')!), [])
    await s.flip('convert-opportunity')
    assert.deepEqual(await axeViolations(s.k.one('[role="dialog"]')!), [])
    await s.flip('convert-org-existing')
    assert.deepEqual(await axeViolations(s.k.one('[role="dialog"]')!), [])
    s.restore()
  })

  it('is as wide as the screen less a margin, scrolls inside itself, and lays two columns out only from a tablet up', () => {
    const source = readFileSync(path.resolve('components/domain/crm/convert-lead-dialog.tsx'), 'utf8')
    const lines = source.split(/\r?\n/)
    const content = lines.find((l) => l.includes('<DialogContent'))
    assert.ok(content)
    assert.match(content!, /\bw-\[calc\(100%-2rem\)\]/, 'two rem of margin on a 390 px screen')
    assert.match(content!, /\bmax-h-\[90vh\]/)
    assert.match(content!, /\bsm:max-w-xl\b/)
    assert.ok(lines.some((l) => l.includes('min-h-0 flex-1') && l.includes('overflow-y-auto')), 'the body scrolls, the buttons stay')
    assert.equal(lines.some((l) => /whitespace-nowrap|\bw-\[\d|\bmin-w-\[|overflow-x-(auto|scroll)/.test(l)), false, 'nothing that cannot shrink')
    const grids = lines.filter((l) => l.includes('grid-cols-2'))
    assert.ok(grids.length > 0 && grids.every((l) => l.includes('sm:grid-cols-2') && l.includes('grid-cols-1')), 'one column on a phone')
    assert.equal(lines.filter((l) => /\bml-\[3\.25rem\]/.test(l)).every((l) => l.includes('sm:ml-[3.25rem]')), true, 'the indent is only from a tablet up')
  })
})
