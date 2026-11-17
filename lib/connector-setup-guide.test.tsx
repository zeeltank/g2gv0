import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { JSDOM } from 'jsdom'

// The Add Connector window as one place: short steps for the chosen platform, the one-time credentials for an administrator, and Create unlocked only when
// the platform's app is set up. Rendered for real in jsdom with a scripted service.
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

const ctx = { organizationId: 1, subInstituteId: 1, userId: 1 } as never
const entry = (ready: boolean) => ({ key: 'linkedin', label: 'LinkedIn', auth: 'oauth' as const, oauth_provider: 'linkedin' as const, requirements: [], ready, redirect_uri: 'https://api.example/cb/linkedin' })

async function render(opts: { ready: boolean; canManage: boolean; type?: string }) {
  const { opportunitiesService } = await import('@/services/signals/opportunities')
  const { ConnectorFormDialog } = await import('@/components/domain/signals/connector-form-dialog')
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const svc = opportunitiesService as unknown as Record<string, unknown>
  const saved: Array<{ provider: string; body: Record<string, string> }> = []
  let refreshed = 0
  const removed: string[] = []
  const savedSettings = { provider: 'linkedin', label: 'LinkedIn', connector_types: ['linkedin'], configured: true, valid: true, status: 'authorization_required', source: 'database', client_id: 'li-id-1', secret_saved: true, secret_mask: '••••••••••••', updated_at: null, missing_config: [], invalid_config: [], message: null, redirect_uri: 'https://api.example/cb/linkedin', requirements: [], scopes: [], approval: null, connected_accounts: 0, can_remove: true }
  svc.getConnectorSettings = async () => ({ status: 1, data: { storage_ready: true, providers: [savedSettings] } })
  svc.testConnectorSettings = async () => ({ status: 1, data: { provider: 'linkedin', status: 'authorization_required', local: { configured: true, valid: true, missing_config: [], invalid_config: [], message: null }, provider_check: { result: 'unverified', message: 'LinkedIn cannot confirm credentials without a sign-in.' }, connected_accounts: 0, next_step: 'Connect an account.' } })
  svc.deleteConnectorSettings = async (_c: unknown, provider: string) => { removed.push(provider); return { status: 1, message: 'ok', data: { ...savedSettings, configured: false, valid: false, source: 'none', can_remove: false, secret_saved: false }, warnings: [] } }
  svc.saveConnectorSettings = async (_c: unknown, provider: string, body: Record<string, string>) => { saved.push({ provider, body }); return { status: 1, message: 'ok', data: { ...savedSettings, client_id: body.client_id ?? savedSettings.client_id }, warnings: [] } }

  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const props = { context: ctx, open: true, mode: 'create' as const, products: [], defaultType: (opts.type ?? 'linkedin') as never, catalog: [entry(opts.ready)] as never, canManageSettings: opts.canManage, onCredentialsSaved: () => { refreshed += 1 }, onClose: () => undefined, onSaved: () => undefined }
  await React.act(async () => { root.render(React.createElement(ConnectorFormDialog, props)) })
  await React.act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve() })
  const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? ''
  const button = (re: RegExp) => Array.from(document.querySelectorAll('button')).find((b) => re.test(b.textContent ?? '')) as HTMLButtonElement | undefined
  const type = async (id: string, value: string) => {
    const el = document.getElementById(id) as HTMLInputElement
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(el, value)
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    })
  }
  const click = async (el: Element) => { await React.act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) }); await React.act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }) }
  return { saved, removed, refreshed: () => refreshed, text, button, type, click, unmount: () => React.act(async () => root.unmount()) }
}

describe('Add Connector: one window with the steps and the credentials', () => {
  it('an administrator sees lettered steps, the callback URL and the two credential fields, and Create is locked until they are saved', async () => {
    const t = await render({ ready: false, canManage: true })
    assert.match(t.text(), /LinkedIn app credentials/)
    assert.match(t.text(), /Community Management API/)
    assert.ok(Array.from(document.querySelectorAll('ol li span')).some((s) => s.textContent === 'A'), 'steps are lettered A, B, C')
    assert.ok((document.getElementById('guide-callback') as HTMLInputElement).value === 'https://api.example/cb/linkedin')
    assert.equal(t.button(/Create & Connect/)!.disabled, true, 'cannot create before the app credentials exist')

    await t.click(t.button(/Save credentials/)!)
    assert.match(t.text(), /Enter both the ID and the secret\./)
    assert.equal(t.saved.length, 0)

    await t.type('guide-client-id', '86abcdefghijkl')
    await t.type('guide-client-secret', 'WPL_AP1.0123456789')
    await t.click(t.button(/Save credentials/)!)
    assert.deepEqual(t.saved, [{ provider: 'linkedin', body: { client_id: '86abcdefghijkl', client_secret: 'WPL_AP1.0123456789' } }])
    assert.equal(t.refreshed(), 1, 'the screen is told to refresh readiness')
    assert.equal(t.button(/Create & Connect/)!.disabled, false, 'Create unlocks once the credentials are saved')
    assert.match(t.text(), /Ready/)
    assert.doesNotMatch(t.text(), /WPL_AP1/, 'the secret is not echoed back')
    await t.unmount()
  })

  it('when the platform is already set up there is nothing to enter, and a non-administrator is told to ask one', async () => {
    const ready = await render({ ready: true, canManage: false })
    assert.match(ready.text(), /already in place/)
    assert.equal(document.getElementById('guide-client-id'), null)
    assert.equal(ready.button(/Create & Connect/)!.disabled, false)
    await ready.unmount()
    document.body.innerHTML = ''

    const other = await render({ ready: false, canManage: false })
    assert.match(other.text(), /administrator must add this platform/)
    assert.equal(document.getElementById('guide-client-id'), null, 'no credential fields for a non-administrator')
    assert.equal(other.button(/Create & Connect/)!.disabled, true)
    await other.unmount()
  })

  it('an administrator can edit, test and remove credentials that are already in place, from the same window', async () => {
    document.body.innerHTML = ''
    const t = await render({ ready: true, canManage: true })
    await t.click(t.button(/Edit, test or remove credentials/)!)
    assert.equal((document.getElementById('manage-id-linkedin') as HTMLInputElement).value, 'li-id-1', 'the saved client ID is shown')
    assert.equal((document.getElementById('manage-secret-linkedin') as HTMLInputElement).value, '', 'the secret field is always empty')
    assert.equal((document.getElementById('manage-secret-linkedin') as HTMLInputElement).type, 'password')

    await t.click(t.button(/Save changes/)!)
    assert.match(t.text(), /Nothing to save/)
    assert.equal(t.saved.length, 0)

    await t.type('manage-id-linkedin', 'li-id-2')
    await t.click(t.button(/Save changes/)!)
    assert.deepEqual(t.saved, [{ provider: 'linkedin', body: { client_id: 'li-id-2' } }], 'an empty secret keeps the saved one: only the changed field is sent')

    await t.click(t.button(/Test Configuration/)!)
    assert.match(t.text(), /Configuration:.*valid/)
    assert.match(t.text(), /cannot confirm credentials without a sign-in/)

    await t.click(t.button(/Remove saved/)!)
    assert.deepEqual(t.removed, [], 'removal asks first')
    await t.click(t.button(/Remove credentials/)!)
    assert.deepEqual(t.removed, ['linkedin'])
    await t.unmount()
  })

  it('a non-administrator gets no credential tools even when the platform is ready', async () => {
    document.body.innerHTML = ''
    const t = await render({ ready: true, canManage: false })
    assert.equal(t.button(/Edit, test or remove credentials/), undefined)
    await t.unmount()
  })

  it('a website needs no credentials and keeps its simple Create button', async () => {
    document.body.innerHTML = ''
    const t = await render({ ready: false, canManage: false, type: 'public_web_page' })
    assert.match(t.text(), /just a web address/)
    assert.equal(document.getElementById('guide-client-id'), null)
    assert.equal(t.button(/Create Connector/)!.disabled, false)
    await t.unmount()
  })
})
