// Turns downloaded master pictures into the light web files an illustrated tour uses, and records each one in the register.
//   node scripts/client-presentation/register-tour-art.mjs --family learn --manifest D:/.../photos.json --src D:/.../photos [--only id1,id2] [--max 1800]
// Manifest: an array of { id, slot, kind: 'photo'|'cartoon'|'sketch', file, source_url, creator|photographer, licence|licence_url, licence_checked, alt, ... }
//   (what the sourcing step wrote next to the masters). For every entry (or the --only ids) this
//   - reads the master (JPEG, PNG or SVG), resizes it so its longest side is at most --max px (SVG is rasterised first) and writes
//     public/client-presentation/tour/<family>/<id>.webp  (alpha kept for cartoons and sketches);
//   - measures the web file and takes its sha256;
//   - merges the record into docs/client-presentation/assets/tour-art.json (by id; other records are left alone).
// Masters stay where they are (outside the repo). The validator in build-atlas.mjs then refuses any id whose file or hash does not match.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const family = arg('family'); const manifestFile = arg('manifest'); const srcDir = arg('src')
const only = arg('only', '')?.split(',').filter(Boolean); const max = Number(arg('max', 1800))
if (!family || !manifestFile || !srcDir) { console.log('usage: --family <key> --manifest <json> --src <folder of masters> [--only ids] [--max px]'); process.exit(1) }
const sharp = createRequire(join(root, 'package.json'))('sharp')
const registerFile = join(root, 'docs/client-presentation/assets/tour-art.json')
const register = existsSync(registerFile) ? JSON.parse(readFileSync(registerFile, 'utf8')) : { about: 'The pictures of the illustrated product tours: see docs/client-presentation/16-illustrated-tours.md.', images: [] }
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
const outDir = join(root, 'public/client-presentation/tour', family); mkdirSync(outDir, { recursive: true })

for (const m of manifest.filter((x) => !only.length || only.includes(x.id))) {
  const src = join(srcDir, m.file)
  if (!existsSync(src)) { console.log(`skip ${m.id}: no master at ${src}`); continue }
  const isSvg = extname(m.file).toLowerCase() === '.svg'
  const img = sharp(src, isSvg ? { density: 300 } : {})
  const meta = await img.metadata()
  const long = Math.max(meta.width, meta.height)
  let pipe = sharp(src, isSvg ? { density: Math.min(600, Math.round((300 * max) / Math.max(1, long))) } : {}).rotate()
  if (long > max || isSvg) pipe = pipe.resize({ width: meta.width >= meta.height ? max : undefined, height: meta.height > meta.width ? max : undefined, withoutEnlargement: !isSvg })
  const file = `${m.id}.webp`
  const buf = await pipe.webp({ quality: m.kind === 'photo' ? 82 : 88, alphaQuality: 92 }).toBuffer()
  const out = await sharp(buf).metadata()
  writeFileSync(join(outDir, file), buf)
  const rec = {
    id: m.id, family, kind: m.kind, slot: m.slot, file, w: out.width, h: out.height, alt: m.alt, sha256: createHash('sha256').update(buf).digest('hex'),
    origin: m.origin ?? (m.tool ? 'generated' : 'downloaded'),
    ...(m.source_url ? { source_url: m.source_url } : {}), ...((m.creator ?? m.photographer) ? { creator: m.creator ?? m.photographer } : {}),
    ...(m.licence ? { licence: m.licence } : m.licence_url ? { licence: `see ${m.licence_url}` } : {}), ...(m.licence_url ? { licence_url: m.licence_url } : {}),
    ...(m.licence_checked ? { licence_checked: m.licence_checked } : {}), master: m.file, master_sha256: createHash('sha256').update(readFileSync(src)).digest('hex'),
    ...(m.tool ? { tool: m.tool, prompt: m.prompt, terms: m.terms, owner_approved: m.owner_approved === true } : {}), ...(m.review ? { review: m.review } : {}),
  }
  const at = register.images.findIndex((x) => x.id === m.id)
  if (at >= 0) register.images[at] = rec; else register.images.push(rec)
  console.log(`ok   ${m.id}  ${out.width}x${out.height}  ${(buf.length / 1024).toFixed(0)} KB  -> public/client-presentation/tour/${family}/${file}`)
}
writeFileSync(registerFile, JSON.stringify(register, null, 1) + '\n', 'utf8')
console.log('register:', register.images.length, 'images')
