import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent } from '../agent/assertions'
import type { CrmOpportunity } from '../../types/crm'
import { withOpportunityExtras } from './model'
import { opportunity, options, pipelineAnswer, PRODUCT } from './fixtures'
import { screenKit } from './screen-kit'

/** An opportunity's page as a person meets it: the real page, the real sidebar hook and service client, only the network replaced. */

const TABS_AS_ALWAYS = ['Details', 'AI Deal Coach & MEDDPICC', 'Contacts', 'Products & Services', 'Quotes', 'Stage History', 'Schedule', 'Comments', 'Documents', 'Emails', 'Projects']
const picklists = { salesStage: [], leadSource: [], potentialType: [], forecastCategory: [] }

async function open(over: Record<string, unknown> = {}) {
  const screen = await screenKit({
    pathname: '/module/crm/sales/opportunities/31',
    respond: (call) => {
      if (call.path.endsWith('/product-master/options')) return { status: 1, data: options }
      if (call.path.endsWith('/crm/opportunities/pipeline')) return pipelineAnswer()
      return undefined
    },
  })
  const { OpportunityDetailPage } = await import('../../components/domain/crm/opportunity-detail-page')
  const read = withOpportunityExtras(opportunity(over) as unknown as CrmOpportunity)
  await screen.mount(screen.k.h(OpportunityDetailPage, { opportunity: read, onSaved: () => undefined, onBack: () => undefined, picklists }), 40)
  const { k } = screen
  const tabs = () => k.all('div.flex.gap-1.border-b button').map((b) => b.textContent)
  const productLine = () => k.one('[data-opportunity-product]')
  const reasonCard = () => k.one('[data-section="Reason Lost"], [data-loss-reason]')
  const label = () => k.one('[data-loss-reason-label]')
  const note = () => k.one('[data-loss-reason-note]')
  return { ...screen, tabs, productLine, reasonCard, label, note }
}

describe('an opportunity\'s page against an older server (none of slice 11\'s fields)', () => {
  afterEach(async () => { await disposeAll() })

  it('keeps its header and its tabs, and draws no product line and no Reason Lost card', async () => {
    const s = await open()
    assert.deepEqual(s.tabs(), TABS_AS_ALWAYS)
    absent(s.productLine(), 'nothing to say under the title, so nothing is drawn')
    absent(s.reasonCard(), 'no reason, no card')
    assert.ok(s.k.bodyText().includes('Hillcrest ERP rollout'))
    assert.ok(s.k.bodyText().includes('OPP-AB12CD34'))
    s.restore()
  })

  it('a free-text reason alone is shown as it always was, in one paragraph under Reason Lost', async () => {
    const s = await open({ salesStage: 'Closed Lost', closeReason: 'No money this year' })
    assert.ok(s.k.bodyText().includes('Reason Lost'))
    absent(s.label(), 'there is no coded reason to name')
    assert.equal(s.note()!.textContent, 'No money this year')
    s.restore()
  })
})

describe('an opportunity\'s page: the product', () => {
  afterEach(async () => { await disposeAll() })

  it('names the product under the title', async () => {
    const s = await open({ product: PRODUCT, loss_reason: null })
    assert.equal(s.productLine()!.textContent, 'Product: School ERP')
    s.restore()
  })

  it('says "No product chosen" when the server says there is none', async () => {
    const s = await open({ product: null })
    assert.equal(s.productLine()!.textContent, 'No product chosen')
    s.restore()
  })

  it('lets a long product name break instead of widening the page', async () => {
    const s = await open({ product: { id: 9, key: 'k', name: 'A very long product name '.repeat(8).trim() } })
    assert.match(s.productLine()!.className, /\bbreak-words\b/)
    s.restore()
  })
})

describe('an opportunity\'s page: the reason it was lost', () => {
  afterEach(async () => { await disposeAll() })

  it('says the coded reason in words, and the person\'s own words under it', async () => {
    const s = await open({ salesStage: 'Closed Lost', closeReason: 'Went with Acme at 20% less', loss_reason: { code: 'competitor', label: 'Chose a competitor' } })
    assert.equal(s.label()!.textContent, 'Chose a competitor')
    assert.equal(s.note()!.textContent, 'Went with Acme at 20% less')
    assert.ok(s.k.bodyText().includes('Reason Lost'))
    s.restore()
  })

  it('says the coded reason once when the free text is only the label (the server copies it there)', async () => {
    const s = await open({ salesStage: 'Closed Lost', closeReason: 'Price too high', loss_reason: { code: 'price', label: 'Price too high' } })
    assert.equal(s.label()!.textContent, 'Price too high')
    absent(s.note(), 'not said twice')
    assert.equal(s.k.bodyText().split('Price too high').length - 1, 1)
    s.restore()
  })

  it('a code with no words at all is still shown', async () => {
    const s = await open({ salesStage: 'Closed Lost', closeReason: null, loss_reason: { code: 'timing', label: 'Timing was wrong' } })
    assert.equal(s.label()!.textContent, 'Timing was wrong')
    absent(s.note(), 'no words')
    s.restore()
  })

  it('draws no card for a deal with the server saying "no coded reason" and no words', async () => {
    const s = await open({ loss_reason: null })
    absent(s.reasonCard(), 'no card')
    s.restore()
  })

  it('has nothing for the accessibility rules to find', async () => {
    const s = await open({ product: PRODUCT, salesStage: 'Closed Lost', closeReason: 'Went with Acme', loss_reason: { code: 'competitor', label: 'Chose a competitor' } })
    assert.deepEqual(await axeViolations(s.k.w.document.body), [])
    s.restore()
  })
})
