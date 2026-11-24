// Turns chosen stock photos into deck-ready WebP and fills their rows in the asset register with the licence evidence.
//   node scripts/client-presentation/register-stock.mjs <stock-report.json> img-hook:35551059 img-student:5905476 ...
// Originals stay where they are (outside the repo). A row is marked 'authorised' only when the report holds a record for that
// slot and id with a licence URL, a photographer, a SHA-256 that matches the file on disk, and the file exists.
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const [reportPath, ...picks] = process.argv.slice(2)
if (!reportPath || !picks.length) { console.error('usage: register-stock.mjs <stock-report.json> slot:id ...'); process.exit(2) }

const report = JSON.parse(readFileSync(reportPath, 'utf8'))
const regPath = join(root, 'docs/client-presentation/assets/assets.json')
const reg = JSON.parse(readFileSync(regPath, 'utf8'))
const outDir = join(root, 'public/client-presentation/scholarclone/images')
mkdirSync(outDir, { recursive: true })
mkdirSync(join(root, 'docs/client-presentation/assets'), { recursive: true })
copyFileSync(reportPath, join(root, 'docs/client-presentation/assets/stock-report.json'))

const MAXW = { 'img-hook': 2560 }
for (const p of picks) {
  const [slot, id] = p.split(':')
  const rec = report.find((r) => r.slot === slot && String(r.id) === id)
  const row = reg.slots.find((r) => r.slot === slot)
  if (!rec || !row) { console.error('FAIL no record or no register row for', p); process.exit(1) }
  for (const f of ['licence_url', 'photographer', 'photo_page_url', 'local_path', 'sha256']) if (!rec[f]) { console.error('FAIL missing', f, 'for', p); process.exit(1) }
  if (!existsSync(rec.local_path)) { console.error('FAIL file missing', rec.local_path); process.exit(1) }
  const bytes = readFileSync(rec.local_path)
  if (createHash('sha256').update(bytes).digest('hex') !== rec.sha256) { console.error('FAIL sha256 mismatch for', p); process.exit(1) }
  const file = `client-presentation/scholarclone/images/${slot}.webp`
  const info = await sharp(bytes).rotate().resize({ width: MAXW[slot] ?? 2000, withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(root, 'public', file))
  Object.assign(row, {
    status: 'authorised', file, width: info.width, height: info.height,
    source_url: rec.photo_page_url, licence: rec.licence_name.split(' (')[0], licence_url: rec.licence_url,
    author: rec.photographer, credit_line: `Photo: ${rec.photographer} / Pexels. Illustrative stock imagery.`,
    retrieved_on: rec.date_read, original_sha256: rec.sha256, original_path: rec.local_path,
    identifiable_people: rec.people_identifiable, model_release: rec.model_release, generated_by_ai: false,
    authorised_by: 'Owner 2026-11-23: mixed sourcing approved (Pexels, Unsplash, AI, Wikimedia excluding CC BY-SA)', authorised_on: '2026-11-23',
    webp_sha256: createHash('sha256').update(readFileSync(join(root, 'public', file))).digest('hex'),
  })
  console.log(`ok ${slot} <- pexels ${id} -> ${info.width}x${info.height} ${(info.size / 1024) | 0} KB`)
}
writeFileSync(regPath, JSON.stringify(reg, null, 1), 'utf8')
