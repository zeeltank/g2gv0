// Generates the cartoon and sketch pictures of an illustrated tour on a FREE route: Cloudflare Workers AI (FLUX.1 schnell, Apache-2.0).
//   node scripts/client-presentation/generate-tour-art.mjs --family learn --slots <slots.json> --out D:/client-presentation-assets/tour-masters/learn/gen [--only id1,id2] [--dry-run] [--seed 11]
// Needs two environment variables (never put them in a file, a chat or a commit): CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (a token with the Workers AI permission).
// The free plan gives 10,000 neurons a day (about 170 images at 1024 px, see the research notes in docs/client-presentation/17-handover-and-playbook-2026-11-26.md and 00-PROGRESS round 12).
// Slots file: [{ "id": "learn-cartoon-teacher", "slot": "teacher", "kind": "cartoon|sketch", "scene": "a friendly adult teacher holding a stack of papers", "alt": "..." }]
// STYLE: every prompt = the fixed STYLE phrase of its kind + the scene + the fixed NEGATIVE phrase, so the set shares one look (line weight, palette, plain faces); the model takes no seed. No prompt asks for lettering and the result is OCR-checked afterwards (ocr-tour-art.mjs).
// OUTPUT: <out>/<slot>.png plus <out>/manifest.json in the format register-tour-art.mjs reads (origin "generated", tool, prompt, seed, terms "unverified", owner_approved false).
// The owner approves each image (owner_approved true in assets/tour-art.json) after looking at it; the validator warns until then. Provenance metadata is kept: the PNG is
// written exactly as the service returns it (no stripping), and the register records the tool, the date and the prompt.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const flag = (n) => process.argv.includes('--' + n)
const family = arg('family'); const slotsFile = arg('slots'); const out = arg('out'); const only = arg('only', '')?.split(',').filter(Boolean)
const baseSeed = Number(arg('seed', 11)); const dry = flag('dry-run')
if (!family || !slotsFile || !out) { console.log('usage: --family <key> --slots <json> --out <folder> [--only ids] [--dry-run] [--seed n]'); process.exit(1) }

export const STYLE = {
  cartoon: 'flat 2D vector cartoon illustration, one clean dark navy outline of even weight, flat colour fills only in blue, green, off-white and marker yellow, simple stylised friendly character with a plain face (two dot eyes, small smile), blank plain laptop lids and blank paper with no symbols, no gradients, no shadows, a single subject centred on a plain empty pure white background with nothing else in it',
  icon: 'flat 2D vector illustration of objects, one clean dark navy outline of even weight, flat colour fills only in blue, green, off-white and marker yellow, no people, blank plain surfaces with no symbols, no gradients, no shadows, one simple composition centred on a plain empty pure white background with nothing else in it',
  sketch: 'loose hand-drawn pencil and ink sketch, single navy line colour, light cross-hatching, no colour fill, plain empty pure white background',
}
// FLUX has no negative prompt and naming 'text' in a prompt can invite it, so the wording is positive: blank paper, blank signs, plain artwork. Stray lettering is caught afterwards (OCR + a person looking).
export const NEGATIVE = 'blank paper and blank signs, plain clean artwork, illustration only'
const MODEL = '@cf/black-forest-labs/flux-1-schnell'
const promptOf = (s) => `${STYLE[s.kind]}. Scene: ${s.scene}. ${NEGATIVE}.`

const slots = JSON.parse(readFileSync(slotsFile, 'utf8')).filter((s) => !only.length || only.includes(s.id))
mkdirSync(out, { recursive: true })
const acct = process.env.CLOUDFLARE_ACCOUNT_ID; const token = process.env.CLOUDFLARE_API_TOKEN
if (!dry && (!acct || !token)) { console.log('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in the environment first (a free Cloudflare account, an API token with the Workers AI permission). Nothing was sent.'); process.exit(1) }

const manifest = []
for (const [i, s] of slots.entries()) {
  const prompt = promptOf(s); const seed = baseSeed + i
  if (dry) { console.log(`DRY ${s.id} seed ${seed}\n  ${prompt}`); continue }
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/${MODEL}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, steps: 6 }) })   // flux-1-schnell on Workers AI takes only a prompt and steps (a 'seed' field is rejected with HTTP 400: tested 27 Nov 2026)
  const j = await res.json().catch(() => null)
  if (!res.ok || !j?.result?.image) { console.log(`FAIL ${s.id}: HTTP ${res.status} ${JSON.stringify(j?.errors ?? j)?.slice(0, 200)}`); if (res.status === 429 || res.status === 403) break; continue }
  const buf = Buffer.from(j.result.image, 'base64')
  const file = `${s.slot}.png`; writeFileSync(join(out, file), buf)
  manifest.push({ id: s.id, slot: s.slot, kind: s.kind, file, alt: s.alt, origin: 'generated', tool: `Cloudflare Workers AI, ${MODEL} (Apache-2.0 model)`, prompt, terms: 'unverified: Cloudflare output terms not read; model licence Apache-2.0; BFL terms claim no ownership of output (bfl.ai/legal/terms-of-service, read 27 Nov 2026 by the research agent)', owner_approved: false, generated: new Date().toISOString().slice(0, 10), sha256: createHash('sha256').update(buf).digest('hex') })
  console.log(`ok   ${s.id}  ${(buf.length / 1024).toFixed(0)} KB  -> ${join(out, file)}`)
}
if (!dry) { writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1)); console.log(`manifest: ${manifest.length} images. Next: look at each, ocr-tour-art.mjs, register-tour-art.mjs, set owner_approved after the owner has seen them.`) }
