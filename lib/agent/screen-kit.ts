import assert from 'node:assert/strict'
import type { ReactElement } from 'react'
import { kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signal-review/router-harness'
import type { AgentApi } from '../../services/agent/api-types'
import { fakeAgentService } from './fake-service'

/**
 * Agent Run History as a whole screen in a fake browser: the real component with its tabs, a stand-in router that keeps the address (so `?tab=` really
 * round-trips), a signed-in session, and the agent API replaced by a fake that records every call. Import from inside the test (it needs the fake DOM), after
 * dom-test-kit.
 */
export const SCREEN_PATH = '/module/crm/marketing/agent-runs'

export interface ScreenOptions {
  /** The address's query string when the screen opens, for example `tab=waiting`. */
  search?: string
  overrides?: Partial<AgentApi>
  /** false: nobody is signed in. */
  session?: boolean
  /** true: the router never applies an address the screen writes (see frozenRouter). */
  frozenAddress?: boolean
  /** How long to let the first reads settle. */
  settle?: number
}

/**
 * A router that remembers every address the screen writes and never applies one: the address stays as it was when the screen opened. A real router applies a
 * replacement a moment later, so for that moment the screen must already show the right thing by itself; this is how a test sees that moment.
 */
async function frozenRouter(initialSearch: string, pathname: string) {
  const React = await import('react')
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime')
  const { PathnameContext, SearchParamsContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime')
  const written: string[] = []
  const router = { replace: (url: string) => { written.push(url) }, push: (url: string) => { written.push(url) }, back: () => undefined, forward: () => undefined, refresh: () => undefined, prefetch: () => undefined }
  const search = new URLSearchParams(initialSearch)
  return {
    wrap: (element: ReactElement) => React.createElement(AppRouterContext.Provider, { value: router as never }, React.createElement(PathnameContext.Provider, { value: pathname }, React.createElement(SearchParamsContext.Provider, { value: search as never }, element))),
    written,
    lastSearch: () => { const url = written[written.length - 1]; return url && url.includes('?') ? url.slice(url.indexOf('?') + 1) : '' },
  }
}

export const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

export async function agentScreen(options: ScreenOptions = {}) {
  const k = await kit()
  const router = options.frozenAddress ? await frozenRouter(options.search ?? '', SCREEN_PATH) : await routerHarness(options.search ?? '', SCREEN_PATH)
  const { AgentRunsView } = await import('../../components/domain/crm/agent-runs-view')
  if (options.session !== false) k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
  else k.w.localStorage.clear()

  const { service, calls } = fakeAgentService(options.overrides)
  await k.render(router.wrap(k.h(AgentRunsView, { service })))
  await k.tick(options.settle ?? 20)

  const button = (label: string, root: ParentNode = k.w.document) => Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined
  const press = async (target: Element | null | undefined) => { assert.ok(target, 'the control exists'); await k.click(target); await k.tick(10) }
  const tabs = () => k.all('[role="tab"]')
  const tab = (name: string) => tabs().find((t) => t.textContent?.trim().startsWith(name)) as HTMLButtonElement | undefined
  const tabNames = () => tabs().map((t) => t.textContent?.trim() ?? '')
  const openTab = async (name: string) => { await press(tab(name)); await k.tick(20) }
  const panel = () => k.one('[role="tabpanel"]:not([hidden])')
  const focused = () => k.w.document.activeElement

  const setValue = async (field: HTMLElement, text: string, kind: 'textarea' | 'select' | 'input') => {
    const proto = kind === 'textarea' ? k.w.HTMLTextAreaElement.prototype : kind === 'select' ? k.w.HTMLSelectElement.prototype : k.w.HTMLInputElement.prototype
    const set = Object.getOwnPropertyDescriptor(proto, 'value')!.set!
    await k.act(async () => { set.call(field, text); field.dispatchEvent(new k.w.Event(kind === 'select' ? 'change' : 'input', { bubbles: true })) })
    await k.tick(5)
  }
  const type = (field: HTMLElement, text: string) => setValue(field, text, 'textarea')
  const choose = (select: HTMLElement, value: string) => setValue(select, value, 'select')

  return { k, router, service, calls, button, press, tabs, tab, tabNames, openTab, panel, focused, type, choose }
}

export type AgentScreen = Awaited<ReturnType<typeof agentScreen>>
