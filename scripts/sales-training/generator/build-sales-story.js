/* G2G Sales Presentation (PowerPoint, native hyperlinks, no macros).
 *   node build-sales-ppt.js   -> ../G2G-Sales-Branching-Presentation.pptx, ./sales-graph.json
 * Content: ./content/g2g-sales.js (modules, customer questions) and ./content/g2g.js (the conversation scenario).
 */
const fs = require('fs')
const path = require('path')
const pptxgen = require('pptxgenjs')
const JSZip = require('jszip')
const D = require('./content/g2g-story')
const OUT = path.join(__dirname, '..', 'G2G-Sales-Branching-Presentation.pptx')
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
  if (n.id !== 'modules') add('Modules', 'modules')
  if (o.extra) for (const [label, target] of o.extra) add(label, target)
  text(s, `${n.num}`, { x: 12.2, y: 7.0, w: 0.8, h: 0.34, fontSize: 10, color: C.muted, align: 'right', valign: 'middle' })
}
function chipStatus(s, kind, label, x, y, w) {
  const ok = kind === 'ok'
  s.addText(label, { shape: pptx.ShapeType.roundRect, rectRadius: 0.1, x, y, w, h: 0.38, fill: { color: ok ? C.greenBg : C.amberBg }, line: { color: ok ? C.green : C.amber, width: 1 }, color: ok ? C.green : C.amber, fontFace: FONT, fontSize: 11, bold: true, align: 'center', valign: 'middle', margin: 2 })
}


/* ================= salesperson-led presentation ================= */
const S = require('./content/g2g-sales')
const G = require('./content/g2g-guide')
C.navy2 = '14305A'
const IC = (name) => path.join(IMGS, 'icons', name + '.png')
const SH = { type: 'outer', color: '0B1F3A', opacity: 0.16, blur: 9, offset: 2, angle: 90 }
const P = D.paths
const PK = P.map((p) => p.key)
const DY = 0.4 // content slides: everything below the header is drawn with y + DY (room for the top navigation bar)
const MORDER = ['attendance', 'leave', 'payroll', 'competency', 'kasba', 'gap', 'lms', 'talent', 'tasks', 'reports', 'org']
const AREA = { A: { icon: 'clock', color: P[0].color }, B: { icon: 'target', color: P[1].color }, C: { icon: 'graduation-cap', color: P[2].color }, D: { icon: 'chart-pie', color: P[3].color } }
const PROB_ICON = { A: 'file-spreadsheet', B: 'search', C: 'book-open', D: 'eye' }
const ROLE_ICON = { hr: 'user-cog', mgr: 'users', emp: 'user', fin: 'wallet', prin: 'landmark', adm: 'settings' }
const MOD = {
  attendance: { icon: 'clock', vis: ['native', 'attendance'], rel: ['feat:payroll', 'feat:leave'] },
  leave: { icon: 'calendar-days', vis: ['photo', 'leave'], rel: ['feat:attendance', 'feat:reports'] },
  payroll: { icon: 'wallet', vis: ['photo', 'payroll'], rel: ['feat:attendance', 'feat:reports'] },
  competency: { icon: 'target', vis: ['native', 'competency'], rel: ['feat:kasba', 'feat:gap'] },
  kasba: { icon: 'library', vis: ['native', 'kasba'], rel: ['feat:competency', 'feat:gap'] },
  gap: { icon: 'chart-column', vis: ['native', 'gap'], rel: ['feat:competency', 'feat:lms'] },
  lms: { icon: 'graduation-cap', vis: ['native', 'learn'], rel: ['feat:gap', 'feat:talent'] },
  talent: { icon: 'users', vis: ['photo', 'talent'], rel: ['feat:lms', 'feat:gap'] },
  tasks: { icon: 'list-checks', vis: ['photo', 'tasks'], rel: ['feat:reports', 'feat:org'] },
  reports: { icon: 'chart-pie', vis: ['native', 'reports'], rel: ['feat:attendance', 'feat:gap'] },
  org: { icon: 'network', vis: ['photo', 'org'], rel: ['roles', 'feat:reports'] },
}

/** A native diagram panel for one module, drawn from documented facts (same data as the browser version). */
const flowPanel = (d) => (s, x, y, w, h, color) => {
  card(s, x, y, w, h, { fill: C.card })
  text(s, d.title, { x: x + 0.2, y: y + 0.1, w: w - 0.4, h: 0.5, fontSize: 14, bold: true, color, valign: 'middle', margin: 0 })
  const n = d.steps.length
  const top = y + 0.7, bottom = y + h - (d.foot ? 0.95 : 0.55), gap = d.kind === 'flow' ? 0.24 : 0.1
  const bh = Math.min(0.62, (bottom - top - gap * (n - 1)) / n)
  d.steps.forEach((t, i) => {
    const by = top + i * (bh + gap)
    const last = d.kind === 'flow' && i === n - 1
    s.addText(t, { shape: pptx.ShapeType.roundRect, rectRadius: 0.1, x: x + 0.25, y: by, w: w - 0.5, h: bh, fill: { color: last ? C.navy : color }, line: { color: last ? C.navy : color }, color: 'FFFFFF', fontFace: FONT, fontSize: bh < 0.5 ? 9.5 : 11.5, bold: true, align: 'center', valign: 'middle', margin: 2 })
    if (d.kind === 'flow' && i < n - 1) s.addShape(pptx.ShapeType.line, { x: x + w / 2, y: by + bh, w: 0, h: gap, line: { color: C.muted, width: 2, endArrowType: 'triangle' } })
  })
  if (d.foot) text(s, d.foot, { x: x + 0.2, y: y + h - 0.9, w: w - 0.4, h: 0.45, fontSize: 10, italic: true, color: C.muted, valign: 'middle', margin: 0 })
  nativeTag(s, x, y, w, h)
}
for (const id of ['leave', 'payroll', 'talent', 'tasks', 'org']) { MOD[id].vis = ['native', 'flow-' + id]; NATIVE['flow-' + id] = flowPanel(G.diagrams[id]) }

/* ---------- graph ---------- */
const nodes = []
const byId = {}
const addNode = (id, type, title) => {
  if (byId[id]) throw new Error('duplicate node ' + id)
  const n = { id, type, title, num: nodes.length + 1, links: [] }
  nodes.push(n); byId[id] = n; return n
}
const N = (id) => { if (!byId[id]) throw new Error('unknown node ' + id); return byId[id].num }
addNode('home', 'home', 'G2G Sales Home')
addNode('roles', 'hub', 'Roles')
addNode('modules', 'hub', 'Modules')
addNode('problems', 'hub', 'Business Problems')
addNode('solutions', 'hub', 'Solutions')
addNode('scenarios', 'hub', 'Sales Scenarios')
D.roles.forEach((r) => addNode('role:' + r.key, 'role', r.name))
MORDER.forEach((id) => addNode('mod:' + id, 'module', D.moduleById[id].name))
MORDER.forEach((id) => addNode('feat:' + id, 'feature', D.moduleById[id].name + ': features'))
PK.forEach((k) => addNode('conv:' + k, 'conv', 'Conversation ' + k))
addNode('questions', 'answer', 'Customer questions')
addNode('closing', 'closing', 'Sales closing')

const sectionOf = (id) => id === 'home' ? 'Home' : id === 'roles' || id.startsWith('role:') ? 'Roles' : id === 'modules' || id.startsWith('mod:') || id.startsWith('feat:') ? 'Modules' : id === 'problems' ? 'Business Problems' : id === 'solutions' ? 'Solutions' : 'Sales Scenarios'

/* ---------- drawing kit ---------- */
const slideFor2 = (id) => { const s = pptx.addSlide(); s.__id = id; return s }
const rr = (s, x, y, w, h, o = {}) => s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: o.r == null ? 0.12 : o.r, fill: { color: o.fill || C.card }, line: { color: o.line || C.border, width: o.lw || 1 }, ...(o.noShadow ? {} : { shadow: { ...SH } }) })
const badge = (s, icon, x, y, d, color) => {
  s.addShape(pptx.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color }, line: { color } })
  if (icon) s.addImage({ path: IC(icon), x: x + d * 0.2, y: y + d * 0.2, w: d * 0.6, h: d * 0.6, altText: icon + ' icon' })
}
/** A transparent click area placed above a card, so the whole card is the button. */
const hit = (s, n, x, y, w, h, target, label, role) => {
  s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: 'FFFFFF', transparency: 100 }, line: { color: 'FFFFFF', transparency: 100, width: 0 }, objectName: `LINK|${N(target)}` })
  link(n, label, target, role || 'nav')
}
const pill = (s, label, x, y, w, h, fill, color, size) => s.addText(label, { shape: pptx.ShapeType.roundRect, rectRadius: 0.1, x, y, w, h, fill: { color: fill }, line: { color: fill }, color, fontFace: FONT, fontSize: size || 11, bold: true, align: 'center', valign: 'middle', margin: 2 })
const arrowText = (s, label, x, y, w, color) => text(s, label + '  >', { x, y, w, h: 0.32, fontSize: 12.5, bold: true, color, margin: 0, valign: 'middle' })
const small = (s, n, label, target, x, y, w, o = {}) => { btn(s, { x, y, w, h: o.h || 0.4, text: label, target, fill: o.fill || C.card, color: o.color || C.navy, lineColor: o.line || C.border, size: o.size || 11.5 }); link(n, label, target, o.role || 'nav') }
const note = (s, t) => s.addNotes(t)
/** An external link (native PowerPoint hyperlink) that opens the live G2G page in the browser. */
const demoBtn = (s, label, p, x, y, w, h, color) => s.addText(label, { shape: pptx.ShapeType.roundRect, rectRadius: 0.12, x, y, w, h, fill: { color }, line: { color }, color: 'FFFFFF', fontFace: FONT, fontSize: 11.5, bold: true, align: 'center', valign: 'middle', margin: 2, objectName: 'LINK|URL|' + G.demoBase + p })

const NAV = [['Home', 'home', 1.0], ['Roles', 'roles', 1.0], ['Modules', 'modules', 1.2], ['Business Problems', 'problems', 1.9], ['Solutions', 'solutions', 1.3], ['Sales Scenarios', 'scenarios', 1.65]]
function topbar(s, n) {
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.52, fill: { color: C.navy2 }, line: { color: C.navy2 } })
  pill(s, 'G2G', 0.3, 0.09, 0.85, 0.34, C.teal, 'FFFFFF', 14)
  const active = sectionOf(n.id)
  let x = 1.35
  const put = (label, target, w, fill, lineColor) => { btn(s, { x, y: 0.09, w, h: 0.34, text: label, target, fill, color: 'FFFFFF', lineColor, size: 11.5, margin: 2 }); x += w + 0.08 }
  put('< Back', 'LAST', 0.9, C.navy2, '5F7BA8')
  for (const [label, target, w] of NAV) put(label, target, w, label === active ? C.teal : C.navy2, label === active ? C.teal : '3A5380')
}
function shiftSlide(s, dy) {
  const aT = s.addText.bind(s), aS = s.addShape.bind(s), aI = s.addImage.bind(s)
  const sh = (o) => (o && typeof o.y === 'number' ? { ...o, y: o.y + dy } : o)
  s.addText = (t, o) => aT(t, sh(o)); s.addShape = (k, o) => aS(k, sh(o)); s.addImage = (o) => aI(sh(o))
}
function page(s, n, o) {
  s.background = { color: C.bg }
  topbar(s, n)
  const left = o.icon ? 1.15 : 0.4
  if (o.icon) badge(s, o.icon, 0.4, 0.62, 0.62, o.color || C.teal)
  text(s, o.title, { x: left, y: 0.58, w: 11.6, h: 0.5, fontSize: o.titleSize || 26, bold: true, color: C.navy, valign: 'middle', margin: 0 })
  if (o.sub) text(s, o.sub, { x: left, y: 1.06, w: 11.8, h: 0.32, fontSize: 13, color: C.muted, valign: 'middle', margin: 0 })
  shiftSlide(s, DY) // from here on, y is relative to the content area (1.3 is just under the header)
}
const panel = (s, x, y, w, h, title, color, items, size) => {
  rr(s, x, y, w, h)
  s.addShape(pptx.ShapeType.rect, { x: x + 0.15, y: y + 0.14, w: 0.07, h: 0.28, fill: { color }, line: { color } })
  text(s, title, { x: x + 0.3, y: y + 0.1, w: w - 0.45, h: 0.36, fontSize: 13, bold: true, color, valign: 'middle', margin: 0 })
  text(s, bullets(items, size || 11, 4), { x: x + 0.15, y: y + 0.5, w: w - 0.3, h: h - 0.58, fontSize: size || 11, margin: 0 })
}
const usersOf = (m) => D.roles.filter((r) => m.roles.some(([nm]) => r.match.includes(nm)))

/* learning panel (native, drawn from documented facts) */
NATIVE.learn = (s, x, y, w, h, color) => {
  card(s, x, y, w, h, { fill: C.card })
  text(s, 'Learning and appraisal', { x: x + 0.2, y: y + 0.12, w: w - 0.4, h: 0.4, fontSize: 15, bold: true, color })
  const row = (label, steps, by, col) => {
    text(s, label, { x: x + 0.2, y: by, w: w - 0.4, h: 0.3, fontSize: 11, bold: true, color: C.muted, margin: 0 })
    const sw = (w - 0.5) / steps.length
    steps.forEach((t, i) => s.addText(t, { shape: pptx.ShapeType.roundRect, rectRadius: 0.08, x: x + 0.25 + i * sw, y: by + 0.32, w: sw - 0.06, h: 0.62, fill: { color: i === steps.length - 1 ? C.navy : col }, line: { color: i === steps.length - 1 ? C.navy : col }, color: 'FFFFFF', fontFace: FONT, fontSize: 10.5, bold: true, align: 'center', valign: 'middle', margin: 2 }))
  }
  row('LEARNING', ['Catalog', 'Assign', 'Assess', 'Certify'], y + 0.7, color)
  row('APPRAISAL', ['Self', 'Peer', 'Evaluator', 'Management'], y + 1.95, C.teal)
  text(s, 'Courses linked to skills: in development', { x: x + 0.2, y: y + 3.1, w: w - 0.4, h: 0.3, fontSize: 10.5, italic: true, color: C.amber, margin: 0 })
  nativeTag(s, x, y, w, h)
}

/* ---------- HOME ---------- */
{
  const n = byId.home; const s = slideFor2(n.id)
  s.background = { color: C.navy }
  s.addShape(pptx.ShapeType.ellipse, { x: 8.6, y: -1.8, w: 7.6, h: 7.6, fill: { color: C.teal, transparency: 75 }, line: { color: C.teal, transparency: 75 } })
  s.addShape(pptx.ShapeType.ellipse, { x: 10.8, y: 1.5, w: 4.4, h: 4.4, fill: { color: 'FFFFFF', transparency: 93 }, line: { color: 'FFFFFF', transparency: 88 } })
  topbar(s, n)
  text(s, 'Your people, skills and learning on one platform', { x: 0.6, y: 0.95, w: 9.2, h: 1.5, fontSize: 38, bold: true, color: 'FFFFFF', valign: 'top', margin: 0 })
  text(s, S.title.sub, { x: 0.6, y: 2.55, w: 8.8, h: 0.7, fontSize: 16, color: 'B7C4D8', margin: 0 })
  text(s, 'WHERE WOULD YOU LIKE TO START?', { x: 0.6, y: 3.4, w: 6, h: 0.3, fontSize: 12, bold: true, color: '7FD6CB', margin: 0 })
  const cards = [['Roles', 'Start from who is in the room', 'users', 'roles'], ['Modules', 'Eleven modules in four areas', 'layout-grid', 'modules'], ['Business Problems', 'Start from what hurts most', 'circle-help', 'problems'], ['Solutions', 'Problem to business value', 'lightbulb', 'solutions'], ['Sales Scenarios', 'Live customer conversations', 'message-square', 'scenarios']]
  cards.forEach(([t, sub, ic, target], i) => {
    const x = 0.6 + i * 2.45, y = 3.8, w = 2.3, h = 3.2
    rr(s, x, y, w, h, { fill: 'FFFFFF', line: 'FFFFFF', noShadow: true })
    badge(s, ic, x + 0.25, y + 0.3, 0.9, C.teal)
    text(s, t, { x: x + 0.2, y: y + 1.4, w: w - 0.4, h: 0.7, fontSize: 18, bold: true, color: C.navy, valign: 'top', margin: 0 })
    text(s, sub, { x: x + 0.2, y: y + 2.1, w: w - 0.4, h: 0.55, fontSize: 12, color: C.muted, margin: 0 })
    arrowText(s, 'Open', x + 0.2, y + 2.7, 1.2, C.teal)
    hit(s, n, x, y, w, h, target, t, 'section')
  })
  note(s, 'Home. The salesperson controls the meeting from here and from the navigation bar at the top (Home | Roles | Modules | Business Problems | Solutions | Sales Scenarios). Start from the room: by role, by module, by the customer\'s problem, by solution, or through a live conversation. Product facts come from the G2G v1 documentation and the product portfolio; unfinished parts are labelled where they appear.')
}

/* ---------- ROLES ---------- */
{
  const n = byId.roles; const s = slideFor2(n.id)
  page(s, n, { title: 'Roles', sub: 'Who is in the room? Pick the role to see the modules it uses.' })
  D.roles.forEach((r, i) => {
    const x = 0.4 + (i % 3) * 4.2, y = 1.4 + Math.floor(i / 3) * 2.75, w = 4.05, h = 2.55
    rr(s, x, y, w, h)
    s.addShape(pptx.ShapeType.rect, { x, y: y + 0.2, w: 0.09, h: h - 0.4, fill: { color: r.color }, line: { color: r.color } })
    badge(s, ROLE_ICON[r.key], x + 0.3, y + 0.25, 0.8, r.color)
    text(s, r.name, { x: x + 1.25, y: y + 0.25, w: w - 1.4, h: 0.8, fontSize: 19, bold: true, color: C.navy, valign: 'middle', margin: 0 })
    text(s, r.sub, { x: x + 0.3, y: y + 1.25, w: w - 0.5, h: 0.6, fontSize: 12.5, color: C.muted, margin: 0 })
    text(s, r.modules.map((id) => D.moduleById[id].name).slice(0, 4).join(', ') + (r.modules.length > 4 ? '...' : ''), { x: x + 0.3, y: y + 1.8, w: w - 0.5, h: 0.4, fontSize: 10.5, italic: true, color: r.color, margin: 0 })
    arrowText(s, r.modules.length + ' modules', x + 0.3, y + 2.15, 2.5, r.color)
    hit(s, n, x, y, w, h, 'role:' + r.key, r.name, 'role')
  })
  note(s, 'Roles. Only roles documented in the G2G v1 documentation are shown (ROLES-PERMISSIONS and the module pages). "Department Head" is not a documented G2G role; team-level work sits with Manager. Ask who is in the room, then click their role.')
}

/* ---------- MODULES ---------- */
{
  const n = byId.modules; const s = slideFor2(n.id)
  page(s, n, { title: 'Modules', sub: 'Click any module to open its talk track. Eleven modules in four areas.' })
  MORDER.forEach((id, i) => {
    const m = D.moduleById[id]; const x = 0.4 + (i % 4) * 3.15, y = 1.4 + Math.floor(i / 4) * 1.8, w = 3.0, h = 1.65
    rr(s, x, y, w, h)
    s.addShape(pptx.ShapeType.rect, { x: x + 0.15, y, w: w - 0.3, h: 0.07, fill: { color: m.color }, line: { color: m.color } })
    badge(s, MOD[id].icon, x + 0.2, y + 0.25, 0.6, m.color)
    text(s, m.name, { x: x + 0.92, y: y + 0.22, w: w - 1.05, h: 0.62, fontSize: 14, bold: true, color: C.navy, valign: 'middle', margin: 0 })
    text(s, m.short, { x: x + 0.2, y: y + 0.92, w: w - 0.4, h: 0.45, fontSize: 10.5, color: C.muted, margin: 0 })
    arrowText(s, 'Open', x + 0.2, y + 1.32, 1.5, m.color)
    hit(s, n, x, y, w, h, 'mod:' + id, m.name, 'module')
  })
  { const x = 0.4 + 3 * 3.15, y = 1.4 + 2 * 1.8
    rr(s, x, y, 3.0, 1.65, { fill: C.grey, line: C.border, noShadow: true })
    badge(s, 'sparkles', x + 0.2, y + 0.25, 0.6, '9333EA')
    text(s, 'Workforce AI assistant', { x: x + 0.92, y: y + 0.22, w: 1.95, h: 0.62, fontSize: 13, bold: true, color: C.muted, valign: 'middle', margin: 0 })
    text(s, 'Still in development. Not part of today\'s offer.', { x: x + 0.2, y: y + 0.95, w: 2.6, h: 0.5, fontSize: 10.5, italic: true, color: C.muted, margin: 0 }) }
  note(s, 'Modules. Eleven modules in four areas (HR day to day; skills; learning and talent; reports, tasks and access). Each opens a talk track and a features-to-demonstrate slide. The Workforce AI assistant is greyed because it is in development (portfolio G2G-08) and must not be sold as available.')
}

/* ---------- BUSINESS PROBLEMS ---------- */
{
  const n = byId.problems; const s = slideFor2(n.id)
  page(s, n, { title: 'Business problems', sub: 'What hurts most? Open the conversation, or go straight to the solution.' })
  P.forEach((p, i) => {
    const x = 0.4 + (i % 2) * 6.35, y = 1.4 + Math.floor(i / 2) * 2.75, w = 6.2, h = 2.55
    rr(s, x, y, w, h)
    s.addShape(pptx.ShapeType.rect, { x, y: y + 0.2, w: 0.09, h: h - 0.4, fill: { color: p.color }, line: { color: p.color } })
    badge(s, PROB_ICON[p.key], x + 0.3, y + 0.25, 0.8, p.color)
    text(s, p.tile, { x: x + 1.25, y: y + 0.2, w: w - 1.4, h: 0.9, fontSize: 18, bold: true, color: C.navy, valign: 'middle', margin: 0 })
    text(s, p.challenge.quote, { x: x + 0.3, y: y + 1.2, w: w - 0.5, h: 0.7, fontSize: 13, italic: true, color: C.ink, margin: 0 })
    text(s, 'A typical situation, not a real customer', { x: x + 0.3, y: y + 1.85, w: 3.5, h: 0.25, fontSize: 9, color: C.muted, margin: 0 })
    hit(s, n, x, y, w, h, 'conv:' + p.key, p.tile, 'problem')
    small(s, n, 'Start the conversation  >', 'conv:' + p.key, x + 0.3, y + 2.05, 2.7, { fill: p.color, color: 'FFFFFF', line: p.color, role: 'problem' })
    small(s, n, 'See the solution', 'solutions', x + 3.15, y + 2.05, 2.0, { role: 'solution' })
  })
  note(s, 'Business problems. Pick the problem the customer raises. "Start the conversation" opens a live question and the customer\'s likely answers; "See the solution" opens the solutions matrix. The quotes are typical situations written for this deck, not real customers.')
}

/* ---------- SOLUTIONS (one matrix: problem, capability, value) ---------- */
{
  const n = byId.solutions; const s = slideFor2(n.id)
  page(s, n, { title: 'Solutions', sub: 'Business problem, G2G capability and business value. Click a module to open it.' })
  const hdr = [['SOLUTION AREA', 0.4, 2.8], ['BUSINESS PROBLEM', 3.3, 3.0], ['G2G CAPABILITY (click)', 6.4, 3.4], ['BUSINESS VALUE', 9.9, 3.0]]
  hdr.forEach(([t, x, w]) => s.addText(t, { shape: pptx.ShapeType.rect, x, y: 1.3, w, h: 0.38, fill: { color: C.navy }, line: { color: C.navy }, color: 'FFFFFF', fontFace: FONT, fontSize: 11, bold: true, align: 'left', valign: 'middle', margin: 8 }))
  PK.forEach((k, i) => {
    const a = G.areas[k]; const y = 1.8 + i * 1.18, h = 1.08
    rr(s, 0.4, y, 12.5, h)
    s.addShape(pptx.ShapeType.rect, { x: 0.4, y: y + 0.12, w: 0.09, h: h - 0.24, fill: { color: AREA[k].color }, line: { color: AREA[k].color } })
    badge(s, AREA[k].icon, 0.65, y + 0.24, 0.6, AREA[k].color)
    text(s, a.name, { x: 1.4, y: y + 0.1, w: 1.8, h: h - 0.2, fontSize: 13.5, bold: true, color: C.navy, valign: 'middle', margin: 0 })
    hit(s, n, 0.4, y, 2.85, h, 'conv:' + k, a.name, 'scenario')
    text(s, a.problem, { x: 3.4, y: y + 0.1, w: 2.8, h: h - 0.2, fontSize: 12.5, color: C.ink, valign: 'middle', margin: 0 })
    a.mods.forEach((id, j) => { const m = D.moduleById[id]; btn(s, { x: 6.5 + (j % 2) * 1.62, y: y + 0.12 + Math.floor(j / 2) * 0.46, w: 1.56, h: 0.4, text: m.name, target: 'mod:' + id, fill: m.color, size: 9.5, margin: 1 }); link(n, m.name, 'mod:' + id, 'module') })
    text(s, bullets(a.value, 11, 3), { x: 10.0, y: y + 0.08, w: 2.8, h: h - 0.16, fontSize: 11, valign: 'middle', margin: 0 })
  })
  text(s, 'The solution area opens a live conversation. No savings or return figures are claimed: none are documented.', { x: 0.4, y: 6.55, w: 12.5, h: 0.3, fontSize: 11, italic: true, color: C.muted, margin: 0 })
  note(s, 'Solutions. One row per business problem: the modules that answer it and the documented value. Clicking the area name opens the matching customer conversation; the module buttons open the talk tracks. Sources: G2G v1 docs and portfolio G2G-01 to G2G-10.')
}

/* ---------- SALES SCENARIOS hub ---------- */
{
  const n = byId.scenarios; const s = slideFor2(n.id)
  page(s, n, { title: 'Sales scenarios', sub: 'Open a live conversation. Ask the question, then click what the customer says.' })
  PK.forEach((k, i) => {
    const p = P[i]; const x = 0.4 + (i % 2) * 6.35, y = 1.4 + Math.floor(i / 2) * 1.95, w = 6.2, h = 1.8
    rr(s, x, y, w, h)
    badge(s, 'message-square', x + 0.25, y + 0.25, 0.7, p.color)
    text(s, 'ASK THE CUSTOMER', { x: x + 1.15, y: y + 0.22, w: 3.5, h: 0.28, fontSize: 10, bold: true, color: p.color, margin: 0 })
    text(s, G.conv[k].ask, { x: x + 1.15, y: y + 0.5, w: w - 1.4, h: 0.75, fontSize: 14, bold: true, color: C.navy, margin: 0 })
    arrowText(s, 'Open the conversation', x + 1.15, y + 1.35, 3.5, p.color)
    hit(s, n, x, y, w, h, 'conv:' + k, p.tile, 'scenario')
  })
  rr(s, 0.4, 5.4, 12.5, 1.0, { fill: C.navy, line: C.navy })
  text(s, 'WHEN THE CUSTOMER ASKS...', { x: 0.7, y: 5.5, w: 4, h: 0.3, fontSize: 10, bold: true, color: '7FD6CB', margin: 0 })
  small(s, n, 'Cost, other clients, what is ready  >', 'questions', 0.7, 5.85, 4.3, { fill: C.teal, color: 'FFFFFF', line: C.teal, size: 13 })
  small(s, n, 'Close the meeting: next steps  >', 'closing', 5.2, 5.85, 4.3, { fill: 'FFFFFF', color: C.navy, line: 'FFFFFF', size: 13 })
  note(s, 'Sales scenarios. Four live conversations led by the salesperson, plus the questions every buyer asks and the closing slide. Each customer answer opens a different module, feature or solution.')
}

/* ---------- ROLE slides ---------- */
D.roles.forEach((r) => {
  const n = byId['role:' + r.key]; const s = slideFor2(n.id)
  page(s, n, { title: r.name, sub: r.sub + '. Open a module to present it for this role.', icon: ROLE_ICON[r.key], color: r.color })
  r.modules.forEach((id, i) => {
    const m = D.moduleById[id]; const work = m.roles.find(([nm]) => r.match.includes(nm))
    if (!work) throw new Error(`role ${r.name} has no documented work in ${id}`)
    const x = 0.4 + (i % 4) * 3.15, y = 1.4 + Math.floor(i / 4) * 2.7, w = 3.0, h = 2.5
    rr(s, x, y, w, h)
    s.addShape(pptx.ShapeType.rect, { x: x + 0.15, y, w: w - 0.3, h: 0.07, fill: { color: m.color }, line: { color: m.color } })
    badge(s, MOD[id].icon, x + 0.2, y + 0.25, 0.6, m.color)
    text(s, m.name, { x: x + 0.92, y: y + 0.22, w: w - 1.05, h: 0.62, fontSize: 14, bold: true, color: C.navy, valign: 'middle', margin: 0 })
    text(s, 'WHAT ' + r.name.toUpperCase() + ' NEEDS', { x: x + 0.2, y: y + 0.95, w: w - 0.4, h: 0.25, fontSize: 9, bold: true, color: C.muted, margin: 0 })
    text(s, work[1], { x: x + 0.2, y: y + 1.2, w: w - 0.4, h: 0.85, fontSize: 11.5, color: C.ink, margin: 0 })
    arrowText(s, 'Open the talk track', x + 0.2, y + 2.1, 2.5, m.color)
    hit(s, n, x, y, w, h, 'mod:' + id, m.name, 'module')
  })
  note(s, r.name + ': the modules this role uses and what the role needs from each. Role lines come from the G2G v1 documentation role tables. Open a module to present it.')
})

/* ---------- MODULE talk tracks ---------- */
MORDER.forEach((id) => {
  const m = D.moduleById[id]; const g = G.mod[id]; const meta = MOD[id]
  const n = byId['mod:' + id]; const s = slideFor2(n.id)
  page(s, n, { title: m.name, sub: m.short, icon: meta.icon, color: m.color })
  text(s, 'USED BY', { x: 0.4, y: 1.3, w: 1.0, h: 0.34, fontSize: 11, bold: true, color: C.muted, valign: 'middle', margin: 0 })
  usersOf(m).forEach((r, i) => { btn(s, { x: 1.35 + i * 1.95, y: 1.3, w: 1.85, h: 0.34, text: r.name, target: 'role:' + r.key, fill: r.color, size: 10.5, margin: 2 }); link(n, r.name, 'role:' + r.key, 'role') })
  const cw = 4.1
  panel(s, 0.4, 1.75, cw, 1.7, 'The problem it solves', C.amber, m.problem.slice(0, 2), 11.5)
  panel(s, 0.4 + cw + 0.15, 1.75, cw, 1.7, 'Why the customer needs it', C.navy, [g.why], 11.5)
  panel(s, 0.4 + 2 * (cw + 0.15), 1.75, cw, 1.7, 'How G2G addresses it', m.color, m.does.slice(0, 2), 11.5)
  panel(s, 0.4, 3.58, 7.0, 1.65, 'What each role needs', C.navy, m.roles.slice(0, 4).map(([r, w]) => `${r}: ${w}`), 10.5)
  panel(s, 7.55, 3.58, 5.35, 1.65, 'Business value', C.green, m.benefit.slice(0, 3), 11.5)
  text(s, 'FEATURES TO DEMONSTRATE', { x: 0.4, y: 5.35, w: 2.3, h: 0.4, fontSize: 10.5, bold: true, color: C.muted, valign: 'middle', margin: 0 })
  g.features.forEach(([name], i) => { btn(s, { x: 2.7 + i * 3.4, y: 5.35, w: 3.3, h: 0.4, text: `${i + 1}. ${name}  >`, target: 'feat:' + id, fill: C.card, color: m.color, lineColor: m.color, size: 11 }); link(n, name, 'feat:' + id, 'feature') })
  pill(s, 'ASK', 0.4, 5.87, 0.7, 0.4, C.navy, 'FFFFFF', 11)
  text(s, g.ask, { x: 1.2, y: 5.87, w: 11.7, h: 0.4, fontSize: 13, italic: true, color: C.ink, valign: 'middle', margin: 0 })
  text(s, 'RELATED', { x: 0.4, y: 6.38, w: 1.0, h: 0.38, fontSize: 10.5, bold: true, color: C.muted, valign: 'middle', margin: 0 })
  meta.rel.forEach((t, i) => { const label = t === 'roles' ? 'Roles' : D.moduleById[t.slice(5)].name + ' features'; small(s, n, label + '  >', t, 1.4 + i * 2.6, 6.38, 2.5, { color: m.color, line: m.color, size: 11 }) })
  chipStatus(s, m.status[1], 'Status: ' + m.status[0].toLowerCase().replace(/^./, (c) => c.toUpperCase()), 6.7, 6.38, 3.1)
  demoBtn(s, 'Show live demo  >', G.demo[id].page, 9.95, 6.38, 2.95, 0.38, m.color)
  note(s, `${m.name}. Live demo page: ${G.demoBase + G.demo[id].page}. Sources: ${m.src}. Status: ${m.statusNote}. Say: ${g.why} Ask: ${g.ask} No savings or return figures are claimed.`)
})

/* ---------- FEATURE slides (demo guide) ---------- */
MORDER.forEach((id) => {
  const m = D.moduleById[id]; const g = G.mod[id]; const meta = MOD[id]
  const n = byId['feat:' + id]; const s = slideFor2(n.id)
  page(s, n, { title: m.name + ': features to demonstrate', titleSize: 24, sub: 'Show these three. Each line says what to show and why the customer cares.', icon: meta.icon, color: m.color })
  const [vk, vv] = meta.vis; let credit = ''
  if (vk === 'native') NATIVE[vv](s, 0.4, 1.35, 3.6, 3.95, m.color)
  else {
    const e = pickImg(vv)
    if (e) { addPhoto(s, e, 0.4, 1.35, 3.6, 3.95, n.num); credit = creditNote(e) } else card(s, 0.4, 1.35, 3.6, 3.95, { fill: C.grey })
  }
  g.features.forEach(([name, show, why], i) => {
    const y = 1.35 + i * 1.35, x = 4.2, w = 8.7, h = 1.22
    rr(s, x, y, w, h)
    s.addText(String(i + 1), { shape: pptx.ShapeType.ellipse, x: x + 0.2, y: y + 0.3, w: 0.6, h: 0.6, fill: { color: m.color }, line: { color: m.color }, color: 'FFFFFF', fontFace: FONT, fontSize: 18, bold: true, align: 'center', valign: 'middle', margin: 0 })
    text(s, name, { x: x + 1.0, y: y + 0.08, w: w - 1.2, h: 0.36, fontSize: 15, bold: true, color: C.navy, valign: 'middle', margin: 0 })
    const demo = G.demo[id].features[i]
    text(s, [{ text: 'SHOW  ', options: { bold: true, color: m.color, fontSize: 9.5 } }, { text: show, options: { fontSize: 11.5, breakLine: true } }, { text: 'WHY IT MATTERS  ', options: { bold: true, color: C.green, fontSize: 9.5 } }, { text: why, options: { fontSize: 11.5 } }], { x: x + 1.0, y: y + 0.45, w: demo ? w - 2.9 : w - 1.2, h: 0.72, fontSize: 11.5, margin: 0 })
    if (demo) demoBtn(s, 'Show live demo  >', demo, x + w - 1.85, y + 0.4, 1.65, 0.42, m.color)
  })
  text(s, 'USED BY', { x: 4.2, y: 5.45, w: 1.0, h: 0.34, fontSize: 10.5, bold: true, color: C.muted, valign: 'middle', margin: 0 })
  usersOf(m).slice(0, 4).forEach((r, i) => { btn(s, { x: 5.1 + i * 1.95, y: 5.45, w: 1.85, h: 0.34, text: r.name, target: 'role:' + r.key, fill: r.color, size: 10.5, margin: 2 }); link(n, r.name, 'role:' + r.key, 'role') })
  small(s, n, '< Back to the talk track', 'mod:' + id, 0.4, 5.95, 3.4, { fill: m.color, color: 'FFFFFF', line: m.color, size: 12.5, role: 'return' })
  meta.rel.forEach((t, i) => { const label = t === 'roles' ? 'Roles' : D.moduleById[t.slice(5)].name; small(s, n, 'Also show: ' + label + '  >', t, 4.0 + i * 3.45, 5.95, 3.35, { color: m.color, line: m.color, size: 11.5, role: 'related' }) })
  chipStatus(s, m.status[1], 'Status: ' + m.status[0].toLowerCase().replace(/^./, (c) => c.toUpperCase()), 4.0, 6.45, 8.9)
  note(s, `${m.name}: features to demonstrate. Live pages: ${g.features.map(([nm], i) => nm + ' = ' + (G.demo[id].features[i] ? G.demoBase + G.demo[id].features[i] : 'no matching page found')).join('; ')}. Sources: ${m.src}. The left panel is an illustration or a diagram drawn for this deck, not a G2G screenshot. Status: ${m.statusNote}${credit}`)
})

/* ---------- CONVERSATIONS ---------- */
P.forEach((p) => {
  const k = p.key; const n = byId['conv:' + k]; const s = slideFor2(n.id); const cv = G.conv[k]
  page(s, n, { title: 'Live conversation: ' + p.tile, titleSize: 24, sub: 'Ask the question. Click what the customer says.', icon: 'message-square', color: p.color })
  rr(s, 0.4, 1.35, 4.5, 3.9, { fill: C.navy, line: C.navy })
  text(s, 'YOU ASK', { x: 0.7, y: 1.55, w: 3.9, h: 0.3, fontSize: 11, bold: true, color: '7FD6CB', margin: 0 })
  text(s, cv.ask, { x: 0.7, y: 1.95, w: 3.9, h: 2.4, fontSize: 24, bold: true, color: 'FFFFFF', margin: 0 })
  text(s, 'Then listen, and click the answer that fits what you hear.', { x: 0.7, y: 4.4, w: 3.9, h: 0.7, fontSize: 12, italic: true, color: 'B7C4D8', margin: 0 })
  text(s, 'THE CUSTOMER MIGHT SAY', { x: 5.2, y: 1.3, w: 7.7, h: 0.3, fontSize: 11, bold: true, color: C.muted, margin: 0 })
  cv.c.forEach(([say, opens, target], i) => {
    const y = 1.65 + i * 0.99, x = 5.2, w = 7.7, h = 0.9
    const sol = target === 'solutions'
    rr(s, x, y, w, h, { fill: sol ? p.color : C.card, line: p.color })
    text(s, say, { x: x + 0.25, y: y + 0.08, w: w - 1.3, h: 0.45, fontSize: 13.5, bold: true, italic: true, color: sol ? 'FFFFFF' : C.navy, valign: 'middle', margin: 0 })
    text(s, 'Opens: ' + opens, { x: x + 0.25, y: y + 0.52, w: w - 1.3, h: 0.32, fontSize: 11, color: sol ? 'E8F6F4' : C.muted, valign: 'middle', margin: 0 })
    text(s, '>', { x: x + w - 0.75, y: y + 0.12, w: 0.5, h: 0.66, fontSize: 26, bold: true, color: sol ? 'FFFFFF' : p.color, align: 'center', valign: 'middle', margin: 0 })
    hit(s, n, x, y, w, h, target, say.slice(0, 40), target.startsWith('feat:') ? 'feature' : target.startsWith('mod:') ? 'module' : 'solution')
  })
  small(s, n, 'Customer questions  >', 'questions', 5.2, 5.75, 3.6, { size: 12.5 })
  small(s, n, 'Other conversations', 'scenarios', 9.0, 5.75, 3.9, { size: 12.5 })
  note(s, `Live conversation. Ask: "${cv.ask}" The customer lines are typical answers, not real customers. Each one opens a different slide: a module, a feature demonstration, or the full solution. The salesperson decides the order; there is no fixed sequence.`)
})

/* ---------- CUSTOMER QUESTIONS ---------- */
{
  const n = byId.questions; const s = slideFor2(n.id)
  page(s, n, { title: 'Customer questions', sub: 'Straight answers, using only what is documented.', icon: 'circle-help', color: C.navy })
  G.questions.forEach((q, i) => {
    const x = 0.4 + i * 4.2, y = 1.35, w = 4.05, h = 3.95
    rr(s, x, y, w, h)
    s.addShape(pptx.ShapeType.rect, { x: x + 0.15, y, w: w - 0.3, h: 0.07, fill: { color: C.teal }, line: { color: C.teal } })
    text(s, q.q, { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: 0.5, fontSize: 17, bold: true, color: C.navy, valign: 'middle', margin: 0 })
    text(s, 'SAY', { x: x + 0.25, y: y + 0.8, w: 1, h: 0.25, fontSize: 9.5, bold: true, color: C.teal, margin: 0 })
    text(s, q.say, { x: x + 0.25, y: y + 1.05, w: w - 0.5, h: 2.1, fontSize: 12.5, margin: 0 })
    text(s, 'BASIS: ' + q.why, { x: x + 0.25, y: y + 3.2, w: w - 0.5, h: 0.65, fontSize: 9.5, italic: true, color: C.muted, margin: 0 })
  })
  small(s, n, 'Close the meeting: next steps  >', 'closing', 0.4, 5.6, 4.4, { fill: C.teal, color: 'FFFFFF', line: C.teal, size: 13.5, h: 0.5 })
  small(s, n, 'Back to the scenarios', 'scenarios', 5.0, 5.6, 3.4, { size: 13, h: 0.5 })
  note(s, 'Customer questions. Cost: pricing is not fixed (portfolio: "To fill"). Who else uses it: no module is "Live with client" in the portfolio; no testimonial or client count is documented. What is ready: v1 docs status and portfolio readiness. Full lists: ' + S.status.ready.join('; ') + ' | Not finished: ' + S.status.coming.join('; '))
}

/* ---------- CLOSING ---------- */
{
  const n = byId.closing; const s = slideFor2(n.id)
  page(s, n, { title: 'Sales closing', sub: 'What G2G offers, and how we start', icon: 'sparkles', color: C.teal })
  rr(s, 0.4, 1.35, 4.3, 4.45, { fill: C.navy, line: C.navy })
  text(s, 'VALUE PROPOSITION', { x: 0.65, y: 1.55, w: 3.8, h: 0.3, fontSize: 11, bold: true, color: '7FD6CB', margin: 0 })
  text(s, 'Your people, skills and learning on one platform', { x: 0.65, y: 1.9, w: 3.8, h: 1.6, fontSize: 24, bold: true, color: 'FFFFFF', margin: 0 })
  text(s, 'Attendance, leave and payroll. Talent and appraisals. Skills and training. Tasks and access control.', { x: 0.65, y: 3.7, w: 3.8, h: 1.2, fontSize: 13, color: 'B7C4D8', margin: 0 })
  text(s, 'SOLUTION HIGHLIGHTS', { x: 4.95, y: 1.35, w: 4, h: 0.3, fontSize: 11, bold: true, color: C.muted, margin: 0 })
  PK.forEach((k, i) => {
    const y = 1.7 + i * 1.02
    rr(s, 4.95, y, 3.9, 0.92)
    badge(s, AREA[k].icon, 5.1, y + 0.16, 0.6, AREA[k].color)
    text(s, G.areas[k].name, { x: 5.85, y: y + 0.1, w: 2.9, h: 0.72, fontSize: 13.5, bold: true, color: C.navy, valign: 'middle', margin: 0 })
    hit(s, n, 4.95, y, 3.9, 0.92, 'conv:' + k, G.areas[k].name, 'solution')
  })
  text(s, 'NEXT STEPS WITH US', { x: 9.1, y: 1.35, w: 4, h: 0.3, fontSize: 11, bold: true, color: C.muted, margin: 0 })
  D.outcomes.won.steps.forEach((t, i) => {
    const y = 1.7 + i * 0.95
    s.addText(String(i + 1), { shape: pptx.ShapeType.ellipse, x: 9.1, y: y + 0.12, w: 0.5, h: 0.5, fill: { color: C.teal }, line: { color: C.teal }, color: 'FFFFFF', fontFace: FONT, fontSize: 15, bold: true, align: 'center', valign: 'middle', margin: 0 })
    text(s, t, { x: 9.75, y, w: 3.15, h: 0.75, fontSize: 12, valign: 'middle', margin: 0 })
  })
  text(s, D.outcomes.won.note, { x: 9.1, y: 5.5, w: 3.8, h: 0.5, fontSize: 9.5, italic: true, color: C.muted, margin: 0 })
  small(s, n, 'Return to Home', 'home', 0.4, 6.1, 3.2, { fill: C.card, color: C.navy, line: C.navy, size: 13.5, h: 0.5 })
  small(s, n, 'Customer questions', 'questions', 3.8, 6.1, 3.4, { size: 13.5, h: 0.5 })
  small(s, n, 'Sales scenarios', 'scenarios', 7.4, 6.1, 3.2, { size: 13.5, h: 0.5 })
  note(s, 'Closing. The pilot is our proposed approach, not a documented product feature. Pricing is not fixed, so no number is quoted. No client names or counts are documented. Suggested close: agree the one or two modules and the number of people, run a pilot on the customer\'s own data with success measures they choose, and send a written proposal by an agreed date.')
}

/* ---------- checks, post-process, write ---------- */
const order = pptx._slides.map((x) => x.__id)
order.forEach((id, i) => { if (id !== nodes[i].id) throw new Error(`slide order mismatch at ${i}: ${id} vs ${nodes[i].id}`) })
if (order.length !== nodes.length) throw new Error('not every node rendered')
if (nodes.length > 40) throw new Error('more than 40 slides: ' + nodes.length)
{
  // reachability from Home using content links only (the top navigation bar is extra)
  const seen = new Set([1]); const q = [1]
  while (q.length) { const c = q.shift(); for (const l of nodes[c - 1].links) { const t = byId[l.to].num; if (!seen.has(t)) { seen.add(t); q.push(t) } } }
  const un = nodes.filter((x) => !seen.has(x.num)).map((x) => x.id)
  if (un.length) throw new Error('unreachable slides: ' + un.join(', '))
  for (const k of PK) { const cv = nodes.find((x) => x.id === 'conv:' + k); const t = cv.links.filter((l) => ['feature', 'module', 'solution'].includes(l.role)).map((l) => l.to); if (t.length !== 4 || new Set(t).size !== 4) throw new Error('conversation ' + k + ' needs four distinct answers, got ' + t.length) }
}

function writeAssetDoc() {
  const L = ['# G2G Sales Presentation: image and icon references', '', 'Generated by `generator/build-sales-story.js` from `assets/manifest-*.json`. Retrieved 2026-11-17.', '',
    '**How images are used.** Every photo or illustration is an example. None is a real G2G screenshot (no G2G product screenshots exist in the repositories). Each carries the tag "ILLUSTRATION - NOT A G2G SCREEN". Diagrams drawn for the deck carry "DIAGRAM DRAWN FOR THIS DECK".', '',
    '**Icons.** Lucide icons (https://lucide.dev), ISC licence, rendered to PNG in `assets/icons/`. Source SVGs in `assets/icons-src/`. The ISC licence requires the copyright notice to be kept: Copyright (c) for Lucide Contributors.', '',
    '**Not used:** Dribbble and other design-showcase sites (design inspiration only); proprietary product screenshots; anything under a non-commercial, no-derivatives or share-alike licence.', '',
    '| Used on slide(s) | Use | Kind | Title | Creator | Licence | Source | Credit line | Note |', '|---|---|---|---|---|---|---|---|---|']
  for (const e of MAN.filter((x) => USED.has(x.id))) L.push(`| ${USED.get(e.id).join(', ')} | ${e.forModules.join(', ')} (${e.use}) | ${e.kind} | ${e.title} | ${e.creator} | [${e.license}](${e.license_url}) | [page](${e.source_url}) | ${e.attribution_text} | ${e.caution || ''} |`)
  L.push('', '## Diagrams drawn for this deck', '', 'Attendance flow, competency flow, KASBA, gap assessment (six-level example), reports catalog, learning and appraisal flow. Built from documented facts with native PowerPoint shapes; no third-party asset and no licence needed.', '', 'Images rejected after review (not used here): see `ASSET-REFERENCES.md`.')
  fs.writeFileSync(path.join(ASSETS, 'ASSET-REFERENCES-branching.md'), L.join('\n') + '\n')
}

async function post(buf) {
  const zip = await JSZip.loadAsync(buf)
  let count = 0
  for (let i = 1; i <= nodes.length; i++) {
    const sp = `ppt/slides/slide${i}.xml`, rp = `ppt/slides/_rels/slide${i}.xml.rels`
    let xml = await zip.file(sp).async('string')
    const rels = await zip.file(rp).async('string')
    const targets = {}
    xml = xml.replace(/<p:cNvPr id="(\d+)" name="LINK\|([^"]+)"([^>]*?)(?:\/>|>\s*<\/p:cNvPr>)/g, (m, id, tgt, rest) => {
      count++
      if (tgt.startsWith('URL|')) { const url = tgt.slice(4); const rid = (targets[tgt] ||= 'rIdExt' + count); return `<p:cNvPr id="${id}" name="Live demo link"${rest}><a:hlinkClick r:id="${rid}" tooltip="Opens the live G2G page in your browser"/></p:cNvPr>` }
      if (tgt === 'LAST') return `<p:cNvPr id="${id}" name="Back button"${rest}><a:hlinkClick r:id="" action="ppaction://hlinkshowjump?jump=lastslideviewed" tooltip="Back to the slide you just viewed"/></p:cNvPr>`
      const rid = (targets[tgt] ||= `rIdNav${tgt}`)
      return `<p:cNvPr id="${id}" name="Button to slide ${tgt}"${rest}><a:hlinkClick r:id="${rid}" action="ppaction://hlinksldjump"/></p:cNvPr>`
    })
    if (/name="LINK\|/.test(xml)) throw new Error(`unreplaced link in slide ${i}`)
    const add = Object.entries(targets).map(([t, rid]) => t.startsWith('URL|') ? `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${t.slice(4)}" TargetMode="External"/>` : `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slide${t}.xml"/>`).join('')
    zip.file(sp, xml); zip.file(rp, rels.replace('</Relationships>', add + '</Relationships>'))
  }
  return { out: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }), count }
}

;(async () => {
  const buf = await pptx.write({ outputType: 'nodebuffer' })
  const { out, count } = await post(buf)
  fs.writeFileSync(OUT, out)
  writeAssetDoc()
  fs.writeFileSync(path.join(__dirname, 'story-graph.json'), JSON.stringify(nodes.map((x) => ({ num: x.num, id: x.id, type: x.type, title: x.title, links: x.links.map((l) => ({ label: l.label, to: byId[l.to].num, role: l.role })) })), null, 1))
  console.log(`wrote ${OUT}\nslides: ${nodes.length}, injected links: ${count}`)
})().catch((e) => { console.error(e); process.exit(1) })
