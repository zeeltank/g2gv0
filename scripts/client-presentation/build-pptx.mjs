// Builds the editable PowerPoint backup of the client presentation from the same checked story and the same registered images.
//   node scripts/client-presentation/build-pptx.mjs [--out D:/client-presentation-assets/out]
// Needs pptxgenjs and jszip (installed outside the repo in D:/client-presentation-assets/_pptx), sharp (from this repo) for JPEG copies of the photos.
// Produces ScholarClone-Client-Presentation.pptx (15 slides + scenario links) and ScholarClone-Client-Presentation-Short.pptx (5 slides).
// A PowerPoint cannot run GSAP: it carries layouts, notes, slide-jump scenario links and a fade transition on every slide. The animated
// experience is the web deck. The layouts reuse the web deck's stage coordinates (1920 x 1080) scaled to 13.333 x 7.5 in.
import { atlasBuilders, atlasOrder, loadAtlas } from './pptx-atlas.mjs'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const outDir = arg('out', 'D:/client-presentation-assets/out'); mkdirSync(outDir, { recursive: true })
const tools = createRequire('D:/client-presentation-assets/_pptx/')
const PptxGenJS = tools('pptxgenjs'); const JSZip = tools('jszip')
const sharp = createRequire(join(root, 'package.json'))('sharp')
const deck = JSON.parse(readFileSync(join(root, 'lib/client-presentation/generated/scholarclone.deck.json'), 'utf8'))

const K = 13.3333 / 1920                       // stage pixel -> inches
const P = (n) => +(n * K).toFixed(3)
const PT = (px) => Math.max(10, Math.round(px * 0.5)) // stage px -> points
const C = { ink: '06182B', navy: '0B3C73', blue: '1088F6', blueD: '0A6AD0', green: '74CD23', greenD: '4C9A14', paper: 'F4F0E6', tInk: '0C2A4A', tBody: '35495F', onInk: 'EAF2FB', soft: 'B7C7DA' }
const HEAD = 'Georgia'; const BODY = 'Calibri'

// ---- images: JPEG copies of the registered files (PowerPoint reads JPEG everywhere)
const imgDir = join(outDir, 'img'); mkdirSync(imgDir, { recursive: true })
const img = {}
for (const [slot, a] of Object.entries(deck.assets)) {
  if (!a.src) continue
  const src = join(root, 'public', a.src.replace(/^\//, ''))
  const dst = join(imgDir, slot + (a.src.endsWith('.png') ? '.png' : '.jpg'))
  const pipe = sharp(src).rotate()
  if (dst.endsWith('.png')) await pipe.png().toFile(dst); else await pipe.jpeg({ quality: 88 }).toFile(dst)
  const meta = await sharp(dst).metadata()
  img[slot] = { path: dst, w: meta.width, h: meta.height, alt: a.alt || slot, credit: a.credit }
}

// ---- the Product Atlas (build-atlas.mjs): sheets per sub-module, edited screenshots as JPEG copies
const { atlas, notes: atlasNotes } = loadAtlas(root)
const atlasImg = new Map()
for (const p of atlas.products) for (const sub of p.subs) {
  const f = sub.shots[0]; if (!f) continue
  const src = join(root, 'public', f.replace(/^\//, '')); if (!existsSync(src)) continue
  const dst = join(imgDir, `atlas-${sub.id}.jpg`)
  await sharp(src).jpeg({ quality: 88 }).toFile(dst); atlasImg.set(sub.id, { path: dst })
}
const imgOfSub = (sub) => atlasImg.get(sub.id) ?? null
const atlasPlan = JSON.parse(readFileSync(join(root, 'lib/client-presentation/generated/atlas-plan.json'), 'utf8'))
const atlasVideoDir = arg('atlas-video', 'D:/client-presentation-assets/atlas-video')
const { mid: atlasMid, gallery: atlasGallery } = atlasOrder(atlas, atlasPlan)

const S = (n) => deck.slides.find((s) => s.n === n)
const L = (s, role) => s.lines.filter((l) => l.role === role)
const T = (s, role) => L(s, role)[0]?.text ?? ''
const Ts = (s, role) => L(s, role).map((l) => l.text)
const split = (t) => { const i = t.indexOf(': '); return i < 0 ? [t, ''] : [t.slice(0, i), t.slice(i + 2)] }

function make(slidesToBuild) {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = deck.title; pptx.company = 'ScholarClone'; pptx.subject = 'Client presentation'
  const idx = new Map() // slide number -> pptx slide index (1-based)
  const order = slidesToBuild.map((n) => (typeof n === 'string' ? Number(n.slice(1)) : n))
  const at = (n) => { const i = order.indexOf(n); return i < 0 ? n : i + 1 } // where slide n sits in this file
  const add = (n, theme, build) => {
    const sl = pptx.addSlide(); idx.set(n, pptx.slides.length)
    sl.background = { color: theme === 'ink' ? C.ink : C.paper }
    sl.theme = theme
    build(sl)
    return sl
  }
  const fg = (sl) => (sl.theme === 'ink' ? C.onInk : C.tInk)
  const sub = (sl) => (sl.theme === 'ink' ? C.soft : C.tBody)
  const text = (sl, t, x, y, w, h, o = {}) => sl.addText(t, { x: P(x), y: P(y), w: P(w), h: P(h), margin: 0, valign: 'top', fontFace: BODY, color: sub(sl), fontSize: PT(26), isTextBox: true, ...o })
  const head = (sl, t, x, y, w, h, px = 70, o = {}) => text(sl, t, x, y, w, h, { fontFace: HEAD, fontSize: PT(px), color: sl.theme === 'ink' ? 'FFFFFF' : C.tInk, ...o })
  const rect = (sl, x, y, w, h, o = {}) => sl.addShape(pptx.ShapeType.rect, { x: P(x), y: P(y), w: P(w), h: P(h), ...o })
  const line = (sl, x1, y1, x2, y2, o = {}) => sl.addShape(pptx.ShapeType.line, { x: P(Math.min(x1, x2)), y: P(Math.min(y1, y2)), w: P(Math.abs(x2 - x1)), h: P(Math.abs(y2 - y1)), flipV: (y2 < y1) !== (x2 < x1), line: { color: C.blueD, width: 2.5, ...o.line }, ...o })
  const tag = (sl, t, x, y, w = 760) => {
    rect(sl, x, y, w, 46, { fill: { type: 'none' }, line: { color: sl.theme === 'ink' ? C.soft : C.tInk, width: 1.5 } })
    text(sl, t.toUpperCase(), x + 14, y, w - 28, 46, { valign: 'middle', bold: true, fontSize: 10, color: sl.theme === 'ink' ? C.onInk : C.tInk, charSpacing: 1 })
  }
  const photo = (sl, slot, x, y, w, h, o = {}) => {
    const a = img[slot]; if (!a) return false
    sl.addImage({ path: a.path, x: P(x), y: P(y), w: P(w), h: P(h), sizing: { type: 'cover', w: P(w), h: P(h) }, altText: a.alt, ...o })
    if (a.credit) text(sl, a.credit, x + 14, y + h - 40, w - 28, 28, { fontSize: 8, color: 'FFFFFF', align: 'right', valign: 'bottom' })
    return true
  }
  const clipsDir = join(root, 'public/client-presentation/clips')
  const clip = (sl, id, x, y, w, h) => {
    const mp4 = join(clipsDir, `${id}-h-hidden.mp4`); const poster = join(clipsDir, `${id}-h-hidden-poster.jpg`)
    const ch = Math.min(h, (w * 9) / 16); const cy = y + (h - ch) / 2
    if (!existsSync(mp4) || !existsSync(poster)) { rect(sl, x, cy, w, ch, { fill: { color: C.navy }, line: { type: 'none' } }); return }
    sl.addMedia({ type: 'video', path: mp4, cover: 'data:image/jpeg;base64,' + readFileSync(poster).toString('base64'), x: P(x), y: P(cy), w: P(w), h: P(ch) })
  }
  const ret = (sl, rx = 140) => { if (!idx.has(4)) return; sl.addText('↩ Return to the journey', { x: P(rx), y: P(1030), w: P(420), h: P(36), margin: 0, fontFace: BODY, fontSize: 11, color: sl.theme === 'ink' ? '9FD0FF' : C.blueD, hyperlink: { slide: idx.get(4) ?? 4, tooltip: 'Back to slide 4' }, underline: true, isTextBox: true }) }
  const notes = (sl, s, extra = '') => sl.addNotes([`SAY: ${s.say}`, `ASK: ${s.ask}`, s.transition ? `THEN: ${s.transition}` : '', (s.limits ?? []).length ? `CAREFUL (presenter only): ${s.limits.join(' ')}` : '', extra].filter(Boolean).join('\n\n'))
  const scenarioFor = { 14: 'principal', 8: 'student', 10: 'teacher', 11: 'decision', 12: 'career' }

  const B = {
    1: () => { const s = S(1); const sl = add(1, 'ink', (sl) => {
      if (!photo(sl, 'img-hook', 0, 0, 1920, 1080)) rect(sl, 0, 0, 1920, 1080, { fill: { color: C.navy } })
      rect(sl, 0, 0, 1500, 1080, { fill: { color: C.ink, transparency: 22 }, line: { type: 'none' } })
      head(sl, T(s, 'headline'), 140, 300, 1180, 320, 126)
      text(sl, T(s, 'support'), 140, 640, 900, 140, { fontSize: PT(40), color: 'DCE9F7' })
      text(sl, T(s, 'closing'), 140, 900, 780, 100, { fontSize: PT(27), color: C.soft })
    }); notes(sl, s) },
    2: () => { const s = S(2); const sl = add(2, 'ink', (sl) => {
      head(sl, T(s, 'headline'), 140, 150, 780, 440, 80)
      const pos = [[1610, 215], [1745, 440], [1700, 690], [1545, 880], [1235, 905], [1065, 745], [1045, 480], [1235, 250]]
      Ts(s, 'ring').forEach((t, i) => { rect(sl, pos[i][0] - 150, pos[i][1] - 28, 300, 56, { fill: { color: 'EAF2FB' }, line: { type: 'none' } }); text(sl, t, pos[i][0] - 150, pos[i][1] - 28, 300, 56, { align: 'center', valign: 'middle', bold: true, color: C.tInk, fontSize: 14 }) })
      line(sl, 1745, 440, 1235, 905, { line: { color: '9FD0FF', width: 3 } })
      text(sl, T(s, 'support'), 166, 740, 700, 200, { fontSize: PT(34), color: 'DCE9F7' }); rect(sl, 140, 740, 4, 150, { fill: { color: C.blue }, line: { type: 'none' } })
    }); notes(sl, s) },
    3: () => { const s = S(3); const sl = add(3, 'paper', (sl) => {
      photo(sl, 'img-student', 140, 110, 640, 860)
      head(sl, T(s, 'headline'), 880, 100, 900, 190, 62)
      tag(sl, T(s, 'tag'), 880, 296, 760)
      Ts(s, 'card').forEach((t, i) => { rect(sl, 880 + i * 8, 450 + i * 52, 330, 112, { fill: { color: 'FFFDF6' }, line: { color: 'CBD2DA', width: 0.75 } }); text(sl, t, 902 + i * 8, 462 + i * 52, 290, 40, { bold: true, color: C.tInk, fontSize: 13 })
        rect(sl, 1290 + i * 8, 450 + i * 52, 330, 112, { fill: { color: C.blueD }, line: { type: 'none' } }); text(sl, t, 1312 + i * 8, 462 + i * 52, 290, 40, { bold: true, color: 'FFFFFF', fontSize: 13 }) })
      line(sl, 1650, 548, 1872, 548, { line: { color: C.blueD, width: 3.5, endArrowType: 'triangle' } })
      text(sl, T(s, 'compare-left'), 880, 690, 360, 140, { fontSize: PT(30), color: C.tBody })
      text(sl, T(s, 'compare-right'), 1290, 690, 520, 170, { fontSize: PT(30), color: C.tInk, bold: true })
    }); notes(sl, s, 'Illustrative situation: never present as a real customer.') },
    4: () => { const s = S(4); const sl = add(4, 'ink', (sl) => {
      head(sl, T(s, 'headline'), 140, 96, 1400, 130, 86)
      const steps = Ts(s, 'step'); const x = (i) => 230 + i * 292
      line(sl, x(0), 440, x(5), 440, { line: { color: C.blue, width: 4 } })
      steps.forEach((t, i) => { sl.addShape(pptx.ShapeType.ellipse, { x: P(x(i) - 15), y: P(425), w: P(30), h: P(30), fill: { color: i === 5 ? C.blue : 'FFFFFF' }, line: { type: 'none' } }); text(sl, `0${i + 1}`, x(i) - 140, 475, 280, 30, { align: 'center', bold: true, color: '7FB6FF', fontSize: 10 }); text(sl, t, x(i) - 140, 510, 280, 70, { align: 'center', bold: true, color: C.onInk, fontSize: 14 }) })
      head(sl, T(s, 'chooser'), 140, 690, 1640, 90, 52, { align: 'center' })
      const chips = Ts(s, 'chip'); const to = [14, 8, 10, 11, 12]
      chips.forEach((t, i) => { const col = i < 3 ? i : i - 3; const row = i < 3 ? 0 : 1; const cx = i < 3 ? 140 + col * 554 : 417 + col * 554; const cy = 810 + row * 110
        sl.addShape(pptx.ShapeType.roundRect, { x: P(cx), y: P(cy), w: P(532), h: P(92), rectRadius: 0.12, fill: { color: '0B2540' }, line: { color: '9FD0FF', width: 1.25 } })
        sl.addText(`0${i + 1}   ${t}`, { x: P(cx + 24), y: P(cy), w: P(490), h: P(92), margin: 0, valign: 'middle', fontFace: BODY, bold: true, fontSize: 14, color: 'FFFFFF', hyperlink: { slide: at(to[i]), tooltip: t }, isTextBox: true }) })
    }); notes(sl, s, 'Slide-show mode (F5): the five chips jump to the scenario slides; each has a link back here. Nothing is scored.') },
    5: () => { const s = S(5); const sl = add(5, 'ink', (sl) => {
      if (img['img-logo']) sl.addImage({ path: img['img-logo'].path, x: P(190), y: P(240), w: P(520), h: P(520), altText: img['img-logo'].alt })
      text(sl, T(s, 'brand').toUpperCase(), 900, 130, 800, 50, { bold: true, color: '7FB6FF', fontSize: 16, charSpacing: 8 })
      head(sl, T(s, 'headline'), 900, 200, 880, 330, 58)
      text(sl, T(s, 'definition'), 930, 560, 850, 190, { fontSize: PT(31), color: 'CFDCED' }); rect(sl, 900, 560, 4, 150, { fill: { color: C.blue }, line: { type: 'none' } })
    }); notes(sl, s) },
    6: () => { const s = S(6); const sl = add(6, 'ink', (sl) => {
      head(sl, T(s, 'headline'), 140, 54, 840, 140, 54)
      text(sl, T(s, 'note'), 1044, 84, 736, 110, { fontSize: PT(26), color: 'CFDCED' }); rect(sl, 1020, 84, 4, 90, { fill: { color: C.blue }, line: { type: 'none' } })
      rect(sl, 100, 232, 1720, 770, { fill: { type: 'none' }, line: { color: '9FD0FF', width: 1.75, dashType: 'dash' } })
      const prods = L(s, 'product').map((l) => ({ ...(([a, b]) => ({ name: a, desc: b }))(split(l.text)) }))
      const by = (n) => prods.find((p) => p.name === n); const to = { 'Scholar Core': 7, 'Scholar Learn': 8, 'Scholar CCB': 10, 'Scholar Insight': 11, 'Scholar Compass': 12 }
      const one = by('Scholar One'); rect(sl, 150, 204, 900, 60, { fill: { color: C.ink }, line: { type: 'none' } })
      text(sl, `${one.name}   ${one.desc}`, 170, 204, 600, 60, { valign: 'middle', fontFace: HEAD, fontSize: 15, color: 'FFFFFF' });
      const tile = (n, x, y, w, h, fill, border) => { const p = by(n); rect(sl, x, y, w, h, { fill: { color: fill }, line: { color: border, width: 1.25 } })
        sl.addText(p.name, { x: P(x + 40), y: P(y + 18), w: P(w - 80), h: P(70), margin: 0, fontFace: HEAD, fontSize: 24, color: 'FFFFFF', hyperlink: { slide: at(to[n]), tooltip: `Open ${n}` }, isTextBox: true })
        text(sl, p.desc, x + 40, y + 92, w - 80, 50, { fontSize: 13, color: C.soft }) }
      tile('Scholar Insight', 160, 290, 1600, 150, '0B3C73', '4A7FB5')
      ;['Scholar Learn', 'Scholar CCB', 'Scholar Compass'].forEach((n, i) => tile(n, 160 + i * 543, 482, 514, 232, '12294A', '1088F6'))
      tile('Scholar Core', 160, 746, 1600, 170, '163A22', '74CD23')
    }); notes(sl, s, 'Product names are links to each product slide (slide-show mode).') },
    16: () => { const s = S(16); const sl = add(16, 'ink', (sl) => {
      head(sl, T(s, 'headline'), 140, 96, 1640, 110, 76)
      const names = [['core', 'Scholar Core', 'Intelligent School Operations', 7], ['learn', 'Scholar Learn', 'AI-Powered Personalised Learning', 8], ['ccb', 'Scholar CCB', 'Competence and Capability Intelligence', 10], ['insight', 'Scholar Insight', 'School Intelligence', 11], ['compass', 'Scholar Compass', 'Student Career Intelligence', 12]]
      names.forEach(([id, nm, desc, target], k) => {
        const col = k < 3 ? k : k - 3; const row = k < 3 ? 0 : 1; const x = k < 3 ? 140 + col * 560 : 420 + col * 560; const y = 270 + row * 340
        const poster = join(clipsDir, `${id}-h-hidden-poster.jpg`)
        if (existsSync(poster)) sl.addImage({ path: poster, x: P(x), y: P(y), w: P(520), h: P(292.5), altText: `${nm}: explainer clip`, hyperlink: { slide: at(target), tooltip: `Open ${nm}` } })
        text(sl, `${nm}   ${desc}`, x, y + 300, 520, 34, { fontSize: 12, bold: true, color: C.onInk })
      })
      text(sl, T(s, 'note'), 140, 975, 1100, 36, { fontSize: PT(26), color: C.soft })
    }); notes(sl, s, 'Click a picture to open that product slide; the clip plays there. In the web deck each product plays on this slide.') },
    17: () => { const s = S(17); const sl = add(17, 'ink', (sl) => {
      const mp4 = join(root, 'public/client-presentation/film/scholarclone-59s.mp4'); const poster = join(root, 'public/client-presentation/film/scholarclone-59s-poster.jpg')
      if (existsSync(mp4) && existsSync(poster)) sl.addMedia({ type: 'video', path: mp4, cover: 'data:image/jpeg;base64,' + readFileSync(poster).toString('base64'), x: 0, y: 0, w: 13.333, h: 7.5 })
      else { rect(sl, 0, 0, 1920, 1080, { fill: { color: C.navy }, line: { type: 'none' } }); head(sl, T(s, 'headline'), 140, 400, 1640, 160, 90) }
    }); notes(sl, s, 'The film starts by itself when this slide opens (silent; the words are on the screen). Click the picture to play it again.') },
    7: () => { const s = S(7); const sl = add(7, 'paper', (sl) => {
      head(sl, T(s, 'headline'), 140, 110, 780, 220, 60)
      L(s, 'row').forEach((l, i) => { const [n, d] = split(l.text); const y = 380 + i * 150; line(sl, 140, y, 920, y, { line: { color: 'B5BCC4', width: 1 } }); text(sl, `0${i + 1}`, 140, y + 26, 50, 40, { bold: true, color: C.blueD, fontSize: 11 }); head(sl, n, 202, y + 16, 700, 60, 42); text(sl, d.charAt(0).toUpperCase() + d.slice(1), 202, y + 80, 700, 64, { fontSize: PT(26), color: C.tBody }) })
      text(sl, T(s, 'situation'), 158, 830, 760, 80, { fontSize: PT(23), color: C.tBody }); text(sl, T(s, 'value'), 158, 925, 760, 80, { fontSize: PT(23), bold: true, color: C.tInk })
      clip(sl, 'core', 1000, 190, 780, 439)
      text(sl, T(s, 'more'), 1000, 800, 780, 110, { fontSize: PT(28), bold: true, color: C.tInk })
    }); notes(sl, s); ret(sl) },
    8: () => { const s = S(8); const sl = add(8, 'ink', (sl) => {
      head(sl, T(s, 'headline'), 140, 110, 1500, 110, 76)
      const x = (i) => 210 + i * 250; line(sl, x(0), 380, x(6), 380, { line: { color: C.blue, width: 4 } })
      Ts(s, 'step').forEach((t, i) => { sl.addShape(pptx.ShapeType.ellipse, { x: P(x(i) - 15), y: P(365), w: P(30), h: P(30), fill: { color: 'FFFFFF' }, line: { type: 'none' } }); text(sl, `0${i + 1}`, x(i) - 120, 420, 240, 30, { align: 'center', bold: true, color: '7FB6FF', fontSize: 10 }); text(sl, t, x(i) - 120, 455, 240, 100, { align: 'center', bold: true, color: C.onInk, fontSize: 13 }) })
      rect(sl, 140, 720, 1000, 184, { fill: { color: '10281C' }, line: { color: C.green, width: 1.25 } }); rect(sl, 140, 720, 8, 184, { fill: { color: C.green }, line: { type: 'none' } })
      text(sl, T(s, 'today'), 182, 748, 930, 140, { fontSize: PT(30), color: C.onInk })
      clip(sl, 'learn', 1240, 676, 540, 304)
    }); notes(sl, s); ret(sl) },
    9: () => { const s = S(9); const sl = add(9, 'paper', (sl) => {
      photo(sl, 'img-teacher', 1100, 0, 820, 1080)
      head(sl, T(s, 'headline'), 140, 100, 860, 190, 64)
      Ts(s, 'row').forEach((t, i) => { rect(sl, 140, 330 + i * 92, 3, 78, { fill: { color: C.blueD }, line: { type: 'none' } }); text(sl, t, 162, 330 + i * 92, 840, 84, { fontSize: PT(27), color: C.tBody }) })
      rect(sl, 140, 628, 270, 80, { fill: { color: C.tInk }, line: { type: 'none' } }); text(sl, T(s, 'source'), 140, 628, 270, 80, { align: 'center', valign: 'middle', bold: true, color: 'FFFFFF', fontSize: 13 })
      Ts(s, 'output').forEach((t, i) => { const y = 606 + i * 62; line(sl, 410, 668, 640, y + 25, { line: { color: C.blueD, width: 2.5 } }); rect(sl, 640, y, 330, 52, { fill: { color: 'FFFDF6' }, line: { color: C.blueD, width: 1.25 } }); text(sl, t, 640, y, 330, 52, { align: 'center', valign: 'middle', bold: true, color: C.tInk, fontSize: 13 }) })
      text(sl, T(s, 'value'), 140, 800, 860, 110, { fontSize: PT(26), color: C.tBody }); head(sl, T(s, 'principle'), 140, 925, 860, 96, 40, { italic: true, color: C.blueD })
    }); notes(sl, s); ret(sl) },
    10: () => { const s = S(10); const sl = add(10, 'paper', (sl) => {
      head(sl, T(s, 'headline'), 140, 110, 740, 210, 62); tag(sl, T(s, 'tag'), 140, 686, 720)
      rect(sl, 140, 760, 720, 200, { fill: { color: 'E8EDDC' }, line: { color: C.greenD, width: 1 } }); rect(sl, 140, 760, 8, 200, { fill: { color: C.greenD }, line: { type: 'none' } }); text(sl, T(s, 'today'), 178, 782, 660, 160, { fontSize: PT(27), color: C.tInk })
      line(sl, 1000, 150, 1000, 610, { line: { color: C.blueD, width: 3 } })
      L(s, 'step').forEach((l, i) => { const y = 120 + i * 92; sl.addShape(pptx.ShapeType.ellipse, { x: P(988), y: P(y + 16), w: P(24), h: P(24), fill: { color: C.blueD }, line: { type: 'none' } }); text(sl, `0${i + 1}`, 1060, y + 14, 50, 36, { bold: true, color: C.blueD, fontSize: 11 }); head(sl, l.text, 1112, y, 480, 60, 44) })
      clip(sl, 'ccb', 1172, 656, 608, 342)
    }); notes(sl, s, 'Illustrative teacher situation: use an unnamed teacher.'); ret(sl) },
    11: () => { const s = S(11); const sl = add(11, 'ink', (sl) => {
      head(sl, T(s, 'headline'), 140, 110, 1100, 190, 66); tag(sl, T(s, 'tag'), 1230, 150, 560)
      L(s, 'step').forEach((l, i) => { const y = 330 + i * 77; line(sl, 140, y, 660, y, { line: { color: '2A4160', width: 1 } }); sl.addShape(pptx.ShapeType.ellipse, { x: P(142), y: P(y + 22), w: P(16), h: P(16), fill: { color: '9FD0FF' }, line: { type: 'none' } }); text(sl, `0${i + 1}`, 184, y + 20, 50, 30, { bold: true, color: '7FB6FF', fontSize: 10 }); text(sl, l.text, 240, y + 12, 420, 50, { bold: true, color: C.onInk, fontSize: 14 }) })
      const ty = [350, 470, 590]; const dy = [360, 470, 580]
      Ts(s, 'thread').forEach((t, i) => { text(sl, t, 690, ty[i] - 26, 190, 52, { align: 'right', valign: 'middle', bold: true, color: C.onInk, fontSize: 11 }); line(sl, 900, ty[i], 1015, 470, { line: { color: '9FD0FF', width: 3 } }) })
      sl.addShape(pptx.ShapeType.ellipse, { x: P(1015), y: P(375), w: P(190), h: P(190), fill: { color: C.blue }, line: { type: 'none' } }); text(sl, T(s, 'case'), 1030, 375, 160, 190, { align: 'center', valign: 'middle', bold: true, color: 'FFFFFF', fontSize: 12 })
      Ts(s, 'decision').forEach((t, i) => { line(sl, 1205, 470, 1390, dy[i], { line: { color: '9FD0FF', width: 3 } }); rect(sl, 1390, dy[i] - 28, 230, 56, { fill: { color: '0B2540' }, line: { color: '9FD0FF', width: 1.25 } }); text(sl, t, 1390, dy[i] - 28, 230, 56, { align: 'center', valign: 'middle', bold: true, color: 'FFFFFF', fontSize: 15 }) })
      text(sl, T(s, 'limit'), 690, 668, 560, 80, { italic: true, bold: true, color: '9FD0FF', fontSize: 13 })
      rect(sl, 140, 760, 1010, 190, { fill: { color: '10281C' }, line: { color: C.green, width: 1 } }); rect(sl, 140, 760, 8, 190, { fill: { color: C.green }, line: { type: 'none' } }); text(sl, T(s, 'today'), 176, 780, 950, 160, { fontSize: PT(25), color: C.onInk })
      clip(sl, 'insight', 1265, 735, 515, 290)
    }); notes(sl, s, 'Do not describe this as a forecast or as finding students early. The comparison shows a link, not a cause.'); ret(sl) },
    12: () => { const s = S(12); const sl = add(12, 'paper', (sl) => {
      head(sl, T(s, 'headline'), 860, 110, 920, 150, 62)
      photo(sl, 'img-counsel', 140, 100, 600, 400); tag(sl, T(s, 'tag'), 140, 530, 600); clip(sl, 'compass', 140, 640, 600, 337)
      Ts(s, 'row').forEach((t, i) => { rect(sl, 860, 300 + i * 92, 3, 80, { fill: { color: C.blueD }, line: { type: 'none' } }); text(sl, t, 882, 300 + i * 92, 898, 84, { fontSize: PT(26), color: C.tBody }) })
      const c = Ts(s, 'circle'); sl.addShape(pptx.ShapeType.ellipse, { x: P(930), y: P(536), w: P(260), h: P(260), fill: { color: C.blueD, transparency: 82 }, line: { color: C.blueD, width: 2 } }); sl.addShape(pptx.ShapeType.ellipse, { x: P(1090), y: P(536), w: P(260), h: P(260), fill: { color: C.greenD, transparency: 80 }, line: { color: C.greenD, width: 2 } })
      text(sl, c[0], 950, 636, 130, 60, { align: 'center', bold: true, color: C.tInk, fontSize: 12 }); text(sl, c[1], 1200, 626, 130, 80, { align: 'center', bold: true, color: C.tInk, fontSize: 12 })
      rect(sl, 1010, 488, 260, 44, { fill: { color: C.paper }, line: { color: C.tInk, width: 1.25 } }); text(sl, `◆ ${T(s, 'aspiration')}`, 1010, 488, 260, 44, { align: 'center', valign: 'middle', bold: true, color: C.tInk, fontSize: 11 })
      Ts(s, 'result').forEach((t, i) => { rect(sl, 1480, 560 + i * 88, 320, 74, { fill: { color: i === 2 ? C.tInk : 'FFFFFF' }, line: { color: i === 2 ? C.tInk : 'B5BCC4', width: 1.25, dashType: i === 2 ? 'dash' : 'solid' } }); text(sl, t, 1500, 560 + i * 88, 280, 74, { valign: 'middle', bold: true, color: i === 2 ? 'FFFFFF' : C.tBody, fontSize: 13 }) })
      text(sl, T(s, 'limit'), 860, 930, 920, 60, { italic: true, bold: true, color: C.tInk, fontSize: 13 })
    }); notes(sl, s, 'Lead with the honest part: when there is not enough evidence the product says so.'); ret(sl) },
    13: () => { const s = S(13); const sl = add(13, 'ink', (sl) => {
      head(sl, T(s, 'headline'), 140, 110, 760, 270, 72)
      const N = [[1000, 380, 'above'], [1180, 680, 'left'], [1680, 380, 'above'], [1680, 840, 'below']]
      const cx = { color: '9FD0FF', width: 3.5 }
      line(sl, 1180, 680, 1680, 840, { line: cx }); line(sl, 1000, 380, 1680, 380, { line: cx }); line(sl, 1180, 680, 1680, 380, { line: cx })
      Ts(s, 'node').forEach((t, i) => { const [px, py, where] = N[i]; sl.addShape(pptx.ShapeType.ellipse, { x: P(px - 15), y: P(py - 15), w: P(30), h: P(30), fill: { color: 'FFFFFF' }, line: { type: 'none' } })
        if (where === 'left') text(sl, t, px - 340, py - 18, 300, 40, { align: 'right', bold: true, color: 'FFFFFF', fontSize: 15 })
        else text(sl, t, px - 170, where === 'above' ? py - 62 : py + 28, 340, 40, { align: 'center', bold: true, color: 'FFFFFF', fontSize: 15 }) })
      const num = [[1440, 790], [1340, 380], [1445, 508]]; num.forEach(([nx, ny], i) => { sl.addShape(pptx.ShapeType.ellipse, { x: P(nx - 22), y: P(ny - 22), w: P(44), h: P(44), fill: { color: '9FD0FF' }, line: { color: C.ink, width: 2 } }); text(sl, String(i + 1), nx - 22, ny - 22, 44, 44, { align: 'center', valign: 'middle', bold: true, color: C.ink, fontSize: 11 }) })
      Ts(s, 'link-built').forEach((t, i) => { text(sl, `${i + 1}   ${t}`, 140, 430 + i * 150, 700, 130, { fontSize: PT(30), color: C.onInk }) })
    }); notes(sl, s) },
    14: () => { const s = S(14); const sl = add(14, 'paper', (sl) => {
      photo(sl, 'img-arrival', 0, 0, 760, 1080)
      text(sl, s.section.toUpperCase(), 860, 80, 800, 36, { bold: true, color: C.blueD, fontSize: 12, charSpacing: 4 }); head(sl, T(s, 'headline'), 860, 124, 920, 120, 80); tag(sl, T(s, 'tag'), 860, 262, 640)
      const q = Ts(s, 'q'); const a = L(s, 'q-answer')
      q.forEach((t, i) => { const y = 350 + i * 108; line(sl, 860, y, 1800, y, { line: { color: 'B5BCC4', width: 1 } }); text(sl, `0${i + 1}`, 860, y + 22, 40, 34, { bold: true, color: C.blueD, fontSize: 11 }); text(sl, t, 918, y + 14, 880, 44, { bold: true, color: C.tInk, fontSize: PT(36) })
        const [nm] = a[i].text.split(' · '); text(sl, nm, 918, y + 62, 520, 36, { bold: true, color: C.tBody, fontSize: 13 }) })
      rect(sl, 860, 905, 8, 110, { fill: { color: C.blueD }, line: { type: 'none' } }); text(sl, T(s, 'note'), 892, 920, 880, 84, { fontSize: PT(25), color: C.tBody })
    }); notes(sl, s, 'Illustrative scenario, not a customer case.'); ret(sl, 860) },
    ...Object.fromEntries((deck.appendix ?? []).map((a, k) => [101 + k, () => { const sl = add(101 + k, 'paper', (sl) => {
      head(sl, a.title, 140, 80, 1640, 110, 62)
      const rows = a.lines; const top = 230; const rh = Math.min(150, Math.floor(760 / rows.length))
      rows.forEach((l, i) => { const y = top + i * rh; line(sl, 140, y, 1780, y, { line: { color: 'B5BCC4', width: 1 } })
        if (l.role === 'qa') { text(sl, l.q, 140, y + 14, 1640, 44, { bold: true, color: C.blueD, fontSize: PT(30) }); text(sl, l.a, 140, y + 62, 1640, rh - 70, { fontSize: PT(27), color: C.tBody }) }
        else { text(sl, l.label.toUpperCase(), 140, y + 18, 420, 40, { bold: true, color: C.blueD, fontSize: 12, charSpacing: 2 }); text(sl, l.text, 600, y + 14, 1180, rh - 20, { fontSize: PT(27), color: C.tBody }) } })
    }); sl.addNotes([a.notes, 'Every row rests on a verified claim in the product reality ledger (docs/client-presentation/02).'].filter(Boolean).join('\n\n')); ret(sl) }])),
    15: () => { const s = S(15); const sl = add(15, 'ink', (sl) => {
      if (!photo(sl, 'img-hook', 0, 0, 1920, 1080)) rect(sl, 0, 0, 1920, 1080, { fill: { color: C.navy } })
      rect(sl, 0, 0, 1920, 1080, { fill: { color: C.ink, transparency: 35 }, line: { type: 'none' } }); rect(sl, 0, 560, 1920, 520, { fill: { color: C.ink, transparency: 15 }, line: { type: 'none' } })
      head(sl, T(s, 'headline'), 140, 92, 1180, 250, 104); text(sl, T(s, 'support'), 140, 350, 1000, 110, { fontSize: PT(38), color: 'DCE9F7' })
      Ts(s, 'item').forEach((t, i) => { const m = /^(\d)\.\s+(.*)$/.exec(t); line(sl, 140 + i * 410, 770, 140 + i * 410 + 370, 770, { line: { color: 'FFFFFF', width: 1.5 } }); text(sl, m ? `${m[1]}.  ${m[2]}` : t, 140 + i * 410, 790, 370, 150, { bold: true, color: 'FFFFFF', fontSize: 14 }) })
      text(sl, T(s, 'close'), 140, 990, 900, 50, { bold: true, color: 'FFFFFF', fontSize: PT(31) })
      rect(sl, 1330, 975, 450, 60, { fill: { type: 'none' }, line: { color: 'DCE9F7', width: 1.5, dashType: 'dash' } }); text(sl, T(s, 'contact'), 1330, 975, 450, 60, { align: 'center', valign: 'middle', color: 'DCE9F7', fontSize: 11 })
    }); notes(sl, s) },
  }
  const SHORT2 = () => { const s = S(2); const s4 = S(4); const sl = add(2, 'ink', (sl) => {
    head(sl, T(s, 'headline'), 140, 96, 1500, 200, 70)
    let x = 140; let y = 330; Ts(s, 'ring').forEach((t) => { const w = Math.max(150, t.length * 17 + 50); if (x + w > 1700) { x = 140; y += 76 } rect(sl, x, y, w, 56, { fill: { color: 'EAF2FB' }, line: { type: 'none' } }); text(sl, t, x, y, w, 56, { align: 'center', valign: 'middle', bold: true, color: C.tInk, fontSize: 13 }); x += w + 14 })
    text(sl, T(s, 'support'), 166, 510, 1100, 110, { fontSize: PT(32), color: 'DCE9F7' }); rect(sl, 140, 510, 4, 90, { fill: { color: C.blue }, line: { type: 'none' } })
    const st = Ts(s4, 'step'); const xx = (i) => 230 + i * 292; line(sl, xx(0), 800, xx(5), 800, { line: { color: C.blue, width: 4 } })
    st.forEach((t, i) => { sl.addShape(pptx.ShapeType.ellipse, { x: P(xx(i) - 14), y: P(786), w: P(28), h: P(28), fill: { color: i === 5 ? C.blue : 'FFFFFF' }, line: { type: 'none' } }); text(sl, `0${i + 1}`, xx(i) - 140, 836, 280, 28, { align: 'center', bold: true, color: '7FB6FF', fontSize: 10 }); text(sl, t, xx(i) - 140, 868, 280, 70, { align: 'center', bold: true, color: C.onInk, fontSize: 13 }) })
  }); notes(sl, s, `Also: ${s4.say}`) }
  const SHORT3 = () => { const s = S(5); const s6 = S(6); const sl = add(5, 'ink', (sl) => {
    if (img['img-logo']) sl.addImage({ path: img['img-logo'].path, x: P(140), y: P(130), w: P(330), h: P(330), altText: img['img-logo'].alt })
    text(sl, T(s, 'brand').toUpperCase(), 140, 500, 600, 40, { bold: true, color: '7FB6FF', fontSize: 14, charSpacing: 8 }); head(sl, T(s, 'headline'), 140, 560, 760, 330, 44)
    L(s6, 'product').forEach((l, i) => { const [n, d] = split(l.text); const y = 120 + i * 132; line(sl, 1000, y, 1780, y, { line: { color: '3A5878', width: 1 } }); head(sl, n, 1000, y + 14, 520, 60, 40); text(sl, d, 1000, y + 76, 520, 40, { fontSize: 12, color: C.soft }) })
  }); notes(sl, s, `Also: ${S(6).say}`) }
  const AB = atlasBuilders({ add, text, head, rect, line, C, HEAD, pptx, PT }, atlas, atlasNotes, imgOfSub, atlasVideoDir)
  const atlasFn = (n) => {
    const it = [...atlasMid, ...atlasGallery].find((x) => x.n === n); if (!it) return null
    if (it.kind === 'video') return AB.video(n, it.key, it.title)
    if (it.kind === 'big') return AB[n]
    if (it.kind === 'intro') return AB.intro(n, it.p)
    if (it.kind === 'sub') return AB.sub(n, it.p, it.s)
    if (it.kind === 'gallery') return AB.gallery(n, it.p)
    return AB[n]
  }
  for (const n of slidesToBuild) (typeof n === 'string' ? { s2: SHORT2, s5: SHORT3 }[n] : (B[n] ?? atlasFn(n)))()
  return pptx
}

async function finish(pptx, file) {
  const path = join(outDir, file)
  await pptx.writeFile({ fileName: path })
  // Start every video by itself when its slide opens (pptxgenjs has no option for it): the timing block PowerPoint writes for
  // "Start: Automatically" on a video, aimed at the picture shape that holds the video. Clicking the video still works.
  const timing = (spid) => `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst><p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="5" presetID="1" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="afterEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="6" dur="1" fill="hold"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq><p:video><p:cMediaNode vol="80000"><p:cTn id="7" fill="hold" display="0"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:endCondLst><p:cond evt="onStopAudio" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:endCondLst></p:cTn><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cMediaNode></p:video></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`
  const AUTOPLAY = !process.argv.includes('--no-autoplay')
  // Add a fade transition to every slide (pptxgenjs has no transition API): <p:transition> goes after <p:clrMapOvr>.
  const zip = await JSZip.loadAsync(readFileSync(path), { createFolders: false })
  for (const name of Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))) {
    let x = await zip.file(name).async('string')
    if (!x.includes('<p:transition')) x = x.replace('</p:clrMapOvr>', '</p:clrMapOvr><p:transition spd="med"><p:fade/></p:transition>')
    const pic = AUTOPLAY ? /<p:pic>(?:(?!<\/p:pic>)[\s\S])*?<p:cNvPr id="(\d+)"(?:(?!<\/p:pic>)[\s\S])*?<a:videoFile/.exec(x) : null
    if (pic && !x.includes('<p:timing')) x = x.replace('</p:transition>', '</p:transition>' + timing(pic[1]))
    zip.file(name, x)
  }
  // Rewrite without the folder entries pptxgenjs/JSZip add (some cloud viewers refuse them); files only, [Content_Types].xml first.
  const clean = new JSZip()
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort((a, b) => (a === '[Content_Types].xml' ? -1 : b === '[Content_Types].xml' ? 1 : 0))
  for (const n of names) clean.file(n, await zip.files[n].async('nodebuffer'), { createFolders: false })
  writeFileSync(path, await clean.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
  console.log('wrote', path)
}

// The atlas sits after the principal's-day slide and before the invitation, as in the web deck; the screen gallery is the last slides of the file.
await finish(make([1, 2, 3, 4, 5, 17, 6, 16, 7, 8, 9, 10, 11, 12, 13, 14, ...atlasMid.map((x) => x.n), 15, 101, 102, 103, 104, ...atlasGallery.map((x) => x.n)]), 'ScholarClone-Client-Presentation.pptx')
await finish(make([1, 's2', 's5', 14, 15]), 'ScholarClone-Client-Presentation-Short.pptx')
