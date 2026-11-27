// Turns the generated pictures (generate-tour-art.mjs) into page-ready files.
//   node scripts/client-presentation/cutout-generated.mjs --in <folder of PNGs> --out <folder> [--max 900] [--band 10.8]
// cartoon: the plain white background is removed by a flood fill from the picture's border (white INSIDE the drawing, such as a whiteboard or a laptop, is kept because
//          it is not connected to the border), the edge is softened by half a pixel, the figure is trimmed to its box with 8 px of air and scaled to at most --max px.
// sketch:  the lines become navy (#0C2A4A) on transparent: alpha comes from how dark each pixel is, so white paper disappears and the page shows through.
//          With --band the sketch is also cropped to a wide strip (ratio width : height) around the densest rows, for a banner.
// Reads and writes PNG only (sharp). Needs the generated manifest's 'kind' per file name: <name>.png is a cartoon unless <name> contains '__sketch'.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const inDir = arg('in'); const outDir = arg('out'); const MAX = Number(arg('max', 900)); const BAND = Number(arg('band', 0))
if (!inDir || !outDir) { console.log('usage: --in <folder> --out <folder> [--max px] [--band ratio]'); process.exit(1) }
const sharp = createRequire(join(root, 'package.json'))('sharp')
mkdirSync(outDir, { recursive: true })

const WHITE = 224   // a pixel whose three channels are all at least this is background when it touches the border (outlines are dark navy, so they stop the fill)
async function cartoon(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const bg = new Uint8Array(w * h)
  const isWhite = (p) => data[p * 4] >= WHITE && data[p * 4 + 1] >= WHITE && data[p * 4 + 2] >= WHITE
  const stack = []
  const push = (x, y) => { const p = y * w + x; if (!bg[p] && isWhite(p)) { bg[p] = 1; stack.push(p) } }
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1) }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y) }
  while (stack.length) { const p = stack.pop(); const x = p % w; const y = (p / w) | 0; if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1) }
  const alpha = Buffer.alloc(w * h)
  let x0 = w; let y0 = h; let x1 = -1; let y1 = -1
  for (let p = 0; p < w * h; p++) { alpha[p] = bg[p] ? 0 : 255; if (!bg[p]) { const x = p % w; const y = (p / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y } }
  const blurred = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).blur(0.6).raw().toBuffer({ resolveWithObject: true })
  const sc = blurred.info.channels   // sharp may hand the blurred plane back with more than one channel: index it with its real stride
  const soft = { at: (p) => blurred.data[p * sc] }
  const rgba = Buffer.alloc(w * h * 4)
  for (let p = 0; p < w * h; p++) { rgba[p * 4] = data[p * 4]; rgba[p * 4 + 1] = data[p * 4 + 1]; rgba[p * 4 + 2] = data[p * 4 + 2]; rgba[p * 4 + 3] = soft.at(p) }
  const pad = 8; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad)
  let img = sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
  const cw = x1 - x0 + 1; const ch = y1 - y0 + 1
  if (Math.max(cw, ch) > MAX) img = img.resize({ width: cw >= ch ? MAX : undefined, height: ch > cw ? MAX : undefined })
  return img.png()
}

async function sketch(file) {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const rgba = Buffer.alloc(w * h * 4)
  for (let p = 0; p < w * h; p++) {
    const a = Math.max(0, Math.min(255, Math.round((250 - data[p]) * 1.5)))   // paper (about 250 and above) vanishes, ink (dark) is opaque
    rgba[p * 4] = 0x0c; rgba[p * 4 + 1] = 0x2a; rgba[p * 4 + 2] = 0x4a; rgba[p * 4 + 3] = a
  }
  let img = sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
  if (BAND > 0) {
    // the strip of rows that holds the most ink, as wide as the picture
    const bh = Math.round(w / BAND); let best = 0; let bestAt = 0
    const rowInk = new Float64Array(h); for (let y = 0; y < h; y++) { let s = 0; for (let x = 0; x < w; x++) s += rgba[(y * w + x) * 4 + 3]; rowInk[y] = s }
    let win = 0; for (let y = 0; y < bh; y++) win += rowInk[y]; best = win
    for (let y = bh; y < h; y++) { win += rowInk[y] - rowInk[y - bh]; if (win > best) { best = win; bestAt = y - bh + 1 } }
    img = img.extract({ left: 0, top: bestAt, width: w, height: bh })
  }
  return img.png()
}

const files = readdirSync(inDir).filter((f) => f.toLowerCase().endsWith('.png'))
for (const f of files) {
  const out = join(outDir, f)
  const img = f.includes('sketch') ? await sketch(join(inDir, f)) : await cartoon(join(inDir, f))
  await img.toFile(out)
  const m = await sharp(out).metadata()
  console.log(`ok   ${f}  ${m.width}x${m.height}`)
}
