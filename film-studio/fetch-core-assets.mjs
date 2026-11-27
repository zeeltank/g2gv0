// Downloads the assets of the Scholar Core film into CORE_ASSETS (default D:/client-presentation-assets/tour-core/assets). Run once: node fetch-core-assets.mjs
// New assets for this film, none taken from the earlier film: real CC0 models and HDRI lighting from Poly Haven (no credit needed, any use),
// and a few Pexels photographs (Pexels licence: free for commercial use, no credit needed; no identifiable people in a sensitive context).
// Every file is listed with its source URL and licence in CREDITS.json next to the assets. Nothing here is stored in the repository.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.env.CORE_ASSETS || 'D:/client-presentation-assets/tour-core/assets'
const MODELS = ['metal_office_desk', 'classic_laptop', 'clipboard', 'office_notepads', 'desk_lamp_arm_01', 'projector_screen', 'CashRegister_01', 'SchoolDesk_01', 'SchoolChair_01', 'standing_chalkboard_01', 'hand_truck', 'cardboard_box_01', 'stationery_supplies']
const HDRIS = ['monochrome_studio_03', 'brown_photostudio_05']
// Pexels photographs: id, what it is used for. The CDN address pattern is public; the licence page was read on 2026-11-26 (https://www.pexels.com/license/).
const PHOTOS = [
  { id: 30473509, use: 'opening plate: a yellow school bus in Chandigarh, no faces' },
  { id: 30703604, use: 'second plate: an empty classroom in an Indian school, natural light' },
]

const get = async (url) => { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return Buffer.from(await r.arrayBuffer()) }
const save = (file, buf) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, buf) }
const credits = []

for (const id of MODELS) {
  const dir = join(root, 'models', id)
  if (existsSync(join(dir, `${id}_1k.gltf`))) { console.log('have model', id); credits.push({ id, kind: 'model', source: 'Poly Haven', licence: 'CC0', url: `https://polyhaven.com/a/${id}` }); continue }
  const api = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json()
  const g = api.gltf?.['1k']?.gltf
  if (!g) { console.log('NO 1k gltf for', id); continue }
  save(join(dir, `${id}_1k.gltf`), await get(g.url))
  for (const [rel, f] of Object.entries(g.include || {})) save(join(dir, rel), await get(f.url))
  console.log('model', id, Object.keys(g.include || {}).length + 1, 'files')
  credits.push({ id, kind: 'model', source: 'Poly Haven', licence: 'CC0', url: `https://polyhaven.com/a/${id}` })
}
for (const id of HDRIS) {
  const file = join(root, 'hdri', `${id}_1k.hdr`)
  if (!existsSync(file)) save(file, await get(`https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/${id}_1k.hdr`))
  console.log('hdri', id)
  credits.push({ id, kind: 'hdri', source: 'Poly Haven', licence: 'CC0', url: `https://polyhaven.com/a/${id}` })
}
for (const p of PHOTOS) {
  const file = join(root, 'photos', `pexels-${p.id}.jpg`)
  if (!existsSync(file)) save(file, await get(`https://images.pexels.com/photos/${p.id}/pexels-photo-${p.id}.jpeg?auto=compress&cs=tinysrgb&w=2400`))
  console.log('photo', p.id)
  credits.push({ id: String(p.id), kind: 'photo', source: 'Pexels', licence: 'Pexels licence (free for commercial use, no credit required)', url: `https://www.pexels.com/photo/${p.id}/`, use: p.use })
}
writeFileSync(join(root, 'CREDITS.json'), JSON.stringify(credits, null, 2))
console.log('done ->', root, `(${credits.length} assets)`)
