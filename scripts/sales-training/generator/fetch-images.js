/* Downloads the pictures the generators use from the database (table sales_training_images, served by
 * GET <api>/sales-training/images/<slug>) into ./.cache, so nothing is kept as local source images.
 *   node fetch-images.js [--force]
 * The API address comes from SALES_IMAGE_API (default http://127.0.0.1:8000/api, the local backend).
 * Which pictures to fetch is read from assets/manifest-*.json (photos, by id) and assets/icons.json (icons).
 */
const fs = require('fs')
const path = require('path')
const ASSETS = path.join(__dirname, '..', 'assets')
const CACHE = path.join(__dirname, '.cache')
const BASE = (process.env.SALES_IMAGE_API || 'http://127.0.0.1:8000/api').replace(/\/$/, '')
const force = process.argv.includes('--force')

const wanted = []
for (const f of fs.readdirSync(ASSETS).filter((x) => /^manifest-.*\.json$/.test(x))) {
  for (const e of JSON.parse(fs.readFileSync(path.join(ASSETS, f), 'utf8'))) wanted.push({ slug: e.id, file: e.file })
}
const iconsFile = path.join(ASSETS, 'icons.json')
if (fs.existsSync(iconsFile)) for (const n of JSON.parse(fs.readFileSync(iconsFile, 'utf8'))) wanted.push({ slug: 'icon-' + n, file: 'icons/' + n + '.png' })

;(async () => {
  let got = 0, kept = 0
  for (const w of wanted) {
    const dest = path.join(CACHE, w.file)
    if (!force && fs.existsSync(dest) && fs.statSync(dest).size > 0) { kept++; continue }
    const res = await fetch(`${BASE}/sales-training/images/${w.slug}`).catch((e) => { throw new Error(`Cannot reach ${BASE} (${e.message}). Is the backend running, and is SALES_IMAGE_API right?`) })
    if (!res.ok) throw new Error(`${w.slug}: HTTP ${res.status} from ${BASE}. Has the picture been imported (php artisan sales-training:import-images)?`)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
    got++
  }
  console.log(`pictures: ${got} downloaded, ${kept} already in .cache (${wanted.length} in total) from ${BASE}`)
})().catch((e) => { console.error(e.message); process.exit(1) })
