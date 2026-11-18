import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent, says } from '../agent/assertions'
import type { Campaign } from '../../types/crm'
import { withCampaignExtras } from './model'
import { campaign, options, PRODUCT } from './fixtures'
import { screenKit, type Call } from './screen-kit'

/** The campaign form (create and edit) as a person meets it: the real dialog and service client, only the network replaced. */

interface Setup {
  campaign?: Record<string, unknown> | null
  options?: unknown
  optionsStatus?: number
  saveStatus?: number
  saveMessage?: string
}

async function open(opts: Setup = {}) {
  const saved: string[] = []
  const screen = await screenKit({
    respond: (call: Call) => {
      if (call.path.endsWith('/product-master/options')) return opts.optionsStatus ? { status: 0, message: 'No.', __status: opts.optionsStatus } : { status: 1, data: opts.options ?? options }
      if (call.path.endsWith('/table_data')) return [{ id: 2, first_name: 'Asha', last_name: 'Menon' }, { id: 3, first_name: 'Ravi', last_name: 'Iyer' }]
      if (call.path.includes('/crm/campaigns')) {
        if (opts.saveStatus) return { status: 0, message: opts.saveMessage ?? 'Product not found.', code: 'product_not_found', __status: opts.saveStatus }
        return { status: 1, message: call.method === 'POST' ? 'Campaign created.' : 'Campaign updated.', data: campaign() }
      }
      return undefined
    },
  })
  const { CreateCampaignModal } = await import('../../components/domain/crm/create-campaign-modal')
  const edited = opts.campaign === undefined || opts.campaign === null ? null : withCampaignExtras(opts.campaign as unknown as Campaign)
  const picklists = { campaignType: [], campaignStatus: [], expectedResponse: [] }
  await screen.mount(screen.k.h(CreateCampaignModal, { isOpen: true, onClose: () => undefined, onSaved: (message: string) => { saved.push(message) }, campaign: edited, picklists }), 60)
  const { k } = screen
  const w = k.w
  const box = () => k.one('[data-campaign-product-field] select') as HTMLSelectElement | null
  const labelOf = (el: HTMLElement) => w.document.querySelector(`label[for="${el.id}"]`)?.textContent ?? null
  const setValue = async (el: HTMLElement, value: string) => {
    const proto = el.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : w.HTMLInputElement.prototype
    await k.act(async () => {
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
      el.dispatchEvent(new w.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
    })
    await k.tick(10)
  }
  const choose = (value: string) => setValue(box()!, value)
  const name = (value: string) => setValue(k.one('#campaign-name')!, value)
  const assignTo = async (who: string) => {
    // The Type, Status and Expected Response boxes are the shared Select; the employee picker is the one that says "Choose an employee…".
    const trigger = k.all('[role="combobox"]').find((c) => c.textContent?.includes('Choose an employee'))
    assert.ok(trigger, 'the employee picker is there')
    await k.click(trigger)
    await k.tick(10)
    const option = k.all('[role="option"]').find((o) => o.textContent?.includes(who))
    assert.ok(option, `${who} is among the employees`)
    await k.click(option)
    await k.tick(10)
  }
  const save = async (label: string) => { await k.click(k.withText(label)!); await k.tick(30); await k.tick(30) }
  const sent = () => screen.calls.filter((c) => c.path.includes('/crm/campaigns') && (c.method === 'POST' || c.method === 'PUT'))
  return { ...screen, box, labelOf, choose, name, assignTo, save, sent, saved, optionLabels: () => Array.from(box()!.options).map((o) => o.textContent) }
}

describe('the campaign form: the optional Product', () => {
  afterEach(async () => { await disposeAll() })

  it('is a labelled box with "No product" first and every product the Product Master lists', async () => {
    const s = await open()
    assert.ok(s.box(), 'the Product box is drawn')
    assert.equal(s.labelOf(s.box()!), 'Product (optional)')
    assert.deepEqual(s.optionLabels(), ['No product', 'ScholarClone', 'ScholarClone › School ERP', 'G2G'])
    assert.equal(s.box()!.value, '', 'a new campaign starts with no product')
    s.restore()
  })

  it('a new campaign with a chosen product sends it under the contract\'s name, product_master_id', async () => {
    const s = await open()
    await s.name('Diwali outreach')
    await s.assignTo('Asha')
    await s.choose('9')
    await s.save('Create Campaign')
    const [call] = s.sent()
    assert.equal(call.method, 'POST')
    assert.equal((call.body as Record<string, unknown>).product_master_id, 9)
    assert.equal((call.body as Record<string, unknown>).name, 'Diwali outreach')
    assert.deepEqual(s.saved, ['Campaign created.'])
    s.restore()
  })

  it('a new campaign with no product sends no product key at all', async () => {
    const s = await open()
    await s.name('Diwali outreach')
    await s.assignTo('Asha')
    await s.save('Create Campaign')
    const [call] = s.sent()
    assert.equal(call.method, 'POST')
    assert.equal('product_master_id' in (call.body as Record<string, unknown>), false)
    s.restore()
  })

  it('an edit shows the campaign\'s product chosen, and saving without touching it sends no product key (and none of the answer-only fields)', async () => {
    const s = await open({ campaign: campaign({ product: PRODUCT, funnel: { targets: 3 }, gtm_campaign: { id: 5, name: 'X', status: 'active' }, leads: { count: 2 } }) })
    assert.equal(s.box()!.value, '9')
    await s.save('Save Changes')
    const [call] = s.sent()
    assert.equal(call.method, 'PUT')
    const body = call.body as Record<string, unknown>
    for (const key of ['product_master_id', 'productMasterId', 'product', 'funnel', 'gtmCampaign', 'gtm_campaign', 'leads']) assert.equal(key in body, false, `${key} is not sent`)
    assert.equal(body.name, 'Diwali outreach')
    s.restore()
  })

  it('an edit that changes the product sends the new one', async () => {
    const s = await open({ campaign: campaign({ product: PRODUCT }) })
    await s.choose('12')
    await s.save('Save Changes')
    assert.equal((s.sent()[0].body as Record<string, unknown>).product_master_id, 12)
    s.restore()
  })

  it('an edit that clears the product sends null, which is how the server is told "no product"', async () => {
    const s = await open({ campaign: campaign({ product: PRODUCT }) })
    await s.choose('')
    await s.save('Save Changes')
    const body = s.sent()[0].body as Record<string, unknown>
    assert.ok('product_master_id' in body && body.product_master_id === null)
    s.restore()
  })

  it('an edit of a campaign that had no product can give it one', async () => {
    const s = await open({ campaign: campaign({ product: null }) })
    assert.equal(s.box()!.value, '')
    await s.choose('4')
    await s.save('Save Changes')
    assert.equal((s.sent()[0].body as Record<string, unknown>).product_master_id, 4)
    s.restore()
  })

  it('keeps a product the list no longer holds (archived since) under its own name, so it can be seen and cleared', async () => {
    const s = await open({ campaign: campaign({ product: { id: 77, key: 'old', name: 'Old Product' } }) })
    assert.deepEqual(s.optionLabels(), ['No product', 'ScholarClone', 'ScholarClone › School ERP', 'G2G', 'Old Product'])
    assert.equal(s.box()!.value, '77')
    s.restore()
  })

  it('when the products cannot be read (no right, a server without the Product Master) the box is not drawn and the form works as before', async () => {
    const s = await open({ optionsStatus: 403 })
    absent(s.box(), 'no Product box')
    await s.name('Diwali outreach')
    await s.assignTo('Asha')
    await s.save('Create Campaign')
    const [call] = s.sent()
    assert.equal('product_master_id' in (call.body as Record<string, unknown>), false)
    assert.deepEqual(s.saved, ['Campaign created.'])
    s.restore()
  })

  it('shows the server\'s refusal of a product in the dialog and does not close it', async () => {
    const s = await open({ campaign: campaign({ product: null }), saveStatus: 422, saveMessage: 'Product not found.' })
    await s.choose('9')
    await s.save('Save Changes')
    says(s.k.bodyText(), 'Product not found.')
    assert.deepEqual(s.saved, [], 'nothing was saved')
    s.restore()
  })

  it('keeps the form\'s other fields and the existing buttons', async () => {
    const s = await open()
    for (const label of ['Campaign Name *', 'Description', 'Closing Date']) assert.ok(s.k.all('label').some((l) => l.textContent?.includes(label)), label)
    for (const label of ['Cancel', 'Create Campaign']) assert.ok(s.k.withText(label), label)
    assert.equal(s.k.all('button').some((b) => /send|schedule/i.test(b.textContent ?? '')), false, 'no send or schedule control')
    s.restore()
  })

  it('has nothing for the accessibility rules to find in the Product box, and adds nothing to what the rest of the form already had', async () => {
    const s = await open({ campaign: campaign({ product: PRODUCT }) })
    assert.deepEqual(await axeViolations(s.k.one('[data-campaign-product-field]')!), [], 'the box itself')
    const withBox = await axeViolations(s.k.w.document.body)
    s.restore()
    await disposeAll()
    const without = await open({ campaign: campaign({ product: null }), optionsStatus: 403 })
    absent(without.box(), 'the same form without the box (nothing to choose and nothing chosen)')
    const before = await axeViolations(without.k.w.document.body)
    without.restore()
    // The Type, Status and Expected Response boxes (the shared Select, showing only a dash) are named by nothing: older than this work, and the same with or without the box.
    assert.equal(withBox.length, before.length, `the box adds no violation to the form (the form's own: ${before.join(' | ')})`)
  })
})
