/**
 * The signed link that lets a person who is not signed in open ONE client presentation (app/present/[product]).
 *
 * A link is `v1.<payload>.<signature>`. The payload names the deck, an expiry and a link id; the signature is an HMAC-SHA256 over
 * `v1.<payload>` with a secret that exists only in the server's environment. So a link cannot be forged, widened to another deck,
 * or given a later expiry without the secret, and a link is not a session: opening it sets no cookie and signs nobody in.
 *
 * Server only (node:crypto). Everything fails closed: no secret, a short secret, a malformed, expired, revoked or wrong-deck link
 * all give the same "no". Make links with scripts/client-presentation/make-share-link.mjs; docs/client-presentation/13-public-share-link.md.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

const VERSION = 'v1'
/** HMAC-SHA256 wants a key at least as long as its output; also stops "secret" or "test" from ever being accepted. */
export const MIN_SECRET_LENGTH = 32
/** A real link is about 130 characters. Anything much longer is not one, and is not worth hashing. */
const MAX_TOKEN_LENGTH = 512
const ID_PATTERN = /^[a-f0-9]{8,32}$/
const DECK_PATTERN = /^[a-z0-9-]{1,40}$/

export interface SharePayload {
  /** Deck key, the same as the last part of the page address. A link for one deck never opens another. */
  d: string
  /** Expiry, seconds since 1970. */
  e: number
  /** Link id: what you put in CLIENT_PRESENTATION_REVOKED_IDS to switch this one link off. */
  i: string
}

export type ShareVerdict =
  | { ok: true; id: string; expires: number }
  | { ok: false; reason: 'no-secret' | 'format' | 'signature' | 'payload' | 'deck' | 'expired' | 'revoked' }

const encode = (value: Buffer): string => value.toString('base64url')
/** Decodes only canonical base64url: Node would otherwise skip stray characters, giving one link many spellings. */
function decode(part: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) return null
  const bytes = Buffer.from(part, 'base64url')
  return encode(bytes) === part ? bytes : null
}
const mac = (body: string, secret: string): Buffer => createHmac('sha256', secret).update(body).digest()

export function signShareToken(payload: SharePayload, secret: string): string {
  if (secret.length < MIN_SECRET_LENGTH) throw new Error(`share secret must be at least ${MIN_SECRET_LENGTH} characters`)
  if (!DECK_PATTERN.test(payload.d) || !Number.isInteger(payload.e) || !ID_PATTERN.test(payload.i)) throw new Error('share payload is not valid')
  const body = `${VERSION}.${encode(Buffer.from(JSON.stringify({ d: payload.d, e: payload.e, i: payload.i }), 'utf8'))}`
  return `${body}.${encode(mac(body, secret))}`
}

export function verifyShareToken(
  token: unknown,
  deck: string,
  secret: string | undefined,
  options: { now?: number; revoked?: ReadonlySet<string> } = {},
): ShareVerdict {
  if (!secret || secret.length < MIN_SECRET_LENGTH) return { ok: false, reason: 'no-secret' }
  if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: 'format' }
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== VERSION) return { ok: false, reason: 'format' }

  // The signature is checked BEFORE the payload is parsed: nothing from an unauthenticated link is ever interpreted.
  const sent = decode(parts[2])
  if (!sent) return { ok: false, reason: 'format' }
  const expected = mac(`${parts[0]}.${parts[1]}`, secret)
  if (sent.length !== expected.length || !timingSafeEqual(sent, expected)) return { ok: false, reason: 'signature' }

  const raw = decode(parts[1])
  let payload: Partial<SharePayload>
  try {
    payload = raw ? (JSON.parse(raw.toString('utf8')) as Partial<SharePayload>) : {}
  } catch {
    return { ok: false, reason: 'payload' }
  }
  if (typeof payload.d !== 'string' || typeof payload.i !== 'string' || !Number.isInteger(payload.e) || !ID_PATTERN.test(payload.i)) return { ok: false, reason: 'payload' }
  if (payload.d !== deck) return { ok: false, reason: 'deck' }
  const now = options.now ?? Math.floor(Date.now() / 1000)
  if ((payload.e as number) <= now) return { ok: false, reason: 'expired' }
  if (options.revoked?.has(payload.i)) return { ok: false, reason: 'revoked' }
  return { ok: true, id: payload.i, expires: payload.e as number }
}

/** What the server reads from its environment. Neither value is ever sent to the browser or logged. */
export function readShareConfig(env: Record<string, string | undefined> = process.env): { secret: string | undefined; revoked: ReadonlySet<string> } {
  const revoked = new Set(
    (env.CLIENT_PRESENTATION_REVOKED_IDS ?? '')
      .split(/[\s,]+/)
      .map((id) => id.trim().toLowerCase())
      .filter(Boolean),
  )
  return { secret: env.CLIENT_PRESENTATION_SHARE_SECRET, revoked }
}
