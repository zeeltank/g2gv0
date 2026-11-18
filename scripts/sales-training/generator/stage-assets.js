/* Stages every picture the sales presentation owns, ready for the database:
 *   node stage-assets.js     -> ./out/assets/manifest.json + the files
 * then:  php artisan sales-training:import-images "<this folder>/out/assets"
 * Photos and illustrations come from assets/manifest-*.json (with their licence and credit); icons from assets/icons.
 * Once the rows are in the table, `node fetch-images.js` is what brings the files back for building the PowerPoint.
 */
const fs = require('fs')
const path = require('path')
const ASSETS = path.join(__dirname, '..', 'assets')
const OUT = path.join(__dirname, 'out', 'assets')
const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }
// reviewed and rejected: they would show something G2G does not document (see ASSET-REFERENCES.md)
const REJECTED = new Set(['leave-1', 'attendance-1', 'attendance-2'])

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
const rows = []
const add = (slug, src, meta) => {
  const ext = path.extname(src).toLowerCase()
  if (!MIME[ext]) throw new Error('unsupported type: ' + src)
  const file = slug + (ext === '.jpeg' ? '.jpg' : ext)
  fs.copyFileSync(src, path.join(OUT, file))
  rows.push({ slug, file, mime: MIME[ext], alt: (meta.alt || slug).slice(0, 255), tag: (meta.tag || '').slice(0, 120) || null, credit: (meta.credit || '').slice(0, 255) || null })
}

for (const f of fs.readdirSync(ASSETS).filter((x) => /^manifest-.*\.json$/.test(x))) {
  for (const e of JSON.parse(fs.readFileSync(path.join(ASSETS, f), 'utf8'))) {
    const src = path.join(ASSETS, e.file)
    if (!fs.existsSync(src)) { console.warn('missing file, skipped:', e.file); continue }
    const credit = [e.attribution_text, e.license].filter(Boolean).join(' | ')
    add(e.id, src, { alt: e.description || e.title, tag: REJECTED.has(e.id) ? 'REVIEWED, NOT USED' : e.kind === 'dashboard-reference' ? 'THIRD-PARTY EXAMPLE - NOT THE G2G SCREEN' : 'ILLUSTRATION - NOT A G2G SCREEN', credit })
  }
}
// pictures in assets/img that no manifest names (earlier searches, never used): kept too, so nothing is lost
const named = new Set(rows.map((r) => r.file.replace(/\.(jpg|png|svg)$/, '')))
for (const f of fs.readdirSync(path.join(ASSETS, 'img'))) {
  const slug = f.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9-]/g, '-')
  if (!named.has(slug) && !rows.some((r) => r.slug === slug)) add(slug, path.join(ASSETS, 'img', f), { alt: f, tag: 'UNREFERENCED, NOT USED', credit: null })
}
const iconDir = path.join(ASSETS, 'icons')
if (fs.existsSync(iconDir)) {
  for (const f of fs.readdirSync(iconDir).filter((x) => x.endsWith('.png'))) add('icon-' + f.replace('.png', ''), path.join(iconDir, f), { alt: f.replace('.png', '') + ' icon', tag: 'ICON', credit: 'Lucide (ISC licence)' })
}
const seen = new Set()
for (const r of rows) { if (seen.has(r.slug)) throw new Error('duplicate slug ' + r.slug); seen.add(r.slug) }
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(rows, null, 1))
console.log(`${rows.length} pictures staged in ${OUT}`)
