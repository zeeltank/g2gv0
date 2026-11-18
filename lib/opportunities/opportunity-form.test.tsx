import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent, same, says } from '../agent/assertions'
import type { CrmOpportunity } from '../../types/crm'
import { withOpportunityExtras } from './model'
import { listAnswer, opportunity, options, pipelineAnswer, PRODUCT, REASONS } from './fixtures'
import { screenKit, type Call } from './screen-kit'

/** The opportunity form (create and edit) as a person meets it: the real dialog and service client, only the network replaced. */

const REQUIRED = { status: 0, message: 'Choose why this opportunity was lost.', code: 'loss_reason_required', errors: { lossReasonCode: ['Required for Closed Lost.'] }, __status: 422 }

const STAGE_PICKLIST = ['Prospecting', 'Negotiation/Review', 'Closed Won', 'Closed Lost'].map((value, index) => ({ value, label: value, sortOrder: index, isDefault: index === 0 }))
const picklists = { salesStage: STAGE_PICKLIST, leadSource: [], potentialType: [], forecastCategory: [] }

interface Setup {
  opportunity?: Record<string, unknown> | null
  options?: unknown
  optionsStatus?: number
  /** Whether the person's menu holds the Campaigns row (the form reads the campaign list only then), and what the campaign list answers. */
  campaigns?: boolean
  campaignsStatus?: number
  /** The pipeline answer's reasons; `'older'` leaves the key out, as an older server does. */
  reasons?: unknown[] | 'older'
  /** What the server answers a save with, per attempt (the default is to accept it). */
  onSave?: (call: Call, attempt: number) => unknown
}

async function open(opts: Setup = {}) {
  const saved: string[] = []
  const saves: Call[] = []
  const screen = await screenKit({
    campaigns: opts.campaigns,
    respond: (call: Call) => {
      if (call.path.endsWith('/crm/campaigns')) return opts.campaignsStatus ? { status: 0, message: 'You do not have access.', __status: opts.campaignsStatus } : listAnswer([{ id: '7', name: 'Diwali outreach' }, { id: '8', name: 'Pongal drive' }])
      if (call.path.endsWith('/product-master/options')) return opts.optionsStatus ? { status: 0, message: 'No.', __status: opts.optionsStatus } : { status: 1, data: opts.options ?? options }
      if (call.path.endsWith('/crm/opportunities/pipeline')) return pipelineAnswer(opts.reasons === 'older' ? null : opts.reasons ?? REASONS)
      if (call.path.endsWith('/table_data')) return [{ id: 2, first_name: 'Asha', last_name: 'Menon' }, { id: 3, first_name: 'Ravi', last_name: 'Iyer' }]
      if (call.path.endsWith('/crm/organizations')) return listAnswer([])
      if ((call.method === 'POST' || call.method === 'PUT') && call.path.includes('/crm/opportunities')) {
        saves.push(call)
        const answer = opts.onSave?.(call, saves.length)
        if (answer !== undefined) return answer
        return { status: 1, message: call.method === 'POST' ? 'Opportunity created.' : 'Opportunity updated.', data: opportunity() }
      }
      return undefined
    },
  })
  const { CreateOpportunityModal } = await import('../../components/domain/crm/create-opportunity-modal')
  const edited = opts.opportunity === undefined || opts.opportunity === null ? null : withOpportunityExtras(opts.opportunity as unknown as CrmOpportunity)
  await screen.mount(screen.k.h(CreateOpportunityModal, { isOpen: true, onClose: () => undefined, onSaved: (message: string) => { saved.push(message) }, opportunity: edited, picklists }), 60)
  await screen.k.tick(40)
  const { k } = screen
  const w = k.w
  const labelOf = (el: HTMLElement) => w.document.querySelector(`label[for="${el.id}"]`)?.textContent ?? null
  const productBox = () => k.one('[data-opportunity-product-field] select') as HTMLSelectElement | null
  const reasonBox = () => k.one('[data-loss-reason-field] select') as HTMLSelectElement | null
  const detailBox = () => k.one('#opp-close-reason') as HTMLTextAreaElement | null
  const reasonError = () => k.one('[data-loss-reason-error]')
  const setValue = async (el: HTMLElement, value: string) => {
    const proto = el.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype
    await k.act(async () => {
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
      el.dispatchEvent(new w.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
    })
    await k.tick(10)
  }
  const chooseStage = async (label: string) => {
    const trigger = k.all('[role="combobox"]').find((c) => STAGE_PICKLIST.some((s) => c.textContent?.trim() === s.label) || c.textContent?.trim() === '—')
    assert.ok(trigger, 'the Sales Stage box')
    await k.click(trigger)
    await k.tick(10)
    const option = k.all('[role="option"]').find((o) => o.textContent?.trim() === label)
    assert.ok(option, `${label} is among the stages`)
    // The shared Select commits an option on pointer down, not on click.
    await k.act(async () => { option.dispatchEvent(new w.Event('pointerdown', { bubbles: true, cancelable: true })) })
    await k.tick(10)
  }
  const assignTo = async (who: string) => {
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
  const body = (index = 0) => saves[index]?.body as Record<string, unknown>
  return { ...screen, labelOf, productBox, reasonBox, detailBox, reasonError, setValue, chooseStage, assignTo, save, saves, saved, body, optionLabels: (el: HTMLSelectElement) => Array.from(el.options).map((o) => o.textContent) }
}

describe('the opportunity form: the optional Product', () => {
  afterEach(async () => { await disposeAll() })

  it('is a labelled box with "No product" first and every product the Product Master lists', async () => {
    const s = await open()
    assert.ok(s.productBox(), 'the Product box is drawn')
    assert.equal(s.labelOf(s.productBox()!), 'Product (optional)')
    assert.deepEqual(s.optionLabels(s.productBox()!), ['No product', 'ScholarClone', 'ScholarClone › School ERP', 'G2G'])
    assert.equal(s.productBox()!.value, '', 'a new opportunity starts with no product')
    s.restore()
  })

  it('a new opportunity with a chosen product sends it as productMasterId, a number', async () => {
    const s = await open()
    await s.setValue(s.k.one('#opp-name')!, 'Hillcrest ERP rollout')
    await s.assignTo('Asha')
    await s.setValue(s.productBox()!, '9')
    await s.save('Create Opportunity')
    assert.equal(s.saves.length, 1)
    assert.equal(s.saves[0].method, 'POST')
    assert.equal(s.body().productMasterId, 9)
    assert.equal(s.body().name, 'Hillcrest ERP rollout')
    assert.deepEqual(s.saved, ['Opportunity created.'])
    s.restore()
  })

  it('a new opportunity with no product sends no product key at all, and no reason key', async () => {
    const s = await open()
    await s.setValue(s.k.one('#opp-name')!, 'Hillcrest ERP rollout')
    await s.assignTo('Asha')
    await s.save('Create Opportunity')
    assert.equal(s.saves[0].method, 'POST')
    for (const key of ['productMasterId', 'product_master_id', 'lossReasonCode', 'product', 'lossReason']) assert.equal(key in s.body(), false, `${key} is not sent`)
    s.restore()
  })

  it('an edit shows the product chosen, and saving without touching it sends no product key (and none of the answer-only fields)', async () => {
    const s = await open({ opportunity: opportunity({ product: PRODUCT, loss_reason: null }) })
    assert.equal(s.productBox()!.value, '9')
    await s.save('Save Changes')
    assert.equal(s.saves[0].method, 'PUT')
    for (const key of ['productMasterId', 'product_master_id', 'product', 'lossReason', 'loss_reason', 'lossReasonCode']) assert.equal(key in s.body(), false, `${key} is not sent`)
    assert.equal(s.body().name, 'Hillcrest ERP rollout')
    s.restore()
  })

  it('an edit that changes the product sends the new one', async () => {
    const s = await open({ opportunity: opportunity({ product: PRODUCT }) })
    await s.setValue(s.productBox()!, '12')
    await s.save('Save Changes')
    assert.equal(s.body().productMasterId, 12)
    s.restore()
  })

  it('an edit that clears the product sends null, which is how the server is told "no product"', async () => {
    const s = await open({ opportunity: opportunity({ product: PRODUCT }) })
    await s.setValue(s.productBox()!, '')
    await s.save('Save Changes')
    assert.ok('productMasterId' in s.body() && s.body().productMasterId === null)
    s.restore()
  })

  it('an edit of an opportunity that had no product can give it one', async () => {
    const s = await open({ opportunity: opportunity({ product: null }) })
    assert.equal(s.productBox()!.value, '')
    await s.setValue(s.productBox()!, '4')
    await s.save('Save Changes')
    assert.equal(s.body().productMasterId, 4)
    s.restore()
  })

  it('keeps a product the list no longer holds (archived since) under its own name, so it can be seen and cleared', async () => {
    const s = await open({ opportunity: opportunity({ product: { id: 77, key: 'old', name: 'Old Product' } }) })
    assert.deepEqual(s.optionLabels(s.productBox()!), ['No product', 'ScholarClone', 'ScholarClone › School ERP', 'G2G', 'Old Product'])
    assert.equal(s.productBox()!.value, '77')
    s.restore()
  })

  it('when the products cannot be read (no right, a server without the Product Master) the box is not drawn and the form works as before', async () => {
    const s = await open({ optionsStatus: 403 })
    absent(s.productBox(), 'no Product box')
    await s.setValue(s.k.one('#opp-name')!, 'Hillcrest ERP rollout')
    await s.assignTo('Asha')
    await s.save('Create Opportunity')
    assert.equal('productMasterId' in s.body(), false)
    assert.deepEqual(s.saved, ['Opportunity created.'])
    s.restore()
  })

  it('shows the server\'s refusal of a product in the dialog and does not close it', async () => {
    const s = await open({ opportunity: opportunity({ product: null }), onSave: () => ({ status: 0, message: 'Product not found.', errors: { productMasterId: ['Choose one of your own products.'] }, __status: 422 }) })
    await s.setValue(s.productBox()!, '9')
    await s.save('Save Changes')
    says(s.k.bodyText(), 'Product not found.')
    assert.deepEqual(s.saved, [], 'nothing was saved')
    s.restore()
  })
})

describe('the opportunity form: the Campaign box', () => {
  afterEach(async () => { await disposeAll() })

  const campaignCalls = (s: Awaited<ReturnType<typeof open>>) => s.calls.filter((c) => c.method === 'GET' && c.path.endsWith('/crm/campaigns'))
  const campaignField = (s: Awaited<ReturnType<typeof open>>) => s.k.one('[data-opportunity-campaign-field]')

  /** Counts what the page logged as an error while the callback ran: a refusal that is understood must not be one. */
  async function loggingErrors<T>(run: () => Promise<T>): Promise<{ result: T; errors: unknown[][] }> {
    const original = console.error
    const errors: unknown[][] = []
    console.error = (...args: unknown[]) => { errors.push(args) }
    try { return { result: await run(), errors } } finally { console.error = original }
  }

  it('a person whose menu does not hold the Campaigns row is not asked for the campaign list at all, and the box is left out', async () => {
    const { result: s, errors } = await loggingErrors(() => open({ opportunity: opportunity() }))
    assert.equal(campaignCalls(s).length, 0, 'no request to /crm/campaigns')
    absent(campaignField(s), 'no Campaign box')
    assert.equal(s.k.all('label').some((l) => l.textContent === 'Campaign'), false)
    assert.ok(s.k.all('label').some((l) => l.textContent === 'Organization'), 'the Organization box is still there')
    assert.deepEqual(errors, [], 'nothing logged')
    s.restore()
  })

  it('and the opportunity keeps the campaign it has: saving sends it unchanged', async () => {
    const s = await open({ opportunity: opportunity({ campaignId: '7', campaignName: 'Diwali outreach' }) })
    await s.save('Save Changes')
    assert.equal(s.body().campaignId, '7')
    assert.deepEqual(s.saved, ['Opportunity updated.'])
    s.restore()
  })

  it('a person whose menu holds the row is asked once per opening and gets the box with the campaigns in it', async () => {
    const s = await open({ campaigns: true })
    assert.equal(campaignCalls(s).length, 1)
    assert.ok(campaignField(s), 'the Campaign box is drawn')
    const trigger = s.k.all('[role="combobox"]').find((c) => c.textContent?.includes('No campaign'))!
    await s.k.click(trigger)
    await s.k.tick(10)
    assert.deepEqual(s.k.all('[role="option"]').map((o) => o.textContent), ['Diwali outreach', 'Pongal drive'])
    s.restore()
  })

  for (const status of [403, 404]) {
    it(`a ${status} on the campaign list is an answer: the box is left out, nothing is logged, and the form saves as it should`, async () => {
      const { result: s, errors } = await loggingErrors(() => open({ opportunity: opportunity({ campaignId: '7' }), campaigns: true, campaignsStatus: status }))
      assert.equal(campaignCalls(s).length, 1, 'asked once, not again')
      absent(campaignField(s), 'the box is gone once the server has said no')
      assert.deepEqual(errors, [], 'nothing logged by the page')
      await s.save('Save Changes')
      assert.equal(s.body().campaignId, '7', 'the opportunity keeps its campaign')
      assert.deepEqual(s.saved, ['Opportunity updated.'])
      s.restore()
    })
  }

  it('an earlier refusal does not hold the box back on a later opening, once the server says yes', async () => {
    let status = 403
    const screen = await screenKit({
      campaigns: true,
      respond: (call: Call) => {
        if (call.path.endsWith('/crm/campaigns')) return status ? { status: 0, message: 'No.', __status: status } : listAnswer([{ id: '7', name: 'Diwali outreach' }])
        if (call.path.endsWith('/crm/opportunities/pipeline')) return pipelineAnswer()
        if (call.path.endsWith('/crm/organizations')) return listAnswer([])
        return undefined
      },
    })
    const { CreateOpportunityModal } = await import('../../components/domain/crm/create-opportunity-modal')
    const show = (isOpen: boolean) => screen.mount(screen.k.h(CreateOpportunityModal, { isOpen, onClose: () => undefined, onSaved: () => undefined, opportunity: null, picklists }), 40)
    await show(true)
    absent(screen.k.one('[data-opportunity-campaign-field]'), 'refused: no box')
    status = 0
    await show(false)
    await show(true)
    await screen.k.tick(40)
    assert.ok(screen.k.one('[data-opportunity-campaign-field]'), 'allowed on the next opening: the box is back')
    screen.restore()
  })

  it('any other failure of the campaign list (a 500) leaves the box in, with nothing to choose, as it always was', async () => {
    const s = await open({ campaigns: true, campaignsStatus: 500 })
    assert.ok(campaignField(s), 'the box stays')
    s.restore()
  })
})

describe('the opportunity form: when it is closed', () => {
  afterEach(async () => { await disposeAll() })

  it('reads neither the products nor the reasons until it is opened', async () => {
    const screen = await screenKit({ respond: () => undefined })
    const { CreateOpportunityModal } = await import('../../components/domain/crm/create-opportunity-modal')
    await screen.mount(screen.k.h(CreateOpportunityModal, { isOpen: false, onClose: () => undefined, onSaved: () => undefined, opportunity: null, picklists }), 60)
    assert.equal(screen.calls.filter((c) => c.path.endsWith('/product-master/options') || c.path.endsWith('/crm/opportunities/pipeline')).length, 0)
    screen.restore()
  })

  it('reads both when it is opened', async () => {
    const s = await open()
    assert.equal(s.calls.filter((c) => c.path.endsWith('/product-master/options')).length, 1)
    assert.equal(s.calls.filter((c) => c.path.endsWith('/crm/opportunities/pipeline')).length, 1)
    s.restore()
  })
})

describe('the opportunity form: the coded Reason', () => {
  afterEach(async () => { await disposeAll() })

  it('is not asked for while the stage is not Closed Lost', async () => {
    const s = await open({ opportunity: opportunity() })
    absent(s.reasonBox(), 'no Reason box')
    absent(s.detailBox(), 'and no box for words')
    s.restore()
  })

  it('moving the stage to Closed Lost shows the Reason box (the server\'s reasons, in its order) and a box for more detail', async () => {
    const s = await open({ opportunity: opportunity() })
    await s.chooseStage('Closed Lost')
    assert.ok(s.reasonBox(), 'the Reason box')
    assert.equal(s.labelOf(s.reasonBox()!), 'Reason lost')
    assert.deepEqual(s.optionLabels(s.reasonBox()!), ['Choose a reason…', ...REASONS.map((r) => r.label)])
    assert.equal(s.reasonBox()!.value, '')
    assert.equal(s.labelOf(s.detailBox()!), 'More detail (optional)')
    s.restore()
  })

  it('saving with neither a reason nor words says so next to the Reason box, sends nothing and keeps the form open', async () => {
    const s = await open({ opportunity: opportunity() })
    await s.chooseStage('Closed Lost')
    await s.save('Save Changes')
    assert.equal(s.saves.length, 0)
    assert.equal(s.reasonError()!.textContent, 'Choose why this opportunity was lost, or write it in your own words.')
    assert.equal(s.reasonBox()!.getAttribute('aria-describedby'), s.reasonError()!.id)
    assert.equal(s.reasonBox()!.getAttribute('aria-invalid'), 'true')
    s.restore()
  })

  it('a chosen reason is sent as lossReasonCode with the stage', async () => {
    const s = await open({ opportunity: opportunity() })
    await s.chooseStage('Closed Lost')
    await s.setValue(s.reasonBox()!, 'timing')
    await s.save('Save Changes')
    assert.equal(s.saves.length, 1)
    assert.equal(s.body().salesStage, 'Closed Lost')
    assert.equal(s.body().lossReasonCode, 'timing')
    assert.deepEqual(s.saved, ['Opportunity updated.'])
    s.restore()
  })

  it('words alone are enough, and then no code key is sent', async () => {
    const s = await open({ opportunity: opportunity() })
    await s.chooseStage('Closed Lost')
    await s.setValue(s.detailBox()!, 'Gone quiet')
    await s.save('Save Changes')
    assert.equal(s.body().closeReason, 'Gone quiet')
    assert.equal('lossReasonCode' in s.body(), false)
    s.restore()
  })

  it('a reason chosen and then abandoned (the stage moved back) is not sent', async () => {
    const s = await open({ opportunity: opportunity() })
    await s.chooseStage('Closed Lost')
    await s.setValue(s.reasonBox()!, 'price')
    await s.chooseStage('Closed Won')
    await s.save('Save Changes')
    assert.equal(s.body().salesStage, 'Closed Won')
    assert.equal('lossReasonCode' in s.body(), false)
    s.restore()
  })

  it('an opportunity that is already lost shows its reason chosen, is not asked again, and saving without touching it sends no code', async () => {
    const s = await open({ opportunity: opportunity({ salesStage: 'Closed Lost', closeReason: 'Price too high', loss_reason: { code: 'price', label: 'Price too high' } }) })
    assert.equal(s.reasonBox()!.value, 'price')
    assert.equal(s.detailBox()!.value, '', 'the free text was only the label (the server copies it), so the box for words starts empty')
    await s.save('Save Changes')
    assert.equal(s.saves.length, 1, 'it saved without asking for a reason')
    assert.equal('lossReasonCode' in s.body(), false)
    s.restore()
  })

  it('an opportunity that is already lost keeps the person\'s own words in the box', async () => {
    const s = await open({ opportunity: opportunity({ salesStage: 'Closed Lost', closeReason: 'Went with Acme at 20% less', loss_reason: { code: 'competitor', label: 'Chose a competitor' } }) })
    assert.equal(s.detailBox()!.value, 'Went with Acme at 20% less')
    s.restore()
  })

  it('changing the reason of a lost deal sends the new code; clearing it sends null', async () => {
    const changed = await open({ opportunity: opportunity({ salesStage: 'Closed Lost', closeReason: 'x', loss_reason: { code: 'price', label: 'Price too high' } }) })
    await changed.setValue(changed.reasonBox()!, 'timing')
    await changed.save('Save Changes')
    assert.equal(changed.body().lossReasonCode, 'timing')
    changed.restore()
    await disposeAll()

    const cleared = await open({ opportunity: opportunity({ salesStage: 'Closed Lost', closeReason: 'x', loss_reason: { code: 'price', label: 'Price too high' } }) })
    await cleared.setValue(cleared.reasonBox()!, '')
    await cleared.save('Save Changes')
    assert.ok('lossReasonCode' in cleared.body() && cleared.body().lossReasonCode === null)
    cleared.restore()
  })

  it('keeps a code the list no longer holds, under its own label', async () => {
    const s = await open({ opportunity: opportunity({ salesStage: 'Closed Lost', closeReason: 'x', loss_reason: { code: 'old_code', label: 'An old reason' } }) })
    assert.equal(s.optionLabels(s.reasonBox()!).at(-1), 'An old reason')
    assert.equal(s.reasonBox()!.value, 'old_code')
    s.restore()
  })

  it('a server that requires a code says so next to the Reason box, in its own words, and the form stays open', async () => {
    const s = await open({ opportunity: opportunity(), onSave: (_call, attempt) => (attempt === 1 ? REQUIRED : undefined) })
    await s.chooseStage('Closed Lost')
    await s.setValue(s.detailBox()!, 'Gone quiet')
    await s.save('Save Changes')
    assert.equal(s.saves.length, 1)
    assert.equal(s.reasonError()!.textContent, 'Choose why this opportunity was lost.')
    assert.deepEqual(s.saved, [])
    await s.setValue(s.reasonBox()!, 'no_response')
    absent(s.reasonError(), 'the sentence goes once the person answers')
    await s.save('Save Changes')
    assert.equal(s.body(1).lossReasonCode, 'no_response')
    assert.deepEqual(s.saved, ['Opportunity updated.'])
    s.restore()
  })

  it('has nothing for the accessibility rules to find in the Reason fields, with an error showing, and adds nothing to what the rest of the form already had', async () => {
    const s = await open({ opportunity: opportunity() })
    await s.chooseStage('Closed Lost')
    await s.save('Save Changes')
    assert.ok(s.reasonError(), 'an error is showing')
    assert.deepEqual(await axeViolations(s.k.one('[data-opportunity-reason-fields]')!), [], 'the fields themselves')
    assert.deepEqual(await axeViolations(s.k.one('[data-opportunity-product-field]')!), [], 'the Product box')
    const withBoxes = await axeViolations(s.k.w.document.body)
    s.restore()
    await disposeAll()
    const before = await open({ opportunity: opportunity(), optionsStatus: 403, reasons: 'older' })
    await before.chooseStage('Closed Lost')
    absent(before.productBox(), 'the same form without the new boxes')
    const without = await axeViolations(before.k.w.document.body)
    before.restore()
    // The custom Select (Sales Stage and the others) names its trigger by nothing: older than this work, and the same with or without the new boxes.
    assert.equal(withBoxes.length, without.length, `the new boxes add no violation to the form (the form's own: ${without.join(' | ')})`)
  })
})

describe('the opportunity form against an older server (no lossReasons, nothing new)', () => {
  afterEach(async () => { await disposeAll() })

  it('asks for the reason as it always did: one box, "Reason Lost *", required, with the old sentence when it is empty', async () => {
    const s = await open({ opportunity: opportunity(), reasons: 'older', optionsStatus: 403 })
    await s.chooseStage('Closed Lost')
    absent(s.reasonBox(), 'no Reason box')
    assert.equal(s.labelOf(s.detailBox()!), 'Reason Lost *')
    await s.save('Save Changes')
    assert.equal(s.saves.length, 0)
    says(s.k.bodyText(), 'Say why this opportunity was lost - it is the only way the pipeline learns from it.')
    absent(s.reasonError(), 'and it is the form\'s own alert, not the new field error')
    await s.setValue(s.detailBox()!, 'No money this year')
    await s.save('Save Changes')
    assert.equal(s.body().closeReason, 'No money this year')
    for (const key of ['lossReasonCode', 'productMasterId']) assert.equal(key in s.body(), false, key)
    s.restore()
  })

  it('keeps the form\'s other fields and the existing buttons, and adds no send or schedule control', async () => {
    const s = await open({ opportunity: opportunity() })
    for (const label of ['Opportunity Name *', 'Amount', 'Currency', 'Probability %', 'Sales Stage', 'Closing Date', 'Next Step', 'Description']) assert.ok(s.k.all('label').some((l) => l.textContent?.includes(label)), label)
    for (const label of ['Cancel', 'Save Changes']) assert.ok(s.k.withText(label), label)
    assert.equal(s.k.all('button').some((b) => /send|schedule/i.test(b.textContent ?? '')), false)
    same(s.k.one('#opp-name') === null, false, 'the name box is there')
    s.restore()
  })
})
