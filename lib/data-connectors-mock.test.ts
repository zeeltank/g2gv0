import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { LaravelContext } from '@/lib/laravel-context'
import { DataConnectorMockApi, isConnectorMockModeEnabled } from './signals/data-connectors-mock'

const context = (subInstituteId: string): LaravelContext => ({
  token: '',
  subInstituteId,
  syear: '',
  userId: '',
  organizationId: '',
  orgType: '',
  profileId: '',
})

describe('Data Connector mock mode', () => {
  it('is opt-in and cannot activate outside a development build', () => {
    assert.equal(isConnectorMockModeEnabled('development', undefined), false)
    assert.equal(isConnectorMockModeEnabled('development', 'false'), false)
    assert.equal(isConnectorMockModeEnabled('production', 'true'), false)
    assert.equal(isConnectorMockModeEnabled('test', 'true'), false)
    assert.equal(isConnectorMockModeEnabled('development', ' TRUE '), true)
  })

  it('keeps state tenant-scoped without claiming provider connectivity', () => {
    const mock = new DataConnectorMockApi()
    const firstTenant = context('tenant-one')
    const secondTenant = context('tenant-two')

    const created = mock.create(firstTenant, {
      type: 'youtube',
      name: 'Local YouTube connector',
      product_key: 'g2g',
    })

    assert.equal(created.data.connection_status, 'not_configured')
    assert.deepEqual(mock.list(secondTenant).data, [])
    assert.equal(mock.list(firstTenant).data[0]?.id, created.data.id)
  })

  it('records sync as skipped and never reports created opportunities', () => {
    const mock = new DataConnectorMockApi()
    const tenant = context('tenant-one')
    const { data: connector } = mock.create(tenant, {
      type: 'facebook_page',
      name: 'Local Page connector',
      product_key: 'g2g',
    })

    const response = mock.sync(tenant, connector.id)
    if (!('status' in response.data)) throw new Error('Expected the sync response to contain a run.')
    const listed = mock.list(tenant).data[0]

    assert.equal(response.data.status, 'skipped')
    assert.equal(response.data.records_fetched, 0)
    assert.equal(response.data.records_created, 0)
    assert.match(response.data.error_message ?? '', /no opportunities are created/)
    assert.equal(listed?.last_successful_sync_at, null)
    assert.equal(listed?.history[0]?.status, 'skipped')
  })

  it('rejects sync after the local connector is disabled', () => {
    const mock = new DataConnectorMockApi()
    const tenant = context('tenant-one')
    const { data: connector } = mock.create(tenant, {
      type: 'public_web_page',
      name: 'Local page connector',
      url: 'https://example.invalid',
      product_key: 'g2g',
    })

    mock.saveSchedule(tenant, connector.id, {
      sync_enabled: false,
      schedule_enabled: false,
      schedule_interval_minutes: 1440,
      schedule_timezone: 'UTC',
    })
    assert.throws(() => mock.sync(tenant, connector.id), /disabled/)
  })

  it('deletes a connector and keeps other connectors untouched', () => {
    const mock = new DataConnectorMockApi()
    const tenant = context('tenant-one')
    const { data: c1 } = mock.create(tenant, { type: 'youtube', name: 'Y1', product_key: 'g2g' })
    const { data: c2 } = mock.create(tenant, { type: 'youtube', name: 'Y2', product_key: 'g2g' })

    const res = mock.delete(tenant, c1.id)
    assert.equal(res.status, 200)
    const list = mock.list(tenant).data
    assert.equal(list.length, 1)
    assert.equal(list[0]?.id, c2.id)

    assert.throws(() => mock.delete(tenant, 999), /not found/)
  })
})
