/* Builds the interactive sales-training deck.
 *   node build.js            -> ../G2G-Sales-Training-Interactive.pptx, ../NAVIGATION-MAP.md, ./graph.json
 * Navigation is native PowerPoint: every button is a shape whose click action is a slide jump
 * (ppaction://hlinksldjump) injected into the slide XML. "Back" uses jump=lastslideviewed.
 * Works in Slide Show mode, no macros.
 */
const fs = require('fs')
const path = require('path')
const pptxgen = require('pptxgenjs')
const JSZip = require('jszip')

const PRODUCTS = [
  require('./content/scholarclone'),
  require('./content/g2g'),
  require('./content/enterprise-brain'),
]
const OUT = path.join(__dirname, '..', 'G2G-Sales-Training-Interactive.pptx')

/* ---------- palette ---------- */
const C = {
  bg: 'F4F6FA', ink: '1B2A41', navy: '0B1F3A', muted: '5B6B82', card: 'FFFFFF', border: 'D5DCE8',
  green: '1E9E5A', greenBg: 'E6F6EE', amber: 'C77700', amberBg: 'FFF3DC', red: 'C93B3B', redBg: 'FDEAEA',
  grey: 'E9EDF5',
}
const FONT = 'Calibri'
const RATING = {
  best: { label: 'BEST MOVE', color: C.green, bg: C.greenBg },
  partial: { label: 'PARTIAL - ACCEPTABLE BUT COSTLY', color: C.amber, bg: C.amberBg },
  poor: { label: 'POOR DECISION', color: C.red, bg: C.redBg },
}

/* ---------- graph ---------- */
const nodes = [] // {id, type, product, title}
const byId = {}
function addNode(id, type, product, title) {
  if (byId[id]) throw new Error('duplicate node ' + id)
  const n = { id, type, product, title, num: nodes.length + 1, links: [] }
  nodes.push(n)
  byId[id] = n
  return n
}
const N = (id) => {
  if (!byId[id]) throw new Error('unknown node ' + id)
  return byId[id].num
}

addNode('home', 'home', null, 'Home')
addNode('howto', 'howto', null, 'How to use this deck')
for (const p of PRODUCTS) {
  const k = p.key
  addNode(`${k}:hub`, 'hub', p, `${p.name} - Product hub`)
  addNode(`${k}:overview`, 'info', p, 'Overview')
  addNode(`${k}:modules`, 'modhub', p, 'Modules and offers')
  p.front.modules.forEach((m, i) => addNode(`${k}:mod${i}`, 'info', p, m.title))
  addNode(`${k}:problems`, 'info', p, 'Customer problems solved')
  addNode(`${k}:customers`, 'info', p, 'Target customers')
  addNode(`${k}:benefits`, 'benefits', p, 'Benefits and USPs')
  addNode(`${k}:proof`, 'info', p, 'Use cases and proof')
  addNode(`${k}:readiness`, 'readiness', p, 'Readiness and limitations')
  addNode(`${k}:missing`, 'missing', p, 'What we cannot claim')
  addNode(`${k}:persona`, 'persona', p, 'Customer persona and brief')
  addNode(`${k}:map`, 'map', p, 'Scenario map')
  p.decisions.forEach((d, i) => {
    addNode(`${k}:d${i}S`, 'dec', p, `Decision ${i + 1}`)
    d.options.forEach((o, j) => addNode(`${k}:d${i}S:fb${j}`, 'fb', p, `D${i + 1} feedback`))
    addNode(`${k}:d${i}S:rec`, 'rec', p, `D${i + 1} recovery`)
    if (i > 0) { // the first decision has no earlier misstep, so no wavering lane
      addNode(`${k}:d${i}M`, 'dec', p, `Decision ${i + 1} (customer wavering)`)
      d.options.forEach((o, j) => addNode(`${k}:d${i}M:fb${j}`, 'fb', p, `D${i + 1} feedback`))
    }
    addNode(`${k}:lost${i}`, 'lost', p, `Deal lost at decision ${i + 1}`)
  })
  addNode(`${k}:out:won`, 'out', p, p.outcomes.won.title)
  addNode(`${k}:out:wonConc`, 'out', p, p.outcomes.wonConc.title)
  addNode(`${k}:out:stalled`, 'out', p, p.outcomes.stalled.title)
}

/* transition rule */
function dest(p, i, lane, rating) {
  const k = p.key
  const last = i === p.decisions.length - 1
  if (lane === 'S') {
    if (rating === 'best') return last ? `${k}:out:won` : `${k}:d${i + 1}S`
    if (rating === 'partial') return last ? `${k}:out:wonConc` : `${k}:d${i + 1}M`
    return `${k}:d${i}S:rec`
  }
  if (rating === 'best') return last ? `${k}:out:wonConc` : `${k}:d${i + 1}S`
  if (rating === 'partial') return last ? `${k}:out:stalled` : `${k}:d${i + 1}M`
  return `${k}:lost${i}`
}
function recDest(p, i, good) {
  const k = p.key
  if (!good) return `${k}:lost${i}`
  return i === p.decisions.length - 1 ? `${k}:out:stalled` : `${k}:d${i + 1}M`
}
function confidenceOf(id) {
  if (/:d\d+S$/.test(id)) return 'Strong'
  if (/:d\d+M$/.test(id)) return 'Wavering'
  if (/:rec$/.test(id)) return 'At risk'
  if (/:out:/.test(id)) return 'Final outcome'
  if (/:lost/.test(id)) return 'Deal lost'
  return ''
}

/* ---------- drawing helpers ---------- */
const pptx = new pptxgen()
pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5
pptx.title = 'Interactive Sales Training - LMS-K12, G2G, Enterprise Brain'
pptx.subject = 'Branching sales scenarios'
pptx.company = 'G2G'

const R = (n) => Math.round(n * 1000) / 1000

function btn(s, o) {
  // o: x,y,w,h,text,target(id|'LAST'),fill,color,size,bold,align,line
  const name = o.target === 'LAST' ? 'LINK|LAST' : `LINK|${N(o.target)}`
  s.addText(o.text, {
    shape: pptx.ShapeType.roundRect, rectRadius: 0.12,
    x: o.x, y: o.y, w: o.w, h: o.h,
    fill: { color: o.fill || C.navy }, line: { color: o.lineColor || o.fill || C.navy, width: 1 },
    color: o.color || 'FFFFFF', fontFace: FONT, fontSize: o.size || 13, bold: o.bold !== false,
    align: o.align || 'center', valign: 'middle', margin: o.margin == null ? 6 : o.margin,
    objectName: name,
  })
}
function card(s, x, y, w, h, opts = {}) {
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.1, fill: { color: opts.fill || C.card },
    line: { color: opts.line || C.border, width: opts.lineW || 1, dashType: opts.dash },
  })
}
function text(s, t, o) {
  s.addText(t, Object.assign({ fontFace: FONT, color: C.ink, fontSize: 14, valign: 'top', margin: 4 }, o))
}
function frame(s, n, o) {
  s.background = { color: C.bg }
  const col = o.color || C.navy
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.95, fill: { color: col }, line: { color: col } })
  text(s, o.title, { x: 0.4, y: 0.08, w: 9.6, h: 0.8, fontSize: o.titleSize || 26, bold: true, color: 'FFFFFF', valign: 'middle' })
  if (o.chip) text(s, o.chip, { x: 10.0, y: 0.08, w: 3.0, h: 0.8, fontSize: 12, color: 'FFFFFF', align: 'right', valign: 'middle' })
  if (o.prov) {
    const v = o.prov === 'verified'
    s.addText(v ? 'VERIFIED PRODUCT FACTS' : 'TRAINING SCENARIO - fictional customer', {
      shape: pptx.ShapeType.roundRect, rectRadius: 0.08, x: 9.3, y: 1.02, w: 3.65, h: 0.3,
      fill: { color: v ? C.greenBg : C.amberBg }, line: { color: v ? C.green : C.amber, width: 1 },
      color: v ? C.green : C.amber, fontFace: FONT, fontSize: 10, bold: true, align: 'center', valign: 'middle', margin: 2,
    })
  }
  // footer navigation (all native links)
  const y = 6.95
  let x = 0.4
  const add = (label, target, fill) => {
    btn(s, { x, y, w: 1.3, h: 0.4, text: label, target, fill: fill || C.grey, color: C.ink, size: 12, lineColor: C.border })
    x += 1.4
  }
  if (n.id !== 'home') add('Home', 'home')
  if (n.id !== 'home') add('Back', 'LAST')
  if (n.product) {
    add('Product hub', `${n.product.key}:hub`)
    if (['dec', 'fb', 'rec', 'lost', 'out', 'persona'].includes(n.type)) add('Scenario map', `${n.product.key}:map`)
  }
  text(s, `Slide ${n.num}`, { x: 11.9, y: 6.97, w: 1.1, h: 0.36, fontSize: 10, color: C.muted, align: 'right', valign: 'middle' })
}
function notes(s, t) { s.addNotes(t) }
function link(n, label, target, role) { n.links.push({ label, to: target, role }) }
const slideFor = (id) => { const s = pptx.addSlide(); s.__id = id; return s }

function avatar(s, x, y, d, letter, color) {
  s.addText(letter, {
    shape: pptx.ShapeType.ellipse, x, y, w: d, h: d, fill: { color }, line: { color }, color: 'FFFFFF',
    fontFace: FONT, fontSize: d * 28, bold: true, align: 'center', valign: 'middle', margin: 0,
  })
}
function autoSize(items, w) { const chars = items.reduce((a, t) => a + t.length + 40, 0) / (w / 7.7); return chars > 1000 ? 14.5 : chars > 780 ? 16 : chars > 520 ? 17.5 : 19 }
function bulletsBox(s, items, x, y, w, h, size) {
  const runs = items.map((t) => ({ text: t, options: { bullet: { indent: 18 }, breakLine: true, paraSpaceAfter: 7 } }))
  text(s, runs, { x, y, w, h, fontSize: size === 'auto' ? autoSize(items, w) : size || 15, margin: 8 })
}

/* ---------- render ---------- */
const HOME = byId.home
const HOWTO = byId.howto

// HOME
{
  const s = slideFor('home'); const n = HOME
  frame(s, n, { title: 'Interactive Sales Training', chip: 'LMS-K12  |  G2G  |  Enterprise Brain' })
  text(s, 'Choose a product. Click buttons to move between slides. Run in Slide Show mode (F5).', { x: 0.5, y: 1.1, w: 8.6, h: 0.5, fontSize: 17, color: C.muted })
  const cw = 4.0, gap = 0.2, x0 = 0.5, y0 = 1.85
  PRODUCTS.forEach((p, i) => {
    const x = x0 + i * (cw + gap)
    card(s, x, y0, cw, 4.2, { fill: C.card })
    s.addShape(pptx.ShapeType.rect, { x, y: y0, w: cw, h: 0.2, fill: { color: p.color }, line: { color: p.color } })
    text(s, p.name, { x: x + 0.25, y: y0 + 0.35, w: cw - 0.5, h: 0.7, fontSize: 28, bold: true, color: p.color })
    text(s, p.tagline, { x: x + 0.25, y: y0 + 1.1, w: cw - 0.5, h: 1.0, fontSize: 15, color: C.ink })
    text(s, p.nameNote, { x: x + 0.25, y: y0 + 2.1, w: cw - 0.5, h: 1.1, fontSize: 11, color: C.muted })
    btn(s, { x: x + 0.25, y: y0 + 3.35, w: cw - 0.5, h: 0.6, text: `Open ${p.name}  >`, target: `${p.key}:hub`, fill: p.color, size: 15 })
    link(n, `Open ${p.name}`, `${p.key}:hub`, 'product')
  })
  btn(s, { x: 0.5, y: 6.25, w: 3.2, h: 0.5, text: 'How this deck works', target: 'howto', fill: C.grey, color: C.ink, size: 13, lineColor: C.border })
  link(n, 'How this deck works', 'howto', 'info')
  notes(s, 'Home slide. Every other slide has a Home button that returns here.')
}
// HOWTO
{
  const s = slideFor('howto'); const n = HOWTO
  frame(s, n, { title: 'How this deck works', chip: 'Read once' })
  card(s, 0.4, 1.4, 6.3, 5.3)
  text(s, 'Navigation', { x: 0.6, y: 1.5, w: 5.9, h: 0.4, fontSize: 18, bold: true })
  bulletsBox(s, [
    'Run the deck in Slide Show mode (F5). Links only work in Slide Show.',
    'Click a button to jump. Home returns to the product list; Back returns to the slide you just came from.',
    'In a scenario, each decision has three choices. Each choice shows its own customer reaction, consequence and coaching.',
    'Use Return to decision to try a different option, and Scenario map to replay any decision.',
    'Every shape is editable in PowerPoint. Replace the dashed screenshot placeholders with real screenshots.',
  ], 0.5, 1.95, 6.1, 4.6, 14)
  card(s, 6.9, 1.4, 6.0, 5.3)
  text(s, 'What is real, and what is training content', { x: 7.1, y: 1.5, w: 5.6, h: 0.4, fontSize: 18, bold: true })
  bulletsBox(s, [
    'Product hubs state only documented facts, each with its source in the speaker notes.',
    'Customers, quotes and objections in scenarios are fictional training material.',
    'Where the documentation has nothing (pricing, ROI, USPs, testimonials, screenshots) the deck says so. The correct sales move is not to invent it.',
    'Customer confidence is tracked by which slide you land on (Strong / Wavering / At risk). PowerPoint cannot keep a score without macros, so the outcome slide is your performance report.',
  ], 7.0, 1.95, 5.8, 4.6, 14)
  notes(s, 'Explains slide-show mode, navigation, the verified-vs-fictional distinction, and the no-macro limitation (no stored score).')
}

for (const p of PRODUCTS) {
  const k = p.key, F = p.front
  const hdr = (n, title, extra) => ({ title, color: p.color, chip: p.name, prov: 'verified', ...extra })

  // HUB
  {
    const n = byId[`${k}:hub`]; const s = slideFor(n.id)
    frame(s, n, { title: `${p.name}  -  Product hub`, color: p.color, chip: 'Choose a topic', prov: 'verified' })
    text(s, p.tagline, { x: 0.5, y: 1.05, w: 8.6, h: 0.4, fontSize: 16, color: C.muted })
    const tiles = [
      ['Overview', 'overview'], ['Modules and offers', 'modules'], ['Customer problems solved', 'problems'], ['Target customers', 'customers'],
      ['Benefits and USPs', 'benefits'], ['Use cases and proof', 'proof'], ['Readiness and limitations', 'readiness'], ['What we cannot claim', 'missing'],
    ]
    tiles.forEach(([label, id], i) => {
      const x = 0.5 + (i % 4) * 3.1, y = 1.6 + Math.floor(i / 4) * 1.5
      btn(s, { x, y, w: 2.9, h: 1.3, text: label, target: `${k}:${id}`, fill: C.card, color: p.color, size: 17, lineColor: p.color })
      link(n, label, `${k}:${id}`, 'info')
    })
    card(s, 0.5, 4.75, 12.3, 1.95, { fill: C.card })
    text(s, 'Practise the sale', { x: 0.7, y: 4.85, w: 6, h: 0.4, fontSize: 18, bold: true, color: p.color })
    text(s, `A branching simulation with ${p.persona.name}. ${p.decisions.length} decisions across the 11 stages of a sale, with successful, stalled and lost outcomes.`, { x: 0.7, y: 5.3, w: 8.0, h: 0.9, fontSize: 14 })
    btn(s, { x: 9.0, y: 5.2, w: 3.6, h: 0.75, text: 'Meet the customer  >', target: `${k}:persona`, fill: p.color, size: 17 })
    link(n, 'Meet the customer', `${k}:persona`, 'start')
    btn(s, { x: 9.0, y: 6.0, w: 3.6, h: 0.5, text: 'Scenario map', target: `${k}:map`, fill: C.grey, color: C.ink, size: 13, lineColor: C.border })
    link(n, 'Scenario map', `${k}:map`, 'info')
    notes(s, `Product hub for ${p.fullName}. ${p.nameNote}`)
  }
  // generic info slide
  const infoSlide = (id, title, bullets, src, shot) => {
    const n = byId[id]; const s = slideFor(id)
    frame(s, n, hdr(n, title, { titleSize: title.length > 48 ? 20 : 24 }))
    card(s, 0.4, 1.45, shot ? 8.0 : 12.5, 5.2)
    bulletsBox(s, bullets, 0.55, 1.55, shot ? 7.7 : 12.2, 4.6, 'auto')
    text(s, 'Source: ' + src, { x: 0.55, y: 6.2, w: shot ? 7.7 : 8.9, h: 0.4, fontSize: 9.5, color: C.muted, italic: true, valign: 'middle' })
    if (shot) {
      card(s, 8.6, 1.45, 4.3, 3.6, { fill: C.grey, dash: 'dash', line: C.muted })
      text(s, 'Screenshot placeholder\n' + shot, { x: 8.7, y: 1.5, w: 4.1, h: 3.5, align: 'center', valign: 'middle', fontSize: 13, color: C.muted })
      text(s, 'No product screenshot exists in the repos. Replace this box with a real one.', { x: 8.6, y: 5.1, w: 4.3, h: 0.7, fontSize: 11, color: C.muted, italic: true })
    }
    btn(s, { x: 9.8, y: 6.0, w: 3.1, h: 0.55, text: 'Back to product hub', target: `${k}:hub`, fill: p.color, size: 13 })
    link(n, 'Back to product hub', `${k}:hub`, 'nav')
    notes(s, `VERIFIED FACTS. Sources: ${src}`)
    return { n, s }
  }
  infoSlide(`${k}:overview`, 'Overview', F.overview.bullets, F.overview.src, F.overview.shot)
  // modules hub
  {
    const n = byId[`${k}:modules`]; const s = slideFor(n.id)
    frame(s, n, hdr(n, 'Modules and offers'))
    text(s, 'Pick a module to see its features, status and sources.', { x: 0.5, y: 1.05, w: 8.6, h: 0.4, fontSize: 15, color: C.muted })
    F.modules.forEach((m, i) => {
      const y = 1.6 + i * 1.25
      btn(s, { x: 0.5, y, w: 12.3, h: 1.1, text: m.title, target: `${k}:mod${i}`, fill: C.card, color: p.color, size: 18, align: 'left', lineColor: p.color, margin: 18 })
      link(n, m.title, `${k}:mod${i}`, 'info')
    })
    notes(s, 'Module list. Each button opens the module detail slide.')
  }
  F.modules.forEach((m, i) => infoSlide(`${k}:mod${i}`, m.title, m.bullets, m.src, m.shot))
  infoSlide(`${k}:problems`, 'Customer problems solved', F.problems.bullets, F.problems.src)
  infoSlide(`${k}:customers`, 'Target customers', F.customers.bullets, F.customers.src)
  // benefits
  {
    const n = byId[`${k}:benefits`]; const s = slideFor(n.id)
    frame(s, n, hdr(n, 'Benefits and USPs'))
    card(s, 0.4, 1.45, 6.2, 5.2, { fill: C.greenBg, line: C.green })
    text(s, 'Documented (you may say this)', { x: 0.55, y: 1.5, w: 5.9, h: 0.4, fontSize: 17, bold: true, color: C.green })
    bulletsBox(s, F.benefits.verified, 0.5, 1.95, 6.0, 4.6, 14)
    card(s, 6.8, 1.45, 6.1, 4.2, { fill: C.redBg, line: C.red })
    text(s, 'NOT documented (do not claim)', { x: 6.95, y: 1.5, w: 5.8, h: 0.4, fontSize: 17, bold: true, color: C.red })
    bulletsBox(s, F.benefits.missing, 6.9, 1.95, 5.9, 3.7, 14)
    btn(s, { x: 9.8, y: 5.95, w: 3.1, h: 0.55, text: 'Back to product hub', target: `${k}:hub`, fill: p.color, size: 13 })
    link(n, 'Back to product hub', `${k}:hub`, 'nav')
    notes(s, `VERIFIED FACTS. Source: ${F.benefits.src}`)
  }
  infoSlide(`${k}:proof`, 'Use cases and proof points', F.proof.bullets, F.proof.src)
  // readiness
  {
    const n = byId[`${k}:readiness`]; const s = slideFor(n.id)
    frame(s, n, hdr(n, 'Readiness and limitations'))
    const colorFor = (st) => (/^Live/.test(st) ? [C.green, C.greenBg] : /^(Proven|Built)/.test(st) ? ['2F6FB0', 'E6F0FA'] : /development|Pilot|Prototype/.test(st) ? [C.amber, C.amberBg] : [C.red, C.redBg])
    const rows = [[
      { text: 'Offer', options: { bold: true, color: 'FFFFFF', fill: { color: C.navy } } },
      { text: 'Portfolio readiness status', options: { bold: true, color: 'FFFFFF', fill: { color: C.navy } } },
    ]]
    F.readiness.rows.forEach(([a, b]) => {
      const [fc, bg] = colorFor(b)
      rows.push([{ text: a, options: { color: C.ink } }, { text: b, options: { bold: true, color: fc, fill: { color: bg } } }])
    })
    s.addTable(rows, { x: 0.4, y: 1.45, w: 8.2, colW: [4.4, 3.8], fontFace: FONT, fontSize: 12, border: { type: 'solid', color: C.border, pt: 1 }, rowH: 0.34, valign: 'middle' })
    card(s, 8.8, 1.45, 4.1, 4.4, { fill: C.amberBg, line: C.amber })
    text(s, 'Limitations', { x: 8.95, y: 1.5, w: 3.8, h: 0.4, fontSize: 16, bold: true, color: C.amber })
    bulletsBox(s, F.readiness.notes, 8.9, 1.95, 3.9, 3.9, 12.5)
    btn(s, { x: 9.8, y: 6.05, w: 3.1, h: 0.5, text: 'Back to product hub', target: `${k}:hub`, fill: p.color, size: 13 })
    link(n, 'Back to product hub', `${k}:hub`, 'nav')
    notes(s, 'VERIFIED FACTS. Source: config/portfolio_seed_data.json readiness_status and notes; docs where cited. Every readiness label is unconfirmed (readiness_confirmed = false).')
  }
  // missing
  {
    const n = byId[`${k}:missing`]; const s = slideFor(n.id)
    frame(s, n, hdr(n, 'What we cannot claim: missing information'))
    card(s, 0.4, 1.45, 12.5, 4.4, { fill: C.redBg, line: C.red })
    text(s, 'No source exists for these. If a customer asks, say you will confirm and come back.', { x: 0.55, y: 1.5, w: 12.0, h: 0.45, fontSize: 16, bold: true, color: C.red })
    bulletsBox(s, F.missing, 0.55, 2.05, 12.2, 3.7, 15)
    btn(s, { x: 9.8, y: 6.05, w: 3.1, h: 0.5, text: 'Back to product hub', target: `${k}:hub`, fill: p.color, size: 13 })
    link(n, 'Back to product hub', `${k}:hub`, 'nav')
    notes(s, 'Gaps recorded during research. Inventing any of these breaks the no-fabrication rule.')
  }
  // persona
  {
    const n = byId[`${k}:persona`]; const s = slideFor(n.id)
    frame(s, n, { title: 'Meet the customer', color: p.color, chip: p.name, prov: 'training' })
    card(s, 0.4, 1.45, 12.5, 4.5)
    avatar(s, 0.8, 1.8, 1.5, p.persona.initial, p.color)
    text(s, p.persona.name, { x: 2.6, y: 1.75, w: 9.5, h: 0.6, fontSize: 28, bold: true })
    text(s, p.persona.role, { x: 2.6, y: 2.35, w: 9.5, h: 0.5, fontSize: 17, color: C.muted })
    bulletsBox(s, p.persona.bullets, 2.5, 3.0, 10.2, 2.4, 15)
    text(s, p.persona.note, { x: 0.6, y: 5.4, w: 12.0, h: 0.5, fontSize: 12, italic: true, color: C.amber })
    btn(s, { x: 7.2, y: 6.05, w: 3.3, h: 0.7, text: 'Start the scenario  >', target: `${k}:d0S`, fill: p.color, size: 17 })
    link(n, 'Start the scenario', `${k}:d0S`, 'start')
    btn(s, { x: 10.7, y: 6.05, w: 2.2, h: 0.7, text: 'Scenario map', target: `${k}:map`, fill: C.grey, color: C.ink, size: 13, lineColor: C.border })
    link(n, 'Scenario map', `${k}:map`, 'info')
    notes(s, 'TRAINING SCENARIO. Fictional persona.')
  }
  // map
  {
    const n = byId[`${k}:map`]; const s = slideFor(n.id)
    frame(s, n, { title: 'Scenario map: replay any decision', color: p.color, chip: p.name, prov: 'training' })
    text(s, 'The 11 stages of the sale are covered by 8 decisions. Click a decision to jump to it (customer confidence resets to Strong).', { x: 0.5, y: 1.05, w: 8.7, h: 0.5, fontSize: 13, color: C.muted })
    p.decisions.forEach((d, i) => {
      const x = 0.5 + (i % 4) * 3.1, y = 1.7 + Math.floor(i / 4) * 1.65
      const stages = d.stageNums.length > 1 ? `Stages ${d.stageNums[0]}-${d.stageNums[1]}` : `Stage ${d.stageNums[0]}`
      btn(s, { x, y, w: 2.9, h: 1.5, text: `Decision ${i + 1}\n${stages}\n${d.stage}`, target: `${k}:d${i}S`, fill: C.card, color: p.color, size: 13, lineColor: p.color })
      link(n, `Decision ${i + 1}`, `${k}:d${i}S`, 'replay')
    })
    card(s, 0.5, 5.1, 12.3, 1.6)
    text(s, 'Stages: 1 Customer introduction | 2 Requirements | 3 Business problems | 4 Product recommendation | 5 Demonstration | 6 Customer questions | 7 Objection handling | 8 Competitor comparison | 9 Price and negotiation | 10 Closing | 11 Follow-up and relationship management', { x: 0.65, y: 5.15, w: 12.0, h: 1.0, fontSize: 12.5, color: C.ink })
    text(s, 'Possible endings: Deal won | Won with concessions | Stalled | Lost (at any decision).', { x: 0.65, y: 6.1, w: 12.0, h: 0.5, fontSize: 12.5, bold: true, color: p.color })
    notes(s, 'Replay index. 11 stages mapped to 8 decisions.')
  }

  // scenario slides
  p.decisions.forEach((d, i) => {
    const stages = d.stageNums.length > 1 ? `Stages ${d.stageNums[0]}-${d.stageNums[1]}` : `Stage ${d.stageNums[0]}`
    const chipFor = `Decision ${i + 1} of ${p.decisions.length}  |  ${stages}`
    for (const lane of (i === 0 ? ['S'] : ['S', 'M'])) {
      // decision slide
      const dn = byId[`${k}:d${i}${lane}`]; const s = slideFor(dn.id)
      frame(s, dn, { title: d.stage, titleSize: 24, color: p.color, chip: chipFor, prov: 'training' })
      card(s, 0.4, 1.45, 5.9, 3.6)
      avatar(s, 0.6, 1.6, 0.9, p.persona.initial, p.color)
      text(s, `${p.persona.name}`, { x: 1.6, y: 1.62, w: 4.5, h: 0.4, fontSize: 15, bold: true })
      text(s, p.persona.role, { x: 1.6, y: 1.98, w: 4.6, h: 0.5, fontSize: 10.5, color: C.muted })
      const q = lane === 'S' ? d.scene : d.sceneM
      text(s, q, { x: 0.6, y: 2.6, w: 5.6, h: 2.4, fontSize: q.length > 170 ? 17 : 20, italic: true })
      const strong = lane === 'S'
      s.addText(`Customer confidence: ${strong ? 'STRONG' : 'WAVERING'}`, {
        shape: pptx.ShapeType.roundRect, rectRadius: 0.1, x: 0.4, y: 5.2, w: 5.9, h: 0.5,
        fill: { color: strong ? C.greenBg : C.amberBg }, line: { color: strong ? C.green : C.amber, width: 1 },
        color: strong ? C.green : C.amber, fontFace: FONT, fontSize: 14, bold: true, align: 'center', valign: 'middle',
      })
      text(s, strong ? 'The customer is engaged. Protect that.' : 'An earlier misstep has made the customer wary. A best move can win trust back; a poor one will end the deal.', { x: 0.4, y: 5.75, w: 5.9, h: 0.9, fontSize: 11.5, color: C.muted })
      text(s, d.prompt, { x: 6.6, y: 1.4, w: 6.3, h: 0.5, fontSize: 19, bold: true, color: p.color })
      d.options.forEach((o, j) => {
        const y = 2.0 + j * 1.57
        s.addText(String.fromCharCode(65 + j), {
          shape: pptx.ShapeType.ellipse, x: 6.6, y: y + 0.45, w: 0.55, h: 0.55, fill: { color: p.color }, line: { color: p.color },
          color: 'FFFFFF', fontFace: FONT, fontSize: 16, bold: true, align: 'center', valign: 'middle', margin: 0,
        })
        const to = `${k}:d${i}${lane}:fb${j}`
        btn(s, { x: 7.25, y, w: 5.65, h: 1.45, text: o.label, target: to, fill: C.card, color: C.ink, size: o.label.length > 190 ? 13 : o.label.length > 120 ? 14.5 : 16, bold: false, align: 'left', lineColor: p.color, margin: 10 })
        link(dn, o.label, to, o.rating)
      })
      notes(s, `TRAINING SCENARIO (${lane === 'S' ? 'strong' : 'wavering'} lane). Fictional customer. Facts referenced come from the product hub slides.`)

      // feedback slides
      d.options.forEach((o, j) => {
        const fn = byId[`${k}:d${i}${lane}:fb${j}`]; const fs_ = slideFor(fn.id)
        const rt = RATING[o.rating]
        frame(fs_, fn, { title: `Decision ${i + 1} result`, color: rt.color, chip: chipFor, prov: 'training' })
        fs_.addText(rt.label, {
          shape: pptx.ShapeType.roundRect, rectRadius: 0.1, x: 0.4, y: 1.4, w: 4.4, h: 0.5, fill: { color: rt.bg }, line: { color: rt.color, width: 1.5 },
          color: rt.color, fontFace: FONT, fontSize: 15, bold: true, align: 'center', valign: 'middle',
        })
        text(fs_, `You chose: ${o.label}`, { x: 5.0, y: 1.35, w: 7.9, h: 0.75, fontSize: 12, italic: true, color: C.muted })
        const boxes = [
          ['Customer reaction', o.react, p.color], ['Consequence', o.result, rt.color], ['Coaching', o.coach, C.navy],
        ]
        boxes.forEach(([h, t, col], b) => {
          const x = 0.4 + b * 4.2
          card(fs_, x, 2.25, 4.05, 3.3)
          fs_.addShape(pptx.ShapeType.rect, { x, y: 2.25, w: 4.05, h: 0.1, fill: { color: col }, line: { color: col } })
          text(fs_, h, { x: x + 0.15, y: 2.4, w: 3.75, h: 0.4, fontSize: 15, bold: true, color: col })
          text(fs_, t, { x: x + 0.15, y: 2.85, w: 3.75, h: 2.6, fontSize: t.length > 150 ? 17 : 19 })
        })
        const to = dest(p, i, lane, o.rating)
        const conf = confidenceOf(to)
        text(fs_, `Customer confidence after this move: ${conf}`, { x: 0.4, y: 5.7, w: 7.0, h: 0.4, fontSize: 13, bold: true, color: rt.color })
        const contLabel = to.endsWith(':rec') ? 'See the customer\'s response  >' : /:out:/.test(to) ? 'See the outcome  >' : /:lost/.test(to) ? 'See what happens  >' : 'Continue  >'
        btn(fs_, { x: 7.4, y: 5.85, w: 3.3, h: 0.7, text: contLabel, target: to, fill: rt.color, size: 15 })
        link(fn, contLabel, to, 'continue')
        const back = `${k}:d${i}${lane}`
        btn(fs_, { x: 10.85, y: 5.85, w: 2.05, h: 0.7, text: 'Return to decision', target: back, fill: C.card, color: C.ink, size: 12.5, lineColor: C.border })
        link(fn, 'Return to decision', back, 'return')
        notes(fs_, `TRAINING SCENARIO. Rating: ${o.rating}. Stage: ${d.stage}. Coaching: ${o.coach}`)
      })

      // recovery (strong lane only)
      if (lane === 'S') {
        const rn = byId[`${k}:d${i}S:rec`]; const rs = slideFor(rn.id)
        frame(rs, rn, { title: 'Recovery moment', color: C.red, chip: chipFor, prov: 'training' })
        card(rs, 0.4, 1.45, 5.9, 3.6, { fill: C.redBg, line: C.red })
        avatar(rs, 0.6, 1.6, 0.9, p.persona.initial, C.red)
        text(rs, p.persona.name, { x: 1.6, y: 1.7, w: 4.5, h: 0.4, fontSize: 15, bold: true })
        text(rs, d.recovery.line, { x: 0.6, y: 2.6, w: 5.6, h: 2.3, fontSize: 17, italic: true })
        text(rs, 'Customer confidence: AT RISK. You have one chance to recover.', { x: 0.4, y: 5.2, w: 5.9, h: 0.8, fontSize: 14, bold: true, color: C.red })
        text(rs, 'How do you respond?', { x: 6.6, y: 1.4, w: 6.3, h: 0.5, fontSize: 19, bold: true, color: C.red })
        const good = recDest(p, i, true), bad = recDest(p, i, false)
        btn(rs, { x: 6.6, y: 2.1, w: 6.3, h: 1.6, text: d.recovery.good, target: good, fill: C.card, color: C.ink, size: 14, bold: false, align: 'left', lineColor: C.green, margin: 12 })
        link(rn, d.recovery.good, good, 'recover')
        btn(rs, { x: 6.6, y: 3.9, w: 6.3, h: 1.6, text: d.recovery.bad, target: bad, fill: C.card, color: C.ink, size: 14, bold: false, align: 'left', lineColor: C.red, margin: 12 })
        link(rn, d.recovery.bad, bad, 'double-down')
        btn(rs, { x: 10.0, y: 5.85, w: 2.9, h: 0.6, text: 'Return to decision', target: `${k}:d${i}S`, fill: C.card, color: C.ink, size: 13, lineColor: C.border })
        link(rn, 'Return to decision', `${k}:d${i}S`, 'return')
        notes(rs, 'TRAINING SCENARIO. Recovery path after a poor decision.')
      }
    }
    // lost slide
    {
      const ln = byId[`${k}:lost${i}`]; const ls = slideFor(ln.id)
      frame(ls, ln, { title: p.outcomes.lost.title, color: C.red, chip: chipFor, prov: 'training' })
      card(ls, 0.4, 1.45, 7.4, 3.2, { fill: C.redBg, line: C.red })
      avatar(ls, 0.6, 1.6, 0.9, p.persona.initial, C.red)
      text(ls, `${p.persona.name} ends the conversation`, { x: 1.6, y: 1.75, w: 6.0, h: 0.5, fontSize: 16, bold: true })
      text(ls, d.lost, { x: 0.6, y: 2.6, w: 7.0, h: 1.9, fontSize: 18, italic: true })
      card(ls, 8.0, 1.45, 4.9, 3.2)
      text(ls, 'Where it went wrong', { x: 8.15, y: 1.5, w: 4.6, h: 0.4, fontSize: 15, bold: true, color: C.red })
      text(ls, `Decision ${i + 1}: ${d.stage}.\nReplay it and try a different approach. Trust is lost faster than it is built.`, { x: 8.15, y: 1.95, w: 4.6, h: 2.6, fontSize: 14 })
      btn(ls, { x: 0.4, y: 5.0, w: 4.4, h: 0.75, text: `Replay decision ${i + 1}  >`, target: `${k}:d${i}S`, fill: C.red, size: 16 })
      link(ln, 'Replay decision', `${k}:d${i}S`, 'replay')
      btn(ls, { x: 5.0, y: 5.0, w: 3.6, h: 0.75, text: 'Scenario map', target: `${k}:map`, fill: C.grey, color: C.ink, size: 14, lineColor: C.border })
      link(ln, 'Scenario map', `${k}:map`, 'info')
      btn(ls, { x: 8.8, y: 5.0, w: 4.1, h: 0.75, text: 'Start over', target: `${k}:d0S`, fill: C.card, color: C.ink, size: 14, lineColor: C.border })
      link(ln, 'Start over', `${k}:d0S`, 'replay')
      notes(ls, 'TRAINING SCENARIO. Unsuccessful outcome: deal lost.')
    }
  })

  // outcomes
  const outDefs = [
    ['won', 'Excellent', C.green, C.greenBg],
    ['wonConc', 'Good, with room to improve', C.amber, C.amberBg],
    ['stalled', 'Needs work', C.amber, C.amberBg],
  ]
  for (const [key, tier, col, bg] of outDefs) {
    const on = byId[`${k}:out:${key}`]; const os = slideFor(on.id)
    const o = p.outcomes[key]
    frame(os, on, { title: o.title, titleSize: 22, color: col, chip: 'Final outcome', prov: 'training' })
    card(os, 0.4, 1.45, 7.6, 3.4, { fill: bg, line: col })
    text(os, 'What happened', { x: 0.55, y: 1.5, w: 7.3, h: 0.4, fontSize: 16, bold: true, color: col })
    text(os, o.text, { x: 0.55, y: 1.95, w: 7.3, h: 2.8, fontSize: 16 })
    card(os, 8.2, 1.45, 4.7, 3.4)
    text(os, 'Sales performance evaluation', { x: 8.35, y: 1.5, w: 4.4, h: 0.4, fontSize: 15, bold: true, color: col })
    text(os, tier, { x: 8.35, y: 1.95, w: 4.4, h: 0.5, fontSize: 20, bold: true, color: col })
    bulletsBox(os, o.lessons, 8.3, 2.5, 4.5, 2.3, 13)
    btn(os, { x: 0.4, y: 5.1, w: 3.6, h: 0.75, text: 'Replay the scenario  >', target: `${k}:d0S`, fill: col, size: 16 })
    link(on, 'Replay the scenario', `${k}:d0S`, 'replay')
    btn(os, { x: 4.2, y: 5.1, w: 3.6, h: 0.75, text: 'Review decisions (map)', target: `${k}:map`, fill: C.grey, color: C.ink, size: 14, lineColor: C.border })
    link(on, 'Review decisions', `${k}:map`, 'info')
    btn(os, { x: 8.0, y: 5.1, w: 4.9, h: 0.75, text: 'Try another product', target: 'home', fill: C.card, color: C.ink, size: 14, lineColor: C.border })
    link(on, 'Try another product', 'home', 'nav')
    notes(os, `TRAINING SCENARIO. Outcome: ${key}. Performance tier: ${tier}.`)
  }
}

/* ---------- enforce slide order == node order ---------- */
const pres = pptx
const rendered = pres._slides.map((s) => s.__id)
rendered.forEach((id, i) => { if (id !== nodes[i].id) throw new Error(`slide order mismatch at ${i}: ${id} vs ${nodes[i].id}`) })
if (rendered.length !== nodes.length) throw new Error('not every node rendered')

/* ---------- post-process: inject native click-links ---------- */
async function post(buf) {
  const zip = await JSZip.loadAsync(buf)
  let linkCount = 0
  for (let i = 1; i <= nodes.length; i++) {
    const sp = `ppt/slides/slide${i}.xml`, rp = `ppt/slides/_rels/slide${i}.xml.rels`
    let xml = await zip.file(sp).async('string')
    let rels = await zip.file(rp).async('string')
    const targets = {}
    xml = xml.replace(/<p:cNvPr id="(\d+)" name="LINK\|([^"]+)"([^>]*?)(?:\/>|>\s*<\/p:cNvPr>)/g, (m, id, tgt, rest) => {
      linkCount++
      if (tgt === 'LAST') {
        return `<p:cNvPr id="${id}" name="Back button"${rest}><a:hlinkClick r:id="" action="ppaction://hlinkshowjump?jump=lastslideviewed" tooltip="Back to the slide you just viewed"/></p:cNvPr>`
      }
      const rid = (targets[tgt] ||= `rIdNav${tgt}`)
      return `<p:cNvPr id="${id}" name="Button to slide ${tgt}"${rest}><a:hlinkClick r:id="${rid}" action="ppaction://hlinksldjump"/></p:cNvPr>`
    })
    if (/name="LINK\|/.test(xml)) throw new Error(`unreplaced link in slide ${i}`)
    const add = Object.entries(targets).map(([t, rid]) => `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slide${t}.xml"/>`).join('')
    rels = rels.replace('</Relationships>', add + '</Relationships>')
    zip.file(sp, xml); zip.file(rp, rels)
  }
  return { out: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }), linkCount }
}

/* ---------- navigation map ---------- */
function writeMap() {
  const L = []
  L.push('# Interactive Sales Training: navigation map', '', 'Generated by `generator/build.js`. Slide numbers are the numbers in the .pptx.', '')
  L.push('## Structure', '', '```', 'Home (1) -> How it works (2)', '  -> Product hub (per product) -> 8 info slides (overview, modules(+details), problems, customers, benefits, proof, readiness, cannot-claim)', '  -> Persona -> Decision 1 ... Decision 8 -> Outcome (Won | Won with concessions | Stalled | Lost)', '```', '')
  L.push('## Branching rule (applies to every decision)', '', '| Current lane | Best move | Partial move | Poor move |', '|---|---|---|---|',
    '| Strong (S) | next decision, Strong | next decision, Wavering | Recovery slide -> recover: next decision, Wavering / double down: Lost |',
    '| Wavering (M) | next decision, Strong | next decision, Wavering | Lost (can replay) |', '',
    'Last decision: S+best = **Won**; S+partial = **Won with concessions**; S+poor = recovery (recover = **Stalled**, else Lost); M+best = Won with concessions; M+partial = **Stalled**; M+poor = Lost.', '')
  for (const p of PRODUCTS) {
    L.push(`## ${p.fullName}`, '', `Persona: ${p.persona.name}, ${p.persona.role} (fictional).`, '')
    L.push('| Slide | Type | Title | Links to (slide: label) |', '|---|---|---|---|')
    nodes.filter((n) => n.product === p).forEach((n) => {
      const ls = n.links.filter((l) => ['dec', 'fb', 'rec', 'lost', 'out', 'persona', 'hub', 'modhub'].includes(n.type)).map((l) => `${N(l.to)} (${l.label.slice(0, 38)}${l.label.length > 38 ? '...' : ''})`).join('; ')
      L.push(`| ${n.num} | ${n.type} | ${n.title} | ${ls} |`)
    })
    L.push('')
  }
  L.push('## Limits of native PowerPoint navigation', '', '- No variables without macros: confidence is encoded in which slide you are on (two parallel lanes), not a stored score.', '- Hyperlinks work in Slide Show mode only.', '- "Back" is PowerPoint\'s "last slide viewed" jump; pressing it twice returns you to where you were.', '')
  fs.writeFileSync(path.join(__dirname, '..', 'NAVIGATION-MAP.md'), L.join('\n'))
}

;(async () => {
  const buf = await pptx.write({ outputType: 'nodebuffer' })
  const { out, linkCount } = await post(buf)
  fs.writeFileSync(OUT, out)
  fs.writeFileSync(path.join(__dirname, 'graph.json'), JSON.stringify(nodes.map((n) => ({ num: n.num, id: n.id, type: n.type, product: n.product && n.product.key, title: n.title, links: n.links.map((l) => ({ label: l.label, to: N(l.to), role: l.role })) })), null, 1))
  writeMap()
  console.log(`wrote ${OUT}\nslides: ${nodes.length}, injected links: ${linkCount}`)
})().catch((e) => { console.error(e); process.exit(1) })
