// The Product Atlas slides of the editable PowerPoint, built from the same data as the web deck (lib/client-presentation/generated/atlas.json).
// Organised BY PRODUCT, like the web deck: a hub slide with one link per product, then for each product its opener, its sub-modules, a "how it
// works" slide and its screens. Every slide has a product rail (links to the hub and to each product) and a "next product" link, so a client
// interested in one module can jump straight to it and skip the others. Each web slide also has an autoplay video slide (render-atlas.mjs)
// ahead of its editable slide(s). PowerPoint cannot run the web deck's motion, so the motion lives in the web deck and in the rendered videos.
// Used by build-pptx.mjs: atlasOrder(...) gives the slide order, atlasBuilders(...) the slide builders.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function loadAtlas(root) {
  const atlas = JSON.parse(readFileSync(join(root, 'lib/client-presentation/generated/atlas.json'), 'utf8'))
  const notesPath = join(root, 'docs/client-presentation/atlas-notes.json')
  const notes = existsSync(notesPath) ? JSON.parse(readFileSync(notesPath, 'utf8')) : { products: [] }
  return { atlas, notes }
}

export const HUB_N = 500

/**
 * The order of the atlas slides in the PowerPoint, and the first slide of each product (where the rail sends you).
 * Per web slide: a video slide (n = 400 + plan index), then its editable slides: the hub; an opener; one slide per sub-module; a "how it works"
 * slide; a screens slide. The hub is editable only (it is the menu, not a film).
 */
export function atlasOrder(atlas, plan) {
  const filled = atlas.products.filter((p) => p.subs.length)
  const list = []; const firstOf = {}
  let sub = 0; let gal = 0
  plan.forEach((a, k) => {
    if (a.kind === 'hub') { list.push({ n: HUB_N, kind: 'hub' }); return }
    const pi = filled.findIndex((p) => p.key === a.family)
    const video = { n: 400 + k, kind: 'video', key: a.key, title: a.title, family: a.family }
    list.push(video)
    if (a.kind === 'opener') { firstOf[a.family] = video.n; list.push({ n: 510 + pi, kind: 'opener', family: a.family }) }
    if (a.kind === 'subs') for (const id of a.subs) list.push({ n: 600 + sub++, kind: 'sub', family: a.family, sub: id })
    if (a.kind === 'glance') list.push({ n: 520 + pi, kind: 'glance', family: a.family })
    if (a.kind === 'gallery') list.push({ n: 700 + gal++, kind: 'gallery', family: a.family, subs: a.subs })
  })
  return { list, firstOf }
}

const short = (p) => p.product.replace(/^Scholar /, '')

/** nav = { at, firstOf, endN }: at(n) is the position of slide n in this file, firstOf[family] the slide a product starts on, endN the slide after the last product. */
export function atlasBuilders(c, atlas, notes, imgOf, videoDir, nav) {
  const { add, text, head, rect, line, C, HEAD, pptx, PT } = c
  const { at, firstOf, endN } = nav
  const filled = atlas.products.filter((p) => p.subs.length)
  const prod = (k) => atlas.products.find((p) => p.key === k)
  const noteOf = (pk, id) => notes.products.find((p) => p.key === pk)?.subs.find((s) => s.id === id)
  const IN = 13.3333 / 1920
  const kicker = (sl, t) => text(sl, t.toUpperCase(), 140, 92, 1100, 34, { bold: true, color: sl.theme === 'ink' ? '9FD0FF' : C.blueD, fontSize: 12, charSpacing: 3 })

  /** The product rail and the "next product" link, drawn last so they sit above a video. */
  const chrome = (sl, family) => {
    const soft = sl.theme === 'ink' ? '9FD0FF' : C.tBody
    const link = (t, n, on) => ({ text: t, options: { hyperlink: { slide: at(n), tooltip: t }, bold: on, fontSize: 11, color: on ? C.blue : soft, underline: false } })
    const runs = [link('ALL PRODUCTS', HUB_N, !family)]
    for (const p of filled) { runs.push({ text: '    ·    ', options: { fontSize: 11, color: soft } }); runs.push(link(short(p).toUpperCase(), firstOf[p.key], family === p.key)) }
    sl.addText(runs, { x: 140 * IN, y: 24 * IN, w: 1200 * IN, h: 34 * IN, margin: 0, fontFace: 'Calibri', fontSize: 11, valign: 'middle', isTextBox: true })
    if (!family) return
    const i = filled.findIndex((p) => p.key === family)
    const last = i === filled.length - 1
    const label = last ? 'Continue ›' : `Next product: ${short(filled[i + 1])} ›`
    sl.addText(label, { x: 1380 * IN, y: 1030 * IN, w: 400 * IN, h: 34 * IN, margin: 0, align: 'right', valign: 'middle', fontFace: 'Calibri', fontSize: 12, bold: true, color: C.blue, hyperlink: { slide: at(last ? endN : firstOf[filled[i + 1].key]), tooltip: label }, isTextBox: true })
  }

  const B = {}
  B.video = (n, key, title, family) => () => {
    const mp4 = join(videoDir, `atlas-${key}.mp4`); const poster = join(videoDir, `atlas-${key}-poster.jpg`)
    const sl = add(n, 'ink', (sl) => {
      if (existsSync(mp4) && existsSync(poster)) sl.addMedia({ type: 'video', path: mp4, cover: 'data:image/jpeg;base64,' + readFileSync(poster).toString('base64'), x: 0, y: 0, w: 13.3333, h: 7.5 })
      else { rect(sl, 0, 0, 1920, 1080, { fill: { color: C.navy }, line: { type: 'none' } }); head(sl, title, 140, 420, 1640, 200, 80) }
      chrome(sl, family)
    })
    sl.addNotes(`${title}. The slide plays by itself when it opens; click the picture to play it again. The links at the top jump to any product; the link at the bottom goes to the next product. The same content, as editable text, follows.`)
  }

  B.hub = () => { const sl = add(HUB_N, 'ink', (sl) => {
    kicker(sl, 'Products')
    sl.addText([{ text: 'Choose a ', options: { color: 'FFFFFF', bold: false } }, { text: 'product', options: { color: '9FD0FF', bold: true } }], { x: 140 * IN, y: 150 * IN, w: 1640 * IN, h: 150 * IN, margin: 0, fontFace: HEAD, fontSize: PT(118), valign: 'top', isTextBox: true })
    text(sl, 'Click a product to open it, or go to the next slide to see them in order.', 140, 310, 1400, 40, { fontSize: PT(28), color: C.soft })
    const cw = 1640 / filled.length
    filled.forEach((p, i) => { const x = 140 + i * cw; const n = firstOf[p.key]
      if (i) line(sl, x - 16, 400, x - 16, 1000, { line: { color: '3A5878', width: 1 } })
      text(sl, String(i + 1).padStart(2, '0'), x, 410, 120, 30, { bold: true, color: C.blue, fontSize: 12, charSpacing: 3 })
      sl.addText(p.product, { x: x * IN, y: 450 * IN, w: (cw - 40) * IN, h: 130 * IN, margin: 0, fontFace: HEAD, fontSize: PT(54), color: 'FFFFFF', valign: 'top', hyperlink: { slide: at(n), tooltip: `Open ${p.product}` }, isTextBox: true })
      text(sl, p.k12_module, x, 590, cw - 40, 34, { bold: true, color: '9FD0FF', fontSize: 12 })
      text(sl, p.family?.summary ?? p.subs[0].summary, x, 640, cw - 50, 220, { fontSize: PT(22), color: 'DCE9F7' })
      head(sl, String(p.subs.length), x, 860, cw - 40, 100, 80, { color: C.blue, bold: true })
      sl.addText('Open ›', { x: x * IN, y: 965 * IN, w: (cw - 40) * IN, h: 34 * IN, margin: 0, fontFace: 'Calibri', fontSize: 14, bold: true, color: '9FD0FF', hyperlink: { slide: at(n), tooltip: `Open ${p.product}` }, isTextBox: true })
    })
    chrome(sl, null)
  }); sl.addNotes('Choose a product. Each product opens its own section; the links at the top of every atlas slide jump to any other product, and the link at the bottom goes to the next product.') }

  B.opener = (n, pk) => () => { const p = prod(pk); const f = p.family; const sl = add(n, 'ink', (sl) => {
    kicker(sl, `${p.product} · ${p.k12_module} · ${p.subs.length} sub-modules`)
    const w = p.product.split(' ')
    sl.addText([{ text: w.slice(0, -1).join(' ') + ' ', options: { color: 'FFFFFF', bold: false } }, { text: w.slice(-1)[0], options: { color: '9FD0FF', bold: true } }], { x: 140 * IN, y: 220 * IN, w: 1640 * IN, h: 200 * IN, margin: 0, fontFace: HEAD, fontSize: PT(150), valign: 'top', isTextBox: true })
    const blocks = [['What it is', f.summary, 140, 470], ['The problem it removes', f.problem, 140, 640], ['Technology', f.technology.join(' · '), 140, 810], ['What could become easier', f.benefit, 980, 470], [f.ai.length ? 'Where AI and intelligence help' : 'How it is built', (f.ai.length ? f.ai : [f.research ?? f.technology.join(' · ')]).join(' · '), 980, 640]]
    for (const [l, t, x, y] of blocks) { text(sl, l.toUpperCase(), x, y, 760, 26, { bold: true, color: '9FD0FF', fontSize: 11, charSpacing: 3 }); text(sl, t, x, y + 32, 760, 130, { fontSize: PT(27), color: 'EAF2FB' }) }
    chrome(sl, pk)
  }); sl.addNotes([`${p.product}: ${f.summary}`, `Research basis: ${f.research ?? 'none stated; do not claim one.'}`].join('\n')) }

  B.sub = (n, pk, sid) => () => { const p = prod(pk); const s = p.subs.find((x) => x.id === sid); const nt = noteOf(pk, sid); const sl = add(n, 'ink', (sl) => {
    text(sl, `${p.product} · ${p.k12_module}`.toUpperCase(), 140, 92, 1100, 34, { bold: true, color: '9FD0FF', fontSize: 12, charSpacing: 3 })
    head(sl, s.name, 960, 150, 820, 110, 70)
    const im = imgOf(s)
    if (im) sl.addImage({ path: im.path, x: 140 * IN, y: 190 * IN, w: 720 * IN, h: 405 * IN, sizing: { type: 'cover', w: 720 * IN, h: 405 * IN }, altText: `${s.name}: ${s.screens[0] ?? 'screen'}` })
    const fy = im ? 636 : 230   // no screenshot: no picture card, the features move up
    text(sl, 'FEATURES', 140, fy, 700, 26, { bold: true, color: '9FD0FF', fontSize: 11, charSpacing: 3 })
    sl.addText(s.features.map((f) => ({ text: f, options: { bullet: { code: '2713' }, breakLine: true } })), { x: 140 * IN, y: (fy + 36) * IN, w: 730 * IN, h: (im ? 330 : 700) * IN, margin: 0, fontFace: 'Calibri', fontSize: PT(im ? 26 : 30), color: 'EAF2FB', valign: 'top', paraSpaceAfter: 6, isTextBox: true })
    const rows = [['What it is', s.summary], ['The problem it removes', s.problem], ['What could become easier', s.benefit], ['Technology', s.technology.join(' · ')], [s.research ? 'Designed from' : `${s.screen_count} screens, for example`, s.research ?? s.screens.slice(0, 5).join(' · ')]]
    rows.forEach(([l, t], i) => { const y = 290 + i * 145; text(sl, l.toUpperCase(), 960, y, 820, 24, { bold: true, color: '9FD0FF', fontSize: 11, charSpacing: 3 }); text(sl, t, 960, y + 30, 820, 112, { fontSize: PT(25), color: 'EAF2FB' }) })
    chrome(sl, pk)
  }); sl.addNotes([`SAY: ${s.summary} ${s.problem}`, `Workflow: ${s.workflow.join(' → ')}`, nt?.owner_to_confirm?.length ? `CAREFUL (presenter only): ${nt.owner_to_confirm.join(' ')}` : '', nt?.evidence?.length ? `Evidence: ${nt.evidence.join('; ')}` : ''].filter(Boolean).join('\n\n')) }

  B.glance = (n, pk) => () => { const p = prod(pk); const f = p.family; const sl = add(n, 'paper', (sl) => {
    kicker(sl, `${p.product} — how it works`)
    text(sl, 'HOW THE WORK FLOWS', 140, 190, 700, 30, { bold: true, color: C.blueD, fontSize: 11, charSpacing: 3 })
    const wf = f.workflow
    line(sl, 250, 312, 1670, 312, { line: { color: C.blue, width: 3 } })
    wf.forEach((s, k) => { const x = 250 + (k / Math.max(1, wf.length - 1)) * 1420
      sl.addShape(pptx.ShapeType.ellipse, { x: (x - 14) * IN, y: 298 * IN, w: 28 * IN, h: 28 * IN, fill: { color: k === wf.length - 1 ? C.green : C.blue }, line: { type: 'none' } })
      text(sl, s, x - 110, 344, 220, 60, { align: 'center', bold: true, fontSize: 12, color: C.tInk }) })
    const cols = []
    if (f.technology.length) cols.push(['What it runs on', f.technology])
    if (f.ai.length) cols.push(['Where AI and intelligence help', f.ai])
    if (f.research) cols.push(['Designed from', [f.research]])
    const cw = 1640 / Math.max(1, cols.length)
    cols.forEach(([l, lines], i) => { const x = 140 + i * cw
      if (i) line(sl, x - 20, 520, x - 20, 950, { line: { color: 'B5BCC4', width: 1 } })
      text(sl, l.toUpperCase(), x, 520, cw - 50, 30, { bold: true, color: C.blueD, fontSize: 11, charSpacing: 3 })
      sl.addText(lines.map((t) => ({ text: t, options: { bullet: { code: '2013' }, breakLine: true } })), { x: x * IN, y: 566 * IN, w: (cw - 60) * IN, h: 400 * IN, margin: 0, fontFace: 'Calibri', fontSize: PT(26), color: C.tInk, valign: 'top', paraSpaceAfter: 8, isTextBox: true }) })
    chrome(sl, pk)
  }); sl.addNotes(`${p.product}: the workflow, what it runs on and where AI and intelligence help, from the sheets written from source. No outside AI company or model is named.`) }

  B.gallery = (n, pk, ids) => () => { const p = prod(pk); const tiles = ids.map((id) => p.subs.find((s) => s.id === id)).filter((s) => s && imgOf(s)); const sl = add(n, 'paper', (sl) => {
    kicker(sl, `${p.product} — screens`)
    head(sl, p.product, 140, 190, 480, 160, 60); text(sl, p.k12_module, 140, 370, 480, 34, { bold: true, color: C.blueD, fontSize: 12 })
    const w = 340; const h = Math.round((w * 9) / 16)
    tiles.forEach((s, k) => { const im = imgOf(s); const x = 700 + (k % 3) * 366; const y = 150 + Math.floor(k / 3) * 262
      sl.addImage({ path: im.path, x: x * IN, y: y * IN, w: w * IN, h: h * IN, sizing: { type: 'cover', w: w * IN, h: h * IN }, altText: `${s.name}: screen` })
      text(sl, s.name, x, y + h + 6, w, 30, { bold: true, color: C.tInk, fontSize: 11 }) })
    text(sl, 'Screens from the working product, edited for this presentation. Personal details are removed.', 140, 960, 900, 40, { fontSize: 11, color: C.tBody })
    chrome(sl, pk)
  }); sl.addNotes(`${p.product}: screens from the working product, edited. Personal details are removed.`) }
  return B
}
