// The Product Atlas slides of the editable PowerPoint, built from the same data as the web deck (lib/client-presentation/generated/atlas.json).
// Every slide is editable text and shapes plus the edited screenshot as a picture; PowerPoint cannot run the web deck's motion, so the motion lives in
// the web deck and in the rendered videos. Used by build-pptx.mjs: atlasBuilders(ctx) returns { slideNumber: () => void } for the plan's slides.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function loadAtlas(root) {
  const atlas = JSON.parse(readFileSync(join(root, 'lib/client-presentation/generated/atlas.json'), 'utf8'))
  const notesPath = join(root, 'docs/client-presentation/atlas-notes.json')
  const notes = existsSync(notesPath) ? JSON.parse(readFileSync(notesPath, 'utf8')) : { products: [] }
  return { atlas, notes }
}

/**
 * The slide order of the atlas in the PowerPoint. For every slide of the web plan there is an autoplay video slide (rendered by render-atlas.mjs);
 * the big-letter slides are the video only, the others are followed by their editable slides (one per sub-module, one overview per family).
 * The screen gallery goes last: its video and then one editable slide per family.
 */
export function atlasOrder(atlas, plan) {
  const mid = []; const gallery = []
  const filled = atlas.products.filter((p) => p.subs.length)
  const editable = []   // [{ after: plan key, items: [...] }]
  let sn = 210
  const subSlides = new Map()
  for (const p of filled) { if (p.family) subSlides.set(`${p.key}:intro`, { n: sn++, kind: 'intro', p: p.key }); for (const x of p.subs) subSlides.set(x.id, { n: sn++, kind: 'sub', p: p.key, s: x.id }) }
  plan.forEach((a, k) => {
    const video = { n: 400 + k, kind: 'video', key: a.key, title: a.title }
    if (a.kind === 'gallery') { gallery.push(video); filled.forEach((p, f) => gallery.push({ n: 300 + f, kind: 'gallery', p: p.key })); return }
    mid.push(video)
    if (a.kind === 'families') mid.push({ n: 202, kind: 'families' })
    if (a.kind === 'problems') mid.push({ n: 204, kind: 'problems' })
    if (a.kind === 'workflows') mid.push({ n: 281, kind: 'workflows' })
    if (a.kind === 'tech') mid.push({ n: 283, kind: 'tech' })
    if (a.kind === 'benefits') mid.push({ n: 285, kind: 'benefits' })
    if (a.kind === 'subs') { if (a.intro) mid.push(subSlides.get(`${a.family}:intro`)); for (const id of a.subs) mid.push(subSlides.get(id)) }
  })
  return { mid, gallery }
}

const BIG = [
  ['What every module is', 'Summary', '01'], ['Which problem we solve', 'Problems', '02'], ['Inside every module', 'Modules and sub-modules', '03'],
  ['How the work flows', 'Workflows', '04'], ['Where our AI helps', 'AI and technology', '05'], ['What could become easier', 'Benefits', '06'], ['See it for real', 'Screens', '07'],
]

export function atlasBuilders(c, atlas, notes, imgOf, videoDir) {
  const { add, text, head, rect, line, C, HEAD, pptx, PT } = c
  const prod = (k) => atlas.products.find((p) => p.key === k)
  const noteOf = (pk, id) => notes.products.find((p) => p.key === pk)?.subs.find((s) => s.id === id)
  const filled = atlas.products.filter((p) => p.subs.length)
  const kicker = (sl, t) => text(sl, t.toUpperCase(), 140, 84, 1000, 36, { bold: true, color: sl.theme === 'ink' ? '9FD0FF' : C.blueD, fontSize: 13, charSpacing: 4 })
  const B = {}
  B.video = (n, key, title) => () => { const mp4 = join(videoDir, `atlas-${key}.mp4`); const poster = join(videoDir, `atlas-${key}-poster.jpg`)
    const sl = add(n, 'ink', (sl) => {
      if (existsSync(mp4) && existsSync(poster)) sl.addMedia({ type: 'video', path: mp4, cover: 'data:image/jpeg;base64,' + readFileSync(poster).toString('base64'), x: 0, y: 0, w: 13.3333, h: 7.5 })
      else { rect(sl, 0, 0, 1920, 1080, { fill: { color: C.navy }, line: { type: 'none' } }); head(sl, title, 140, 420, 1640, 200, 80) }
    }); sl.addNotes(`${title}. The slide plays by itself when it opens; click the picture to play it again. The same content, as editable text, follows (where there is a slide for it).`) }
  const bigSlide = (n, i, theme) => () => { const [t, k, g] = BIG[i]; const sl = add(n, theme, (sl) => {
    kicker(sl, `${g} — ${k}`)
    text(sl, g, 1000, 360, 800, 700, { fontFace: HEAD, fontSize: PT(520), bold: true, color: theme === 'ink' ? '0B2A4D' : 'E4DDCB' })
    const w = t.split(' '); const cut = Math.ceil(w.length / 2)
    sl.addText([{ text: w.slice(0, cut).join(' ') + ' ', options: { color: theme === 'ink' ? 'FFFFFF' : C.tInk, bold: false } }, { text: w.slice(cut).join(' '), options: { color: theme === 'ink' ? '9FD0FF' : C.blue, bold: true } }],
      { x: 0.97, y: 2.9, w: 9.6, h: 3.4, margin: 0, fontFace: HEAD, fontSize: PT(170), valign: 'top', isTextBox: true })
    rect(sl, 140, 930, 1640, 4, { fill: { color: C.blue }, line: { type: 'none' } })
    text(sl, `${atlas.products.reduce((a, p) => a + p.subs.length, 0)} sub-modules · ${filled.length} product families`, 140, 960, 900, 36, { bold: true, fontSize: 12, charSpacing: 2 })
  }); sl.addNotes(`${t}.`) }
  for (const [n, i, theme] of [[201, 0, 'ink'], [203, 1, 'ink'], [205, 2, 'ink'], [280, 3, 'paper'], [282, 4, 'ink'], [284, 5, 'paper']]) B[n] = bigSlide(n, i, theme)

  B[202] = () => { const sl = add(202, 'paper', (sl) => {
    kicker(sl, '01 — Summary'); const cw = 1640 / filled.length
    filled.forEach((p, i) => { const x = 140 + i * cw; if (i) line(sl, x - 16, 190, x - 16, 980, { line: { color: 'B5BCC4', width: 1 } })
      text(sl, String(i + 1).padStart(2, '0'), x, 200, 120, 30, { bold: true, color: C.blueD, fontSize: 12, charSpacing: 3 })
      head(sl, p.product, x, 240, cw - 40, 130, 54); text(sl, p.k12_module, x, 380, cw - 40, 40, { bold: true, color: C.blueD, fontSize: 12 })
      text(sl, p.family?.summary ?? p.subs[0].summary, x, 440, cw - 50, 330, { fontSize: PT(25), color: C.tBody })
      head(sl, String(p.subs.length), x, 800, cw - 40, 120, 110, { color: C.blue, bold: true }); text(sl, 'SUB-MODULES', x, 930, cw - 40, 30, { bold: true, fontSize: 11, charSpacing: 2 }) })
  }); sl.addNotes('One column per product family, with the number of sub-modules in the K12 menu.') }

  const rowsSlide = (n, key, title, g, field) => () => { const sl = add(n, 'paper', (sl) => {
    kicker(sl, `${g} — ${title}`)
    filled.forEach((p, i) => { const y = 170 + i * 168; line(sl, 140, y, 1780, y, { line: { color: 'B5BCC4', width: 1 } })
      head(sl, p.product, 140, y + 24, 480, 70, 46); text(sl, p.k12_module, 140, y + 100, 480, 34, { bold: true, color: C.blueD, fontSize: 12 })
      sl.addText('→', { x: 6.45, y: ((y + 40) * 13.3333) / 1920, w: 0.7, h: 0.6, margin: 0, fontFace: 'Calibri', fontSize: 30, color: C.blue, bold: true })
      text(sl, p.family?.[field] ?? p.subs[0][field], 700, y + 22, 1080, 130, { fontSize: PT(33), bold: true, color: C.tInk }) })
  }); sl.addNotes(title) }
  B[204] = rowsSlide(204, 'problems', 'Problems', '02', 'problem')
  B[285] = rowsSlide(285, 'benefits', 'Benefits', '06', 'benefit')

  B[281] = () => { const sl = add(281, 'ink', (sl) => {
    kicker(sl, '04 — Workflows')
    filled.filter((p) => p.family?.workflow?.length).forEach((p, i) => { const y = 190 + i * 166; const wf = p.family.workflow
      head(sl, p.product, 140, y + 20, 420, 60, 44); text(sl, p.k12_module, 140, y + 84, 420, 30, { bold: true, color: '9FD0FF', fontSize: 11 })
      line(sl, 600, y + 52, 1780, y + 52, { line: { color: C.blue, width: 3 } })
      wf.forEach((s, k) => { const x = 600 + (k / Math.max(1, wf.length - 1)) * 1180
        sl.addShape(pptx.ShapeType.ellipse, { x: ((x - 14) * 13.3333) / 1920, y: ((y + 38) * 13.3333) / 1920, w: (28 * 13.3333) / 1920, h: (28 * 13.3333) / 1920, fill: { color: k === wf.length - 1 ? C.green : C.blue }, line: { type: 'none' } })
        text(sl, s, x - 110, y + 82, 220, 60, { align: 'center', bold: true, fontSize: 11, color: 'FFFFFF' }) }) })
  }); sl.addNotes('The chain of work in each product family, from the sheets written from source.') }

  B[283] = () => { const t = atlas.tech; const sl = add(283, 'paper', (sl) => {
    kicker(sl, '05 — AI and technology')
    t.pillars.forEach((p, i) => { const x = 140 + i * 560
      if (i) line(sl, x - 24, 200, x - 24, 780, { line: { color: 'B5BCC4', width: 1 } })
      head(sl, p.name, x, 200, 500, 190, 76, { bold: false })
      p.lines.forEach((l, k) => { rect(sl, x, 420 + k * 120 + 16, 22, 4, { fill: { color: C.blue }, line: { type: 'none' } }); text(sl, l, x + 36, 420 + k * 120, 470, 110, { fontSize: PT(30), bold: true, color: C.tInk }) }) })
    text(sl, 'DESIGNED FROM', 140, 840, 600, 30, { bold: true, color: C.blueD, fontSize: 12, charSpacing: 3 })
    text(sl, t.designed_from.join('     '), 140, 880, 1640, 100, { fontSize: PT(32), bold: true, color: C.tInk })
  }); sl.addNotes('Knowledge graph, AI and intelligence: what each does, from the code. No outside AI company or model is named.') }

  B.intro = (n, pk) => () => { const p = prod(pk); const f = p.family; const sl = add(n, 'ink', (sl) => {
    kicker(sl, `${p.k12_module}`)
    const w = p.product.split(' ')
    sl.addText([{ text: w.slice(0, -1).join(' ') + ' ', options: { color: 'FFFFFF', bold: false } }, { text: w.slice(-1)[0], options: { color: '9FD0FF', bold: true } }], { x: 0.97, y: 1.6, w: 12, h: 1.4, margin: 0, fontFace: HEAD, fontSize: PT(150), isTextBox: true })
    const blocks = [['What it is', f.summary, 140, 470], ['The problem it removes', f.problem, 140, 640], ['What could become easier', f.benefit, 980, 470], [f.ai.length ? 'Where AI and intelligence help' : 'Technology', (f.ai.length ? f.ai : f.technology).join(' · '), 980, 640], ['Technology', f.technology.join(' · '), 980, 810]]
    for (const [l, t, x, y] of blocks) { text(sl, l.toUpperCase(), x, y, 760, 26, { bold: true, color: '9FD0FF', fontSize: 11, charSpacing: 3 }); text(sl, t, x, y + 32, 760, 130, { fontSize: PT(27), color: 'EAF2FB' }) }
  }); sl.addNotes([`${p.product}: ${f.summary}`, `Research basis: ${f.research ?? 'none stated; do not claim one.'}`].join('\n')) }

  B.sub = (n, pk, sid) => () => { const p = prod(pk); const s = p.subs.find((x) => x.id === sid); const nt = noteOf(pk, sid); const sl = add(n, 'ink', (sl) => {
    text(sl, `${p.product} · ${p.k12_module}`.toUpperCase(), 140, 84, 1100, 34, { bold: true, color: '9FD0FF', fontSize: 12, charSpacing: 3 })
    head(sl, s.name, 960, 150, 820, 110, 70)
    const im = imgOf(s)
    if (im) sl.addImage({ path: im.path, x: (140 * 13.3333) / 1920, y: (190 * 13.3333) / 1920, w: (720 * 13.3333) / 1920, h: (405 * 13.3333) / 1920, sizing: { type: 'cover', w: (720 * 13.3333) / 1920, h: (405 * 13.3333) / 1920 }, altText: `${s.name}: ${s.screens[0] ?? 'screen'}` })
    else { rect(sl, 140, 190, 720, 405, { fill: { color: C.navy }, line: { color: '9FD0FF', width: 1 } }); text(sl, s.screens.slice(0, 7).join('\n'), 170, 215, 660, 360, { fontSize: PT(25), color: 'EAF2FB' }) }
    text(sl, 'FEATURES', 140, 636, 700, 26, { bold: true, color: '9FD0FF', fontSize: 11, charSpacing: 3 })
    sl.addText(s.features.map((f) => ({ text: f, options: { bullet: { code: '2713' }, breakLine: true } })), { x: (140 * 13.3333) / 1920, y: (672 * 13.3333) / 1920, w: (730 * 13.3333) / 1920, h: (330 * 13.3333) / 1920, margin: 0, fontFace: 'Calibri', fontSize: PT(26), color: 'EAF2FB', valign: 'top', paraSpaceAfter: 6, isTextBox: true })
    const rows = [['What it is', s.summary], ['The problem it removes', s.problem], ['What could become easier', s.benefit], ['Technology', s.technology.join(' · ')], [s.research ? 'Designed from' : `${s.screen_count} screens, for example`, s.research ?? s.screens.slice(0, 5).join(' · ')]]
    rows.forEach(([l, t], i) => { const y = 290 + i * 145; text(sl, l.toUpperCase(), 960, y, 820, 24, { bold: true, color: '9FD0FF', fontSize: 11, charSpacing: 3 }); text(sl, t, 960, y + 30, 820, 112, { fontSize: PT(25), color: 'EAF2FB' }) })
  }); sl.addNotes([`SAY: ${s.summary} ${s.problem}`, `Workflow: ${s.workflow.join(' → ')}`, nt?.owner_to_confirm?.length ? `CAREFUL (presenter only): ${nt.owner_to_confirm.join(' ')}` : '', nt?.evidence?.length ? `Evidence: ${nt.evidence.join('; ')}` : ''].filter(Boolean).join('\n\n')) }

  B.gallery = (n, pk) => () => { const p = prod(pk); const tiles = p.subs.filter((s) => imgOf(s)).slice(0, 6); const sl = add(n, 'paper', (sl) => {
    text(sl, `07 — SCREENS`, 140, 84, 600, 34, { bold: true, color: C.blueD, fontSize: 13, charSpacing: 4 })
    head(sl, p.product, 140, 200, 520, 160, 64); text(sl, p.k12_module, 140, 380, 520, 34, { bold: true, color: C.blueD, fontSize: 13 })
    tiles.forEach((s, k) => { const im = imgOf(s); const x = 700 + (k % 2) * 560; const y = 150 + Math.floor(k / 2) * 290; const w = 520; const h = Math.round((w * 9) / 16)
      sl.addImage({ path: im.path, x: (x * 13.3333) / 1920, y: (y * 13.3333) / 1920, w: (w * 13.3333) / 1920, h: (h * 13.3333) / 1920, sizing: { type: 'cover', w: (w * 13.3333) / 1920, h: (h * 13.3333) / 1920 }, altText: `${s.name}: screen` })
      text(sl, s.name, x, y + h + 6, w, 30, { bold: true, color: C.tInk, fontSize: 11 }) })
    text(sl, 'Screens from the working product, edited for this presentation. Personal details are removed.', 140, 960, 900, 40, { fontSize: 11, color: C.tBody })
  }); sl.addNotes(`${p.product}: screens from the working product, edited. Personal details are removed.`) }
  return B
}
