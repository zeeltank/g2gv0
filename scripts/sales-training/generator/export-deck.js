/* Exports ONE sales-training deck containing all three products, in the study-deck v3 shape.
 *   node export-deck.js [path-to-frontend]   (default: the frontend this folder lives in)
 * Writes <frontend>/public/sales-training/sales/deck.json, images/*.svg and <frontend>/public/sales-training/index.json.
 *
 * Slide 1 is the cover, slide 2 is a product chooser (three answers, each opening that product's own cover), then the
 * three product blocks one after another. Branching uses decision + outcome interactions, so every choice opens its own
 * slide. Every ending offers "Choose another product", which goes back to slide 2.
 */
const fs = require('fs')
const path = require('path')
const args = process.argv.slice(2)
const ROOT = args.find((a) => !a.startsWith('--')) || path.resolve(__dirname, '..', '..', '..') // the frontend this folder lives in
const WANT = ((args.find((a) => a.startsWith('--products=')) || '--products=g2g').split('=')[1] || 'g2g').split(',')
const OUT = path.join(ROOT, 'public', 'sales-training', 'sales')
const ALL = [require('./content/scholarclone'), require('./content/g2g'), require('./content/enterprise-brain')]
const PRODUCTS = ALL.filter((p) => WANT.includes(p.key))
if (PRODUCTS.length === 0) throw new Error('no products selected: ' + WANT.join(','))
for (const p of PRODUCTS) if (p.key === 'g2g') p.explorer = require('./content/g2g-explorer')
const NAVY = '1c2468'

const svg = (initial, label, sub, c1, c2) => `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#${c1}"/><stop offset="1" stop-color="#${c2}"/></linearGradient></defs>
<rect width="1280" height="720" fill="url(#g)"/>
<circle cx="1010" cy="360" r="250" fill="#ffffff" fill-opacity="0.07"/><circle cx="1010" cy="360" r="170" fill="#ffffff" fill-opacity="0.08"/>
<circle cx="1010" cy="360" r="95" fill="#ffffff" fill-opacity="0.9"/><text x="1010" y="395" text-anchor="middle" font-family="Segoe UI,Arial" font-size="100" font-weight="700" fill="#${c1}">${initial}</text>
<text x="80" y="640" font-family="Segoe UI,Arial" font-size="34" font-weight="700" fill="#fff">${label}</text>
<text x="80" y="680" font-family="Segoe UI,Arial" font-size="20" fill="#fff" fill-opacity="0.85">${sub}</text></svg>`
const dark = (hex, f) => hex.match(/../g).map((h) => Math.round(parseInt(h, 16) * f).toString(16).padStart(2, '0')).join('')

const VER = 'Verified product facts'
const TRN = 'Training scenario (fictional customer)'
const MULTI = PRODUCTS.length > 1
// With several products slide 2 is the product chooser; with one, the product's own cover (slide 1) is the start.
const CHOOSER_N = MULTI ? 2 : 1
const CHOOSER_LABEL = MULTI ? 'Choose another product' : 'Back to the start'

/** One product's slides, numbered from offset + 1. Returns { slides, coverN }. */
function buildProduct(p, offset) {
  const k = p.key, F = p.front
  const slides = []; const idx = {}; const order = []
  const add = (id) => { order.push(id); idx[id] = order.length + offset }
  const X = p.explorer
  const xIds = X ? [['xhub', X.hub.title], ...X.modules.flatMap((m) => [[`x:${m.id}`, m.title], [`x:${m.id}:roles`, `${m.title}: who does what`]]), ['xmatrix', 'Who uses what: role overview']] : []
  const info = [['overview', 'Overview'], ...(X ? xIds : F.modules.map((m, i) => [`mod${i}`, m.title])), ['problems', 'Customer problems solved'], ['customers', 'Target customers'], ['benefits', 'Benefits and USPs'], ['proof', 'Use cases and proof'], ['readiness', 'Readiness and limitations'], ['missing', 'What we cannot claim'], ['persona', 'Meet the customer']]
  add('cover'); info.forEach(([id]) => add(id))
  p.decisions.forEach((d, i) => {
    add(`d${i}S`); d.options.forEach((o, j) => add(`d${i}S:fb${j}`)); add(`d${i}S:rec`)
    if (i > 0) { add(`d${i}M`); d.options.forEach((o, j) => add(`d${i}M:fb${j}`)) }
    add(`lost${i}`)
  })
  ;['won', 'wonConc', 'stalled'].forEach((o) => add(`out:${o}`))
  const N = (id) => { if (!idx[id]) throw new Error('missing ' + id); return idx[id] }
  const last = p.decisions.length - 1
  const dest = (i, lane, r) => {
    const L = i === last
    if (lane === 'S') return r === 'best' ? (L ? 'out:won' : `d${i + 1}S`) : r === 'partial' ? (L ? 'out:wonConc' : `d${i + 1}M`) : `d${i}S:rec`
    return r === 'best' ? (L ? 'out:wonConc' : `d${i + 1}S`) : r === 'partial' ? (L ? 'out:stalled' : `d${i + 1}M`) : `lost${i}`
  }
  const base = (id, title, section, content, interaction, extra = {}, image = null) => ({
    n: N(id), section, slide_type: extra.slide_type || 'objectives', title, accent: '#' + p.color,
    concept_ids: [], taught_concept_ids: [], concepts: [], relationship: null,
    content: Object.assign({ body: '', explanations: [], bullets: [], example: null, misconception: null, relationship_note: null, key_idea: null, discussion: null, bloom: 'apply', dok: 2, minutes: 2 }, content),
    question_ids: [], activities: [], interaction, interaction_reason: '', h5p_pattern: null, image_missing: null, image,
    ...(extra.next !== undefined ? { next: extra.next } : {}),
    ...(extra.product ? { product: extra.product } : {}),
    ...(extra.links ? { links: extra.links } : {}),
  })
  const img = (name, alt) => ({ type: 'photo', url: `/sales-training/sales/images/${name}.svg`, alt, caption: null, width: 1280, height: 720, role: 'scene', licence: null, source_url: null, creator: null, attribution: 'Illustration generated for this training deck; not a product screenshot.', attribution_required: false, backdrop: false })

  slides.push(base('cover', p.name, VER, {
    body: p.nameNote,
    bullets: ['Read the verified product facts first, then practise the sale with a fictional customer.', `${p.decisions.length} decisions cover the 11 stages of a sale. Every choice opens its own slide.`, 'Where the documentation has nothing (pricing, ROI, USPs, testimonials), the right move is never to invent it.'],
  }, null, { slide_type: 'hook', product: { name: p.name, tagline: p.tagline } }))
  const infoBody = { overview: F.overview, problems: F.problems, customers: F.customers, proof: F.proof }
  const explorerSlide = (id, title) => {
    const sec = `${p.name} - ${VER}`
    const link = (label, goto, primary) => ({ label, goto, ...(primary ? { primary: true } : {}) })
    if (id === 'xhub') {
      return base(id, X.hub.title, sec, { body: X.hub.body, bullets: [], key_idea: X.hub.note }, null, {
        links: [...X.modules.map((m, i) => link(`${i + 1}. ${m.title}: ${m.short}`, N(`x:${m.id}`))), link('Who uses what: role overview', N('xmatrix'))],
      })
    }
    if (id === 'xmatrix') {
      return base(id, 'Who uses what: role overview', sec, { body: `Source: ${X.matrixSrc}`, bullets: X.matrix.map(([r, u]) => `${r}: ${u}`) }, null, { links: [link('Back to all modules', N('xhub'), true)] })
    }
    const m = X.modules.find((x) => id === `x:${x.id}` || id === `x:${x.id}:roles`)
    const at = X.modules.indexOf(m)
    if (id.endsWith(':roles')) {
      const next = X.modules[at + 1]
      return base(id, `${m.title}: who does what`, sec, { body: `Source: ${m.roleSrc}`, bullets: m.roles.map(([r, w]) => `${r}: ${w}`) }, null, {
        links: [link('Back to this module', N(`x:${m.id}`)), ...(next ? [link(`Next module: ${next.title}`, N(`x:${next.id}`), true)] : [link('Role overview', N('xmatrix'), true)]), link('All modules', N('xhub'))],
      })
    }
    return base(id, m.title, sec, { body: `Source: ${m.src}`, bullets: m.does }, null, {
      links: [link('Who does what: role by role', N(`x:${m.id}:roles`), true), link('Back to all modules', N('xhub'))],
    })
  }
  info.forEach(([id, title]) => {
    if (X && (id === 'xhub' || id === 'xmatrix' || id.startsWith('x:'))) { slides.push(explorerSlide(id, title)); return }
    let c
    if (id === 'benefits') c = { body: `Source: ${F.benefits.src}`, bullets: [...F.benefits.verified.map((t) => `Documented: ${t}`), ...F.benefits.missing.map((t) => `NOT documented, do not claim: ${t}`)] }
    else if (id === 'readiness') c = { body: 'Portfolio readiness status. Every label is unconfirmed (readiness_confirmed = false).', bullets: [...F.readiness.rows.map((r) => `${r[0]}: ${r[1]}`), ...F.readiness.notes.map((t) => `Limit: ${t}`)] }
    else if (id === 'missing') c = { body: 'No source exists for these. If a customer asks, say you will confirm and come back.', bullets: F.missing }
    else if (id === 'persona') c = { body: `${p.persona.name}, ${p.persona.role}.`, bullets: [...p.persona.bullets, p.persona.note], key_idea: 'Start the scenario with Continue.' }
    else if (id.startsWith('mod')) { const m = F.modules[+id.slice(3)]; c = { body: `Source: ${m.src}`, bullets: m.bullets } }
    else c = { body: `Source: ${infoBody[id].src}`, bullets: infoBody[id].bullets }
    slides.push(base(id, title, id === 'persona' ? `${p.name} - ${TRN}` : `${p.name} - ${VER}`, c, null))
  })
  p.decisions.forEach((d, i) => {
    const stages = d.stageNums.length > 1 ? `Stages ${d.stageNums.join('-')}` : `Stage ${d.stageNums[0]}`
    const sec = `Decision ${i + 1} of ${p.decisions.length} - ${stages}`
    const tag = `${p.name} - ${sec} - ${TRN}`
    for (const lane of i === 0 ? ['S'] : ['S', 'M']) {
      const strong = lane === 'S'
      slides.push(base(`d${i}${lane}`, d.stage, tag, { body: strong ? d.scene : d.sceneM, bullets: [] }, {
        kind: 'decision', reason: 'A sales decision with a different consequence for each option.',
        kicker: `${p.name} - ${sec} - Customer confidence: ${strong ? 'Strong' : 'Wavering'}`,
        question: `${strong ? d.scene : d.sceneM}  ${d.prompt}`,
        options: d.options.map((o, j) => ({ id: 'abc'[j], text: o.label, goto: N(`d${i}${lane}:fb${j}`) })),
      }, { slide_type: 'challenge', next: -1 }, img(`scene-${k}`, `${p.persona.name}, the customer`)))
      d.options.forEach((o, j) => {
        const to = dest(i, lane, o.rating)
        slides.push(base(`d${i}${lane}:fb${j}`, `Decision ${i + 1}: ${o.rating === 'best' ? 'best move' : o.rating === 'partial' ? 'partial move' : 'poor decision'}`, tag, { body: o.result, bullets: [] }, {
          kind: 'outcome', reason: 'The consequence of this option.', tone: o.rating === 'best' ? 'sound' : 'caution',
          choice: { id: 'abc'[j], text: o.label }, what: `${o.react}  ${o.result}`, why: o.coach,
          actions: [{ label: /:rec$/.test(to) ? "See the customer's response" : /^out:|^lost/.test(to) ? 'See what happens' : 'Continue', goto: N(to), primary: true }, { label: 'Choose again', goto: N(`d${i}${lane}`) }],
        }, { slide_type: 'challenge', next: -1 }, img(`scene-${k}`, `${p.persona.name}, the customer`)))
      })
      if (strong) {
        slides.push(base(`d${i}S:rec`, 'Recovery moment', tag, { body: d.recovery.line, bullets: [] }, {
          kind: 'decision', reason: 'A poor decision gets one recovery chance.', kicker: `${p.name} - ${sec} - Customer confidence: At risk`,
          question: `${d.recovery.line}  How do you respond?`,
          options: [{ id: 'a', text: d.recovery.good, goto: N(i === last ? 'out:stalled' : `d${i + 1}M`) }, { id: 'b', text: d.recovery.bad, goto: N(`lost${i}`) }],
        }, { slide_type: 'challenge', next: -1 }, img(`lost-${k}`, 'The customer is losing confidence')))
      }
    }
    slides.push(base(`lost${i}`, p.outcomes.lost.title, tag, { body: d.lost, bullets: [] }, {
      kind: 'outcome', reason: 'An unsuccessful ending.', tone: 'caution', choice: { id: 'lost', text: `Deal lost at decision ${i + 1}: ${d.stage}` },
      what: d.lost, why: 'Trust is lost faster than it is built. Replay this decision and try a different approach.',
      actions: [{ label: `Replay decision ${i + 1}`, goto: N(`d${i}S`), primary: true }, { label: 'Start this scenario again', goto: N('d0S') }, { label: CHOOSER_LABEL, goto: CHOOSER_N }],
    }, { slide_type: 'challenge', next: -1 }, img(`lost-${k}`, 'Deal lost')))
  })
  const tiers = { won: ['Excellent', 'sound'], wonConc: ['Good, with room to improve', 'caution'], stalled: ['Needs work', 'caution'] }
  Object.entries(tiers).forEach(([key, [tier, tone]]) => {
    const o = p.outcomes[key]
    slides.push(base(`out:${key}`, o.title, `${p.name} - Final outcome - ${TRN}`, { body: o.text, bullets: o.lessons }, {
      kind: 'outcome', reason: 'The final result of the sale.', tone, choice: { id: key, text: `Sales performance: ${tier}` },
      what: o.text, why: o.lessons.join(' '),
      actions: [{ label: 'Replay this scenario', goto: N('d0S'), primary: true }, { label: CHOOSER_LABEL, goto: CHOOSER_N }],
    }, { slide_type: 'summary', next: -1 }, img(key === 'won' ? `won-${k}` : `scene-${k}`, o.title)))
  })
  if (slides.length !== order.length) throw new Error('slide count mismatch for ' + p.name)
  return { slides, coverN: N('cover') }
}

/* ---- assemble ---- */
const blocks = []
let offset = MULTI ? 2 : 0 // several products: slide 1 = cover, slide 2 = chooser
for (const p of PRODUCTS) {
  const b = buildProduct(p, offset)
  blocks.push({ p, ...b })
  offset += b.slides.length
}

const plain = (n, title, section, content, interaction, extra = {}) => ({
  n, section, slide_type: extra.slide_type || 'objectives', title, accent: '#' + NAVY,
  concept_ids: [], taught_concept_ids: [], concepts: [], relationship: null,
  content: Object.assign({ body: '', explanations: [], bullets: [], example: null, misconception: null, relationship_note: null, key_idea: null, discussion: null, bloom: 'apply', dok: 2, minutes: 2 }, content),
  question_ids: [], activities: [], interaction, interaction_reason: '', h5p_pattern: null, image_missing: null, image: null,
  ...(extra.next !== undefined ? { next: extra.next } : {}),
  ...(extra.product ? { product: extra.product } : {}),
})
const head = []
if (MULTI) {
  head.push(plain(1, 'Sales Training', 'Sales Training - Verified product facts', {
    body: 'Several products, one course. Choose a product, read its verified facts, then practise the sale with a fictional customer.', bullets: [],
  }, null, { slide_type: 'hook', product: { name: 'Sales Training', tagline: PRODUCTS.map((p) => p.name).join(', ') + ': practise the sale with branching scenarios.' } }))
  head.push(plain(CHOOSER_N, 'Choose a product', 'Sales Training - Choose a product', { body: 'Pick the product you want to practise selling.', bullets: [] }, {
    kind: 'decision', reason: 'Product selection: each answer opens that product\'s own course.', kicker: 'Sales Training - Choose a product',
    question: 'Which product do you want to practise selling?',
    options: blocks.map((b, i) => ({ id: 'abc'[i], text: `${b.p.name} - ${b.p.tagline}`, goto: b.coverN })),
  }, { slide_type: 'menu', next: -1 }))
}

const slides = [...head, ...blocks.flatMap((b) => b.slides)].sort((a, b) => a.n - b.n)
slides.forEach((x, i) => { if (x.n !== i + 1) throw new Error(`slide numbers are not contiguous at ${i + 1}`) })

const title = MULTI ? 'Sales Training' : `${PRODUCTS[0].name} Sales Training`
const tagline = MULTI ? PRODUCTS.map((p) => p.name).join(', ') + ': practise the sale with branching scenarios.' : PRODUCTS[0].tagline
const deck = {
  version: 3, title, theme: 'professional', accent: '#' + (MULTI ? NAVY : PRODUCTS[0].color),
  product: { key: 'sales', name: title, tagline },
  chapter: { id: 990000, name: title, number: 1, standard_id: 0, subject_id: 0, standard_name: 'Sales Training', subject_name: PRODUCTS.map((p) => p.name).join(', ') },
  chapter_id: 990000, slide_count: slides.length,
  teaching_strategy: 'Branching sales scenarios. Each decision has three options and every option opens its own consequence slide. A poor decision gets one recovery chance; a second misstep loses the deal.',
  outline: [], concepts: {}, slides, concept_slides: {}, taught_by: {}, concept_questions: {},
}

fs.mkdirSync(path.join(OUT, 'images'), { recursive: true })
fs.writeFileSync(path.join(OUT, 'deck.json'), JSON.stringify(deck, null, 1))
for (const { p } of blocks) {
  const i = p.persona.initial
  fs.writeFileSync(path.join(OUT, 'images', `scene-${p.key}.svg`), svg(i, p.name, 'Training scenario - illustration, not a screenshot', p.color, dark(p.color, 0.55)))
  fs.writeFileSync(path.join(OUT, 'images', `lost-${p.key}.svg`), svg(i, 'Deal at risk', 'Training scenario - illustration, not a screenshot', 'C93B3B', '5A1A1A'))
  fs.writeFileSync(path.join(OUT, 'images', `won-${p.key}.svg`), svg(i, 'Deal won', 'Training scenario - illustration, not a screenshot', '1E9E5A', '0D4A2A'))
}
fs.writeFileSync(path.join(ROOT, 'public', 'sales-training', 'index.json'), JSON.stringify({ sales: { slides: slides.length, name: title, products: PRODUCTS.map((p) => p.name) } }, null, 1))
console.log(`${title}: ${slides.length} slides -> ${OUT}`)
blocks.forEach((b) => console.log(`  ${b.p.name}: slides ${b.coverN}-${b.coverN + b.slides.length - 1}`))
