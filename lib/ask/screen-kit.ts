import assert from 'node:assert/strict'
import { kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signal-review/router-harness'
import type { AskApi } from '../../services/agent/ask-types'
import type { ChatEngine } from './engine'
import { fakeAskService } from './fake-service'
import type { LegacyChat } from './session'

/**
 * The whole chat in a fake browser: the real widget, a stand-in router that knows which page we are on, a signed-in session, and the Ask API replaced by a fake
 * that records every call. Import after dom-test-kit (it needs the fake DOM) and from inside the test.
 */
export interface Setup {
  pathname?: string
  overrides?: Partial<AskApi>
  /** Left out, the widget uses the constant (lib/ask/engine.ts), as the shell mounts it. */
  engine?: ChatEngine
  legacy?: LegacyChat
  /** true: do not hand in a fake for the old endpoint; the widget's own adapter runs (the test replaces fetch). */
  realLegacy?: boolean
  /** false: nobody is signed in. */
  session?: boolean
  /** Open the panel before returning. Default true. */
  open?: boolean
}

export async function setup(options: Setup = {}) {
  const k = await kit()
  const router = await routerHarness('', options.pathname ?? '/module/crm/marketing/leads')
  const { CrmChatWidget } = await import('../../components/domain/crm/crm-chat-widget')
  if (options.session === false) k.w.localStorage.clear()
  else k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))

  const { service, calls } = fakeAskService(options.overrides)
  const legacyCalls: Array<{ question: string; history: Array<{ role: string; content: string }> }> = []
  const legacy: LegacyChat = options.legacy ?? (async (question, history) => { legacyCalls.push({ question, history }); return 'An old-style reply.' })
  await k.render(router.wrap(k.h(CrmChatWidget, { service, ...(options.realLegacy ? {} : { legacy }), ...(options.engine ? { engine: options.engine } : {}) })))
  await k.tick(10)

  const launcher = () => k.one('button[aria-label="Open CRM AI chat"]') as HTMLButtonElement | null
  const panel = () => k.one('[role="dialog"]')
  const box = () => k.one('textarea') as HTMLTextAreaElement | null
  const button = (label: string) => k.all('button').find((b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label || b.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined
  const press = async (target: Element | null | undefined) => { assert.ok(target, 'the control exists'); await k.click(target); await k.tick(10) }
  const type = async (text: string) => {
    const field = box()
    assert.ok(field, 'the box exists')
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLTextAreaElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(field, text); field.dispatchEvent(new k.w.Event('input', { bubbles: true })) })
    await k.tick(2)
  }
  /** Presses a key in the box, with the modifiers given; answers whether the page's default was left alone (false = something called preventDefault). */
  const key = async (name: string, init: { shiftKey?: boolean; isComposing?: boolean } = {}, target?: Element) => {
    let delivered = true
    await k.act(async () => { delivered = (target ?? box() ?? k.w.document.body).dispatchEvent(new k.w.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init })) })
    await k.tick(10)
    return delivered
  }
  const ask = async (text: string) => { await type(text); await key('Enter') }
  const open = async () => { await press(launcher()); }
  const focused = () => k.w.document.activeElement
  const log = () => k.one('[role="log"]')
  const bubbles = (role: 'user' | 'assistant') => k.all(`[data-role="${role}"]`)

  if (options.open !== false && options.session !== false) await open()
  return { k, router, service, calls, legacyCalls, launcher, panel, box, button, press, type, key, ask, open, focused, log, bubbles }
}

export type Chat = Awaited<ReturnType<typeof setup>>
