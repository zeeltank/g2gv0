import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { JSDOM } from 'jsdom'

// The real Data Connectors screen rendered in jsdom with a scripted service: who gets the Connector Settings entry point, and what everyone else sees.
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

const available = [
  { key: 'public_web_page', label: 'Public website or article', auth: 'public_url', requirements: [], ready: true },
  { key: 'youtube', label: 'YouTube', auth: 'oauth', requirements: [], ready: false, missing_config: ['YOUTUBE_OAUTH_CLIENT_ID'], redirect_uri: 'https://x/cb' },
]

async function render(canManage: boolean) {
  const { opportunitiesService } = await import('@/services/signals/opportunities')
  const { DataConnectorsPanel } = await import('@/components/domain/signals/data-connectors-panel')
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const svc = opportunitiesService as unknown as Record<string, unknown>
  const calls = { settings: 0 }
  svc.listConnectors = async () => ({ status: 1, tables_migrated: true, global_schedule_enabled: true, can_manage_settings: canManage, available, data: [] })
  svc.getConnectorSettings = async () => { calls.settings += 1; return { status: 1, data: { storage_ready: true, providers: [] } } }

  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  await React.act(async () => { root.render(React.createElement(DataConnectorsPanel, { context: ctx, productKey: null, products: [] })) })
  await React.act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve() })
  const click = async (el: Element) => { await React.act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) }); await React.act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }) }
  const button = (re: RegExp) => Array.from(document.querySelectorAll('button')).find((b) => re.test(b.textContent ?? '')) as HTMLButtonElement | undefined

  return { calls, button, click, text: () => document.body.textContent?.replace(/\s+/g, ' ') ?? '', unmount: () => React.act(async () => root.unmount()) }
}

describe('Connector Settings access on the Data Connectors screen', () => {
  it('there is ONE button, Add Connector: no separate Connector Settings button, and an administrator is pointed into Add Connector for setup', async () => {
    const t = await render(true)
    assert.equal(t.button(/^\s*Connector Settings\s*$/), undefined, 'the second button is gone')
    assert.ok(t.button(/Add Connector/) && t.button(/Refresh/), 'existing actions are untouched')
    assert.match(t.text(), /YouTube needs provider credentials before accounts can be connected\./)
    assert.doesNotMatch(t.text(), /YOUTUBE_OAUTH_CLIENT_ID/, 'no server variable names on the main screen')
    assert.equal(t.calls.settings, 0, 'the settings are not loaded until an administrator asks')

    await t.click(t.button(/Set up in Add Connector/)!)
    assert.match(t.text(), /Google \(YouTube\) app credentials/, 'Add Connector opens on the platform that needs setup, with its credentials')
    assert.ok(document.getElementById('guide-client-id'))
    await t.unmount()
  })

  it('anyone else gets no settings entry point and is told, without technical detail, that an administrator must finish setup', async () => {
    const t = await render(false)
    assert.equal(t.button(/Set up in Add Connector/), undefined)
    assert.match(t.text(), /YouTube is not set up yet\. An administrator needs to finish the one-time setup\./)
    assert.doesNotMatch(t.text(), /YOUTUBE_OAUTH_CLIENT_ID|Redirect URI/)
    assert.equal(t.calls.settings, 0, 'the settings route is never even requested')
    assert.ok(t.button(/Add Connector/), 'their existing actions are untouched')
    await t.unmount()
  })
})
