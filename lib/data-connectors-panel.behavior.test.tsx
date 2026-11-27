import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'
import { disposeAll, kit } from './scaffolds/dom-test-kit'
import type { DataConnectorInfo, DataConnectorsResponse } from '@/services/signals/opportunities'

/**
 * The existing social / web connector panel, driven through its real buttons with the service MOCKED (no provider is contacted). Mocked tests: they prove
 * what the screen does with each answer, not that a provider accepts a real account.
 */
const connector = (id: number, over: Partial<DataConnectorInfo> = {}): DataConnectorInfo => ({
  id, type: 'facebook_page', name: `Connector ${id}`, url: 'https://www.facebook.com/page', external_account_id: 'PAGE', account_name: `Account ${id}`, product_key: 'scholarclone',
  offer_id: null, customer_model: 'b2b', regions: null, connection_status: 'connected', sync_enabled: true, schedule_enabled: false, schedule_interval_minutes: 60,
  schedule_timezone: 'UTC', next_sync_at: null, available_accounts: [], last_sync_at: null, last_successful_sync_at: null, last_error: null, history: [], ...over,
})

const provider = (key: string, label: string, ready = true) => ({ key, label, auth: key === 'public_web_page' ? 'public_url' as const : 'oauth' as const, requirements: [], ready, readiness_message: ready ? null : 'The platform application is not configured on this server.' })

const answer = (data: DataConnectorInfo[], ready = true): DataConnectorsResponse => ({
  status: 1, tables_migrated: true, global_schedule_enabled: false,
  available: [provider('facebook_page', 'Facebook'), provider('youtube', 'YouTube'), provider('linkedin', 'LinkedIn', ready), provider('public_web_page', 'Public website or article')],
  data,
})

const context = { token: 't', subInstituteId: '1', userId: '1' } as never

async function mount(data: DataConnectorInfo[], props: Record<string, unknown> = {}, ready = true) {
  const k = await kit()
  const { opportunitiesService } = await import('@/services/signals/opportunities')
  const { DataConnectorsPanel } = await import('@/components/domain/signals/data-connectors-panel')
  const list = mock.method(opportunitiesService, 'listConnectors', async () => answer(data, ready))
  await k.render(k.h(DataConnectorsPanel, { context, productKey: 'scholarclone', requestTimeoutMs: 60, ...props }))
  await k.tick(10)

  return { k, opportunitiesService, list }
}

const syncButtons = (k: Awaited<ReturnType<typeof kit>>) => k.all('button').filter((b) => /^sync/i.test((b.textContent ?? '').trim()))

describe('the social and web connector panel', () => {
  afterEach(async () => {
    mock.restoreAll()
    await disposeAll()
  })

  it('offers Sync only for a connector that is really connected, and Connect / Reconnect / Enable for the others', async () => {
    const { k } = await mount([
      connector(1),
      connector(2, { type: 'youtube', name: 'Our Channel' }),
      connector(3, { type: 'public_web_page', name: 'News page', connection_status: 'not_configured', external_account_id: null }),
      connector(4, { type: 'linkedin', name: 'Our LinkedIn', connection_status: 'token_expired', last_error: 'The access token has expired. Reconnect this account to authorise it again.' }),
    ])
    assert.equal(syncButtons(k).length, 3, 'two connected connectors, and the web page that can be fetched without a sign-in')
    assert.ok(k.withText('Reconnect'), 'an expired token offers Reconnect')
    assert.match(k.bodyText(), /access token has expired/i, 'and says why')
    const texts = k.all('button').map((b) => (b.textContent ?? '').trim())
    assert.ok(texts.includes('Reconnect'))
  })

  it('a click on one connector\'s Sync locks only that connector, and a second connector can sync at the same time', async () => {
    const { k, opportunitiesService } = await mount([connector(1), connector(2, { type: 'youtube', name: 'Our Channel' })])
    const asked: number[] = []
    mock.method(opportunitiesService, 'syncConnector', async (_c: unknown, id: number) => { asked.push(id); return new Promise(() => {}) })   // the server never answers
    const [first, second] = syncButtons(k)
    await k.click(first)
    assert.equal(syncButtons(k)[0].hasAttribute('disabled'), true, 'the clicked connector waits')
    assert.equal(syncButtons(k)[1].hasAttribute('disabled'), false, 'the other connector stays usable')
    await k.click(syncButtons(k)[1])
    assert.deepEqual(asked, [1, 2])
    assert.equal(syncButtons(k)[0].hasAttribute('disabled'), true, 'starting the second did not release the first')
    void second
  })

  it('a request the server never answers is stopped on screen with a clear message and the button comes back', async () => {
    const { k, opportunitiesService } = await mount([connector(1)])
    mock.method(opportunitiesService, 'syncConnector', async () => new Promise(() => {}))
    await k.click(syncButtons(k)[0])
    assert.equal(syncButtons(k)[0].hasAttribute('disabled'), true)
    await k.tick(120)
    assert.match(k.bodyText(), /did not answer within/)
    assert.equal(syncButtons(k)[0].hasAttribute('disabled'), false, 'not locked for good')
  })

  it('a refused Sync shows the server\'s reason and leaves the connector usable', async () => {
    const { k, opportunitiesService } = await mount([connector(1)])
    mock.method(opportunitiesService, 'syncConnector', async () => { throw new Error('A sync is already running for this connector.') })
    await k.click(syncButtons(k)[0])
    await k.tick(10)
    assert.match(k.bodyText(), /A sync is already running for this connector\./)
    assert.equal(syncButtons(k)[0].hasAttribute('disabled'), false)
  })

  it('an accepted Sync says it is queued, never that it finished', async () => {
    const { k, opportunitiesService } = await mount([connector(1)])
    mock.method(opportunitiesService, 'syncConnector', async () => ({ status: 1, message: 'Connector sync queued. It stays "queued" until a Signals queue worker picks it up.', data: {} }))
    await k.click(syncButtons(k)[0])
    await k.tick(10)
    assert.match(k.bodyText(), /queued/i)
    assert.doesNotMatch(k.bodyText(), /sync(ed)? (complete|finished|done)/i)
  })

  it('a connector whose platform application is not configured on the server cannot start the sign-in, and says why', async () => {
    const { k } = await mount([connector(4, { type: 'linkedin', name: 'Our LinkedIn', connection_status: 'not_configured', external_account_id: null })], {}, false)
    const connect = k.all('button').find((b) => /connect account/i.test((b.textContent ?? '').trim()))!
    assert.ok(connect, 'there is a Connect account button')
    assert.equal(connect.hasAttribute('disabled'), true, 'it cannot be clicked into a provider that is not set up')
    assert.match(k.bodyText(), /not configured on this server|administrator/i)
  })

  it('a sync nobody has picked up for minutes says no queue worker is running, instead of "waiting" for ever', async () => {
    const queuedFor = (minutes: number) => ({
      id: 9, source_id: null, status: 'queued' as const, records_fetched: 0, records_processed: 0, records_skipped: 0, records_created: 0, records_duplicate: 0, records_failed: 0,
      progress: 2, error_message: null, started_at: new Date(Date.now() - minutes * 60_000).toISOString(), completed_at: null,
    })
    const stuck = await mount([connector(1, { history: [queuedFor(5)] })])
    assert.match(stuck.k.bodyText(), /no Signals queue worker has picked this up/)
    assert.match(stuck.k.bodyText(), /queue:work --queue=signals,default/)
    await disposeAll()

    const fresh = await mount([connector(1, { history: [queuedFor(0)] })])
    assert.match(fresh.k.bodyText(), /Waiting in the queue for a worker/)
    assert.doesNotMatch(fresh.k.bodyText(), /no Signals queue worker has picked this up/)
  })

  it('a server that never answers the connector list gives an error instead of a spinner for ever', async () => {
    const k = await kit()
    const { opportunitiesService } = await import('@/services/signals/opportunities')
    const { DataConnectorsPanel } = await import('@/components/domain/signals/data-connectors-panel')
    mock.method(opportunitiesService, 'listConnectors', async () => new Promise(() => {}))
    await k.render(k.h(DataConnectorsPanel, { context, productKey: 'scholarclone', requestTimeoutMs: 40 }))
    await k.tick(120)
    assert.match(k.bodyText(), /did not answer within|Failed to load/)
  })
})
