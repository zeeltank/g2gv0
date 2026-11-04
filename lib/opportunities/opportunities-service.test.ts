import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { crmService } from '../../services/crm'
import type { LaravelContext } from '../laravel-context'
import { listAnswer, opportunity, pipelineAnswer, PRODUCT, REASONS } from './fixtures'

/** The opportunity service: what comes back has the new fields read, an older server's answer comes back as it was sent, and a move carries what it is given. */

interface Call { url: URL; init?: RequestInit }

const restore: Array<() => void> = []
afterEach(() => { for (const fn of restore.splice(0)) fn() })

function fakeFetch(reply: (call: Call) => unknown) {
  const calls: Call[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const call = { url: new URL(String(input), 'http://test.local'), init }
    calls.push(call)
    return new Response(JSON.stringify(reply(call)), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  restore.push(() => { globalThis.fetch = original })
  return calls
}

const context: LaravelContext = { token: 'test-token', subInstituteId: '1', syear: '', userId: '2', organizationId: '', orgType: '', profileId: '16' }
const sent = (call: Call) => JSON.parse(String(call.init?.body)) as Record<string, unknown>
const one = (over: Record<string, unknown> = {}) => ({ status: 1, message: 'Opportunity.', data: opportunity(over) })

describe('the answers', () => {
  it('a list from an older server (none of the new fields) comes back as it was sent, with no field invented', async () => {
    fakeFetch(() => listAnswer([opportunity(), opportunity({ id: '32', name: 'Pongal supplies' })]))
    const response = await crmService.getOpportunities(context)
    assert.equal(response.data.items.length, 2)
    assert.deepEqual(response.data.items[1], opportunity({ id: '32', name: 'Pongal supplies' }))
    assert.equal(response.data.pagination.total, 2, 'the pagination is untouched')
    for (const item of response.data.items) for (const key of ['product', 'lossReason']) assert.equal(key in item, false, `${key} is not invented`)
  })

  it('a list from the new server has its contract fields read into the names the screens use', async () => {
    fakeFetch(() => listAnswer([opportunity({ product: PRODUCT, loss_reason: { code: 'price', label: 'Price too high' } }), opportunity({ id: '32', product: null, loss_reason: null })]))
    const response = await crmService.getOpportunities(context)
    assert.deepEqual(response.data.items[0].product, PRODUCT)
    assert.deepEqual(response.data.items[0].lossReason, { code: 'price', label: 'Price too high' })
    assert.equal(response.data.items[1].product, null)
    assert.equal(response.data.items[1].lossReason, null)
  })

  it('the one-opportunity answer, a create, an edit and a stage move are all read the same way', async () => {
    const answer = () => one({ product: PRODUCT, loss_reason: { code: 'timing', label: 'Timing was wrong' } })
    fakeFetch(answer)
    const results = [
      await crmService.getOpportunity(context, '31'),
      await crmService.createOpportunity(context, { name: 'x', assignedTo: '2' }),
      await crmService.updateOpportunity(context, '31', { name: 'x' }),
      await crmService.changeOpportunityStage(context, '31', { salesStage: 'Closed Lost', lossReasonCode: 'timing' }),
    ]
    for (const result of results) {
      assert.deepEqual(result.data.product, PRODUCT)
      assert.deepEqual(result.data.lossReason, { code: 'timing', label: 'Timing was wrong' })
      assert.equal(result.message, 'Opportunity.', 'the message is untouched')
    }
  })

  it('the pipeline answer\'s reasons are read; an older answer comes back without the key', async () => {
    fakeFetch(() => pipelineAnswer())
    const withReasons = await crmService.getOpportunityPipeline(context)
    assert.deepEqual(withReasons.data.lossReasons, REASONS)
    assert.equal(withReasons.data.stages.length, 5, 'the stages are untouched')
    restore.splice(0).forEach((fn) => fn())
    fakeFetch(() => pipelineAnswer(null))
    const older = await crmService.getOpportunityPipeline(context)
    assert.equal('lossReasons' in older.data, false)
    assert.equal(older.data.stages.length, 5)
  })
})

describe('the requests', () => {
  it('a stage move sends what it is given under the names the endpoint reads', async () => {
    const calls = fakeFetch(() => one())
    await crmService.changeOpportunityStage(context, '31', { salesStage: 'Closed Lost', lossReasonCode: 'price', closeReason: 'cheaper elsewhere' })
    assert.equal(calls[0].init?.method, 'PUT')
    assert.equal(calls[0].url.pathname.endsWith('/crm/opportunities/31/stage'), true)
    assert.equal(sent(calls[0]).salesStage, 'Closed Lost')
    assert.equal(sent(calls[0]).lossReasonCode, 'price')
    assert.equal(sent(calls[0]).closeReason, 'cheaper elsewhere')
  })

  it('a create and an edit carry productMasterId and lossReasonCode when given, and nothing when not', async () => {
    const calls = fakeFetch(() => one())
    await crmService.createOpportunity(context, { name: 'x', assignedTo: '2', productMasterId: 9 })
    await crmService.updateOpportunity(context, '31', { name: 'x', productMasterId: null, lossReasonCode: 'other' })
    await crmService.updateOpportunity(context, '31', { name: 'x' })
    assert.equal(sent(calls[0]).productMasterId, 9)
    assert.ok('productMasterId' in sent(calls[1]) && sent(calls[1]).productMasterId === null)
    assert.equal(sent(calls[1]).lossReasonCode, 'other')
    for (const key of ['productMasterId', 'lossReasonCode']) assert.equal(key in sent(calls[2]), false, key)
  })
})
