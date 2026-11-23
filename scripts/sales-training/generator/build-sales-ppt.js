/* G2G Sales Presentation (PowerPoint, native hyperlinks, no macros).
 *   node build-sales-ppt.js   -> ../G2G-Sales-Presentation.pptx, ./sales-graph.json
 * Content: ./content/g2g-sales.js (modules, customer questions) and ./content/g2g.js (the conversation scenario).
 */
const fs = require('fs')
const path = require('path')
const pptxgen = require('pptxgenjs')
const JSZip = require('jszip')
const D = require('./content/g2g-sales')
const OUT = path.join(__dirname, '..', 'G2G-Sales-Presentation.pptx')
const ASSETS = path.join(__dirname, '..', 'assets')
const IMGS = path.join(__dirname, '.cache') // pictures, downloaded from the database by fetch-images.js

// Images: every entry comes from assets/manifest-*.json (licence-checked by the research step). Entries whose file is missing are ignored.
let MAN = []
if (fs.existsSync(ASSETS)) {
  for (const f of fs.readdirSync(ASSETS).filter((x) => /^manifest-.*\.json$/.test(x))) MAN.push(...JSON.parse(fs.readFileSync(path.join(ASSETS, f), 'utf8')))
}
MAN = MAN.filter((e) => { const ok = fs.existsSync(path.join(IMGS, e.file)); if (!ok) console.warn('picture not in .cache, skipped (run: node fetch-images.js):', e.file); return ok })
// Rejected after review although licence-checked: they would show something G2G does not document.
//  leave-1: the calendar is printed "MATERNITY LEAVE" (no such leave type is documented; the docs name CL, SL, PL, LWP).
//  attendance-1/-2: fingerprint scanners imply biometric attendance, which the docs list only as a possible v2 idea.
const AVOID = new Set(['leave-1', 'attendance-1', 'attendance-2'])
const pickImg = (id, use = 'module') => { const c = MAN.filter((e) => e.forModules.includes(id) && e.use === use && !AVOID.has(e.id)); return c.find((e) => e.primary) || c[0] || null }
const USED = new Map() // manifest id -> slide numbers where it appears

const C = {
  navy: '0B1F3A', teal: '0E9F8E', ink: '1B2A41', muted: '5B6B82', bg: 'F5F8FA', card: 'FFFFFF', border: 'D5DCE8', grey: 'E9EDF5',
  green: '1E9E5A', greenBg: 'E6F6EE', amber: 'C77700', amberBg: 'FFF3DC', red: 'C93B3B', redBg: 'FDEAEA',
}
const FONT = 'Calibri'
const RATING = {
  best: { label: 'BEST MOVE', color: C.green, bg: C.greenBg },
  partial: { label: 'PARTIAL: ACCEPTABLE BUT COSTLY', color: C.amber, bg: C.amberBg },
  poor: { label: 'POOR DECISION', color: C.red, bg: C.redBg },
}

/* ---------- graph ---------- */
const nodes = []
const byId = {}
const addNode = (id, type, title) => {
  if (byId[id]) throw new Error('duplicate node ' + id)
  const n = { id, type, title, num: nodes.length + 1, links: [] }
  nodes.push(n); byId[id] = n; return n
}
const N = (id) => { if (!byId[id]) throw new Error('unknown node ' + id); return byId[id].num }

const MODS = D.modules
const DEC = D.decisionIndexes.map((i, k) => ({ ...D.decisions[i], k }))
const LAST = DEC.length - 1

addNode('title', 'title', 'G2G')
addNode('home', 'home', 'What matters most to you?')
addNode('overview', 'overview', 'G2G at a glance')
addNode('modules', 'modules', 'The G2G modules')
MODS.forEach((m) => { addNode(`m:${m.id}`, 'module', m.name); addNode(`m:${m.id}:roles`, 'roles', `${m.name}: who gets what`) })
addNode('status', 'status', 'Where G2G is today')
addNode('faq', 'faq', 'Customer questions')
D.faq.forEach((f, i) => addNode(`q${i}`, 'answer', f.q))
addNode('sim', 'sim', 'Practise the sales conversation')
DEC.forEach((d, i) => {
  addNode(`d${i}S`, 'dec', `Decision ${i + 1}`)
  d.options.forEach((o, j) => addNode(`d${i}S:fb${j}`, 'fb', `D${i + 1} result`))
  addNode(`d${i}S:rec`, 'rec', `D${i + 1} recovery`)
  if (i > 0) { addNode(`d${i}M`, 'dec', `Decision ${i + 1} (wavering)`); d.options.forEach((o, j) => addNode(`d${i}M:fb${j}`, 'fb', `D${i + 1} result`)) }
  addNode(`lost${i}`, 'lost', `Deal lost at decision ${i + 1}`)
})
;['won', 'wonConc', 'stalled'].forEach((k) => addNode(`out:${k}`, 'out', D.outcomes[k].title))

function dest(i, lane, r) {
  const L = i === LAST
  if (lane === 'S') return r === 'best' ? (L ? 'out:won' : `d${i + 1}S`) : r === 'partial' ? (L ? 'out:wonConc' : `d${i + 1}M`) : `d${i}S:rec`
  return r === 'best' ? (L ? 'out:wonConc' : `d${i + 1}S`) : r === 'partial' ? (L ? 'out:stalled' : `d${i + 1}M`) : `lost${i}`
}
const recDest = (i, good) => (!good ? `lost${i}` : i === LAST ? 'out:stalled' : `d${i + 1}M`)
const confidenceOf = (id) => (/:d\d+S$|^d\d+S$/.test(id) ? 'Strong' : /^d\d+M$/.test(id) ? 'Wavering' : /:rec$/.test(id) ? 'At risk' : /^out:/.test(id) ? 'Final outcome' : /^lost/.test(id) ? 'Deal lost' : '')
const nextModule = (m) => MODS[MODS.indexOf(m) + 1]

/* ---------- drawing ---------- */
const pptx = new pptxgen()
pptx.layout = 'LAYOUT_WIDE'
pptx.title = 'G2G Sales Presentation'
pptx.subject = 'Interactive sales presentation with branching conversations'
pptx.company = 'G2G'

function btn(s, o) {
  const name = o.target === 'LAST' ? 'LINK|LAST' : `LINK|${N(o.target)}`
  s.addText(o.text, {
    shape: pptx.ShapeType.roundRect, rectRadius: 0.12, x: o.x, y: o.y, w: o.w, h: o.h,
    fill: { color: o.fill || C.navy }, line: { color: o.lineColor || o.fill || C.navy, width: o.lineW || 1 },
    color: o.color || 'FFFFFF', fontFace: FONT, fontSize: o.size || 14, bold: o.bold !== false,
    align: o.align || 'center', valign: 'middle', margin: o.margin == null ? 8 : o.margin, objectName: name,
  })
}
const card = (s, x, y, w, h, o = {}) => s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.1, fill: { color: o.fill || C.card }, line: { color: o.line || C.border, width: o.lineW || 1 } })
const text = (s, t, o) => s.addText(t, Object.assign({ fontFace: FONT, color: C.ink, fontSize: 16, valign: 'top', margin: 4 }, o))
const band = (s, x, y, w, h, color, label) => s.addText(label, { shape: pptx.ShapeType.rect, x, y, w, h, fill: { color }, line: { color }, color: 'FFFFFF', fontFace: FONT, fontSize: 15, bold: true, align: 'left', valign: 'middle', margin: 10 })
const bullets = (items, size, gap) => items.map((t) => ({ text: t, options: { bullet: { indent: 16 }, breakLine: true, paraSpaceAfter: gap == null ? 8 : gap } }))
const link = (n, label, target, role) => n.links.push({ label, to: target, role })
const notes = (s, t) => s.addNotes(t)
const slideFor = (id) => { const s = pptx.addSlide(); s.__id = id; return s }

/** Places an image to fill a box (cropped, never stretched), tags it so nobody mistakes it for the G2G screen, and returns its credit line. */
function addPhoto(s, e, x, y, w, h, slideNum) {
  const ar = e.width / e.height, br = w / h
  const iw = ar > br ? h * ar : w, ih = ar > br ? h : w / ar
  s.addImage({ path: path.join(IMGS, e.file), x, y, w: iw, h: ih, sizing: { type: 'cover', w, h }, altText: e.description || e.title })
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.05, fill: { color: 'FFFFFF', transparency: 100 }, line: { color: C.border, width: 1 } })
  const tag = e.kind === 'dashboard-reference' ? 'THIRD-PARTY EXAMPLE - NOT THE G2G SCREEN' : 'ILLUSTRATION - NOT A G2G SCREEN'
  s.addText(tag, { shape: pptx.ShapeType.roundRect, rectRadius: 0.06, x: x + 0.1, y: y + h - 0.42, w: Math.min(w - 0.2, 3.6), h: 0.32, fill: { color: C.navy, transparency: 15 }, line: { color: C.navy, transparency: 15 }, color: 'FFFFFF', fontFace: FONT, fontSize: 9, bold: true, align: 'center', valign: 'middle', margin: 2 })
  if (e.attribution_required) text(s, 'Image: ' + e.attribution_text, { x, y: y + h + 0.02, w, h: 0.4, fontSize: 7.5, color: C.muted, valign: 'top', margin: 0 })
  USED.set(e.id, [...(USED.get(e.id) || []), slideNum])
}
const nativeTag = (s, x, y, w, h) => s.addText('DIAGRAM DRAWN FOR THIS DECK', { shape: pptx.ShapeType.roundRect, rectRadius: 0.06, x: x + 0.1, y: y + h - 0.42, w: Math.min(w - 0.2, 3.0), h: 0.32, fill: { color: C.navy, transparency: 15 }, line: { color: C.navy, transparency: 15 }, color: 'FFFFFF', fontFace: FONT, fontSize: 9, bold: true, align: 'center', valign: 'middle', margin: 2 })
const NATIVE = {
  // Documented: staff punch in/out; a correction request goes to a manager or HR for approval; attendance data flows into payroll.
  attendance: (s, x, y, w, h, color) => {
    card(s, x, y, w, h, { fill: C.card })
    text(s, 'A day in Attendance', { x: x + 0.2, y: y + 0.12, w: w - 0.4, h: 0.4, fontSize: 15, bold: true, color })
    const steps = ['Staff punch in and out', 'Missed punch? Send a correction request', 'Manager or HR approves', 'Attendance flows into payroll']
    const bh = 0.56, gap = 0.2
    steps.forEach((t, i) => {
      const by = y + 0.65 + i * (bh + gap)
      s.addText(t, { shape: pptx.ShapeType.roundRect, rectRadius: 0.1, x: x + 0.25, y: by, w: w - 0.5, h: bh, fill: { color: i === 3 ? C.navy : color }, line: { color: i === 3 ? C.navy : color }, color: 'FFFFFF', fontFace: FONT, fontSize: 13, bold: true, align: 'center', valign: 'middle', margin: 6 })
      if (i < steps.length - 1) s.addShape(pptx.ShapeType.line, { x: x + w / 2, y: by + bh, w: 0, h: gap, line: { color: C.muted, width: 2, endArrowType: 'triangle' } })
    })
    nativeTag(s, x, y, w, h)
  },
  // Documented: role-to-competency frameworks (FRAC-aligned option); skills matrix and competency gap reports.
  competency: (s, x, y, w, h, color) => {
    card(s, x, y, w, h, { fill: C.card })
    text(s, 'From role to skills picture', { x: x + 0.2, y: y + 0.12, w: w - 0.4, h: 0.4, fontSize: 15, bold: true, color })
    const steps = [['A role', 'e.g. any job in your organisation'], ['Competency framework', 'what the role needs'], ['Skills matrix and gap report', 'who has it, who does not']]
    steps.forEach(([t, sub], i) => {
      const by = y + 0.7 + i * 1.0
      s.addText([{ text: t, options: { bold: true, fontSize: 14, breakLine: true } }, { text: sub, options: { bold: false, fontSize: 10.5 } }], { shape: pptx.ShapeType.roundRect, rectRadius: 0.1, x: x + 0.25, y: by, w: w - 0.5, h: 0.7, fill: { color: i === 2 ? C.navy : color }, line: { color: i === 2 ? C.navy : color }, color: 'FFFFFF', fontFace: FONT, align: 'center', valign: 'middle', margin: 4 })
      if (i < steps.length - 1) s.addShape(pptx.ShapeType.line, { x: x + w / 2, y: by + 0.7, w: 0, h: 0.3, line: { color: C.muted, width: 2, endArrowType: 'triangle' } })
    })
    nativeTag(s, x, y, w, h)
  },
  // Documented: 6-level competency rating scale, expected competency per role, self-rating, gap reports. Positions are an example, not data.
  gap: (s, x, y, w, h, color) => {
    card(s, x, y, w, h, { fill: C.card })
    text(s, 'Six-level rating: an example', { x: x + 0.2, y: y + 0.12, w: w - 0.4, h: 0.4, fontSize: 15, bold: true, color })
    const sw = (w - 0.5) / 6
    for (let i = 0; i < 6; i++) {
      s.addText(String(i + 1), { shape: pptx.ShapeType.rect, x: x + 0.25 + i * sw, y: y + 1.7, w: sw - 0.04, h: 0.55, fill: { color: i < 3 ? color : i < 5 ? 'C9B6F5' : 'E9E3FB' }, line: { color: 'FFFFFF' }, color: i < 3 ? 'FFFFFF' : C.ink, fontFace: FONT, fontSize: 15, bold: true, align: 'center', valign: 'middle', margin: 0 })
    }
    const cx = (lvl) => x + 0.25 + (lvl - 0.5) * sw
    s.addText('Expected for the role', { x: cx(5) - 0.9, y: y + 0.95, w: 1.8, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: C.navy, align: 'center', margin: 0 })
    s.addShape(pptx.ShapeType.line, { x: cx(5), y: y + 1.27, w: 0, h: 0.42, line: { color: C.navy, width: 2, endArrowType: 'triangle' } })
    s.addText('Current rating', { x: cx(3) - 0.9, y: y + 2.7, w: 1.8, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color, align: 'center', margin: 0 })
    s.addShape(pptx.ShapeType.line, { x: cx(3), y: y + 2.28, w: 0, h: 0.42, line: { color, width: 2, beginArrowType: 'triangle' } })
    s.addText('Gap', { shape: pptx.ShapeType.roundRect, rectRadius: 0.08, x: cx(3) + 0.15, y: y + 3.0, w: cx(5) - cx(3) - 0.3, h: 0.32, fill: { color: C.amberBg }, line: { color: C.amber }, color: C.amber, fontFace: FONT, fontSize: 11, bold: true, align: 'center', valign: 'middle', margin: 0 })
    text(s, 'Example only, not real data', { x: x + 0.2, y: y + 3.3, w: w - 0.4, h: 0.22, fontSize: 9.5, italic: true, color: C.muted, margin: 0 })
    nativeTag(s, x, y, w, h)
  },
  // Documented: reports catalog across modules, filters (department, employee, date range, status), export to Excel or PDF.
  reports: (s, x, y, w, h, color) => {
    card(s, x, y, w, h, { fill: C.card })
    text(s, 'One catalog of reports', { x: x + 0.2, y: y + 0.12, w: w - 0.4, h: 0.4, fontSize: 15, bold: true, color })
    const fam = ['Attendance', 'Leave', 'Payroll', 'Talent', 'Skills', 'Learning', 'Tasks']
    fam.forEach((t, i) => {
      const cw = (w - 0.7) / 2
      const bx = x + 0.25 + (i % 2) * (cw + 0.2), by = y + 0.6 + Math.floor(i / 2) * 0.42
      s.addText(t, { shape: pptx.ShapeType.roundRect, rectRadius: 0.08, x: bx, y: by, w: i === 6 ? w - 0.5 : cw, h: 0.34, fill: { color: i === 6 ? color : 'E6F1F8' }, line: { color }, color: i === 6 ? 'FFFFFF' : color, fontFace: FONT, fontSize: 12, bold: true, align: 'center', valign: 'middle', margin: 0 })
    })
    text(s, 'Filter by department, employee, date range and status', { x: x + 0.2, y: y + 2.35, w: w - 0.4, h: 0.4, fontSize: 11.5, color: C.ink, margin: 0 })
    const bars = [0.35, 0.6, 0.45, 0.8]
    bars.forEach((v, i) => s.addShape(pptx.ShapeType.rect, { x: x + 0.35 + i * 0.55, y: y + 3.35 - v * 0.55, w: 0.38, h: v * 0.55, fill: { color: i === 3 ? color : 'B9D6E8' }, line: { color: i === 3 ? color : 'B9D6E8' } }))
    text(s, 'Export: Excel / PDF', { x: x + 2.45, y: y + 2.85, w: w - 2.55, h: 0.3, fontSize: 10.5, bold: true, color: C.navy, margin: 0 })
    text(s, 'Example, not real data', { x: x + 2.45, y: y + 3.12, w: w - 2.55, h: 0.25, fontSize: 9, italic: true, color: C.muted, margin: 0 })
    nativeTag(s, x, y, w, h)
  },
  // Documented: KASBA = Knowledge, Ability, Skill, Behaviour, Attitude; ready library of 3,572 tasks, 268 roles, 128 skills.
  kasba: (s, x, y, w, h, color) => {
    card(s, x, y, w, h, { fill: C.card })
    text(s, 'KASBA', { x: x + 0.2, y: y + 0.1, w: w - 0.4, h: 0.45, fontSize: 20, bold: true, color })
    const parts = [['K', 'Knowledge'], ['A', 'Ability'], ['S', 'Skill'], ['B', 'Behaviour'], ['A', 'Attitude']]
    parts.forEach(([l, t], i) => {
      const by = y + 0.65 + i * 0.5
      s.addText(l, { shape: pptx.ShapeType.ellipse, x: x + 0.25, y: by, w: 0.42, h: 0.42, fill: { color }, line: { color }, color: 'FFFFFF', fontFace: FONT, fontSize: 14, bold: true, align: 'center', valign: 'middle', margin: 0 })
      text(s, t, { x: x + 0.8, y: by, w: w - 1.0, h: 0.42, fontSize: 16, color: C.ink, valign: 'middle' })
    })
    s.addText('3,572 tasks | 268 job roles | 128 skills', { shape: pptx.ShapeType.roundRect, rectRadius: 0.08, x: x + 0.2, y: y + 3.2, w: w - 0.4, h: 0.42, fill: { color: C.grey }, line: { color: C.border }, color: C.navy, fontFace: FONT, fontSize: 12, bold: true, align: 'center', valign: 'middle', margin: 2 })
    nativeTag(s, x, y, w, h)
  },
}
const creditNote = (e) => (e ? ' Image: ' + e.title + ' by ' + e.creator + ' (' + e.license + '), ' + e.source_url + '. Illustrative only, not a G2G screen.' : '')

function frame(s, n, o) {
  s.background = { color: C.bg }
  s.addText('G2G', { shape: pptx.ShapeType.roundRect, rectRadius: 0.1, x: 0.4, y: 0.27, w: 0.85, h: 0.44, fill: { color: o.color || C.teal }, line: { color: o.color || C.teal }, color: 'FFFFFF', fontFace: FONT, fontSize: 15, bold: true, align: 'center', valign: 'middle', margin: 0 })
  text(s, o.title, { x: 1.4, y: 0.15, w: o.chip ? 8.9 : 11.4, h: 0.68, fontSize: o.titleSize || 28, bold: true, color: C.navy, valign: 'middle' })
  if (o.chip) text(s, o.chip, { x: 10.3, y: 0.25, w: 2.65, h: 0.48, fontSize: 12, color: C.muted, align: 'right', valign: 'middle' })
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.92, w: 13.33, h: 0.05, fill: { color: o.color || C.teal }, line: { color: o.color || C.teal } })
  const y = 6.98
  let x = 0.4
  const add = (label, target) => { btn(s, { x, y, w: 1.25, h: 0.38, text: label, target, fill: C.grey, color: C.ink, size: 11, lineColor: C.border }); x += 1.35 }
  add('Home', 'home')
  add('Back', 'LAST')
  if (o.extra) for (const [label, target] of o.extra) add(label, target)
  text(s, `${n.num}`, { x: 12.2, y: 7.0, w: 0.8, h: 0.34, fontSize: 10, color: C.muted, align: 'right', valign: 'middle' })
}
function chipStatus(s, kind, label, x, y, w) {
  const ok = kind === 'ok'
  s.addText(label, { shape: pptx.ShapeType.roundRect, rectRadius: 0.1, x, y, w, h: 0.38, fill: { color: ok ? C.greenBg : C.amberBg }, line: { color: ok ? C.green : C.amber, width: 1 }, color: ok ? C.green : C.amber, fontFace: FONT, fontSize: 11, bold: true, align: 'center', valign: 'middle', margin: 2 })
}

/* ---------- slides ---------- */
const stageLine = (d, i) => `Decision ${i + 1} of ${DEC.length}`

// TITLE
{
  const n = byId.title; const s = slideFor(n.id)
  s.background = { color: C.navy }
  s.addShape(pptx.ShapeType.ellipse, { x: 8.3, y: -1.8, w: 7.2, h: 7.2, fill: { color: C.teal, transparency: 72 }, line: { color: C.teal, transparency: 72 } })
  s.addShape(pptx.ShapeType.ellipse, { x: 10.3, y: 2.4, w: 4.6, h: 4.6, fill: { color: 'FFFFFF', transparency: 92 }, line: { color: 'FFFFFF', transparency: 85 } })
  s.addShape(pptx.ShapeType.ellipse, { x: -1.2, y: 5.2, w: 3.6, h: 3.6, fill: { color: C.teal, transparency: 80 }, line: { color: C.teal, transparency: 80 } })
  text(s, D.title.name, { x: 0.8, y: 1.0, w: 8, h: 1.7, fontSize: 96, bold: true, color: 'FFFFFF', valign: 'middle' })
  text(s, D.title.line, { x: 0.8, y: 2.8, w: 9.2, h: 0.9, fontSize: 32, color: 'FFFFFF' })
  text(s, D.title.sub, { x: 0.8, y: 3.8, w: 8.6, h: 0.9, fontSize: 17, color: 'B7C4D8' })
  btn(s, { x: 0.8, y: 5.3, w: 4.0, h: 0.85, text: 'Start the presentation  >', target: 'home', fill: C.teal, size: 20 }); link(n, 'Start', 'home', 'start')
  btn(s, { x: 5.0, y: 5.3, w: 3.6, h: 0.85, text: 'Customer questions', target: 'faq', fill: 'FFFFFF', color: C.navy, size: 17 }); link(n, 'Customer questions', 'faq', 'nav')
  btn(s, { x: 8.8, y: 5.3, w: 4.0, h: 0.85, text: 'Practise the sales conversation', target: 'sim', fill: 'FFFFFF', color: C.navy, size: 17 }); link(n, 'Practise', 'sim', 'nav')
  text(s, 'Run in Slide Show mode (F5). Click the buttons to choose where to go.', { x: 0.8, y: 6.7, w: 9, h: 0.4, fontSize: 12, color: '8FA2BF' })
  notes(s, 'Title slide. Start the presentation opens the topic chooser. Customer questions and the conversation practice are also reachable from here and from Home.')
}

// HOME
{
  const n = byId.home; const s = slideFor(n.id)
  frame(s, n, { title: 'What matters most to you?', chip: 'Pick a topic' })
  const tiles = [...D.journeys.map(([t, sub, id], i) => ({ t, sub, target: `m:${id}`, color: MODS.find((m) => m.id === id).color })), { t: 'G2G at a glance', sub: 'How the twelve modules fit together', target: 'overview', color: C.navy }]
  tiles.forEach((tl, i) => {
    const x = 0.4 + (i % 3) * 4.2, y = 1.35 + Math.floor(i / 3) * 2.15
    s.addShape(pptx.ShapeType.rect, { x, y, w: 0.14, h: 1.95, fill: { color: tl.color }, line: { color: tl.color } })
    btn(s, { x: x + 0.14, y, w: 3.9, h: 1.95, text: [{ text: tl.t, options: { fontSize: 24, bold: true, color: C.navy, breakLine: true } }, { text: tl.sub, options: { fontSize: 15, bold: false, color: C.muted } }], target: tl.target, fill: C.card, lineColor: C.border, align: 'left', margin: 18 })
    link(n, tl.t, tl.target, 'journey')
  })
  btn(s, { x: 0.4, y: 5.85, w: 3.9, h: 0.7, text: 'Customer questions', target: 'faq', fill: C.teal, size: 17 }); link(n, 'Customer questions', 'faq', 'nav')
  btn(s, { x: 4.6, y: 5.85, w: 3.9, h: 0.7, text: 'Where G2G is today', target: 'status', fill: C.card, color: C.navy, lineColor: C.navy, size: 17 }); link(n, 'Where G2G is today', 'status', 'nav')
  btn(s, { x: 8.8, y: 5.85, w: 4.1, h: 0.7, text: 'Practise the sales conversation', target: 'sim', fill: C.card, color: C.navy, lineColor: C.navy, size: 17 }); link(n, 'Practise', 'sim', 'nav')
  notes(s, 'Let the customer pick what matters most. Each tile opens the first module for that need; every module slide has a Next module button to continue.')
}

// OVERVIEW: how the modules fit together, drawn natively (no third-party image), plus the "where teams start" photo
{
  const n = byId.overview; const s = slideFor(n.id)
  frame(s, n, { title: 'G2G at a glance', chip: 'How it fits together', extra: [['All modules', 'modules']] })
  const mod = (id) => MODS.find((m) => m.id === id)
  const box = (id, x, y, w, dashed) => {
    const m = mod(id)
    btn(s, { x, y, w, h: 0.62, text: dashed ? [{ text: m.name, options: { breakLine: true, fontSize: 12.5 } }, { text: 'in development', options: { fontSize: 9, bold: false } }] : m.name, target: `m:${id}`, fill: dashed ? C.card : m.color, color: dashed ? m.color : 'FFFFFF', lineColor: m.color, lineW: dashed ? 2 : 1, size: 12.5, margin: 3 })
    link(n, m.name, `m:${id}`, 'module')
  }
  const lab = (t, y) => text(s, t, { x: 0.4, y, w: 4, h: 0.3, fontSize: 12, bold: true, color: C.muted })
  lab('PEOPLE OPERATIONS', 1.2); box('attendance', 0.4, 1.5, 2.1); box('payroll', 2.95, 1.5, 2.1); box('leave', 5.5, 1.5, 1.9)
  s.addShape(pptx.ShapeType.line, { x: 2.5, y: 1.81, w: 0.45, h: 0, line: { color: C.navy, width: 2.25, endArrowType: 'triangle' } })
  text(s, 'attendance feeds payroll', { x: 1.6, y: 2.14, w: 2.6, h: 0.25, fontSize: 9.5, color: C.muted, align: 'center', margin: 0 })
  lab('SKILLS AND LEARNING', 2.45); box('competency', 0.4, 2.75, 1.6); box('kasba', 2.2, 2.75, 1.6); box('gap', 4.0, 2.75, 1.6); box('lms', 5.8, 2.75, 1.6)
  s.addShape(pptx.ShapeType.line, { x: 5.6, y: 3.06, w: 0.2, h: 0, line: { color: C.muted, width: 2, dashType: 'dash', endArrowType: 'triangle' } })
  text(s, 'courses linked to skills: in development', { x: 3.9, y: 3.4, w: 3.6, h: 0.25, fontSize: 9.5, color: C.muted, align: 'right', margin: 0 })
  lab('TALENT, TASKS AND AI', 3.7); box('talent', 0.4, 4.0, 2.1); box('tasks', 2.95, 4.0, 2.1); box('ai', 5.5, 4.0, 1.9, true)
  btn(s, { x: 0.4, y: 4.85, w: 7.0, h: 0.5, text: 'Reports and analytics across all modules', target: 'm:reports', fill: mod('reports').color, size: 13 }); link(n, 'Reports', 'm:reports', 'module')
  btn(s, { x: 0.4, y: 5.45, w: 7.0, h: 0.45, text: 'Organisation and access: one directory of people and the right access for each role', target: 'm:org', fill: mod('org').color, size: 12 }); link(n, 'Organisation', 'm:org', 'module')
  text(s, 'Solid = built. Dashed = still in development. Click any box to open the module.', { x: 0.4, y: 5.95, w: 7.0, h: 0.3, fontSize: 10.5, italic: true, color: C.muted })
  const pe = pickImg('problems', 'problems')
  if (pe) { addPhoto(s, pe, 7.75, 1.3, 5.15, 3.45, n.num); text(s, 'Where many teams start: paper records and spreadsheets.', { x: 7.75, y: 4.82, w: 5.15, h: 0.35, fontSize: 13, italic: true, color: C.ink }) }
  btn(s, { x: 7.75, y: 5.45, w: 2.5, h: 0.6, text: 'All modules', target: 'modules', fill: C.card, color: C.navy, lineColor: C.navy, size: 14 }); link(n, 'All modules', 'modules', 'nav')
  btn(s, { x: 10.4, y: 5.45, w: 2.5, h: 0.6, text: 'Customer questions', target: 'faq', fill: C.teal, size: 14 }); link(n, 'Questions', 'faq', 'nav')
  notes(s, 'Overview diagram drawn for this deck. Documented link: attendance data flows into payroll (G2G v1 docs). Courses linked to skills (competency-linked learning) is in development (portfolio G2G-04); the Workforce AI assistant is in development (G2G-08).' + creditNote(pe))
}

// MODULES OVERVIEW
{
  const n = byId.modules; const s = slideFor(n.id)
  frame(s, n, { title: 'The G2G modules', chip: 'Click a module' })
  MODS.forEach((m, i) => {
    const x = 0.4 + (i % 4) * 3.15, y = 1.25 + Math.floor(i / 4) * 1.85
    s.addShape(pptx.ShapeType.rect, { x, y, w: 3.0, h: 0.12, fill: { color: m.color }, line: { color: m.color } })
    btn(s, { x, y: y + 0.12, w: 3.0, h: 1.55, text: [{ text: m.name, options: { fontSize: 17, bold: true, color: m.color, breakLine: true } }, { text: m.short, options: { fontSize: 11.5, bold: false, color: C.ink } }], target: `m:${m.id}`, fill: C.card, lineColor: C.border, align: 'left', margin: 12 })
    link(n, m.name, `m:${m.id}`, 'module')
  })
  notes(s, 'All twelve modules. Source: G2G v1 documentation (CCB overview, index, reports catalog) and the product portfolio.')
}

// MODULE + ROLES
MODS.forEach((m) => {
  const mn = byId[`m:${m.id}`]; const s = slideFor(mn.id)
  const nx = nextModule(m)
  const native = NATIVE[m.id]
  const img = native ? null : pickImg(m.id)
  frame(s, mn, { title: m.name, color: m.color, chip: 'Module', extra: [['All modules', 'modules']] })
  text(s, m.short, { x: 0.4, y: 1.03, w: 8.0, h: 0.45, fontSize: 18, italic: true, color: C.muted })
  chipStatus(s, m.status[1], m.status[0], 8.3, 1.07, 4.65)
  const rows = [['The typical situation', C.amber, m.problem], ['What G2G does', m.color, m.does], ['What it means for you', C.green, m.benefit]]
  if (img || native) {
    if (native) native(s, 0.4, 1.55, 3.9, 3.95, m.color)
    else addPhoto(s, img, 0.4, 1.55, 3.9, 3.95, mn.num)
    const hs = [1.0, 1.95, 1.2]
    let y = 1.55
    rows.forEach(([label, col, items], i) => {
      card(s, 4.5, y, 8.4, hs[i])
      s.addText(label, { shape: pptx.ShapeType.rect, x: 4.5, y, w: 1.55, h: hs[i], fill: { color: col }, line: { color: col }, color: 'FFFFFF', fontFace: FONT, fontSize: 13, bold: true, align: 'left', valign: 'middle', margin: 8 })
      text(s, bullets(items, 13.5, 4), { x: 6.12, y: y + 0.05, w: 6.7, h: hs[i] - 0.1, fontSize: 13.5, valign: 'middle' })
      y += hs[i] + 0.12
    })
  } else {
    rows.forEach(([label, col, items], i) => {
      const x = 0.4 + i * 4.2
      card(s, x, 1.6, 4.05, 4.15)
      band(s, x, 1.6, 4.05, 0.5, col, label)
      text(s, bullets(items, 17, 9), { x: x + 0.1, y: 2.2, w: 3.85, h: 3.5, fontSize: 17 })
    })
  }
  text(s, `Good to know: ${m.statusNote}`, { x: 0.4, y: 5.95, w: 12.5, h: 0.4, fontSize: 12, color: C.muted, italic: true })
  btn(s, { x: 0.4, y: 6.35, w: 4.2, h: 0.5, text: 'Who gets what: role by role', target: `m:${m.id}:roles`, fill: m.color, size: 14 }); link(mn, 'Roles', `m:${m.id}:roles`, 'roles')
  if (nx) { btn(s, { x: 9.4, y: 6.35, w: 3.5, h: 0.5, text: `Next: ${nx.name}  >`, target: `m:${nx.id}`, fill: C.card, color: C.navy, lineColor: C.navy, size: 12 }); link(mn, 'Next', `m:${nx.id}`, 'next') }
  notes(s, `Sources: ${m.src}. "Typical situation" describes the customer's world, not a G2G claim. "What it means for you" restates documented functions in plain words; no figures or savings are claimed.` + creditNote(img))

  const rn = byId[`m:${m.id}:roles`]; const r = slideFor(rn.id)
  frame(r, rn, { title: `${m.name}: who gets what`, color: m.color, chip: 'By role', titleSize: 26 })
  m.roles.forEach(([role, work], i) => {
    const cols2 = m.roles.length > 3 ? 2 : 1
    const w = cols2 === 2 ? 6.15 : 12.5
    const x = 0.4 + (cols2 === 2 ? (i % 2) * 6.35 : 0)
    const y = cols2 === 2 ? 1.3 + Math.floor(i / 2) * 2.2 : 1.3 + i * 1.55
    const hh = cols2 === 2 ? 2.0 : 1.4
    card(r, x, y, w, hh)
    r.addShape(pptx.ShapeType.rect, { x, y, w: 0.14, h: hh, fill: { color: m.color }, line: { color: m.color } })
    text(r, role, { x: x + 0.3, y: y + 0.12, w: w - 0.5, h: 0.5, fontSize: 22, bold: true, color: m.color })
    text(r, work, { x: x + 0.3, y: y + 0.65, w: w - 0.5, h: hh - 0.7, fontSize: 18 })
  })
  btn(r, { x: 0.4, y: 6.3, w: 3.6, h: 0.55, text: 'Back to the module', target: `m:${m.id}`, fill: C.card, color: C.navy, lineColor: C.navy, size: 14 }); link(rn, 'Back', `m:${m.id}`, 'nav')
  if (nx) { btn(r, { x: 10.0, y: 6.3, w: 2.9, h: 0.55, text: `Next: ${nx.name}  >`, target: `m:${nx.id}`, fill: m.color, size: 14 }); link(rn, 'Next', `m:${nx.id}`, 'next') }
  else { btn(r, { x: 10.0, y: 6.3, w: 2.9, h: 0.55, text: 'Customer questions  >', target: 'faq', fill: m.color, size: 14 }); link(rn, 'Questions', 'faq', 'next') }
  notes(r, `Roles are listed only where the documentation names them on a screen, report or access table. Sources: ${m.src}.`)
})

// STATUS
{
  const n = byId.status; const s = slideFor(n.id)
  frame(s, n, { title: 'Where G2G is today', chip: 'Honest status', extra: [['Customer questions', 'faq']] })
  card(s, 0.4, 1.3, 6.15, 4.3, { fill: C.greenBg, line: C.green }); band(s, 0.4, 1.3, 6.15, 0.55, C.green, 'Built and ready to show')
  text(s, bullets(D.status.ready, 17, 8), { x: 0.5, y: 1.95, w: 5.95, h: 3.6, fontSize: 17 })
  card(s, 6.75, 1.3, 6.15, 4.3, { fill: C.amberBg, line: C.amber }); band(s, 6.75, 1.3, 6.15, 0.55, C.amber, 'Being completed or in development')
  text(s, bullets(D.status.coming, 17, 8), { x: 6.85, y: 1.95, w: 5.95, h: 3.6, fontSize: 17 })
  s.addText(D.status.note, { shape: pptx.ShapeType.roundRect, rectRadius: 0.1, x: 0.4, y: 5.8, w: 12.5, h: 0.75, fill: { color: C.navy }, line: { color: C.navy }, color: 'FFFFFF', fontFace: FONT, fontSize: 18, bold: true, align: 'center', valign: 'middle' })
  notes(s, `Sources: ${D.status.sources} Presenter note: no G2G module is in production at a client yet (portfolio: "Built, no production client"). Do not claim customers or results.`)
}

// FAQ hub
{
  const n = byId.faq; const s = slideFor(n.id)
  frame(s, n, { title: 'Customer questions', chip: 'Click a question' })
  D.faq.forEach((f, i) => {
    const x = 0.4 + (i % 2) * 6.35, y = 1.25 + Math.floor(i / 2) * 1.08
    btn(s, { x, y, w: 6.15, h: 0.95, text: f.q, target: `q${i}`, fill: C.card, color: C.navy, lineColor: C.teal, lineW: 2, size: 17, align: 'left', margin: 16 })
    link(n, f.q, `q${i}`, 'question')
  })
  notes(s, 'Typical customer questions and objections. Each answer slide gives an honest answer and the documented facts behind it.')
}

// FAQ answers
D.faq.forEach((f, i) => {
  const an = byId[`q${i}`]; const s = slideFor(an.id)
  const nxt = D.faq[i + 1]
  frame(s, an, { title: f.q, titleSize: f.q.length > 44 ? 22 : 26, chip: `Question ${i + 1} of ${D.faq.length}`, extra: [['All questions', 'faq']] })
  card(s, 0.4, 1.3, 7.7, 4.45); band(s, 0.4, 1.3, 7.7, 0.5, C.teal, 'What to say')
  text(s, f.say, { x: 0.55, y: 1.95, w: 7.4, h: 3.7, fontSize: f.say.length > 230 ? 21 : 24 })
  card(s, 8.3, 1.3, 4.6, 4.45, { fill: C.grey }); band(s, 8.3, 1.3, 4.6, 0.5, C.navy, 'Behind the answer')
  text(s, bullets(f.why, 14, 7), { x: 8.4, y: 1.95, w: 4.4, h: 3.7, fontSize: 14.5 })
  let bx = 0.4
  if (f.module) { btn(s, { x: bx, y: 6.0, w: 3.6, h: 0.65, text: 'Show the module  >', target: `m:${f.module}`, fill: C.teal, size: 16 }); link(an, 'Show the module', `m:${f.module}`, 'show'); bx += 3.8 }
  if (f.status) { btn(s, { x: bx, y: 6.0, w: 3.6, h: 0.65, text: 'Where G2G is today  >', target: 'status', fill: C.teal, size: 16 }); link(an, 'Status', 'status', 'show'); bx += 3.8 }
  if (nxt) { btn(s, { x: 9.3, y: 6.0, w: 3.6, h: 0.65, text: 'Next question  >', target: `q${i + 1}`, fill: C.card, color: C.navy, lineColor: C.navy, size: 15 }); link(an, 'Next question', `q${i + 1}`, 'next') }
  link(an, 'All questions', 'faq', 'nav')
  notes(s, `Honest answer using documented facts only. Facts behind it: ${f.why.join(' | ')}`)
})

// SIM intro
{
  const n = byId.sim; const s = slideFor(n.id)
  frame(s, n, { title: 'Practise the sales conversation', chip: 'Fictional customer', titleSize: 26, extra: [['Customer questions', 'faq']] })
  card(s, 0.4, 1.3, 6.5, 4.5)
  s.addText(D.persona.initial, { shape: pptx.ShapeType.ellipse, x: 0.7, y: 1.55, w: 1.3, h: 1.3, fill: { color: C.teal }, line: { color: C.teal }, color: 'FFFFFF', fontFace: FONT, fontSize: 40, bold: true, align: 'center', valign: 'middle', margin: 0 })
  text(s, D.persona.name, { x: 2.2, y: 1.55, w: 4.5, h: 0.6, fontSize: 26, bold: true, color: C.navy })
  text(s, D.persona.role, { x: 2.2, y: 2.15, w: 4.5, h: 0.7, fontSize: 15, color: C.muted })
  text(s, bullets(D.persona.bullets, 15, 6), { x: 0.6, y: 3.05, w: 6.2, h: 2.2, fontSize: 15 })
  text(s, D.persona.note, { x: 0.6, y: 5.25, w: 6.2, h: 0.5, fontSize: 11.5, italic: true, color: C.amber })
  const se = pickImg('scenario', 'scenario')
  const hy = se ? 3.35 : 1.3
  if (se) addPhoto(s, se, 7.1, 1.3, 5.8, 2.1, n.num)
  card(s, 7.1, se ? 3.55 : 1.3, 5.8, se ? 2.25 : 4.5, { fill: C.grey })
  text(s, 'How it works', { x: 7.3, y: se ? 3.6 : 1.4, w: 5.4, h: 0.45, fontSize: se ? 18 : 22, bold: true, color: C.navy })
  text(s, bullets([`${DEC.length} decisions: opening, the customer's problems, a fit question, a competitor, price and closing`, 'Each choice leads to its own customer reaction and result', 'Poor choices can lose the deal; there is one chance to recover', 'Endings: won, won with concessions, stalled or lost, with a replay'], 13, 4), { x: 7.3, y: se ? 4.05 : 2.0, w: 5.4, h: se ? 1.7 : 3.7, fontSize: se ? 13 : 16 })
  btn(s, { x: 0.4, y: 6.0, w: 4.4, h: 0.7, text: 'Start the conversation  >', target: 'd0S', fill: C.teal, size: 18 }); link(n, 'Start', 'd0S', 'start')
  notes(s, 'Conversation practice. The customer and all quotes are fictional; the photo is an illustration, not a real customer. Product facts in the answers come from the G2G documentation and portfolio.' + creditNote(se))
}

// Scenario
DEC.forEach((d, i) => {
  const sec = `${stageLine(d, i)}`
  for (const lane of i === 0 ? ['S'] : ['S', 'M']) {
    const dn = byId[`d${i}${lane}`]; const s = slideFor(dn.id)
    const strong = lane === 'S'
    frame(s, dn, { title: d.stage, titleSize: 24, chip: sec, extra: [['Scenario start', 'sim']] })
    card(s, 0.4, 1.3, 5.9, 3.7)
    s.addText(D.persona.initial, { shape: pptx.ShapeType.ellipse, x: 0.6, y: 1.45, w: 0.85, h: 0.85, fill: { color: C.teal }, line: { color: C.teal }, color: 'FFFFFF', fontFace: FONT, fontSize: 26, bold: true, align: 'center', valign: 'middle', margin: 0 })
    text(s, D.persona.name, { x: 1.6, y: 1.5, w: 4.5, h: 0.4, fontSize: 16, bold: true })
    text(s, D.persona.role, { x: 1.6, y: 1.88, w: 4.6, h: 0.5, fontSize: 11, color: C.muted })
    const q = strong ? d.scene : d.sceneM
    text(s, q, { x: 0.6, y: 2.5, w: 5.6, h: 2.45, fontSize: q.length > 170 ? 17 : 20, italic: true })
    s.addText(`Customer confidence: ${strong ? 'STRONG' : 'WAVERING'}`, { shape: pptx.ShapeType.roundRect, rectRadius: 0.1, x: 0.4, y: 5.15, w: 5.9, h: 0.5, fill: { color: strong ? C.greenBg : C.amberBg }, line: { color: strong ? C.green : C.amber, width: 1 }, color: strong ? C.green : C.amber, fontFace: FONT, fontSize: 15, bold: true, align: 'center', valign: 'middle' })
    text(s, strong ? 'The customer is engaged. Protect that.' : 'An earlier misstep made the customer wary. A best move can win trust back; a poor one will end the deal.', { x: 0.4, y: 5.72, w: 5.9, h: 0.9, fontSize: 12, color: C.muted })
    text(s, d.prompt, { x: 6.6, y: 1.25, w: 6.3, h: 0.5, fontSize: 20, bold: true, color: C.teal })
    d.options.forEach((o, j) => {
      const y = 1.9 + j * 1.6
      s.addText(String.fromCharCode(65 + j), { shape: pptx.ShapeType.ellipse, x: 6.6, y: y + 0.45, w: 0.55, h: 0.55, fill: { color: C.teal }, line: { color: C.teal }, color: 'FFFFFF', fontFace: FONT, fontSize: 16, bold: true, align: 'center', valign: 'middle', margin: 0 })
      const to = `d${i}${lane}:fb${j}`
      btn(s, { x: 7.25, y, w: 5.65, h: 1.48, text: o.label, target: to, fill: C.card, color: C.ink, size: o.label.length > 190 ? 12.5 : o.label.length > 120 ? 14 : 15.5, bold: false, align: 'left', lineColor: C.teal, margin: 10 })
      link(dn, o.label, to, o.rating)
    })
    notes(s, `Fictional customer (${strong ? 'strong' : 'wavering'} confidence). Each option leads to its own result slide.`)

    d.options.forEach((o, j) => {
      const fn = byId[`d${i}${lane}:fb${j}`]; const f = slideFor(fn.id)
      const rt = RATING[o.rating]
      frame(f, fn, { title: `Decision ${i + 1} result`, color: rt.color, chip: sec })
      f.addText(rt.label, { shape: pptx.ShapeType.roundRect, rectRadius: 0.1, x: 0.4, y: 1.2, w: 4.6, h: 0.5, fill: { color: rt.bg }, line: { color: rt.color, width: 1.5 }, color: rt.color, fontFace: FONT, fontSize: 15, bold: true, align: 'center', valign: 'middle' })
      text(f, `You chose: ${o.label}`, { x: 5.2, y: 1.12, w: 7.7, h: 0.75, fontSize: 12, italic: true, color: C.muted })
      ;[['Customer reaction', o.react, C.teal], ['What happens', o.result, rt.color], ['Why', o.coach, C.navy]].forEach(([h, t, col], b) => {
        const x = 0.4 + b * 4.2
        card(f, x, 2.05, 4.05, 3.45)
        f.addShape(pptx.ShapeType.rect, { x, y: 2.05, w: 4.05, h: 0.1, fill: { color: col }, line: { color: col } })
        text(f, h, { x: x + 0.15, y: 2.2, w: 3.75, h: 0.4, fontSize: 16, bold: true, color: col })
        text(f, t, { x: x + 0.15, y: 2.65, w: 3.75, h: 2.8, fontSize: t.length > 150 ? 17 : 19 })
      })
      const to = dest(i, lane, o.rating)
      text(f, `Customer confidence after this move: ${confidenceOf(to)}`, { x: 0.4, y: 5.62, w: 7.0, h: 0.4, fontSize: 14, bold: true, color: rt.color })
      const lbl = to.endsWith(':rec') ? "See the customer's response  >" : /^out:/.test(to) ? 'See the outcome  >' : /^lost/.test(to) ? 'See what happens  >' : 'Continue  >'
      btn(f, { x: 7.4, y: 5.95, w: 3.4, h: 0.72, text: lbl, target: to, fill: rt.color, size: 16 }); link(fn, lbl, to, 'continue')
      btn(f, { x: 10.95, y: 5.95, w: 1.95, h: 0.72, text: 'Return to decision', target: `d${i}${lane}`, fill: C.card, color: C.ink, size: 12.5, lineColor: C.border }); link(fn, 'Return', `d${i}${lane}`, 'return')
      notes(f, `Rating: ${o.rating}. ${o.coach}`)
    })

    if (strong) {
      const rn = byId[`d${i}S:rec`]; const r = slideFor(rn.id)
      frame(r, rn, { title: 'Recovery moment', color: C.red, chip: sec })
      card(r, 0.4, 1.3, 5.9, 3.7, { fill: C.redBg, line: C.red })
      text(r, d.recovery.line, { x: 0.6, y: 1.5, w: 5.5, h: 2.6, fontSize: 21, italic: true })
      text(r, 'Customer confidence: AT RISK. You have one chance to recover.', { x: 0.4, y: 5.2, w: 5.9, h: 0.8, fontSize: 15, bold: true, color: C.red })
      text(r, 'How do you respond?', { x: 6.6, y: 1.25, w: 6.3, h: 0.5, fontSize: 20, bold: true, color: C.red })
      btn(r, { x: 6.6, y: 1.95, w: 6.3, h: 1.7, text: d.recovery.good, target: recDest(i, true), fill: C.card, color: C.ink, size: 15, bold: false, align: 'left', lineColor: C.green, margin: 12 }); link(rn, 'Recover', recDest(i, true), 'recover')
      btn(r, { x: 6.6, y: 3.85, w: 6.3, h: 1.7, text: d.recovery.bad, target: recDest(i, false), fill: C.card, color: C.ink, size: 15, bold: false, align: 'left', lineColor: C.red, margin: 12 }); link(rn, 'Double down', recDest(i, false), 'double-down')
      btn(r, { x: 10.0, y: 5.95, w: 2.9, h: 0.65, text: 'Return to decision', target: `d${i}S`, fill: C.card, color: C.ink, size: 13, lineColor: C.border }); link(rn, 'Return', `d${i}S`, 'return')
      notes(r, 'A poor decision gets one recovery chance.')
    }
  }
  const ln = byId[`lost${i}`]; const l = slideFor(ln.id)
  frame(l, ln, { title: D.outcomes.lost.title, color: C.red, chip: sec })
  card(l, 0.4, 1.3, 7.4, 3.2, { fill: C.redBg, line: C.red })
  text(l, `${D.persona.name} ends the conversation`, { x: 0.6, y: 1.45, w: 7.0, h: 0.5, fontSize: 18, bold: true })
  text(l, d.lost, { x: 0.6, y: 2.1, w: 7.0, h: 2.2, fontSize: 22, italic: true })
  card(l, 8.0, 1.3, 4.9, 3.2)
  text(l, 'Where it went wrong', { x: 8.15, y: 1.4, w: 4.6, h: 0.45, fontSize: 17, bold: true, color: C.red })
  text(l, `Decision ${i + 1}: ${d.stage}. Replay it and try a different approach.`, { x: 8.15, y: 1.95, w: 4.6, h: 2.4, fontSize: 16 })
  btn(l, { x: 0.4, y: 4.9, w: 4.4, h: 0.75, text: `Replay decision ${i + 1}  >`, target: `d${i}S`, fill: C.red, size: 17 }); link(ln, 'Replay', `d${i}S`, 'replay')
  btn(l, { x: 5.0, y: 4.9, w: 3.6, h: 0.75, text: 'Start over', target: 'd0S', fill: C.card, color: C.ink, size: 15, lineColor: C.border }); link(ln, 'Start over', 'd0S', 'replay')
  btn(l, { x: 8.8, y: 4.9, w: 4.1, h: 0.75, text: 'Back to the presentation', target: 'home', fill: C.card, color: C.ink, size: 15, lineColor: C.border }); link(ln, 'Presentation', 'home', 'nav')
  notes(l, 'Unsuccessful outcome: deal lost.')
})

// Outcomes
;[['won', 'Excellent', C.green, C.greenBg], ['wonConc', 'Good, with room to improve', C.amber, C.amberBg], ['stalled', 'Needs work', C.amber, C.amberBg]].forEach(([key, tier, col, bg]) => {
  const on = byId[`out:${key}`]; const s = slideFor(on.id); const o = D.outcomes[key]
  frame(s, on, { title: o.title, titleSize: 24, color: col, chip: 'Final outcome' })
  card(s, 0.4, 1.3, 7.6, 3.5, { fill: bg, line: col })
  text(s, 'What happened', { x: 0.55, y: 1.4, w: 7.3, h: 0.45, fontSize: 17, bold: true, color: col })
  text(s, o.text, { x: 0.55, y: 1.95, w: 7.3, h: 2.8, fontSize: 19 })
  card(s, 8.2, 1.3, 4.7, 3.5)
  text(s, 'Sales performance', { x: 8.35, y: 1.4, w: 4.4, h: 0.45, fontSize: 16, bold: true, color: col })
  text(s, tier, { x: 8.35, y: 1.9, w: 4.4, h: 0.5, fontSize: 22, bold: true, color: col })
  text(s, bullets(o.lessons, 14, 6), { x: 8.3, y: 2.5, w: 4.5, h: 2.3, fontSize: 14 })
  btn(s, { x: 0.4, y: 5.1, w: 3.7, h: 0.75, text: 'Replay the conversation  >', target: 'd0S', fill: col, size: 16 }); link(on, 'Replay', 'd0S', 'replay')
  btn(s, { x: 4.3, y: 5.1, w: 3.7, h: 0.75, text: 'Customer questions', target: 'faq', fill: C.card, color: C.ink, size: 15, lineColor: C.border }); link(on, 'Questions', 'faq', 'nav')
  btn(s, { x: 8.2, y: 5.1, w: 4.7, h: 0.75, text: 'Back to the presentation', target: 'home', fill: C.card, color: C.ink, size: 15, lineColor: C.border }); link(on, 'Presentation', 'home', 'nav')
  notes(s, `Outcome: ${key}.`)
})

/* ---------- checks, post-process, write ---------- */
const order = pptx._slides.map((s) => s.__id)
order.forEach((id, i) => { if (id !== nodes[i].id) throw new Error(`slide order mismatch at ${i}: ${id} vs ${nodes[i].id}`) })
if (order.length !== nodes.length) throw new Error('not every node rendered')

// graph checks: reachability from the title, distinct option destinations, every link target exists
{
  const seen = new Set([1]); const q = [1]
  const num = (id) => byId[id].num
  while (q.length) { const c = q.shift(); for (const l of nodes[c - 1].links) { const t = typeof l.to === 'string' ? num(l.to) : l.to; if (!seen.has(t)) { seen.add(t); q.push(t) } } }
  const unreachable = nodes.filter((n) => !seen.has(n.num) && n.id !== 'home' && !n.id.startsWith('lost')).map((n) => n.id)
  // Home is reached from every footer, lost slides from the fail paths, both recorded; list anything else
  const all = nodes.filter((n) => !seen.has(n.num)).map((n) => n.id)
  if (all.length) throw new Error('unreachable slides: ' + all.join(', '))
  for (const n of nodes.filter((x) => x.type === 'dec')) {
    const opts = n.links.filter((l) => ['best', 'partial', 'poor'].includes(l.role))
    if (opts.length !== 3 || new Set(opts.map((l) => l.to)).size !== 3) throw new Error(n.id + ': options do not lead to three different slides')
  }
}

function writeAssetDoc() {
  const L = ['# G2G Sales Presentation: image asset references', '', 'Generated by `generator/build-sales-ppt.js` from `assets/manifest-*.json`. Retrieved 2026-11-17.', '',
    '**How images are used.** Every picture is an illustration or an example. None is a real G2G screenshot (the deck has none, because no G2G product screenshots exist in the repositories). Each image on a slide carries a tag: "ILLUSTRATION - NOT A G2G SCREEN" or, for third-party dashboards, "THIRD-PARTY EXAMPLE - NOT THE G2G SCREEN". Images are chosen to show what a module does in general; they do not add features G2G lacks.', '',
    '**Not used:** Dribbble and other design-showcase sites (their shots are copyrighted and are design inspiration only); proprietary product screenshots; anything under a non-commercial, no-derivatives or share-alike licence.', '',
    '| Used on slide(s) | Module / use | Kind | Title | Creator | Licence | Source | Credit line | Note |', '|---|---|---|---|---|---|---|---|---|']
  const used = MAN.filter((e) => USED.has(e.id))
  for (const e of used) L.push(`| ${USED.get(e.id).join(', ')} | ${e.forModules.join(', ')} (${e.use}) | ${e.kind} | ${e.title} | ${e.creator} | [${e.license}](${e.license_url}) | [page](${e.source_url}) | ${e.attribution_text} | ${e.caution || ''} |`)
  const WHY = {
    'leave-1': 'The calendar is printed "MATERNITY LEAVE"; the docs name CL, SL, PL and LWP, not maternity leave.',
    'attendance-1': 'Fingerprint scanner: implies biometric attendance, which the docs list only as a possible v2 idea.',
    'attendance-2': 'Fingerprint scanner: implies biometric attendance, which the docs list only as a possible v2 idea.',
  }
  const rejected = MAN.filter((e) => AVOID.has(e.id))
  if (rejected.length) { L.push('', '## Licence-checked but rejected after review', '', '| File | Title | Licence | Reason |', '|---|---|---|---|'); for (const e of rejected) L.push(`| ${e.file} | ${e.title} | ${e.license} | ${WHY[e.id] || 'Rejected after review'} |`) }
  const spare = MAN.filter((e) => !USED.has(e.id) && !AVOID.has(e.id))
  if (spare.length) { L.push('', '## Verified, not used (backups)', '', '| File | Module | Title | Creator | Licence | Source |', '|---|---|---|---|---|---|'); for (const e of spare) L.push(`| ${e.file} | ${e.forModules.join(', ')} | ${e.title} | ${e.creator} | ${e.license} | ${e.source_url} |`) }
  L.push('', '## Not images: diagrams drawn for this deck', '', 'Overview diagram; Attendance flow; Competency management; KASBA; Gap assessment (six-level example); Reports catalog. Drawn from documented facts with native PowerPoint shapes; no third-party asset and no licence needed.')
  fs.writeFileSync(path.join(ASSETS, 'ASSET-REFERENCES.md'), L.join('\n') + '\n')
}

async function post(buf) {
  const zip = await JSZip.loadAsync(buf)
  let count = 0
  for (let i = 1; i <= nodes.length; i++) {
    const sp = `ppt/slides/slide${i}.xml`, rp = `ppt/slides/_rels/slide${i}.xml.rels`
    let xml = await zip.file(sp).async('string')
    let rels = await zip.file(rp).async('string')
    const targets = {}
    xml = xml.replace(/<p:cNvPr id="(\d+)" name="LINK\|([^"]+)"([^>]*?)(?:\/>|>\s*<\/p:cNvPr>)/g, (m, id, tgt, rest) => {
      count++
      if (tgt === 'LAST') return `<p:cNvPr id="${id}" name="Back button"${rest}><a:hlinkClick r:id="" action="ppaction://hlinkshowjump?jump=lastslideviewed" tooltip="Back to the slide you just viewed"/></p:cNvPr>`
      const rid = (targets[tgt] ||= `rIdNav${tgt}`)
      return `<p:cNvPr id="${id}" name="Button to slide ${tgt}"${rest}><a:hlinkClick r:id="${rid}" action="ppaction://hlinksldjump"/></p:cNvPr>`
    })
    if (/name="LINK\|/.test(xml)) throw new Error(`unreplaced link in slide ${i}`)
    const add = Object.entries(targets).map(([t, rid]) => `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slide${t}.xml"/>`).join('')
    zip.file(sp, xml); zip.file(rp, rels.replace('</Relationships>', add + '</Relationships>'))
  }
  return { out: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }), count }
}

;(async () => {
  const buf = await pptx.write({ outputType: 'nodebuffer' })
  const { out, count } = await post(buf)
  fs.writeFileSync(OUT, out)
  writeAssetDoc()
  fs.writeFileSync(path.join(__dirname, 'sales-graph.json'), JSON.stringify(nodes.map((n) => ({ num: n.num, id: n.id, type: n.type, title: n.title, links: n.links.map((l) => ({ label: l.label, to: typeof l.to === 'string' ? N(l.to) : l.to, role: l.role })) })), null, 1))
  console.log(`wrote ${OUT}\nslides: ${nodes.length}, injected links: ${count}`)
})().catch((e) => { console.error(e); process.exit(1) })
