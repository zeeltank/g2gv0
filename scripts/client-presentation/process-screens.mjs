// Turns the approved, masked K12 captures into the optimised WebP pictures the deck and the PowerPoint use.
//   node scripts/client-presentation/process-screens.mjs [--from D:/client-presentation-incoming]
// Reads  docs/client-presentation/content/atlas/screens-approved.json: [{ id, dir, crop?: {x,y,w,h} }]  (dir = the capture folder under --from, e.g. k12b)
// Writes public/client-presentation/atlas/<id>.webp (1600 x 900, an optional crop of the 1920 x 1080 capture first) and
//        docs/client-presentation/atlas-screens.json (the register: where each picture came from, how it was masked, who authorised it).
// Only the captures listed as approved are used; a capture is approved after its still-readable text and the picture have been reviewed
// (capture-k12.mjs masks every page before the picture is taken; nothing unmasked is ever written).
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const from = arg('from', 'D:/client-presentation-incoming')
const sharp = createRequire(join(root, 'package.json'))('sharp')
const approved = JSON.parse(readFileSync(join(root, 'docs/client-presentation/content/atlas/screens-approved.json'), 'utf8'))
const outDir = join(root, 'public/client-presentation/atlas'); mkdirSync(outDir, { recursive: true })
const register = []
for (const a of approved.screens) {
  const src = join(from, a.dir, `${a.id}.png`)
  if (!existsSync(src)) { console.log('missing', src); continue }
  let img = sharp(src)
  const c = a.crop ?? { x: 0, y: 0, w: 1920, h: 1080 }
  img = img.extract({ left: c.x, top: c.y, width: c.w, height: c.h }).resize(1600, 900, { fit: 'cover' })
  const dst = join(outDir, `${a.id}.webp`)
  await img.webp({ quality: 84 }).toFile(dst)
  register.push({ id: a.id, file: `client-presentation/atlas/${a.id}.webp`, source: 'K12 product (live school, demo login)', captured_on: approved.captured_on, crop: a.crop ?? null, personal_data_masked: true, masked_by: 'scripts/client-presentation/capture-k12.mjs (default-deny masker) and a review of the still-readable text', authorised_by: approved.authorised_by })
}
writeFileSync(join(root, 'docs/client-presentation/atlas-screens.json'), JSON.stringify({ note: approved.note, screens: register }, null, 1) + '\n', 'utf8')
console.log(`wrote ${register.length} pictures to ${outDir}`)
