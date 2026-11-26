// Makes a signed public share link for a client presentation (app/present/[product]).
//
//   node --import tsx scripts/client-presentation/make-share-link.mjs --new-secret
//       Prints a fresh random secret. Put it in the server's environment as CLIENT_PRESENTATION_SHARE_SECRET (Vercel > Settings >
//       Environment Variables), redeploy, and keep a copy in your password manager. It is never written to a file by this script.
//
//   CLIENT_PRESENTATION_SHARE_SECRET=<that secret> node --import tsx scripts/client-presentation/make-share-link.mjs \
//       --base https://g2gv0.vercel.app [--deck scholarclone] [--days 14]
//       Prints the link, its id and its expiry. Write the id next to the client's name: the id is how you switch that one link off
//       (CLIENT_PRESENTATION_REVOKED_IDS, comma separated). The link itself is not stored anywhere by this script.
//
// The secret comes from the environment only, never from an argument, so it stays out of shell history and process lists.
// A link lasts 14 days unless you say otherwise and never more than 90: a link that does not expire is a standing back door.
import { randomBytes } from 'node:crypto'

import { MIN_SECRET_LENGTH, signShareToken } from '../../lib/client-presentation/share-token.ts'

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const value = (name, fallback) => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 && args[at + 1] && !args[at + 1].startsWith('--') ? args[at + 1] : fallback
}
const fail = (message) => {
  console.error(`make-share-link: ${message}`)
  process.exit(1)
}

if (flag('new-secret')) {
  console.log(randomBytes(48).toString('base64url'))
  process.exit(0)
}

const secret = process.env.CLIENT_PRESENTATION_SHARE_SECRET
if (!secret || secret.length < MIN_SECRET_LENGTH) fail(`set CLIENT_PRESENTATION_SHARE_SECRET (at least ${MIN_SECRET_LENGTH} characters; --new-secret makes one)`)

const deck = value('deck', 'scholarclone')
const days = Number(value('days', '14'))
if (!Number.isFinite(days) || days < 1 || days > 90) fail('--days must be a number from 1 to 90')

let base
try {
  base = new URL(value('base', ''))
} catch {
  fail('--base must be the site address, for example https://g2gv0.vercel.app')
}
const local = ['localhost', '127.0.0.1'].includes(base.hostname)
if (base.protocol !== 'https:' && !local) fail('--base must be https (http is allowed only for localhost)')

const expires = Math.floor(Date.now() / 1000) + Math.round(days * 86400)
const id = randomBytes(8).toString('hex')
const token = signShareToken({ d: deck, e: expires, i: id }, secret)

console.log(`${base.origin}/present/${deck}?k=${token}`)
console.error(`\nlink id   ${id}   (to switch this link off, add it to CLIENT_PRESENTATION_REVOKED_IDS)`)
console.error(`expires   ${new Date(expires * 1000).toISOString()}`)
console.error('Anyone who has the link can open the deck until then, so send it only to the person it is for.')
