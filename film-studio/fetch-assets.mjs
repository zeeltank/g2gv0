// Downloads the free assets of the film into FILM_ASSETS (default D:/client-presentation-assets/film3d/assets). Run once: node fetch-assets.mjs
// Every asset here is CC0 (Poly Haven, ambientCG): usable for any purpose, no credit needed. The research that picked them, with the tested
// URLs, is in D:/client-presentation-assets/research/reports/Advanced motion film toolchain.md. Nothing is stored in the repo.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.env.FILM_ASSETS || 'D:/client-presentation-assets/film3d/assets'
const MODELS = ['magnifying_glass_01', 'seadogs_compass', 'vintage_microscope', 'book_encyclopedia_set_01', 'SchoolDesk_01', 'SchoolChair_01', 'stationery_supplies', 'lightbulb_01', 'wall_clock']
const HDRIS = ['studio_small_09', 'qwantani_dusk_2_puresky', 'qwantani_sunset_puresky']
const TEXTURES = ['Paper001', 'Paper006', 'Metal032', 'Wood095']

const get = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return Buffer.from(await r.arrayBuffer()) }
const save = (file, buf) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, buf) }
const credits = []

for (const id of MODELS) {
  const dir = join(root, 'models', id)
  if (existsSync(join(dir, `${id}_1k.gltf`))) { console.log('have model', id); continue }
  const api = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json()
  const g = api.gltf['1k'].gltf
  save(join(dir, `${id}_1k.gltf`), await get(g.url))
  for (const [rel, f] of Object.entries(g.include || {})) save(join(dir, rel), await get(f.url))
  console.log('model', id, Object.keys(g.include || {}).length + 1, 'files')
}
for (const id of HDRIS) {
  const file = join(root, 'hdri', `${id}_1k.hdr`)
  if (!existsSync(file)) save(file, await get(`https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/${id}_1k.hdr`))
  console.log('hdri', id)
}
for (const id of TEXTURES) {
  const dir = join(root, 'textures', id)
  if (existsSync(dir)) { console.log('have texture', id); continue }
  const zip = join(root, 'textures', `${id}.zip`)
  save(zip, await get(`https://ambientcg.com/get?file=${id}_1K-JPG.zip`))
  execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dir}' -Force`])
  console.log('texture', id)
}
for (const id of [...MODELS, ...HDRIS]) credits.push({ id, source: 'Poly Haven', licence: 'CC0', url: `https://polyhaven.com/a/${id}` })
for (const id of TEXTURES) credits.push({ id, source: 'ambientCG', licence: 'CC0', url: `https://ambientcg.com/a/${id}` })
writeFileSync(join(root, 'CREDITS.json'), JSON.stringify(credits, null, 2))
console.log('done ->', root)
