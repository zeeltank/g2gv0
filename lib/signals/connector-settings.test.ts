import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import {
  buildSavePayload,
  cardStatus,
  describeTest,
  formFor,
  overallStatus,
  providerCards,
  updatedLabel,
  type ProviderSettings,
  type SettingsTestResult,
} from './connector-settings'

const settings = (over: Partial<ProviderSettings> = {}): ProviderSettings => ({
  provider: 'youtube', label: 'YouTube', connector_types: ['youtube'], configured: false, valid: false, status: 'not_configured', source: 'none',
  client_id: null, secret_saved: false, secret_mask: null, updated_at: null, missing_config: [], invalid_config: [], message: null, redirect_uri: 'https://api.example/cb',
  requirements: [], scopes: [], approval: null, connected_accounts: 0, can_remove: false, ...over,
})
const saved = (over: Partial<ProviderSettings> = {}) => settings({ configured: true, valid: true, status: 'authorization_required', source: 'database', client_id: 'id-1', secret_saved: true, secret_mask: '••••••••••••', ...over })

describe('what a save sends', () => {
  it('needs both values for a first save', () => {
    const r = buildSavePayload({ clientId: '', clientSecret: '' }, settings())
    assert.deepEqual(r.problems, ['Enter the client ID.', 'Enter the client secret.'])
    assert.deepEqual(buildSavePayload({ clientId: 'abc', clientSecret: '' }, settings()).problems, ['Enter the client secret.'])
    assert.deepEqual(buildSavePayload({ clientId: 'abc', clientSecret: 's3cret' }, settings()), { payload: { client_id: 'abc', client_secret: 's3cret' }, problems: [] })
  })

  it('an empty secret keeps the saved one: it is not sent, and an unchanged client id is not sent either', () => {
    const current = saved()
    assert.deepEqual(buildSavePayload({ clientId: 'id-2', clientSecret: '' }, current), { payload: { client_id: 'id-2' }, problems: [] })
    const nothing = buildSavePayload({ clientId: 'id-1', clientSecret: '' }, current)
    assert.deepEqual(nothing.payload, {})
    assert.match(nothing.problems[0], /Nothing to save/)
  })

  it('the mask is never sent as a secret, and a typed secret replaces the saved one', () => {
    const current = saved()
    assert.deepEqual(buildSavePayload({ clientId: 'id-1', clientSecret: '••••••••••••' }, current).payload, {})
    assert.deepEqual(buildSavePayload({ clientId: 'id-1', clientSecret: 'new-secret' }, current), { payload: { client_secret: 'new-secret' }, problems: [] })
  })

  it('credentials that come from the server count as nothing saved here, so an override needs both halves', () => {
    const fromServer = settings({ configured: true, valid: true, status: 'authorization_required', source: 'environment', secret_saved: true, secret_mask: '••••••••••••' })
    assert.deepEqual(buildSavePayload({ clientId: 'abc', clientSecret: '' }, fromServer).problems, ['Enter the client secret.'])
  })

  it('opens an edit form with the saved client id and an always-empty secret field', () => {
    assert.deepEqual(formFor(saved()), { clientId: 'id-1', clientSecret: '' })
    assert.deepEqual(formFor(settings()), { clientId: '', clientSecret: '' })
    assert.deepEqual(formFor(null), { clientId: '', clientSecret: '' })
  })
})

describe('provider cards and statuses', () => {
  it('shows four cards, with Facebook and Instagram served by the one Meta application', () => {
    const cards = providerCards([settings(), settings({ provider: 'linkedin' }), settings({ provider: 'meta' })])
    assert.deepEqual(cards.map((c) => c.key), ['youtube', 'linkedin', 'facebook_page', 'instagram_business'])
    assert.equal(cards[2].settings, cards[3].settings)
    assert.deepEqual(cards.map((c) => c.connectorType), ['youtube', 'linkedin', 'facebook_page', 'instagram_business'])
  })

  it('a provider is green only when an account is connected: configured credentials are Ready to Connect, not Connected', () => {
    assert.deepEqual([cardStatus({ status: 'not_configured', source: 'none' }).label, cardStatus({ status: 'not_configured', source: 'none' }).tone], ['Setup Required', 'warning'])
    assert.equal(cardStatus({ status: 'configuration_invalid', source: 'database' }).label, 'Configuration Invalid')
    const ready = cardStatus({ status: 'authorization_required', source: 'database' })
    assert.deepEqual([ready.label, ready.tone], ['Ready to Connect', 'info'])
    assert.deepEqual([cardStatus({ status: 'connected', source: 'database' }).label, cardStatus({ status: 'connected', source: 'database' }).tone], ['Connected', 'success'])
  })

  it('summarises how many providers are ready and flags a problem', () => {
    const ps = (statuses: ProviderSettings['status'][]) => providerCards(statuses.map((status, i) => settings({ provider: (['youtube', 'linkedin', 'meta'] as const)[i], status })))
    assert.deepEqual(overallStatus([]), { label: 'Loading', tone: 'muted' })
    assert.equal(overallStatus(ps(['not_configured', 'not_configured', 'not_configured'])).label, '0 of 4 ready')
    assert.equal(overallStatus(ps(['authorization_required', 'not_configured', 'authorization_required'])).label, '3 of 4 ready')
    assert.equal(overallStatus(ps(['authorization_required', 'configuration_invalid', 'authorization_required'])).tone, 'danger')
    assert.equal(overallStatus(ps(['connected', 'authorization_required', 'connected'])).label, 'All providers ready')
  })

  it('formats the update time, and never throws on a bad date', () => {
    assert.match(updatedLabel('2026-11-12T10:00:00Z') ?? '', /^Updated \d{1,2} Nov 2026$/)
    assert.equal(updatedLabel(null), null)
    assert.equal(updatedLabel('not a date'), null)
  })
})

describe('Test Configuration result', () => {
  const result = (over: Partial<SettingsTestResult> = {}): SettingsTestResult => ({
    provider: 'youtube', status: 'authorization_required',
    local: { configured: true, valid: true, missing_config: [], invalid_config: [], message: null },
    provider_check: { result: 'accepted', message: 'Google recognised this application.' }, connected_accounts: 0, next_step: 'Connect an account.', ...over,
  })

  it('keeps this app\'s configuration and the provider\'s answer as two separate lines', () => {
    const d = describeTest(result())
    assert.deepEqual([d.configuration.text, d.configuration.tone], ['Configuration is valid.', 'success'])
    assert.deepEqual([d.provider.text, d.provider.tone], ['Google recognised this application.', 'success'])
  })

  it('reports a rejection, an unreachable provider and an empty configuration each in its own words', () => {
    assert.equal(describeTest(result({ provider_check: { result: 'rejected', message: 'Google did not recognise this client.' } })).provider.tone, 'danger')
    assert.equal(describeTest(result({ provider_check: { result: 'unreachable', message: 'Could not be reached.' } })).provider.tone, 'warning')
    const none = describeTest(result({ local: { configured: false, valid: false, missing_config: ['X'], invalid_config: [], message: null }, provider_check: { result: 'not_checked', message: 'Not contacted.' } }))
    assert.deepEqual([none.configuration.text, none.configuration.tone, none.provider.tone], ['Not configured yet.', 'warning', 'muted'])
  })
})
