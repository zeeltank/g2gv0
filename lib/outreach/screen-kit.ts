import { screenKit as leadsScreenKit, type Call, type Responder } from '../leads/screen-kit'
import { attempt as attemptRow, claimsAnswer, gateAnswer, message, readiness } from './fixtures'

export type { Call, Responder }

/**
 * A whole GTM Outreach screen in a fake browser. The method, the router stand-in, the signed-in session and the replaced `fetch` are the Leads screen's own
 * (lib/leads/screen-kit.ts, reused and not copied). `server()` answers the endpoints the screen asks of: the list, the readiness panel, a message's send
 * attempts, the outreach checks and the approved claims, each of which a test can replace. Import after dom-test-kit and from inside the test.
 */

export interface Server {
  messages?: unknown[]
  readiness?: unknown
  attempts?: unknown[]
  /** The answer to GET /outreach/gate, or a function of the call. A `{ __status, message }` object is an error response. */
  gate?: unknown | ((call: Call) => unknown)
  claims?: unknown | ((call: Call) => unknown)
  /** The answer to POST /gtm/outreach/{id}/send (only a test of the refusal sets this: the screen's own Send now control, not a new one). */
  send?: unknown | ((call: Call) => unknown)
  /** Every other call. */
  other?: Responder
}

const call = (v: unknown, c: Call) => (typeof v === 'function' ? (v as (c: Call) => unknown)(c) : v)

export function server(s: Server = {}): Responder {
  return (c) => {
    if (c.path.endsWith('/outreach/gate')) return call(s.gate, c) ?? gateAnswer()
    if (c.path.endsWith('/outreach/claims')) return call(s.claims, c) ?? claimsAnswer()
    if (c.path.endsWith('/gtm/outreach/readiness')) return s.readiness ?? { status: 1, data: readiness() }
    if (/\/gtm\/outreach\/\d+\/attempts$/.test(c.path)) return { status: 1, data: { attempts: s.attempts ?? [] } }
    if (/\/gtm\/outreach\/\d+\/send$/.test(c.path)) return call(s.send, c)
    if (c.path.endsWith('/gtm/outreach')) return { status: 1, data: { items: s.messages ?? [message()], counts: { approved: (s.messages ?? [message()]).length } } }
    return s.other ? s.other(c) : undefined
  }
}

export { attemptRow }

export async function screenKit(opts: { respond?: Responder } = {}) {
  return leadsScreenKit({ pathname: '/gtm/outreach', respond: opts.respond })
}

/** The calls to the checks endpoint, so a test can count how often the screen asked. */
export const gateCalls = (calls: Call[]) => calls.filter((c) => c.path.endsWith('/outreach/gate'))
