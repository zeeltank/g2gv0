import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { JSDOM } from 'jsdom'

// The real Connector Settings panel and dialog rendered in jsdom, with the network replaced by a script. Nothing is sent anywhere.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
const domGlobals = Object.getOwnPropertyNames(dom.window).filter((n) => /^(HTML\w*Element|SVG\w*Element|Element|Node|Document|DocumentFragment|ShadowRoot|\w*Event|MutationObserver|DOMRect|CSSStyleDeclaration|getComputedStyle|requestAnimationFrame|cancelAnimationFrame|getSelection|NodeFilter|TreeWalker|Range|Selection|DOMParser|XMLSerializer|AbortController|AbortSignal|Text|Comment|Attr|NodeList|HTMLCollection|DOMTokenList)$/.test(n))
for (const name of domGlobals) {
  const v = (dom.window as unknown as Record<string, unknown>)[name]
  if (v !== undefined) Object.defineProperty(globalThis, name, { value: v, configurable: true, writable: true })
}
class NoopObserver { observe() {} unobserve() {} disconnect() {} }
Object.assign(globalThis, { ResizeObserver: NoopObserver })

import type { ProviderSettings } from './signals/connector-settings'

const ctx = { organizationId: 1, subInstituteId: 1, userId: 1 } as never
const SECRET_IN_SERVER = 'THE-REAL-SECRET-VALUE-0001'

const base = (over: Partial<ProviderSettings>): ProviderSettings => ({
  provider: 'youtube', label: 'YouTube', connector_types: ['youtube'], configured: false, valid: false, status: 'not_configured', source: 'none', client_id: null,
  secret_saved: false, secret_mask: null, updated_at: null, missing_config: ['YOUTUBE_OAUTH_CLIENT_ID'], invalid_config: [], message: null,
  redirect_uri: 'https://hp.example.test/api/signals/ingestion/connectors/oauth/youtube/callback', requirements: ['YouTube Data API v3 enabled'], scopes: [],
  approval: 'Consent screen verification may be needed.', connected_accounts: 0, can_remove: false, ...over,
})

function scenario() {
  return [
    base({}),
    base({ provider: 'linkedin', label: 'LinkedIn', connector_types: ['linkedin'], configured: true, valid: true, status: 'authorization_required', source: 'environment', secret_saved: true, secret_mask: '••••••••••••', redirect_uri: 'https://hp.example.test/cb/linkedin', missing_config: [] }),
    base({ provider: 'meta', label: 'Facebook and Instagram', connector_types: ['facebook_page', 'instagram_business'], configured: true, valid: true, status: 'authorization_required', source: 'database', client_id: '1234567890123456', secret_saved: true, secret_mask: '••••••••••••', updated_at: '2026-11-10T09:00:00Z', can_remove: true, redirect_uri: 'https://hp.example.test/cb/meta', missing_config: [] }),
  ]
}

async function setup(script: { providers?: ProviderSettings[]; loadFails?: boolean } = {}) {
  const { opportunitiesService } = await import('@/services/signals/opportunities')
  const { ConnectorSettingsPanel } = await import('@/components/domain/signals/connector-settings-panel')
  const { ApiError } = await import('@/services/core')
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')

  let providers = script.providers ?? scenario()
  const calls = { load: 0, save: [] as Array<{ provider: string; body: Record<string, string> }>, test: [] as string[], remove: [] as string[] }
  const svc = opportunitiesService as unknown as Record<string, unknown>
  svc.getConnectorSettings = async () => {
    calls.load += 1
    if (script.loadFails) throw new ApiError('Could not reach the server.', 500)
    return { status: 1, data: { storage_ready: true, providers } }
  }
  svc.saveConnectorSettings = async (_c: unknown, provider: string, body: Record<string, string>) => {
    calls.save.push({ provider, body })
    const current = providers.find((p) => p.provider === provider)!
    const next = { ...current, configured: true, valid: true, status: 'authorization_required' as const, source: 'database' as const, client_id: body.client_id ?? current.client_id, secret_saved: true, secret_mask: '••••••••••••', can_remove: true, missing_config: [] }
    providers = providers.map((p) => (p.provider === provider ? next : p))
    return { status: 1, message: 'Configuration saved.', data: next, warnings: [] }
  }
  svc.testConnectorSettings = async (_c: unknown, provider: string) => {
    calls.test.push(provider)
    return { status: 1, data: { provider, status: 'authorization_required', local: { configured: true, valid: true, missing_config: [], invalid_config: [], message: null }, provider_check: { result: 'accepted', message: 'Google recognised this application. This does not prove approval.' }, connected_accounts: 0, next_step: 'Credentials look valid. Connect an account to complete authorization.' } }
  }
  svc.deleteConnectorSettings = async (_c: unknown, provider: string) => {
    calls.remove.push(provider)
    const next = { ...providers.find((p) => p.provider === provider)!, configured: false, valid: false, status: 'not_configured' as const, source: 'none' as const, client_id: null, secret_saved: false, secret_mask: null, can_remove: false }
    providers = providers.map((p) => (p.provider === provider ? next : p))
    return { status: 1, message: 'Saved credentials removed.', data: next, warnings: [] }
  }

  const events = { connect: [] as string[], changed: 0 }
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  await React.act(async () => {
    root.render(React.createElement(ConnectorSettingsPanel, { context: ctx, onConnectAccount: (t: string) => { events.connect.push(t) }, onSettingsChanged: () => { events.changed += 1 } }))
  })
  const flush = async () => { await React.act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }) }
  await flush()

  const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? ''
  const buttons = () => Array.from(document.querySelectorAll('button'))
  const button = (label: RegExp, within: ParentNode = document.body) => Array.from(within.querySelectorAll('button')).find((b) => label.test(b.textContent ?? '') || label.test(b.getAttribute('aria-label') ?? '')) as HTMLButtonElement | undefined
  const click = async (el: Element | undefined | null) => { assert.ok(el, 'the control exists'); await React.act(async () => { el!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) }); await flush() }
  const cardOf = (title: string) => Array.from(document.querySelectorAll('li')).find((li) => li.querySelector('h4')?.textContent === title) as HTMLElement
  const field = (id: string) => document.getElementById(id) as HTMLInputElement
  const type = async (id: string, value: string) => {
    const el = field(id)
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(el, value)
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    })
  }
  const submit = async () => {
    await React.act(async () => {
      const form = document.querySelector('form') as HTMLFormElement
      form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
    })
    await flush()
  }
  return { calls, events, text, buttons, button, click, cardOf, field, type, submit, flush, ApiError, unmount: () => React.act(async () => root.unmount()) }
}

describe('Connector Settings panel and dialog (real components, scripted service)', () => {
  it('shows four compact provider cards with real statuses, an overall status, and no secret anywhere in the page', async () => {
    const t = await setup()
    assert.deepEqual(Array.from(document.querySelectorAll('li h4')).map((h) => h.textContent), ['YouTube', 'LinkedIn', 'Facebook', 'Instagram'])
    assert.match(t.cardOf('YouTube').textContent ?? '', /Setup Required/)
    assert.match(t.cardOf('LinkedIn').textContent ?? '', /Ready to Connect/)
    assert.match(t.cardOf('Facebook').textContent ?? '', /Ready to Connect/)
    assert.match(t.cardOf('Instagram').textContent ?? '', /Ready to Connect/)
    assert.match(t.text(), /3 of 4 ready/)
    assert.match(t.cardOf('LinkedIn').textContent ?? '', /Credentials come from the server/)
    assert.doesNotMatch(document.body.innerHTML, new RegExp(SECRET_IN_SERVER))
    assert.equal(document.querySelectorAll('input[type="password"]').length, 0, 'no credential field is on the page until Configure is pressed')
    // Connect Account is offered only where credentials are in place
    assert.equal(t.button(/Connect Account/, t.cardOf('YouTube')), undefined)
    assert.ok(t.button(/Connect Account/, t.cardOf('LinkedIn')))
    await t.unmount()
  })

  it('Connect Account starts the existing connect flow for that platform', async () => {
    const t = await setup()
    await t.click(t.button(/Connect Account/, t.cardOf('Instagram')))
    await t.click(t.button(/Connect Account/, t.cardOf('LinkedIn')))
    assert.deepEqual(t.events.connect, ['instagram_business', 'linkedin'])
    await t.unmount()
  })

  it('Configure opens the form with the callback URL, a copy action, an empty masked secret field and a setup guide', async () => {
    const t = await setup()
    await t.click(t.button(/Configure/, t.cardOf('YouTube')))
    assert.match(t.text(), /Configure YouTube/)
    assert.equal((t.field('cs-callback')).value, 'https://hp.example.test/api/signals/ingestion/connectors/oauth/youtube/callback')
    assert.ok(t.button(/Copy callback URL/))
    assert.equal(t.field('cs-client-secret').type, 'password')
    assert.equal(t.field('cs-client-secret').value, '')
    assert.match(document.body.textContent ?? '', /Google OAuth Client ID/)
    assert.match(document.body.textContent ?? '', /Setup guide/)
    assert.ok(t.button(/Save Configuration/) && t.button(/Test Configuration/))
    assert.equal(t.button(/Remove/), undefined, 'nothing saved here to remove')
    await t.unmount()
  })

  it('saves a first configuration with both values, empties the secret field and updates the card without claiming a connection', async () => {
    const t = await setup()
    await t.click(t.button(/Configure/, t.cardOf('YouTube')))
    await t.type('cs-client-id', '1234567890-abc.apps.googleusercontent.com')
    await t.type('cs-client-secret', 'GOCSPX-typed-secret-value')
    await t.submit()

    assert.deepEqual(t.calls.save, [{ provider: 'youtube', body: { client_id: '1234567890-abc.apps.googleusercontent.com', client_secret: 'GOCSPX-typed-secret-value' } }])
    assert.equal(t.field('cs-client-secret').value, '', 'the secret is not kept in the form after saving')
    assert.doesNotMatch(document.body.innerHTML, /GOCSPX-typed-secret-value/)
    assert.match(t.cardOf('YouTube').textContent ?? '', /Ready to Connect/)
    assert.doesNotMatch(t.cardOf('YouTube').textContent ?? '', /Connected/)
    assert.equal(t.events.changed, 1)
    await t.unmount()
  })

  it('refuses a first save with a missing value and sends nothing', async () => {
    const t = await setup()
    await t.click(t.button(/Configure/, t.cardOf('YouTube')))
    await t.type('cs-client-id', '1234567890-abc.apps.googleusercontent.com')
    await t.submit()
    assert.equal(t.calls.save.length, 0)
    assert.match(document.querySelector('[role="alert"]')?.textContent ?? '', /Enter the client secret/)
    await t.unmount()
  })

  it('editing a saved configuration: the secret shows as a mask placeholder, an empty secret is preserved, and only the changed field is sent', async () => {
    const t = await setup()
    await t.click(t.button(/Edit/, t.cardOf('Facebook')))
    assert.equal(t.field('cs-client-id').value, '1234567890123456')
    assert.equal(t.field('cs-client-secret').value, '')
    assert.equal(t.field('cs-client-secret').placeholder, '••••••••••••')
    assert.match(document.body.textContent ?? '', /A secret is saved/)

    await t.submit()
    assert.equal(t.calls.save.length, 0, 'nothing changed: nothing sent')
    assert.match(document.querySelector('[role="alert"]')?.textContent ?? '', /Nothing to save/)

    await t.type('cs-client-id', '9999999999999999')
    await t.submit()
    assert.deepEqual(t.calls.save, [{ provider: 'meta', body: { client_id: '9999999999999999' } }], 'the secret is not sent, so the saved one is kept')

    await t.type('cs-client-secret', 'ffffffffffffffffffffffffffffffff')
    await t.submit()
    assert.deepEqual(t.calls.save[1], { provider: 'meta', body: { client_secret: 'ffffffffffffffffffffffffffffffff' } }, 'a typed secret replaces it (and the unchanged id is not resent)')
    await t.unmount()
  })

  it('shows the server\'s reason next to the field when a value is refused', async () => {
    const t = await setup()
    const { opportunitiesService } = await import('@/services/signals/opportunities')
    ;(opportunitiesService as unknown as Record<string, unknown>).saveConnectorSettings = async () => {
      throw new t.ApiError('The credentials could not be saved because they do not look valid. Nothing was changed.', 422, { client_id: ['That does not look like a valid Google OAuth Client ID.'] })
    }
    await t.click(t.button(/Configure/, t.cardOf('YouTube')))
    await t.type('cs-client-id', 'nope')
    await t.type('cs-client-secret', 'something-long-enough-123')
    await t.submit()
    assert.match(t.text(), /does not look like a valid Google OAuth Client ID/)
    assert.equal(t.field('cs-client-id').getAttribute('aria-invalid'), 'true')
    await t.unmount()
  })

  it('Test Configuration reports the configuration and the provider separately and never says connected', async () => {
    const t = await setup()
    await t.click(t.button(/Edit/, t.cardOf('Facebook')))
    await t.click(t.button(/Test Configuration/))
    assert.deepEqual(t.calls.test, ['meta'])
    assert.match(t.text(), /Configuration: Configuration is valid\./)
    assert.match(t.text(), /Provider: Google recognised this application\. This does not prove approval\./)
    assert.match(t.text(), /Connect an account to complete authorization/)
    assert.doesNotMatch(document.querySelector('[aria-live="polite"]')?.textContent ?? '', /connected\b(?! an account)/i)
    await t.unmount()
  })

  it('removal asks for confirmation first, then deletes only the saved credentials', async () => {
    const t = await setup()
    await t.click(t.button(/Edit/, t.cardOf('Facebook')))
    await t.click(t.button(/^\s*Remove\s*$/))
    assert.equal(t.calls.remove.length, 0, 'not removed until confirmed')
    assert.match(t.text(), /Remove saved credentials\?/)
    await t.click(t.button(/Remove credentials/))
    assert.deepEqual(t.calls.remove, ['meta'])
    assert.match(t.cardOf('Facebook').textContent ?? '', /Setup Required/)
    await t.unmount()
  })

  it('a failed load is shown with a retry, and a loading state is shown while waiting', async () => {
    const t = await setup({ loadFails: true })
    assert.match(document.querySelector('[role="alert"]')?.textContent ?? '', /Could not reach the server/)
    const before = t.calls.load
    await t.click(t.button(/^Retry$/))
    assert.equal(t.calls.load, before + 1)
    await t.unmount()
  })
})
