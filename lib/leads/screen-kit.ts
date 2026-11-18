import type { ReactElement } from 'react'
import { kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signal-review/router-harness'
import { h } from '../scaffolds/h'
import type { FactsApi } from '../../services/facts/api-types'
import type { Fact, FactsEntityData } from '../../services/facts/types'

/**
 * A whole Leads screen in a fake browser: the real component, the real sidebar hook (fed a small menu from the browser's own storage, which is where the hook
 * looks first), a stand-in router that keeps the address, a signed-in session, and `fetch` replaced by `respond`. The facts API is handed to the component as a
 * fake service, so a test sees exactly what the Evidence tab asked of it. The method is the facts screens' (lib/facts/screen-kit.ts), duplicated on purpose so
 * the two tracks' files stay apart. Import after dom-test-kit (it needs the fake DOM) and from inside the test.
 */
export interface Call {
  method: string
  path: string
  query: URLSearchParams
  body: unknown
}

export type Responder = (call: Call) => unknown | Promise<unknown>

const PROFILE = 16
const TENANT = 1

/** Sales & Marketing with Leads and Signal Review, at the access links the real menu holds. */
export function menu(withSignalReview = true) {
  return [{
    id: 199, label: 'Sales & Marketing', icon: null, access_link: '/module/crm', page_type: null, sort_order: 1, parent_id: null,
    children: [
      { id: 201, label: 'Leads', icon: null, access_link: '/module/crm/marketing/leads', page_type: 'page', sort_order: 1, parent_id: 199, children: [] },
      ...(withSignalReview ? [{ id: 506, label: 'Signal Review', icon: null, access_link: '/signal-review', page_type: 'page', sort_order: 9, parent_id: 199, children: [] }] : []),
    ],
  }]
}

export async function screenKit(opts: { search?: string; pathname?: string; respond?: Responder; signalReview?: boolean } = {}) {
  const k = await kit()
  const router = await routerHarness(opts.search ?? '', opts.pathname ?? '/module/crm/marketing/leads')
  // `require`, not `import()`: the screens load these through the same loader, and a dynamic import would give this file a second copy of each module.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { AuthContext } = require('../../components/auth/gtg-auth') as typeof import('../../components/auth/gtg-auth')
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query')
  /* eslint-enable @typescript-eslint/no-require-imports */

  k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: TENANT, user_id: 2, user_profile_id: PROFILE }))
  k.w.sessionStorage.setItem(`gtg-sidebar-cache-v3:${TENANT}:${PROFILE}`, JSON.stringify({ status_code: 200, message: 'ok', data: menu(opts.signalReview ?? true) }))
  // next/link reads `self` while it renders; the fake browser does not define it.
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })

  const calls: Call[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: unknown, init?: { method?: string; body?: string }) => {
    const url = new URL(String(input), 'http://test.local')
    const call: Call = { method: init?.method ?? 'GET', path: url.pathname, query: url.searchParams, body: init?.body ? JSON.parse(init.body) : undefined }
    calls.push(call)
    try {
      const answer = opts.respond ? await opts.respond(call) : undefined
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
    mount: async (element: ReactElement, settle = 40) => { await k.render(wrap(element)); await k.tick(settle) },
    /** Calls to one endpoint, by the end of its path. */
    to: (suffix: string) => calls.filter((c) => c.path.endsWith(suffix)),
    restore: () => { globalThis.fetch = original; client.clear() },
  }
}

// ── A fake facts API for the Evidence tab ──────────────────────────────────────────────────────────────────────────────────────────────

export function leadFact(over: Partial<Fact> = {}): Fact {
  return {
    id: 501, entity_type: 'lead', entity_id: 41, field: 'phone', field_label: 'Phone number', value: '+91 98765 43210', value_kind: null, status: 'proposed', band: 'probable',
    score: 0.7, method: 'web_lookup', source_url: 'https://hillcrest.example.edu/contact', proposed_by: 'agent:organisation', decided_by_name: null, decided_at: null,
    evidence: [{ kind: 'site.own-page', label: "the organisation's own website states it", weight: 0.8, source_url: 'https://hillcrest.example.edu/contact', quote: 'Office: +91 98765 43210', retrieved_at: null }],
    rationale: 'One source states it.', column_written: false, record_value: null, decision_note: null, supersedes_id: null, created_at: null, entity_name: 'Asha Menon', ...over,
  }
}

export function entityData(facts: Fact[] = [leadFact()]): FactsEntityData {
  return {
    entity: { type: 'lead', id: 41, name: 'Asha Menon' },
    facts,
    counts: { proposed: facts.filter((f) => f.status === 'proposed').length, applied: facts.filter((f) => f.status === 'applied').length, dismissed: facts.filter((f) => f.status === 'dismissed').length },
    can: { decide: true },
  }
}

export function fakeFacts(overrides: Partial<FactsApi> = {}) {
  const entityCalls: Array<{ type: string; id: number | string }> = []
  const service: FactsApi = {
    entity: async (type, id) => { entityCalls.push({ type, id }); return overrides.entity ? overrides.entity(type, id) : { status: 1, data: entityData() } },
    queue: async (params) => (overrides.queue ? overrides.queue(params) : { status: 1, data: { rows: [], pagination: { page: 1, per_page: 25, total: 0 } } }),
    accept: async (id) => (overrides.accept ? overrides.accept(id) : { status: 1, data: { outcome: 'applied', fact: leadFact({ id: Number(id), status: 'applied', column_written: true }) } }),
    dismiss: async (id, reason) => (overrides.dismiss ? overrides.dismiss(id, reason) : { status: 1, data: { outcome: 'dismissed', fact: leadFact({ id: Number(id), status: 'dismissed' }) } }),
    consent: async (type, id) => (overrides.consent ? overrides.consent(type, id) : { status: 1, data: { channels: {}, sources: [] } }),
  }
  return { service, entityCalls }
}
