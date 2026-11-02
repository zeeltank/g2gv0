import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { JSDOM } from 'jsdom'

// The real dialog rendered in jsdom, with the network call replaced by a script (nothing is sent anywhere).
const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
// The dialog library builds events and measures elements with the global constructors, so jsdom's versions must be the global ones.
const domGlobals = Object.getOwnPropertyNames(dom.window).filter((n) => /^(HTML\w*Element|SVG\w*Element|Element|Node|Document|DocumentFragment|ShadowRoot|\w*Event|MutationObserver|DOMRect|CSSStyleDeclaration|getComputedStyle|requestAnimationFrame|cancelAnimationFrame|getSelection|NodeFilter|TreeWalker|Range|Selection|DOMParser|XMLSerializer|AbortController|AbortSignal|Text|Comment|Attr|NodeList|HTMLCollection|DOMTokenList)$/.test(n))
for (const name of domGlobals) {
  const v = (dom.window as unknown as Record<string, unknown>)[name]
  if (v !== undefined) Object.defineProperty(globalThis, name, { value: v, configurable: true, writable: true })
}
class NoopObserver { observe() {} unobserve() {} disconnect() {} }
Object.assign(globalThis, { ResizeObserver: NoopObserver })

const ctx = { organizationId: 1, subInstituteId: 1, userId: 1 } as never

async function setup(createManual: (c: unknown, body: Record<string, unknown>) => Promise<unknown>) {
  const { opportunitiesService } = await import('@/services/signals/opportunities')
  const { ManualOpportunityDialog } = await import('@/components/domain/signals/manual-opportunity-dialog')
  const { ApiError } = await import('@/services/core')
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  ;(opportunitiesService as unknown as Record<string, unknown>).createManual = createManual

  const events = { saved: [] as unknown[], closed: 0 }
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  await React.act(async () => {
    root.render(React.createElement(ManualOpportunityDialog, {
      context: ctx, open: true, onClose: () => { events.closed += 1 }, onSaved: (r: unknown) => { events.saved.push(r) },
      productKey: 'enterprise_brain', productLabel: 'Enterprise Brain', offerId: 'EB-01', offerLabel: 'Plant Brain', customerModel: 'b2g', today: '2026-11-02',
    }))
  })
  const field = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement
  const type = (id: string, value: string) => React.act(async () => {
    const el = field(id)
    const proto = el instanceof dom.window.HTMLTextAreaElement ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
  const submit = () => React.act(async () => {
    const form = document.querySelector('form') as HTMLFormElement
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
    await Promise.resolve(); await Promise.resolve()
  })
  const fillValid = async () => {
    await type('mo-company', 'Acme Plastics Pvt Ltd')
    await type('mo-summary', 'Acme says on LinkedIn it is opening a second plant and hiring a plant IT head.')
    await type('mo-url', 'https://www.linkedin.com/posts/acme-1')
  }

  return { events, field, type, submit, fillValid, ApiError, text: () => document.body.textContent ?? '', unmount: () => React.act(async () => root.unmount()) }
}

describe('Add Opportunity Manually: the real dialog', () => {
  it('says what it is saved for and when it is listed', async () => {
    const t = await setup(async () => ({}))
    assert.match(t.text(), /Add Opportunity Manually/)
    assert.match(t.text(), /Saved for Enterprise Brain · Plant Brain · B2G/)
    assert.match(t.text(), /listed under today.s date/)
    await t.unmount()
  })

  it('refuses an incomplete form with a message per field, sends nothing and stays open', async () => {
    let sent = 0
    const t = await setup(async () => { sent += 1; return {} })
    await t.submit()

    assert.equal(sent, 0, 'nothing is sent')
    assert.match(t.text(), /Enter the company name\./)
    assert.match(t.text(), /Add the link to the post or page it came from\./)
    assert.equal(t.events.saved.length, 0)
    assert.equal(t.events.closed, 0)
    await t.unmount()
  })

  it('refuses a post date in the future, and a valid older post date is sent only as the source date', async () => {
    const bodies: Array<Record<string, unknown>> = []
    const t = await setup(async (_c, body) => { bodies.push(body); return { status: 1, message: 'Opportunity saved.', data: { id: 9, outcome: 'accepted', created_at: null, captured_on: '2026-11-02', source_published_at: '2026-09-01' } } })
    await t.fillValid()
    await t.type('mo-published', '2026-11-03')
    await t.submit()
    assert.match(t.text(), /cannot have been published in the future/)
    assert.equal(bodies.length, 0)

    await t.type('mo-published', '2026-09-01')
    await t.submit()
    assert.equal(bodies.length, 1)
    assert.equal(bodies[0].source_published_at, '2026-09-01')
    for (const k of ['created_at', 'first_discovered_at', 'observed_at', 'event_date', 'report_date', 'captured_on']) assert.equal(k in bodies[0], false, `${k} is never sent`)
    assert.deepEqual([bodies[0].product, bodies[0].offer_id, bodies[0].customer_model], ['enterprise_brain', 'EB-01', 'b2g'])
    await t.unmount()
  })

  it('a successful save is reported to the screen with what the server answered, and the form is emptied', async () => {
    const answer = { status: 1, message: 'Opportunity saved.', data: { id: 9, outcome: 'accepted', created_at: '2026-11-02T10:00:00+00:00', captured_on: '2026-11-02', source_published_at: null } }
    const t = await setup(async () => answer)
    await t.fillValid()
    await t.submit()

    assert.deepEqual(t.events.saved, [answer], 'the screen is told, and decides what to show (the saved day comes from the server)')
    assert.equal(t.field('mo-company').value, '', 'the form is empty for next time')
    await t.unmount()
  })

  it('a refusal from the server (for example a duplicate) is shown in the dialog and nothing typed is lost', async () => {
    const { ApiError } = await import('@/services/core')
    const t = await setup(async () => { throw new ApiError('This opportunity is already saved.', 409) })
    await t.fillValid()
    await t.submit()

    assert.match(t.text(), /This opportunity is already saved\./)
    assert.equal(t.events.saved.length, 0)
    assert.equal(t.field('mo-company').value, 'Acme Plastics Pvt Ltd', 'what was typed is still there')
    await t.unmount()
  })
  it('names the platform of the link under the field, for any site, and not for something that is not a link', async () => {
    const t = await setup(async () => ({}))
    await t.type('mo-url', 'https://www.facebook.com/AcmePlastics/posts/pfbid02abc')
    assert.match(t.text(), /Source: Facebook/)
    await t.type('mo-url', 'https://youtu.be/dQw4w9WgXcQ')
    assert.match(t.text(), /Source: YouTube/)
    await t.type('mo-url', 'https://www.acmeplastics.co.in/news/plant')
    assert.match(t.text(), /Source: acmeplastics\.co\.in/, 'an unknown site is named by its own address')
    await t.type('mo-url', 'javascript:alert(1)')
    assert.doesNotMatch(t.text(), /Source: /, 'nothing is said about something that is not a link')
    await t.unmount()
  })

  it('refuses an unsafe link with a clear reason, sends nothing and opens nothing', async () => {
    let sent = 0
    let fetched = 0
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () => { fetched += 1; throw new Error('no network in this test') }) as typeof fetch
    try {
      const t = await setup(async () => { sent += 1; return {} })
      await t.fillValid()
      for (const bad of ['javascript:alert(document.cookie)', 'data:text/html;base64,PHNjcmlwdD4=', 'file:///etc/passwd', 'ftp://example.com/a', 'linkedin.com/posts/x', 'http://localhost/x']) {
        await t.type('mo-url', bad)
        await t.submit()
        assert.ok(/http:\/\/ and https:\/\/|full web link|numeric IP|real website name/.test(t.text()), `a reason is shown for ${bad}`)
      }
      assert.equal(sent, 0, 'nothing was sent for any of them')
      assert.equal(fetched, 0, 'the link was never opened or fetched')
      assert.equal(t.events.saved.length, 0)
      assert.equal(t.field('mo-company').value, 'Acme Plastics Pvt Ltd', 'what was typed is kept')
      await t.unmount()
    } finally {
      globalThis.fetch = realFetch
    }
  })
})
