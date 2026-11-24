// Builds the Motion PowerPoint: every slide is the real animated web slide, recorded as a full-screen video, with its own final frame as the
// cover image, the speaker notes, and the same slide-jump links as the editable file (slide 4 chips, slide 6 product tiles, a way back).
//   node scripts/client-presentation/build-pptx-motion.mjs [--videos D:/client-presentation-assets/slides-motion] [--out D:/client-presentation-assets/out]
// Needs the output of record-slides.mjs (manifest.json, sNN.mp4, sNN-poster.jpg) and the reel from make-reel.mjs (s16-reel.mp4, s16-poster.jpg).
// Writes ScholarClone-Client-Presentation-Motion.pptx. Videos play when clicked (PowerPoint's default for an inserted video); the cover shows
// the finished slide, so a slide that is not played still reads. The text on the slides is part of the video, so it is not editable:
// the editable file (ScholarClone-Client-Presentation.pptx) stays for changes.
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const dir = arg('videos', 'D:/client-presentation-assets/slides-motion')
const outDir = arg('out', 'D:/client-presentation-assets/out'); mkdirSync(outDir, { recursive: true })
const tools = createRequire('D:/client-presentation-assets/_pptx/')
const PptxGenJS = tools('pptxgenjs'); const JSZip = tools('jszip')
const deck = JSON.parse(readFileSync(join(root, 'lib/client-presentation/generated/scholarclone.deck.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
const ORDER = [1, 2, 3, 4, 5, 6, 16, 7, 8, 9, 10, 11, 12, 13, 14, 15]
const at = (n) => ORDER.indexOf(n) + 1
const K = 13.3333 / 1920; const P = (n) => +(n * K).toFixed(3)
const cover = (file) => 'data:image/jpeg;base64,' + readFileSync(file).toString('base64')
const CHIP_TARGETS = [14, 8, 10, 11, 12]
const TILE_TARGETS = { 'Scholar Core': 7, 'Scholar Learn': 8, 'Scholar CCB': 10, 'Scholar Insight': 11, 'Scholar Compass': 12 }
const DETOUR_SLIDES = new Set([7, 8, 10, 11, 12, 14])

const pptx = new PptxGenJS()
pptx.layout = 'LAYOUT_WIDE'
pptx.title = deck.title + ' (motion)'; pptx.company = 'ScholarClone'; pptx.subject = 'Client presentation, motion version'

for (const n of ORDER) {
  const slide = deck.slides.find((s) => s.n === n)
  const sl = pptx.addSlide(); sl.background = { color: '02080F' }
  const video = n === 16 ? join(dir, 's16-reel.mp4') : join(dir, manifest.slides[n].file)
  const poster = n === 16 ? join(dir, 's16-poster.jpg') : join(dir, manifest.slides[n].poster)
  if (!existsSync(video) || !existsSync(poster)) throw new Error(`missing video or poster for slide ${n}: run record-slides.mjs and make-reel.mjs first`)
  sl.addMedia({ type: 'video', path: video, cover: cover(poster), x: 0, y: 0, w: 13.333, h: 7.5 })

  // Links over the video (a shape added later sits above it).
  const link = (h, target, tip) => sl.addShape(pptx.ShapeType.rect, { x: P(h.x), y: P(h.y), w: P(h.w), h: P(h.h), fill: { color: 'FFFFFF', transparency: 100 }, line: { type: 'none' }, hyperlink: { slide: at(target), tooltip: tip } })
  if (n === 4) (manifest.hotspots[4] ?? []).forEach((h, i) => { if (CHIP_TARGETS[i]) link(h, CHIP_TARGETS[i], h.text) })
  if (n === 6) (manifest.hotspots[6] ?? []).forEach((h) => { const name = Object.keys(TILE_TARGETS).find((k) => h.text.includes(k)); if (name) link(h, TILE_TARGETS[name], `Open ${name}`) })
  if (DETOUR_SLIDES.has(n)) {
    sl.addShape(pptx.ShapeType.roundRect, { x: 11.35, y: 7.02, w: 1.75, h: 0.34, rectRadius: 0.15, fill: { color: '02080F', transparency: 35 }, line: { type: 'none' } })
    sl.addText('↩ Back to the journey', { x: 11.35, y: 7.02, w: 1.75, h: 0.34, margin: 0, align: 'center', valign: 'middle', fontFace: 'Calibri', fontSize: 10, bold: true, color: 'FFFFFF', hyperlink: { slide: at(4), tooltip: 'Back to slide 4' } })
  }
  sl.addNotes([`SAY: ${slide.say}`, `ASK: ${slide.ask}`, slide.transition ? `THEN: ${slide.transition}` : '', (slide.limits ?? []).length ? `CAREFUL (presenter only): ${slide.limits.join(' ')}` : '', 'Click the picture to play the slide\'s motion; the cover shows the finished slide.'].filter(Boolean).join('\n\n'))
}

const path = join(outDir, 'ScholarClone-Client-Presentation-Motion.pptx')
await pptx.writeFile({ fileName: path })
const zip = await JSZip.loadAsync(readFileSync(path), { createFolders: false })
for (const name of Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))) {
  let x = await zip.file(name).async('string')
  if (!x.includes('<p:transition')) { x = x.replace('</p:clrMapOvr>', '</p:clrMapOvr><p:transition spd="med"><p:fade/></p:transition>'); zip.file(name, x) }
}
const clean = new JSZip()
const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort((a, b) => (a === '[Content_Types].xml' ? -1 : b === '[Content_Types].xml' ? 1 : 0))
for (const n of names) clean.file(n, await zip.files[n].async('nodebuffer'), { createFolders: false })
writeFileSync(path, await clean.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
console.log('wrote', path)
