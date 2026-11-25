import type { ReactElement } from 'react'
import { kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signals/router-harness'
import { h } from '../scaffolds/h'

/**
 * A whole Product Portfolio screen in a fake browser: the real component with the real service client, the real sidebar hook (fed a small menu from the
 * browser's own storage, which is where the hook looks first), a stand-in router that keeps the address, and `fetch` replaced by `respond`. Nothing but the
 * network is faked, so a test of the list runs the wiring the component tests of the pieces cannot reach: the address of every request, its parameters and
 * the bearer header. Import after dom-test-kit (it needs the fake DOM) and from inside the test.
 */
export interface Call {
  method: string
  path: string
  query: URLSearchParams
  body: unknown
  headers: Record<string, string>
}

export type Responder = (call: Call) => unknown | Promise<unknown>

const PROFILE = 16
const TENANT = 1

/** The part of the menu the sidebar tests use: Sales & Marketing with the Products and Services rows, as the database holds them. */
export const MENU_ROWS = {
  products: { id: 468, label: 'Products', icon: null, access_link: '/module/crm/sales/products', page_type: 'page', sort_order: 1, parent_id: 199, children: [] },
  services: { id: 469, label: 'Services', icon: null, access_link: '/module/crm/sales/services', page_type: 'page', sort_order: 2, parent_id: 199, children: [] },
}

export function menuOf(...rows: Array<(typeof MENU_ROWS)[keyof typeof MENU_ROWS]>) {
  return [{ id: 199, label: 'Sales & Marketing', icon: null, access_link: '/module/crm', page_type: null, sort_order: 1, parent_id: null, children: rows }]
}

export async function screenKit(opts: { search?: string; pathname?: string; respond: Responder; menu?: ReturnType<typeof menuOf> }) {
  const k = await kit()
  const router = await routerHarness(opts.search ?? '', opts.pathname ?? '/portfolio')
  // `require`, not `import()`: the screens load these through the same loader, and a dynamic import would give this file a second copy of each module
  // (a second React Query context, a second AuthContext) that the screen's own copy never sees.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { AuthContext } = require('../../components/auth/gtg-auth') as typeof import('../../components/auth/gtg-auth')
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query')
  /* eslint-enable @typescript-eslint/no-require-imports */

  k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: TENANT, user_id: 2, user_profile_id: PROFILE }))
  k.w.sessionStorage.setItem(`gtg-sidebar-cache-v3:${TENANT}:${PROFILE}`, JSON.stringify({ status_code: 200, message: 'ok', data: opts.menu ?? menuOf(MENU_ROWS.products, MENU_ROWS.services) }))
  // next/link reads `self` while it renders; the fake browser does not define it.
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })

  const calls: Call[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: unknown, init?: { method?: string; body?: string; headers?: Record<string, string> }) => {
    const url = new URL(String(input), 'http://test.local')
    const call: Call = { method: init?.method ?? 'GET', path: url.pathname, query: url.searchParams, body: init?.body ? JSON.parse(init.body) : undefined, headers: init?.headers ?? {} }
    calls.push(call)
    try {
      const answer = await opts.respond(call)
      const body = answer === undefined ? { status: 1, message: 'ok', data: [] } : answer
      const status = (body as { __status?: number }).__status ?? 200
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    } catch (cause) {
      return new Response(JSON.stringify({ status: 0, message: cause instanceof Error ? cause.message : 'failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
  }) as typeof fetch

  // gcTime 0: React Query otherwise keeps a five-minute timer per cached query, and a test process does not end while a timer is pending.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrap = (element: ReactElement) => router.wrap(h(QueryClientProvider, { client }, h(AuthContext.Provider, { value: { user: null } as never }, element)))

  return {
    k,
    router,
    calls,
    wrap,
    mount: async (element: ReactElement, settle = 60) => { await k.render(wrap(element)); await k.tick(settle) },
    /** Calls to one endpoint, by the end of its path. */
    to: (suffix: string) => calls.filter((c) => c.path.endsWith(suffix)),
    restore: () => { globalThis.fetch = original; client.clear() },
  }
}
