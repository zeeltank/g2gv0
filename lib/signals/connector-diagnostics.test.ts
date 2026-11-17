import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  connectorHealth,
  connectorStage,
  connectorStatusInfo,
  finishedSyncs,
  isSyncActive,
  latestStatuses,
  oauthReturnMessage,
  parseOAuthReturn,
  syncButtonState,
  syncRequestedMessage,
  syncRunDisplay,
  syncStageCounts,
} from './connector-diagnostics'

describe('connector diagnostics', () => {
  it('shows Configuration Required before anything else when the provider app is not configured', () => {
    const info = connectorStatusInfo('connected', { oauth: true, providerReady: false })
    assert.equal(info.label, 'Configuration Required')
    assert.match(info.action ?? '', /administrator/i)
  })

  it('never labels an unverified connector as Connected', () => {
    for (const status of ['not_configured', 'permission_required', 'token_expired', 'error', 'disconnected']) {
      assert.notEqual(connectorStatusInfo(status, { oauth: true, providerReady: true }).label, 'Connected')
    }
    assert.equal(connectorStatusInfo('connected', { oauth: true, providerReady: true }).label, 'Connected')
  })

  it('distinguishes choosing an account from a missing permission', () => {
    assert.equal(connectorStatusInfo('permission_required', { oauth: true, needsAccount: true }).label, 'Choose Account')
    assert.equal(connectorStatusInfo('permission_required', { oauth: true }).label, 'Permission Missing')
    assert.equal(connectorStatusInfo('token_expired', { oauth: true }).label, 'Token Expired')
  })

  it('treats a fresh website connector differently from a fresh OAuth connector', () => {
    assert.equal(connectorStatusInfo('not_configured', { oauth: false }).label, 'Not synced yet')
    assert.equal(connectorStatusInfo('not_configured', { oauth: true }).label, 'Authorization Required')
  })

  it('parses the OAuth return parameters and ignores unrelated query strings', () => {
    assert.deepEqual(parseOAuthReturn('?connector_oauth=error&connector_id=12&reason=cancelled'), { result: 'error', reason: 'cancelled', connectorId: 12 })
    assert.deepEqual(parseOAuthReturn('connector_oauth=pending&connector_id=3&reason=account_selection_required'), { result: 'pending', reason: 'account_selection_required', connectorId: 3 })
    assert.equal(parseOAuthReturn('?product=x'), null)
    assert.equal(parseOAuthReturn('?connector_oauth=hacked'), null)
    assert.equal(parseOAuthReturn('?connector_oauth=success&connector_id=abc')?.connectorId, null)
  })

  it('explains every OAuth failure reason and falls back safely for unknown ones', () => {
    for (const reason of ['invalid_state', 'cancelled', 'provider_denied', 'permission_required', 'exchange_failed']) {
      const message = oauthReturnMessage({ result: 'error', reason, connectorId: 1 })
      assert.equal(message.tone, 'danger')
      assert.ok(message.text.length > 20)
    }
    assert.ok(oauthReturnMessage({ result: 'error', reason: 'something_new', connectorId: 1 }).text.length > 0)
    assert.equal(oauthReturnMessage({ result: 'success', reason: null, connectorId: 1 }).tone, 'success')
    assert.equal(oauthReturnMessage({ result: 'pending', reason: 'account_selection_required', connectorId: 1 }).tone, 'warning')
  })

  it('derives test results from real stored state rather than a simulated ping', () => {
    assert.equal(connectorHealth({ connection_status: 'connected', last_error: null }, true).healthy, true)
    const failed = connectorHealth({ connection_status: 'token_expired', last_error: 'Reconnect this account.' }, true)
    assert.equal(failed.healthy, false)
    assert.equal(failed.message, 'Reconnect this account.')
    assert.equal(connectorHealth({ connection_status: 'error', last_error: null }, false).healthy, false)
  })
})

describe('sync state shown to the user', () => {
  it('blocks a second Sync Now while one is queued or running, and says why', () => {
    assert.deepEqual(syncButtonState([]).disabled, false)
    assert.equal(syncButtonState([{ status: 'completed' }]).disabled, false)
    assert.equal(syncButtonState([{ status: 'failed' }, { status: 'completed' }]).disabled, false)
    const queued = syncButtonState([{ status: 'queued' }])
    assert.equal(queued.disabled, true)
    assert.equal(queued.label, 'Queued')
    assert.match(queued.hint ?? '', /worker/i)
    assert.equal(syncButtonState([{ status: 'running' }]).disabled, true)
    assert.equal(isSyncActive([{ status: 'completed' }, { status: 'queued' }]), true)
    assert.equal(isSyncActive([{ status: 'failed' }]), false)
  })

  it('never calls a queued request a success', () => {
    assert.match(syncRequestedMessage(undefined, 'Acme'), /queued/i)
    assert.doesNotMatch(syncRequestedMessage('', 'Acme'), /synced|success|complete/i)
    assert.equal(syncRequestedMessage('The server says queued.', 'Acme'), 'The server says queued.')
  })

  it('does not show partial or skipped runs as in progress, and does not show a closed lost sync as a success', () => {
    assert.equal(syncRunDisplay('partial').tone, 'warning')
    assert.equal(syncRunDisplay('partial').label, 'Partial')
    assert.equal(syncRunDisplay('skipped').label, 'Skipped')
    assert.equal(syncRunDisplay('failed').tone, 'danger')
    assert.notEqual(syncRunDisplay('failed').tone, 'success')
    assert.notEqual(syncRunDisplay('queued').tone, 'success')
  })

  it('reports a finished sync once, only when queued or running work really completed', () => {
    const connectors = (status: string) => [{ id: 1, history: [{ status }] }, { id: 2, history: [{ status: 'completed' }] }]
    assert.deepEqual(finishedSyncs(latestStatuses(connectors('queued')), connectors('completed')), [1])
    assert.deepEqual(finishedSyncs(latestStatuses(connectors('running')), connectors('partial')), [1])
    assert.deepEqual(finishedSyncs(latestStatuses(connectors('queued')), connectors('queued')), [])
    assert.deepEqual(finishedSyncs(latestStatuses(connectors('running')), connectors('failed')), [], 'a failed or recovered sync is not a finished import')
    assert.deepEqual(finishedSyncs(latestStatuses(connectors('completed')), connectors('completed')), [], 'already finished before')
    assert.deepEqual(finishedSyncs({}, connectors('completed')), [], 'the first load never counts')
  })
})

describe('connector stage shown on the card', () => {
  const oauth = { oauth: true, providerReady: true }
  const stage = (status: string, history: Array<{ status: string }> = [], options: Parameters<typeof connectorStage>[2] = oauth) => connectorStage({ connection_status: status }, history, options)

  it('shows Setup Required when the platform application is not configured, whatever else is stored', () => {
    assert.equal(stage('connected', [{ status: 'completed' }], { oauth: true, providerReady: false }).label, 'Setup Required')
    assert.equal(stage('not_configured', [], { oauth: true, providerReady: false }).label, 'Setup Required')
  })

  it('is Ready to Connect before authorization, Connecting while the sign-in opens, and never Connected or Synced without authorization', () => {
    assert.equal(stage('not_configured').label, 'Ready to Connect')
    assert.equal(stage('not_configured', [], { ...oauth, connecting: true }).label, 'Connecting')
    for (const status of ['not_configured', 'disconnected', 'token_expired', 'permission_required', 'error']) {
      assert.notEqual(stage(status, [{ status: 'completed' }]).label, 'Connected')
      assert.notEqual(stage(status, [{ status: 'completed' }]).label, 'Synced')
    }
  })

  it('separates choosing an account from a lost permission, and reports an expired token as Reconnect Required', () => {
    assert.equal(stage('permission_required', [], { ...oauth, needsAccount: true }).label, 'Authorization Required')
    assert.equal(stage('permission_required').label, 'Reconnect Required')
    assert.equal(stage('token_expired').label, 'Reconnect Required')
    assert.equal(stage('token_expired').tone, 'danger')
  })

  it('a connected account follows its newest sync, and is only Connected before any sync', () => {
    assert.equal(stage('connected').label, 'Connected')
    assert.equal(stage('connected', [{ status: 'queued' }]).label, 'Sync Queued')
    assert.equal(stage('connected', [{ status: 'running' }, { status: 'completed' }]).label, 'Syncing')
    assert.equal(stage('connected', [{ status: 'completed' }]).label, 'Synced')
    assert.equal(stage('connected', [{ status: 'skipped' }]).label, 'Synced')
    assert.equal(stage('connected', [{ status: 'partial' }]).label, 'Partial')
    assert.equal(stage('connected', [{ status: 'failed' }, { status: 'completed' }]).label, 'Failed', 'the newest sync decides, not an older success')
    assert.equal(stage('connected', [{ status: 'failed' }]).tone, 'danger')
  })

  it('a queued request is never shown as synced', () => {
    assert.notEqual(stage('connected', [{ status: 'queued' }]).tone, 'success')
  })
})

describe('fetched, analysed and signals are three separate numbers', () => {
  it('reports each count on its own and marks a running sync as not final', () => {
    assert.deepEqual(syncStageCounts({ status: 'completed', records_fetched: 25, records_processed: 20, records_created: 3 }), { fetched: 25, analysed: 20, signals: 3, done: true })
    assert.equal(syncStageCounts({ status: 'running', records_fetched: 25, records_processed: 4, records_created: 0 })?.done, false)
    assert.equal(syncStageCounts(null), null)
  })

  it('zero signals from a finished sync stays zero: fetched and analysed are not turned into signals', () => {
    const counts = syncStageCounts({ status: 'completed', records_fetched: 10, records_processed: 10, records_created: 0 })
    assert.deepEqual([counts?.fetched, counts?.analysed, counts?.signals], [10, 10, 0])
  })
})
