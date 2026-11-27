import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { test } from 'node:test'

import { MIN_SECRET_LENGTH, readShareConfig, signShareToken, verifyShareToken } from './share-token'

const SECRET = 'test-secret-that-is-comfortably-longer-than-32-chars'
const OTHER = 'a-completely-different-secret-also-over-32-chars!'
const NOW = 1_800_000_000
const ID = 'a1b2c3d4e5f60718'
const good = () => signShareToken({ d: 'scholarclone', e: NOW + 3600, i: ID }, SECRET)
const verify = (token: unknown, o: { deck?: string; secret?: string | undefined; revoked?: string[] } = {}) =>
  verifyShareToken(token, o.deck ?? 'scholarclone', 'secret' in o ? o.secret : SECRET, { now: NOW, revoked: new Set(o.revoked ?? []) })
const reason = (v: ReturnType<typeof verify>) => (v.ok ? 'ok' : v.reason)
const b64u = (s: string) => Buffer.from(s, 'utf8').toString('base64url')

test('a link signed with the secret opens its own deck and reports its id and expiry', () => {
  assert.deepEqual(verify(good()), { ok: true, id: ID, expires: NOW + 3600 })
})

test('changing any single character of a link breaks it (payload and signature, every position)', () => {
  const token = good()
  const [v, payload, sig] = token.split('.')
  let tried = 0
  for (const [idx, part] of [[1, payload], [2, sig]] as const) {
    for (let i = 0; i < part.length; i++) {
      const swap = part[i] === 'A' ? 'B' : 'A'
      const parts = [v, payload, sig]
      parts[idx] = part.slice(0, i) + swap + part.slice(i + 1)
      assert.equal(verify(parts.join('.')).ok, false, `position ${idx}:${i} was accepted`)
      tried++
    }
  }
  assert.ok(tried > 100)
})

test('a link with a later expiry written into the payload, but the old signature, is refused', () => {
  const [v, , sig] = good().split('.')
  const forged = b64u(JSON.stringify({ d: 'scholarclone', e: NOW + 999_999_999, i: ID }))
  assert.equal(reason(verify(`${v}.${forged}.${sig}`)), 'signature')
})

test('a link signed with another secret, or by someone who guessed the format, is refused', () => {
  assert.equal(reason(verify(signShareToken({ d: 'scholarclone', e: NOW + 3600, i: ID }, OTHER))), 'signature')
  const body = `v1.${b64u(JSON.stringify({ d: 'scholarclone', e: NOW + 3600, i: ID }))}`
  assert.equal(reason(verify(`${body}.`)), 'format') // empty signature
  assert.equal(reason(verify(`${body}.${createHmac('sha256', 'guess').update(body).digest('base64url')}`)), 'signature')
})

test('a link is for one deck only', () => {
  assert.equal(reason(verify(good(), { deck: 'another-deck' })), 'deck')
})

test('an expired link is refused, including at the exact second it expires', () => {
  const token = signShareToken({ d: 'scholarclone', e: NOW, i: ID }, SECRET)
  assert.equal(reason(verify(token)), 'expired')
  assert.equal(reason(verify(signShareToken({ d: 'scholarclone', e: NOW - 1, i: ID }, SECRET))), 'expired')
  assert.equal(verifyShareToken(token, 'scholarclone', SECRET, { now: NOW - 1 }).ok, true)
})

test('a revoked link id is refused while other links keep working', () => {
  assert.equal(reason(verify(good(), { revoked: [ID] })), 'revoked')
  assert.equal(verify(good(), { revoked: ['ffffffffffffffff'] }).ok, true)
})

test('with no secret, or a short one, NOTHING opens, even a link that was correctly signed', () => {
  assert.equal(reason(verify(good(), { secret: undefined })), 'no-secret')
  assert.equal(reason(verify(good(), { secret: '' })), 'no-secret')
  assert.equal(reason(verify(good(), { secret: 'x'.repeat(MIN_SECRET_LENGTH - 1) })), 'no-secret')
  const short = 'x'.repeat(MIN_SECRET_LENGTH - 1)
  assert.throws(() => signShareToken({ d: 'scholarclone', e: NOW + 60, i: ID }, short))
})

test('things that are not links are refused without throwing', () => {
  for (const junk of [undefined, null, 0, {}, [], [good()], '', 'v1', 'v1..', 'v1.a.b', '...', 'v2.a.b', 'x'.repeat(513), `${good()}.extra`, ` ${good()}`, `${good()} `]) {
    assert.equal(verify(junk).ok, false, `accepted ${JSON.stringify(junk)?.slice(0, 40)}`)
  }
})

test('only the canonical spelling of a link works (no padding, no stray characters)', () => {
  const [v, payload, sig] = good().split('.')
  assert.equal(verify(`${v}.${payload}.${sig}=`).ok, false)
  assert.equal(verify(`${v}.${payload}.${sig}%0A`).ok, false)
  assert.equal(verify(`${v}.${payload}.${sig.slice(0, -1)}`).ok, false)
})

test('a correctly signed payload that is the wrong shape is refused, and signing refuses to make one', () => {
  const sign = (p: unknown) => {
    const body = `v1.${b64u(typeof p === 'string' ? p : JSON.stringify(p))}`
    return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`
  }
  assert.equal(reason(verify(sign('not json'))), 'payload')
  assert.equal(reason(verify(sign({ d: 'scholarclone', e: 'soon', i: ID }))), 'payload')
  assert.equal(reason(verify(sign({ d: 'scholarclone', e: NOW + 60, i: 'x' }))), 'payload')
  assert.equal(reason(verify(sign({ d: 'scholarclone', e: NOW + 60 }))), 'payload')
  assert.throws(() => signShareToken({ d: 'Bad Deck!', e: NOW + 60, i: ID }, SECRET))
  assert.throws(() => signShareToken({ d: 'scholarclone', e: NOW + 60.5, i: ID }, SECRET))
  assert.throws(() => signShareToken({ d: 'scholarclone', e: NOW + 60, i: 'not hex' }, SECRET))
})

test('the secret and the revoked list are read from the environment, tolerant of spaces and case', () => {
  const c = readShareConfig({ CLIENT_PRESENTATION_SHARE_SECRET: SECRET, CLIENT_PRESENTATION_REVOKED_IDS: ' A1B2C3D4E5F60718 ,, 0011223344556677\n' })
  assert.equal(c.secret, SECRET)
  assert.deepEqual([...c.revoked].sort(), ['0011223344556677', 'a1b2c3d4e5f60718'])
  assert.equal(verifyShareToken(good(), 'scholarclone', c.secret, { now: NOW, revoked: c.revoked }).ok, false)
  assert.equal(readShareConfig({}).secret, undefined)
  assert.equal(readShareConfig({}).revoked.size, 0)
})
