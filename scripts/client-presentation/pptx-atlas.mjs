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
  const presenterPath = join(root, 'lib/client-presentation/generated/atlas-presenter.json')
  const presenter = existsSync(presenterPath) ? JSON.parse(readFileSync(presenterPath, 'utf8')) : {}
  return { atlas, notes, presenter }
}

export const HUB_N = 500

/**
 * The order of the atlas slides in the PowerPoint, and the first slide of each product (where the rail sends you).
 * Per web slide: a video slide (n = 400 + plan index), then its editable slides: the hub; an opener; one slide per sub-module; a "how it works"
 * slide; a screens slide. The hub is editable only (it is the menu, not a film).
 */
export function atlasOrder(atlas, plan) {
  const filled = atlas.products.filter((p) => p.subs.length)
  const list = []; const firstOf = {}; const tourFirst = {}
  let sub = 0; let gal = 0; let tourN = 800
  plan.forEach((a, k) => {
    if (a.kind === 'hub') { list.push({ n: HUB_N, kind: 'hub' }); return }
    const pi = filled.findIndex((p) => p.key === a.family)
    const video = { n: 400 + k, kind: 'video', key: a.key, slug: a.slug, title: a.title, family: a.family }
    list.push(video)
    if (a.kind === 'opener') { firstOf[a.family] = video.n; list.push({ n: 510 + pi, kind: 'opener', family: a.family }) }
    if (a.kind === 'subs') for (const id of a.subs) list.push({ n: 600 + sub++, kind: 'sub', family: a.family, sub: id })
    if (a.kind === 'glance') list.push({ n: 520 + pi, kind: 'glance', family: a.family })
    if (a.kind === 'gallery') list.push({ n: 700 + gal++, kind: 'gallery', family: a.family, subs: a.subs })
    if (a.kind === 'tour') {
      // a tour is one video slide, then one editable slide per step of its tabs (a features group, a role); tourFirst says where each tab starts
      const t = atlas.products.find((p) => p.key === a.family).tour
      const tf = { tabs: {}, groups: [], roles: [] }
      const push = (tab, step) => { const n = tourN++; list.push({ n, kind: 'tour', family: a.family, tab, step }); return n }
      for (const tab of ['summary', 'problem', 'intelligence', 'ai']) tf.tabs[tab] = push(tab, 0)
      if (t.research.items.length) tf.tabs.research = push('research', 0)
      t.features.groups.forEach((g, i) => { const n = push('features', i); tf.groups.push(n); if (i === 0) tf.tabs.features = n })
      t.roles.forEach((r, i) => { const n = push('roles', i); tf.roles.push(n); if (i === 0) tf.tabs.roles = n })
      tourFirst[a.family] = tf
    }
  })
  return { list, firstOf, tourFirst }
}

const short = (p) => p.product.replace(/^Scholar /, '')

/** nav = { at, firstOf, endN }: at(n) is the position of slide n in this file, firstOf[family] the slide a product starts on, endN the slide after the last product. */
export function atlasBuilders(c, atlas, notes, imgOf, videoDir, nav) {
  const { add, text, head, rect, line, C, HEAD, pptx, PT } = c
  const { at, firstOf, endN, tourFirst, presenter } = nav   // nav.art: the tour pictures converted for PowerPoint (id -> { path })
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
  B.video = (n, slug, title, family) => () => {
    // videos are named by the slide's stable slug (atlas-core-tour.mp4), not by its key, which shifts when slides are added or removed
    const mp4 = join(videoDir, `atlas-${slug}.mp4`); const poster = join(videoDir, `atlas-${slug}-poster.jpg`)
    const sl = add(n, 'ink', (sl) => {
      if (existsSync(mp4) && existsSync(poster)) sl.addMedia({ type: 'video', path: mp4, cover: 'data:image/jpeg;base64,' + readFileSync(poster).toString('base64'), x: 0, y: 0, w: 13.3333, h: 7.5 })
      else { rect(sl, 0, 0, 1920, 1080, { fill: { color: C.navy }, line: { type: 'none' } }); head(sl, title, 140, 420, 1640, 200, 80) }
      chrome(sl, family)
    })
    sl.addNotes(`${title}. The slide plays by itself when it opens; click the picture to play it again. The links at the top jump to any product; the link at the bottom goes to the next product. The same content, as editable text, follows.`)
  }

  /* ---- the product tour: one editable slide per step of its tabs (a features group, a role), each with a clickable tab strip ---- */
  const TAB_LABEL = { summary: 'Summary', problem: 'Problem', intelligence: 'Intelligence', ai: 'AI capability', research: 'Research', features: 'Features and modules', roles: 'Role-wise benefits' }
  const RING = { x: 1400, y: 600, r: 235 }
  const ringAt = (i, k) => { const a = ((-90 + (360 / k) * i) * Math.PI) / 180; return { x: RING.x + RING.r * Math.cos(a), y: RING.y + RING.r * Math.sin(a) } }
  B.tour = (n, pk, tab, step) => () => {
    if (prod(pk).tour.style === 'sketchbook') return B.tourSketch(n, pk, tab, step)()
    const p = prod(pk); const t = p.tour; const tf = tourFirst[pk]; const script = presenter?.[pk]?.[tab] ?? ''
    const sl = add(n, 'ink', (sl) => {
      kicker(sl, `${p.product} · ${p.k12_module} · ${p.subs.length} modules`)
      // the tab strip: every tab is a link to its first slide, the one you are on is bold and blue
      const tabs = Object.keys(tf.tabs)
      const runs = []
      tabs.forEach((k, i) => { if (i) runs.push({ text: '      ', options: { fontSize: 12 } }); runs.push({ text: `${String(i + 1).padStart(2, '0')}  ${TAB_LABEL[k]}`, options: { hyperlink: { slide: at(tf.tabs[k]), tooltip: TAB_LABEL[k] }, bold: k === tab, fontSize: 14, color: k === tab ? C.blue : '9FD0FF', underline: false } }) })
      sl.addText(runs, { x: 140 * IN, y: 150 * IN, w: 1640 * IN, h: 44 * IN, margin: 0, fontFace: 'Calibri', fontSize: 14, valign: 'middle', isTextBox: true })
      line(sl, 140, 200, 1780, 200, { line: { color: '3A5878', width: 1 } })
      const soft = 'DCE9F7'
      if (tab === 'summary') {
        head(sl, t.summary.lines[0], 140, 262, 800, 330, 88)
        text(sl, t.summary.lines[1], 140, 640, 780, 150, { fontSize: PT(31), color: 'EAF2FB' })
        text(sl, t.summary.lines[2], 140, 820, 780, 110, { fontSize: PT(26), color: '9FD0FF', bold: true })
        head(sl, String(p.subs.length), 1010, 240, 560, 300, 230, { color: '9FD0FF', bold: true })
        text(sl, 'MODULES', 1010, 520, 400, 36, { bold: true, color: soft, fontSize: 14, charSpacing: 4 })
        t.features.groups.forEach((g, i) => { const y = 610 + i * 74; line(sl, 1010, y, 1780, y, { line: { color: '3A5878', width: 1 } }); text(sl, g.title, 1010, y + 18, 600, 40, { bold: true, color: 'FFFFFF', fontSize: PT(28) }); text(sl, '\u25CF \u25CF \u25CF \u25CF \u25CF', 1560, y + 18, 220, 40, { color: C.green, align: 'right', fontSize: 14 }) })
      } else if (tab === 'problem') {
        text(sl, t.problem.label.toUpperCase(), 140, 262, 700, 30, { bold: true, color: '9FD0FF', fontSize: 12, charSpacing: 3 })
        t.problem.beats.forEach((b, i) => text(sl, b, 140, 326 + i * 128, 940, 120, { fontFace: HEAD, fontSize: PT(44), color: 'FFFFFF' }))
        text(sl, t.problem.turn, 140, 850, 1040, 110, { fontFace: HEAD, fontSize: PT(40), bold: true, color: '9FD0FF' })
        const regs = [{ x: 1140, y: 350 }, { x: 1420, y: 440 }, { x: 1200, y: 780 }]
        t.problem.scattered.forEach((nm, i) => { rect(sl, regs[i].x, regs[i].y, 330, 92, { fill: { color: '123456' }, line: { color: '3A5878', width: 1 } }); text(sl, nm, regs[i].x, regs[i].y, 330, 92, { align: 'center', valign: 'middle', bold: true, color: 'FFFFFF', fontSize: PT(28) }) })
        rect(sl, 1275, 540, 430, 240, { fill: { color: C.blue }, line: { type: 'none' } })
        text(sl, p.product, 1313, 590, 380, 70, { fontFace: HEAD, fontSize: PT(48), color: 'FFFFFF' }); text(sl, t.problem.record.toUpperCase(), 1313, 690, 380, 40, { bold: true, color: 'EAF2FB', fontSize: 14, charSpacing: 3 })
      } else if (tab === 'intelligence') {
        text(sl, t.intelligence.lead, 140, 252, 860, 130, { fontSize: PT(29), bold: true, color: 'EAF2FB' })
        t.intelligence.modules.forEach((m, i) => { const y = 384 + i * 96; line(sl, 140, y, 980, y, { line: { color: '3A5878', width: 1 } }); text(sl, m.name.toUpperCase(), 140, y + 8, 840, 26, { bold: true, color: '9FD0FF', fontSize: 12, charSpacing: 3 }); text(sl, m.asks, 140, y + 36, 840, 56, { fontSize: PT(24), color: 'FFFFFF', bold: true }) })
        const k = t.intelligence.modules.length
        t.intelligence.modules.forEach((m, i) => { const q = ringAt(i, k); line(sl, RING.x, RING.y, q.x, q.y, { line: { color: C.blue, width: 2 } }) })
        rect(sl, RING.x - 95, RING.y - 48, 190, 96, { fill: { color: C.blue }, line: { type: 'none' } }); text(sl, 'Your school\u2019s records', RING.x - 95, RING.y - 48, 190, 96, { align: 'center', valign: 'middle', bold: true, color: 'FFFFFF', fontSize: PT(22) })
        t.intelligence.modules.forEach((m, i) => { const q = ringAt(i, k); rect(sl, q.x - 100, q.y - 28, 200, 56, { fill: { color: '0B2540' }, line: { color: '9FD0FF', width: 1 } }); text(sl, m.name, q.x - 100, q.y - 28, 200, 56, { align: 'center', valign: 'middle', bold: true, color: 'FFFFFF', fontSize: PT(22) }) })
        text(sl, t.intelligence.close, 1010, 912, 770, 80, { fontFace: HEAD, fontSize: PT(30), color: 'B7C7DA', align: 'center' })
      } else if (tab === 'ai') {
        text(sl, t.ai.lead, 140, 252, 860, 130, { fontSize: PT(29), bold: true, color: 'EAF2FB' })
        t.ai.uses.forEach((u, i) => { const y = 380 + i * 128; line(sl, 140, y, 980, y, { line: { color: '3A5878', width: 1 } }); text(sl, u.name.toUpperCase(), 140, y + 12, 840, 26, { bold: true, color: '9FD0FF', fontSize: 12, charSpacing: 3 }); text(sl, u.line, 140, y + 44, 840, 70, { fontSize: PT(28), bold: true, color: 'FFFFFF' }) })
        rect(sl, 1040, 262, 740, 470, { fill: { color: '123456' }, line: { color: '3A5878', width: 1 } })
        text(sl, 'DRAFT PREVIEW', 1076, 292, 360, 26, { bold: true, color: '9FD0FF', fontSize: 12, charSpacing: 3 }); text(sl, t.ai.sample.label, 1440, 292, 304, 26, { color: 'B7C7DA', align: 'right', fontSize: 12 })
        text(sl, t.ai.sample.text, 1076, 350, 668, 260, { fontSize: PT(31), color: 'FFFFFF' })
        rect(sl, 1076, 646, 126, 56, { fill: { color: C.green }, line: { type: 'none' } }); text(sl, 'Apply', 1076, 646, 126, 56, { align: 'center', valign: 'middle', bold: true, color: C.ink, fontSize: PT(22) })
        rect(sl, 1220, 646, 146, 56, { fill: { color: '123456' }, line: { color: '3A5878', width: 1 } }); text(sl, 'Discard', 1220, 646, 146, 56, { align: 'center', valign: 'middle', bold: true, color: 'FFFFFF', fontSize: PT(22) })
        text(sl, t.ai.guard, 1040, 788, 740, 90, { fontFace: HEAD, fontSize: PT(34), color: '9FD0FF' }); text(sl, t.ai.control, 1040, 884, 740, 60, { fontSize: PT(26), color: 'B7C7DA' })
      } else if (tab === 'research') {
        text(sl, 'DESIGNED FROM', 140, 262, 700, 30, { bold: true, color: '9FD0FF', fontSize: 12, charSpacing: 3 })
        // a table of two fixed columns, as in the web deck: the sentence, then its source; six rows must fit above y = 960
        t.research.items.forEach((r, i) => { const y = 330 + i * 102; line(sl, 140, y, 1780, y, { line: { color: '3A5878', width: 1 } }); text(sl, r.text, 140, y + 16, 1080, 80, { fontFace: HEAD, fontSize: PT(28), color: 'FFFFFF' }); text(sl, r.source.toUpperCase(), 1260, y + 16, 520, 84, { bold: true, color: '9FD0FF', fontSize: 11, charSpacing: 2 }) })
      } else if (tab === 'features') {
        const g = t.features.groups[step]
        const gr = []
        t.features.groups.forEach((x, i) => { if (i) gr.push({ text: '      ', options: { fontSize: 12 } }); gr.push({ text: `${String(i + 1).padStart(2, '0')}  ${x.title}`, options: { hyperlink: { slide: at(tf.groups[i]), tooltip: x.title }, bold: i === step, fontSize: 13, color: i === step ? 'FFFFFF' : '9FD0FF', underline: false } }) })
        sl.addText(gr, { x: 140 * IN, y: 220 * IN, w: 1640 * IN, h: 76 * IN, margin: 0, fontFace: 'Calibri', fontSize: 13, valign: 'middle', isTextBox: true })   // group titles can wrap to a second line: the box is tall enough, the title below starts at y 322
        head(sl, g.title, 140, 322, 1640, 120, 76)
        g.subs.forEach((s, k) => { const x = 140 + k * 336; const sub = p.subs.find((q) => q.id === s.id); const im = sub && imgOf(sub)
          if (im) sl.addImage({ path: im.path, x: x * IN, y: 470 * IN, w: 296 * IN, h: 268 * IN, sizing: { type: 'cover', w: 296 * IN, h: 268 * IN }, altText: `${s.name}: screen` })
          text(sl, s.name, x, 760, 296, 40, { bold: true, color: 'FFFFFF', fontSize: PT(26) }); text(sl, s.tagline, x, 806, 296, 130, { color: 'B7C7DA', fontSize: PT(22) }) })
      } else if (tab === 'roles') {
        const r = t.roles[step]
        t.roles.forEach((x, i) => { const y = 262 + i * 96; line(sl, 140, y, 580, y, { line: { color: '3A5878', width: 1 } })
          sl.addText(x.role, { x: 140 * IN, y: (y + 22) * IN, w: 440 * IN, h: 60 * IN, margin: 0, fontFace: HEAD, fontSize: PT(30), color: i === step ? 'FFFFFF' : '7A93AE', bold: i === step, valign: 'top', hyperlink: { slide: at(tf.roles[i]), tooltip: x.role }, isTextBox: true }) })
        text(sl, r.who.toUpperCase(), 660, 262, 1000, 28, { bold: true, color: '9FD0FF', fontSize: 12, charSpacing: 3 })
        head(sl, r.role, 660, 296, 1120, 120, 88)
        sl.addText(r.benefits.map((b) => ({ text: b, options: { bullet: { code: '2713' }, breakLine: true } })), { x: 660 * IN, y: 452 * IN, w: 1000 * IN, h: 300 * IN, margin: 0, fontFace: 'Calibri', fontSize: PT(32), color: 'FFFFFF', bold: true, valign: 'top', paraSpaceAfter: 14, isTextBox: true })
        text(sl, `A DAY WITH ${p.product.toUpperCase()}. ILLUSTRATIVE.`, 660, 790, 1050, 26, { bold: true, color: '9FD0FF', fontSize: 12, charSpacing: 3 })
        text(sl, r.use, 660, 826, 1050, 90, { fontFace: HEAD, fontSize: PT(34), italic: true, color: 'FFFFFF' })
        text(sl, r.modules.map((m) => m.name).join('  \u00B7  '), 660, 940, 1120, 40, { bold: true, color: '9FD0FF', fontSize: PT(20) })
      }
      chrome(sl, pk)
    })
    sl.addNotes([`${TAB_LABEL[tab]}${tab === 'features' ? ` (${t.features.groups[step].title})` : tab === 'roles' ? ` (${t.roles[step].role})` : ''}`, script ? `SAY: ${script}` : '', 'The links on the tab strip jump to any tab; the links at the top jump to any product. The situations and day-in-the-life lines are illustrations, not a customer\u2019s school.'].filter(Boolean).join('\n\n'))
  }


  /* ---- the illustrated ("sketchbook") tour: paper theme, the same coordinates as scenes/sketch-tour-scene.tsx, real pictures via addImage ---- */
  const MARK = 'FFD84D'; const CARD = 'FFFDF6'; const INKT = C.tInk
  const tail = (line, n = 3) => { const w = line.split(' '); return n >= w.length ? ['', line] : [w.slice(0, -n).join(' ') + ' ', w.slice(-n).join(' ')] }
  const rich = (line, n, base) => { const [a, b] = tail(line, n); return [{ text: a, options: base }, { text: b, options: { ...base, highlight: MARK } }] }
  const pic = (sl, im, x, y, w, h, o = {}) => { if (im) sl.addImage({ path: im.path, x: x * IN, y: y * IN, w: w * IN, h: h * IN, altText: o.alt ?? '', ...(o.cover ? { sizing: { type: 'cover', w: w * IN, h: h * IN } } : {}), ...(o.rotate ? { rotate: o.rotate } : {}), ...(o.transparency ? { transparency: o.transparency } : {}) }) }
  const tape = (sl, x, y, rot, w = 120, h = 34) => rect(sl, x, y, w, h, { fill: { color: MARK, transparency: 18 }, line: { type: 'none' }, rotate: rot })
  const paperCard = (sl, x, y, w, h, rot = 0) => rect(sl, x, y, w, h, { fill: { color: CARD }, line: { color: 'D8D2C2', width: 0.75 }, shadow: { type: 'outer', color: '0C2A4A', opacity: 0.16, blur: 8, offset: 3, angle: 90 }, ...(rot ? { rotate: rot } : {}) })
  const framed = (sl, im, x, y, w, h, rot, alt) => { paperCard(sl, x, y, w, h, rot); pic(sl, im, x + 14, y + 14, w - 28, h - 28, { cover: true, rotate: rot, alt }) }
  const linesOf = (txt, perLine) => Math.max(1, Math.ceil(String(txt).length / perLine))
  const labelRun = (txt, color = C.blueD) => ({ text: txt.toUpperCase(), options: { bold: true, color, fontSize: 11, charSpacing: 2 } })

  B.tourSketch = (n, pk, tab, step) => () => {
    const p = prod(pk); const t = p.tour; const tf = tourFirst[pk]; const script = presenter?.[pk]?.[tab] ?? ''
    const art = (slot) => { const im = t.art?.[slot]?.[0]; return im ? { ...(nav.art?.get(im.id) ?? {}), alt: im.alt, w: im.w, h: im.h } : null }
    const labels = t.labels ?? { draft: 'Draft' }
    const hasButtons = !!(labels.apply && labels.discard)
    const sl = add(n, 'paper', (sl) => {
      kicker(sl, `${p.product} \u00B7 ${p.k12_module} \u00B7 ${p.subs.length} modules`)
      // the index tabs: each is a link to its first slide; the one you are on is bold with a marker behind it
      const tabs = Object.keys(tf.tabs)
      const runs = []
      tabs.forEach((k, i) => { if (i) runs.push({ text: '      ', options: { fontSize: 12 } }); runs.push({ text: `${String(i + 1).padStart(2, '0')}  ${TAB_LABEL[k]}`, options: { hyperlink: { slide: at(tf.tabs[k]), tooltip: TAB_LABEL[k] }, bold: k === tab, fontSize: 14, color: k === tab ? INKT : '5A6B7F', underline: false, ...(k === tab ? { highlight: MARK } : {}) } }) })
      sl.addText(runs, { x: 140 * IN, y: 150 * IN, w: 1640 * IN, h: 44 * IN, margin: 0, fontFace: 'Calibri', fontSize: 14, valign: 'middle', isTextBox: true })
      line(sl, 140, 200, 1780, 200, { line: { color: 'C9C3B3', width: 1 } })
      if (tab === 'summary') {
        head(sl, t.summary.lines[0], 140, 270, 800, 300, t.summary.lines[0].length <= 40 ? 78 : t.summary.lines[0].length <= 60 ? 68 : 60)   // a long headline gets a smaller size so it stays above the first line of text
        text(sl, t.summary.lines[1], 140, 585, 760, 120, { fontSize: PT(30), color: C.tBody })
        sl.addText(rich(t.summary.lines[2], 4, { fontFace: 'Calibri', fontSize: PT(30), color: C.tBody }), { x: 140 * IN, y: 725 * IN, w: 760 * IN, h: 120 * IN, margin: 0, valign: 'top', isTextBox: true })
        head(sl, String(p.subs.length), 140, 870, 200, 110, 96, { color: C.blueD, bold: true }); text(sl, 'MODULES', 250, 925, 300, 36, { bold: true, color: C.tBody, fontSize: 14, charSpacing: 3 })
        framed(sl, art('summary.photo'), 980, 290, 800, 520, 1.2, art('summary.photo')?.alt)
        tape(sl, 1040, 270, -6); tape(sl, 1660, 780, 5)
        const cutBox = (im, right, bottom, maxW, maxH) => { const k = Math.min(maxW / im.w, maxH / im.h); const w = Math.round(im.w * k); const h = Math.round(im.h * k); return { x: right - w, y: bottom - h, w, h } }   // as in the web scene: a figure never runs off the slide
        const cut = art('summary.cut1'); if (cut) { const b = cutBox(cut, 1790, 830, 260, 330); pic(sl, cut, b.x, b.y, b.w, b.h, { alt: cut.alt }) }
        t.features.groups.forEach((g, i) => text(sl, `${g.title} \u00B7 ${g.subs.length}`, 980 + (i % 2) * 400, 860 + Math.floor(i / 2) * 44, 390, 40, { bold: true, color: INKT, fontSize: PT(24) }))
      } else if (tab === 'problem') {
        rect(sl, 140, 262, 520, 40, { fill: { color: MARK }, line: { color: INKT, width: 1.5 }, rotate: -2 })
        text(sl, t.problem.label.toUpperCase(), 140, 262, 520, 40, { align: 'center', valign: 'middle', bold: true, color: INKT, fontSize: 12, charSpacing: 2, rotate: -2 })
        t.problem.beats.forEach((b, i) => { const y = 316 + i * 116; rect(sl, 140, y, 780, 104, { fill: { color: CARD }, line: { color: 'E4DFD0', width: 0.75 } }); sl.addText(rich(b, 3, { fontFace: 'Calibri', fontSize: PT(28), color: INKT }), { x: 162 * IN, y: (y + 8) * IN, w: 738 * IN, h: 88 * IN, margin: 0, valign: 'middle', isTextBox: true }) })
        sl.addText(rich(t.problem.turn, 4, { fontFace: HEAD, fontSize: PT(40), color: INKT }), { x: 140 * IN, y: 800 * IN, w: 780 * IN, h: 140 * IN, margin: 0, valign: 'top', isTextBox: true })
        framed(sl, art('problem.photo'), 980, 290, 800, 520, -1.2, art('problem.photo')?.alt)
        tape(sl, 1040, 276, -5); tape(sl, 1600, 790, 4)
        const regs = [{ x: 1040, y: 350, r: -6 }, { x: 1400, y: 450, r: 4 }, { x: 1090, y: 660, r: -3 }]
        t.problem.scattered.forEach((nm, i) => { rect(sl, regs[i].x, regs[i].y, 300, 92, { fill: { color: CARD }, line: { color: 'D8D2C2', width: 0.75 }, rotate: regs[i].r, shadow: { type: 'outer', color: '0C2A4A', opacity: 0.2, blur: 6, offset: 3, angle: 90 } }); text(sl, nm, regs[i].x, regs[i].y, 300, 92, { align: 'center', valign: 'middle', bold: true, color: INKT, fontSize: PT(30), rotate: regs[i].r }) })
        paperCard(sl, 980, 850, 540, 140); text(sl, p.product.toUpperCase(), 1010, 868, 480, 26, { bold: true, color: C.blueD, fontSize: 11, charSpacing: 2 }); head(sl, t.problem.record, 1010, 900, 480, 80, 44)
        const cutBox2 = (im, right, bottom, maxW, maxH) => { const k = Math.min(maxW / im.w, maxH / im.h); const w = Math.round(im.w * k); const h = Math.round(im.h * k); return { x: right - w, y: bottom - h, w, h } }
        const cut = art('problem.cutout'); if (cut) { const b = cut.w / cut.h > 1.1 ? cutBox2(cut, 1795, 992, 300, 160) : cutBox2(cut, 1795, 990, 185, 380); pic(sl, cut, b.x, b.y, b.w, b.h, { alt: cut.alt }) }
      } else if (tab === 'intelligence') {
        text(sl, t.intelligence.lead, 140, 262, 780, 150, { fontSize: PT(32), bold: true, color: INKT })
        t.intelligence.modules.forEach((m, i) => { const y = 440 + i * 104; line(sl, 140, y, 920, y, { line: { color: 'C9C3B3', width: 1 } }); text(sl, m.name.toUpperCase(), 140, y + 12, 780, 26, { bold: true, color: C.blueD, fontSize: 11, charSpacing: 2 }); sl.addText([{ text: m.asks, options: { fontFace: 'Calibri', fontSize: PT(26), bold: true, color: INKT, highlight: MARK } }], { x: 140 * IN, y: (y + 38) * IN, w: 780 * IN, h: 66 * IN, margin: 0, valign: 'top', isTextBox: true }) })
        const HUB = { x: 1360, y: 545 }; const NODES = [{ x: 1150, y: 345 }, { x: 1570, y: 345 }, { x: 1150, y: 760 }, { x: 1570, y: 760 }]
        t.intelligence.modules.forEach((m, i) => line(sl, HUB.x, HUB.y, NODES[i].x, NODES[i].y, { line: { color: INKT, width: 3 } }))
        rect(sl, HUB.x - 115, HUB.y - 55, 230, 110, { fill: { color: MARK }, line: { color: INKT, width: 2.25 } }); text(sl, 'The school\u2019s records', HUB.x - 115, HUB.y - 55, 230, 110, { align: 'center', valign: 'middle', bold: true, color: INKT, fontSize: PT(26) })
        t.intelligence.modules.forEach((m, i) => { rect(sl, NODES[i].x - 130, NODES[i].y - 38, 260, 76, { fill: { color: CARD }, line: { color: INKT, width: 2.25 } }); text(sl, m.name, NODES[i].x - 130, NODES[i].y - 38, 260, 76, { align: 'center', valign: 'middle', bold: true, color: INKT, fontSize: PT(24) }) })
        text(sl, t.intelligence.close, 140, 890, 780, 90, { fontFace: HEAD, fontSize: PT(34), color: INKT })
      } else if (tab === 'ai') {
        text(sl, t.ai.lead, 140, 262, 800, 150, { fontSize: PT(32), bold: true, color: INKT })
        let y = 440
        t.ai.uses.forEach((u) => { const h = 52 + linesOf(u.line, 56) * 34; line(sl, 140, y, 940, y, { line: { color: 'C9C3B3', width: 1 } }); text(sl, u.name.toUpperCase(), 140, y + 12, 800, 26, { bold: true, color: C.blueD, fontSize: 11, charSpacing: 2 }); text(sl, u.line, 140, y + 42, 800, h - 40, { fontSize: PT(26), bold: true, color: INKT }); y += h })
        paperCard(sl, 1000, 280, 780, 520)
        sl.addText([labelRun(labels.draft)], { x: 1036 * IN, y: 310 * IN, w: 380 * IN, h: 26 * IN, margin: 0, fontFace: 'Calibri', isTextBox: true }); text(sl, t.ai.sample.label, 1400, 310, 346, 26, { color: C.tBody, align: 'right', fontSize: 11 })
        text(sl, t.ai.sample.text, 1036, 368, 708, 250, { fontSize: PT(30), color: INKT })
        if (hasButtons) {
          rect(sl, 1036, 720, 160, 56, { fill: { color: C.blue }, line: { color: C.blueD, width: 1.5 } }); text(sl, labels.apply, 1036, 720, 160, 56, { align: 'center', valign: 'middle', bold: true, color: 'FFFFFF', fontSize: PT(24) })
          rect(sl, 1214, 720, 170, 56, { fill: { color: CARD }, line: { color: INKT, width: 2 } }); text(sl, labels.discard, 1214, 720, 170, 56, { align: 'center', valign: 'middle', bold: true, color: INKT, fontSize: PT(24) })
          sl.addShape(pptx.ShapeType.ellipse, { x: 1580 * IN, y: 610 * IN, w: 150 * IN, h: 150 * IN, fill: { type: 'none' }, line: { color: C.green, width: 4.5 }, rotate: -14 })
          text(sl, labels.apply.toUpperCase(), 1580, 610, 150, 150, { align: 'center', valign: 'middle', bold: true, color: C.greenD, fontSize: 12, charSpacing: 2, rotate: -14 })
        }
        sl.addText(rich(t.ai.guard, 4, { fontFace: HEAD, fontSize: PT(34), color: INKT }), { x: 1000 * IN, y: 830 * IN, w: 780 * IN, h: 100 * IN, margin: 0, valign: 'top', isTextBox: true })
        text(sl, t.ai.control, 1000, 930, 780, 60, { fontSize: PT(26), color: C.tBody })
      } else if (tab === 'research') {
        text(sl, t.research.lead ?? 'Designed from', 140, 252, 560, 60, { fontSize: PT(32), color: INKT })
        const band = art('research.banner'); if (band) pic(sl, band, 740, 236, 1040, 96, { cover: true, transparency: 50, alt: band.alt })
        let y = 350
        t.research.items.forEach((r) => { const h = Math.max(96, 28 + linesOf(r.text, 68) * 34 + 12); line(sl, 140, y, 1780, y, { line: { color: 'C9C3B3', width: 1 } }); text(sl, r.text, 140, y + 14, 1080, h - 14, { fontFace: HEAD, fontSize: PT(28), color: INKT }); text(sl, r.source.toUpperCase(), 1260, y + 18, 520, h - 18, { bold: true, color: C.blueD, fontSize: 11, charSpacing: 2 }); y += h + 6 })
      } else if (tab === 'features') {
        const g = t.features.groups[step]
        const gr = []
        t.features.groups.forEach((x, i) => { if (i) gr.push({ text: '      ', options: { fontSize: 12 } }); gr.push({ text: `${String(i + 1).padStart(2, '0')}  ${x.title}`, options: { hyperlink: { slide: at(tf.groups[i]), tooltip: x.title }, bold: i === step, fontSize: 14, color: i === step ? INKT : '5A6B7F', underline: false, ...(i === step ? { highlight: MARK } : {}) } }) })
        sl.addText(gr, { x: 140 * IN, y: 244 * IN, w: 1640 * IN, h: 76 * IN, margin: 0, fontFace: 'Calibri', fontSize: 14, valign: 'middle', isTextBox: true })   // five long group titles wrap to a second line: the box is tall enough
        head(sl, g.title, 140, 340, 1640, 110, 70)
        const k = g.subs.length; const gap = 32; const cw = (1640 - gap * (k - 1)) / k; const ar = k <= 3 ? 1.5 : 4 / 3; const sh = Math.round(cw / ar)
        g.subs.forEach((s, j) => { const x = 140 + j * (cw + gap); const sub = p.subs.find((q) => q.id === s.id); const im = sub && imgOf(sub)   // the Features step keeps the product screenshot of each module
          paperCard(sl, x, 500, cw, sh)
          if (im) sl.addImage({ path: im.path, x: (x + 10) * IN, y: 510 * IN, w: (cw - 20) * IN, h: (sh - 20) * IN, sizing: { type: 'cover', w: (cw - 20) * IN, h: (sh - 20) * IN }, altText: `${s.name}: screen` })
          tape(sl, x + cw / 2 - 48, 486, -3, 96, 28)
          text(sl, s.name, x, 500 + sh + 26, cw, 40, { bold: true, color: INKT, fontSize: PT(28) }); text(sl, s.tagline, x, 500 + sh + 70, cw, 110, { color: C.tBody, fontSize: PT(24) }) })
      } else if (tab === 'roles') {
        const r = t.roles[step]
        t.roles.forEach((x, i) => { const y = 270 + i * 66; line(sl, 140, y, 580, y, { line: { color: 'C9C3B3', width: 1 } })
          sl.addText(`${String(i + 1).padStart(2, '0')}  ${x.role}`, { x: 140 * IN, y: (y + 14) * IN, w: 440 * IN, h: 40 * IN, margin: 0, fontFace: 'Calibri', fontSize: PT(26), color: i === step ? INKT : '5A6B7F', bold: i === step, valign: 'top', hyperlink: { slide: at(tf.roles[i]), tooltip: x.role }, isTextBox: true }) })
        text(sl, r.who.toUpperCase(), 660, 270, 1000, 28, { bold: true, color: C.blueD, fontSize: 11, charSpacing: 2 })
        head(sl, r.role, 660, 316, 1000, 110, r.role.length <= 18 ? 76 : r.role.length <= 24 ? 60 : 50)   // a long role name gets a smaller size: one line
        r.benefits.forEach((b, i) => { const y = 470 + i * 102; line(sl, 660, y, 1360, y, { line: { color: 'C9C3B3', width: 1 } }); text(sl, b, 660, y + 14, 700, 86, { fontSize: PT(28), bold: true, color: INKT }) })
        text(sl, `A DAY WITH ${p.product.toUpperCase()}. ILLUSTRATIVE.`, 660, 810, 700, 24, { bold: true, color: C.blueD, fontSize: 10, charSpacing: 2 })
        text(sl, r.use, 660, 846, 700, 130, { fontSize: PT(28), color: C.tBody })
        const many = t.roles.length > 3   // a taller role list pushes the module pills down
        text(sl, 'WHERE IT LIVES', 140, many ? 712 : 510, 440, 24, { bold: true, color: C.blueD, fontSize: 10, charSpacing: 2 })
        let px = 140; let py = many ? 756 : 560
        r.modules.forEach((m) => { const w = Math.round(m.name.length * 12.5 + 40); if (px + w > 580) { px = 140; py += 54 } rect(sl, px, py, w, 42, { fill: { color: CARD }, line: { color: INKT, width: 1.5 } }); text(sl, m.name, px, py, w, 42, { align: 'center', valign: 'middle', bold: true, color: INKT, fontSize: PT(22) }); px += w + 12 })
        const im = art(`roles.${step}`)
        if (im) { const h = Math.round(Math.min(520, 380 * (im.h / im.w))); const w = Math.round(h * (im.w / im.h)); pic(sl, im, 1780 - w, 1000 - h, w, h, { alt: im.alt }) }
      }
      chrome(sl, pk)
    })
    sl.addNotes([`${TAB_LABEL[tab]}${tab === 'features' ? ` (${t.features.groups[step].title})` : tab === 'roles' ? ` (${t.roles[step].role})` : ''}`, script ? `SAY: ${script}` : '', 'The links on the tab strip jump to any tab; the links at the top jump to any product. The situations and day-in-the-life lines are illustrations, not a customer\u2019s school.'].filter(Boolean).join('\n\n'))
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
    const blocks = [['What it is', f.summary, 140, 470], ['The problem it removes', f.problem, 140, 640], ['Technology', f.technology.join(' · '), 140, 810], ['What could become easier', f.benefit, 980, 470], [f.ai.length ? 'Where AI and intelligence help' : 'How it is built', (f.ai.length ? f.ai.slice(0, 3) : [f.research ?? f.technology.join(' · ')]).join(' · '), 980, 640]]
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
