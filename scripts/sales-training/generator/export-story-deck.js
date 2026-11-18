/* Exports the G2G sales presentation (same 40-slide graph as G2G-Sales-Branching-Presentation.pptx) in the
 * study-deck v3 shape that the My Learning player reads.
 *   node export-story-deck.js [path-to-frontend]   (default: the frontend this folder lives in)
 * Writes <frontend>/public/sales-training/sales/deck.json and <frontend>/public/sales-training/index.json.
 * The pictures are NOT written into the frontend. They go to ./out/images (with manifest.json), are stored in the
 * sales_training_images table by `php artisan sales-training:import-images`, and the deck points at /api/sales-training/images/<slug>.
 * The slide order and ids mirror build-sales-story.js; keep the two in step.
 */
const fs = require('fs')
const path = require('path')
const D = require('./content/g2g-story')
const S = require('./content/g2g-sales')
const G = require('./content/g2g-guide')
const ROOT = process.argv.slice(2).find((a) => !a.startsWith('--')) || path.resolve(__dirname, '..', '..', '..') // the frontend this folder lives in
const OUT = path.join(ROOT, 'public', 'sales-training', 'sales')
const TEAL = '0E9F8E'
const P = D.paths
const PK = P.map((p) => p.key)
const VER = 'G2G - Verified product facts'
const SIM = 'G2G - Live sales conversation (typical situation, not a real customer)'
const MORDER = ['attendance', 'leave', 'payroll', 'competency', 'kasba', 'gap', 'lms', 'talent', 'tasks', 'reports', 'org']
const REL = { attendance: ['feat:payroll', 'feat:leave'], leave: ['feat:attendance', 'feat:reports'], payroll: ['feat:attendance', 'feat:reports'], competency: ['feat:kasba', 'feat:gap'], kasba: ['feat:competency', 'feat:gap'], gap: ['feat:competency', 'feat:lms'], lms: ['feat:gap', 'feat:talent'], talent: ['feat:lms', 'feat:gap'], tasks: ['feat:reports', 'feat:org'], reports: ['feat:attendance', 'feat:gap'], org: ['roles', 'feat:reports'] }
const mod = (id) => D.moduleById[id]

const order = ['home', 'roles', 'modules', 'problems', 'solutions', 'scenarios', ...D.roles.map((r) => 'role:' + r.key), ...MORDER.map((m) => 'mod:' + m), ...MORDER.map((m) => 'feat:' + m), ...PK.map((k) => 'conv:' + k), 'questions', 'closing']
const N = (id) => { const i = order.indexOf(id); if (i < 0) throw new Error('unknown slide ' + id); return i + 1 }

const svg = (initial, label, sub, c1, c2) => `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#${c1}"/><stop offset="1" stop-color="#${c2}"/></linearGradient></defs>
<rect width="1280" height="720" fill="url(#g)"/>
<circle cx="1010" cy="360" r="250" fill="#ffffff" fill-opacity="0.07"/><circle cx="1010" cy="360" r="170" fill="#ffffff" fill-opacity="0.08"/>
<circle cx="1010" cy="360" r="95" fill="#ffffff" fill-opacity="0.9"/><text x="1010" y="395" text-anchor="middle" font-family="Segoe UI,Arial" font-size="100" font-weight="700" fill="#${c1}">${initial}</text>
<text x="80" y="640" font-family="Segoe UI,Arial" font-size="34" font-weight="700" fill="#fff">${label}</text>
<text x="80" y="680" font-family="Segoe UI,Arial" font-size="20" fill="#fff" fill-opacity="0.85">${sub}</text></svg>`
const IMG_URL = '/api/sales-training/images/'
const img = (name, alt) => ({ url: IMG_URL + name, alt })

const base = (id, title, section, content, interaction, extra = {}) => ({
  n: N(id), section, slide_type: extra.slide_type || 'objectives', title, accent: '#' + (extra.color || TEAL),
  concept_ids: [], taught_concept_ids: [], concepts: [], relationship: null,
  content: Object.assign({ body: '', explanations: [], bullets: [], example: null, misconception: null, relationship_note: null, key_idea: null, discussion: null, bloom: 'apply', dok: 2, minutes: 2 }, content),
  question_ids: [], activities: [], interaction, interaction_reason: '', h5p_pattern: null, image_missing: null, image: extra.image || null,
  ...(extra.next !== undefined ? { next: extra.next } : {}),
  ...(extra.product ? { product: extra.product } : {}),
  ...(extra.links ? { links: extra.links } : {}),
})
const H = (label, p) => ({ label, href: G.demoBase + p })
const grp = (group, links) => links.map((l) => ({ ...l, group }))
const L = (label, id, primary) => ({ label, goto: N(id), ...(primary ? { primary: true } : {}) })
// the PowerPoint's top navigation bar, as buttons on every information slide
const BAR = () => [L('Home', 'home'), L('Roles', 'roles'), L('Modules', 'modules'), L('Business Problems', 'problems'), L('Solutions', 'solutions'), L('Sales Scenarios', 'scenarios')]
const slides = []
const info = (id, title, content, links, extra = {}) => slides.push(base(id, title, VER, content, null, { next: -1, ...extra, links }))
const usersOf = (m) => D.roles.filter((r) => m.roles.some(([nm]) => r.match.includes(nm)))
const relLabel = (t) => (t === 'roles' ? 'Roles' : mod(t.slice(5)).name + ' features')

slides.push(base('home', 'Your people, skills and learning on one platform', VER, { body: S.title.sub, bullets: ['The salesperson controls the meeting: start from a role, a module, a business problem, a solution or a live conversation.', 'Only documented features are shown; unfinished parts are labelled.'] }, null, {
  slide_type: 'hook', next: N('roles'), product: { name: 'G2G', tagline: 'Your people, skills and learning on one platform' },
  links: [L('Roles', 'roles', true), L('Modules', 'modules'), L('Business Problems', 'problems'), L('Solutions', 'solutions'), L('Sales Scenarios', 'scenarios')],
}))
info('roles', 'Roles', { body: 'Who is in the room? Pick the role to see the modules it uses.', bullets: [] }, D.roles.map((r) => L(`${r.name}: ${r.sub} (${r.modules.length} modules)`, 'role:' + r.key)))
info('modules', 'Modules', { body: 'Click any module to open its talk track. The Workforce AI assistant is still in development and is not part of today\'s offer.', bullets: [] }, MORDER.map((id) => L(`${mod(id).name}: ${mod(id).short}`, 'mod:' + id)))
info('problems', 'Business problems', { body: 'What hurts most? Open the live conversation, or go to the solution. These are typical situations, not real customers.', bullets: [] }, [...P.map((p) => L(`Conversation: ${p.tile}`, 'conv:' + p.key)), L('See the solutions', 'solutions')])
info('solutions', 'Solutions', { body: 'Business problem, G2G capability and business value, one row per solution area.', bullets: PK.map((k) => `${G.areas[k].name} (${G.areas[k].mods.map((id) => mod(id).name).join(', ')}): ${G.areas[k].problem}. Value: ${G.areas[k].value.join('; ')}.`) },
  PK.flatMap((k) => grp(G.areas[k].name, [L('Open the conversation', 'conv:' + k), ...G.areas[k].mods.map((id) => L(mod(id).name, 'mod:' + id))])))
info('scenarios', 'Sales scenarios', { body: 'Open a live conversation. Ask the question, then click what the customer says.', bullets: [] },
  [...PK.map((k) => L(`Conversation: ${G.conv[k].ask}`, 'conv:' + k)), L('Customer questions: cost, other clients, what is ready', 'questions'), L('Close the meeting: next steps', 'closing')])

D.roles.forEach((r) => {
  const rows = r.modules.map((id) => { const m = mod(id); const w = m.roles.find(([nm]) => r.match.includes(nm)); if (!w) throw new Error(`role ${r.name} has no documented work in ${id}`); return { m, id, w: w[1] } })
  info('role:' + r.key, r.name, { body: `${r.sub}. Click a module card to present it for this role.`, bullets: rows.map(({ m, w }) => `${m.name}: ${w}`) }, rows.map(({ m, id }) => L(m.name, 'mod:' + id)), { color: r.color })
})

MORDER.forEach((id) => {
  const m = mod(id); const g = G.mod[id]
  info('mod:' + id, m.name, {
    body: m.short,
    bullets: [...m.problem.slice(0, 2).map((t) => `Problem it solves: ${t}`), `Why the customer needs it: ${g.why}`, ...m.does.slice(0, 2).map((t) => `How G2G addresses it: ${t}`), ...m.roles.slice(0, 4).map(([r, w]) => `${r} needs: ${w}`), ...m.benefit.slice(0, 3).map((t) => `Business value: ${t}`), `Ask: ${g.ask}`, `Status: ${m.status[0]}. ${m.statusNote}`],
  }, [...grp('Live demo', [H('Show live demo', G.demo[id].page)]), ...grp('Features', g.features.map(([name]) => L(`Feature: ${name}`, 'feat:' + id))), ...grp('Used by', usersOf(m).map((r) => L(`Used by: ${r.name}`, 'role:' + r.key))), ...grp('Related', REL[id].map((t) => L(relLabel(t), t)))], { color: m.color })
})

MORDER.forEach((id) => {
  const m = mod(id); const g = G.mod[id]
  info('feat:' + id, `${m.name}: features to demonstrate`, {
    body: 'Show these three. Each says what to show and why the customer cares.',
    bullets: g.features.map(([name, show, why]) => `${name}. Show: ${show} Why it matters: ${why}.`),
  }, [L('Back to the talk track', 'mod:' + id, true), ...grp('Live demo', g.features.flatMap(([name], i) => (G.demo[id].features[i] ? [H(`Show live demo: ${name}`, G.demo[id].features[i])] : []))), ...grp('Used by', usersOf(m).slice(0, 4).map((r) => L(`Used by: ${r.name}`, 'role:' + r.key))), ...grp('Also show', REL[id].map((t) => L('Also show: ' + relLabel(t).replace(' features', ''), t)))], { color: m.color })
})

PK.forEach((k, i) => {
  const p = P[i]; const cv = G.conv[k]
  slides.push(base('conv:' + k, 'Live conversation: ' + p.tile, `Decision ${i + 1} of ${PK.length} - ${SIM}`, { body: `You ask: ${cv.ask}`, bullets: [] }, {
    kind: 'decision', reason: 'Click what the customer says; each answer opens a different slide.', kicker: `${p.tile} - you ask`,
    question: `You ask: ${cv.ask}  What does the customer say?`,
    options: cv.c.map(([say, opens, target], j) => ({ id: 'abcd'[j], text: `${say} Opens: ${opens}`, goto: N(target) })),
  }, { slide_type: 'challenge', next: -1, color: p.color, image: img('story-scene', 'The conversation') }))
})

slides.push(base('questions', 'Customer questions', VER, { body: 'Straight answers, using only what is documented.', bullets: G.questions.map((q) => `${q.q} Say: ${q.say} (Basis: ${q.why})`) }, null, {
  next: -1, links: [L('Close the meeting: next steps', 'closing', true), L('Back to the scenarios', 'scenarios')],
}))
info('closing', 'Sales closing', {
  body: 'Value proposition: your people, skills and learning on one platform. ' + S.title.sub,
  bullets: [...D.outcomes.won.steps.map((t, i) => `Next step ${i + 1}: ${t}`), D.outcomes.won.note],
}, [...grp('Solution highlights', PK.map((k) => L(G.areas[k].name, 'conv:' + k))), L('Customer questions', 'questions'), L('Return to Home', 'home', true)])

/* ---- pictures: licensed illustrations from the asset manifests, or a coloured panel with the module's icon ---- */
const ASSETS = path.join(__dirname, '..', 'assets')
const IMGS = path.join(__dirname, '.cache') // pictures, downloaded from the database by fetch-images.js
let MAN = []
for (const f of fs.readdirSync(ASSETS).filter((x) => /^manifest-.*\.json$/.test(x))) MAN.push(...JSON.parse(fs.readFileSync(path.join(ASSETS, f), 'utf8')))
MAN = MAN.filter((e) => fs.existsSync(path.join(IMGS, e.file)))
const AVOID = new Set(['leave-1', 'attendance-1', 'attendance-2']) // would show things G2G does not document (see ASSET-REFERENCES.md)
const pickImg = (id, use = 'module') => { const c = MAN.filter((e) => e.forModules.includes(id) && e.use === use && !AVOID.has(e.id)); return c.find((e) => e.primary) || c[0] || null }
const MODICON = { attendance: 'clock', leave: 'calendar-days', payroll: 'wallet', competency: 'target', kasba: 'library', gap: 'chart-column', lms: 'graduation-cap', talent: 'users', tasks: 'list-checks', reports: 'chart-pie', org: 'network' }
const ROLEICON = { hr: 'user-cog', mgr: 'users', emp: 'user', fin: 'wallet', prin: 'landmark', adm: 'settings' }
const TAG = 'ILLUSTRATION - NOT A G2G SCREEN'
const panelSvg = (icon, label, c1) => {
  const b64 = fs.readFileSync(path.join(IMGS, 'icons', icon + '.png')).toString('base64')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#${c1}"/><stop offset="1" stop-color="#${dark(c1, 0.55)}"/></linearGradient></defs>
<rect width="1280" height="720" fill="url(#g)"/>
<circle cx="640" cy="330" r="270" fill="#ffffff" fill-opacity="0.08"/><circle cx="640" cy="330" r="190" fill="#ffffff" fill-opacity="0.1"/>
<image href="data:image/png;base64,${b64}" x="490" y="180" width="300" height="300"/>
<text x="640" y="610" text-anchor="middle" font-family="Segoe UI,Arial" font-size="46" font-weight="700" fill="#fff">${label}</text>
<text x="640" y="660" text-anchor="middle" font-family="Segoe UI,Arial" font-size="22" fill="#fff" fill-opacity="0.85">Illustration, not a G2G screen</text></svg>`
}
const dark = (hex, f) => hex.match(/../g).map((h) => Math.round(parseInt(h, 16) * f).toString(16).padStart(2, '0')).join('')
const imgDir = path.join(__dirname, 'out', 'images')
fs.rmSync(imgDir, { recursive: true, force: true })
fs.mkdirSync(imgDir, { recursive: true })
const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' }
const MANIFEST = []
/** Writes one picture to the staging folder and records it for the importer. Returns the deck's image object. */
const stage = (slug, content, ext, meta) => {
  const file = slug + ext
  fs.writeFileSync(path.join(imgDir, file), content)
  MANIFEST.push({ slug, file, mime: MIME[ext], alt: meta.alt, tag: meta.tag ?? null, credit: meta.credit ?? null })
  return { url: IMG_URL + slug, alt: meta.alt, ...(meta.tag ? { tag: meta.tag } : {}), ...(meta.credit ? { credit: meta.credit } : {}) }
}
const visualFor = (key, id, label, color) => {
  const e = id in MODICON ? (id === 'attendance' ? pickImg('problems', 'problems') : pickImg(id)) : null
  if (e) {
    return stage(key, fs.readFileSync(path.join(IMGS, e.file)), path.extname(e.file), { alt: e.description || e.title, tag: TAG, ...(e.attribution_required ? { credit: e.attribution_text } : {}) })
  }
  const icon = MODICON[id] || ROLEICON[id]
  return stage(key, panelSvg(icon, label, color), '.svg', { alt: label + ' (icon)', tag: 'ILLUSTRATION' })
}
const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;')
/** A diagram for one module, drawn from documented facts (4:3, so the player shows it uncropped). */
const diagramSvg = (d, color) => {
  const W = 1200, H = 900, navy = '0B1F3A'
  let body = ''
  const n = d.steps.length
  if (d.kind === 'chips') {
    d.steps.forEach((t, i) => {
      const cw = 500, x = 70 + (i % 2) * (cw + 60), y = 190 + Math.floor(i / 2) * 105
      const full = i === n - 1 && n % 2 === 1
      body += `<rect x="${x}" y="${y}" width="${full ? 1060 : cw}" height="80" rx="16" fill="${i === n - 1 ? '#' + color : '#E6F1F8'}" stroke="#${color}" stroke-width="3"/><text x="${x + (full ? 530 : cw / 2)}" y="${y + 52}" text-anchor="middle" font-family="Segoe UI,Arial" font-size="34" font-weight="700" fill="${i === n - 1 ? '#fff' : '#' + color}">${esc(t)}</text>`
    })
  } else {
    const top = 175, bottom = d.foot ? 740 : 800, gap = d.kind === 'flow' ? 44 : 20
    const bh = Math.min(112, (bottom - top - gap * (n - 1)) / n)
    d.steps.forEach((t, i) => {
      const y = top + i * (bh + gap)
      const last = d.kind === 'flow' && i === n - 1
      const words = t.split(' '); const lines = []; let cur = ''
      for (const w of words) { if ((cur + ' ' + w).trim().length > 34 && cur) { lines.push(cur); cur = w } else cur = (cur + ' ' + w).trim() }
      lines.push(cur)
      const fs = lines.length > 1 ? 30 : 34
      const ty = y + bh / 2 - ((lines.length - 1) * fs) / 2 + fs * 0.35
      body += `<rect x="90" y="${y}" width="1020" height="${bh}" rx="20" fill="#${last ? navy : color}"/>`
      body += lines.map((ln, k) => `<text x="600" y="${ty + k * fs * 1.15}" text-anchor="middle" font-family="Segoe UI,Arial" font-size="${fs}" font-weight="700" fill="#fff">${esc(ln)}</text>`).join('')
      if (d.kind === 'flow' && i < n - 1) body += `<path d="M600 ${y + bh + 6} L600 ${y + bh + gap - 8}" stroke="#5B6B82" stroke-width="5"/><path d="M586 ${y + bh + gap - 20} L600 ${y + bh + gap - 6} L614 ${y + bh + gap - 20}" fill="none" stroke="#5B6B82" stroke-width="5"/>`
    })
  }
  const foot = d.foot ? `<text x="600" y="800" text-anchor="middle" font-family="Segoe UI,Arial" font-size="27" font-style="italic" fill="#5B6B82">${esc(d.foot)}</text>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" rx="24" fill="#fff"/><rect width="${W}" height="110" fill="#${color}"/><text x="60" y="72" font-family="Segoe UI,Arial" font-size="44" font-weight="700" fill="#fff">${esc(d.title)}</text>${body}${foot}</svg>`
}
slides.forEach((s) => {
  const id = order[s.n - 1]
  if (id.startsWith('mod:') || id.startsWith('feat:')) {
    const m = id.split(':')[1]; const key = (id.startsWith('mod:') ? 'mod-' : 'feat-') + m
    s.image = stage(key, diagramSvg(G.diagrams[m], mod(m).color), '.svg', { alt: `${mod(m).name}: ${G.diagrams[m].title}`, tag: 'DIAGRAM DRAWN FOR THIS DECK' })
  }
  else if (id.startsWith('role:')) { const r = D.roles.find((x) => 'role:' + x.key === id); s.image = visualFor('role-' + r.key, r.key, r.name, r.color) }
})

/* ---- top navigation: the player shows these six buttons on every slide, with the current section highlighted ---- */
const sectionOf = (id) => (id === 'home' ? 'Home' : id === 'roles' || id.startsWith('role:') ? 'Roles' : id === 'modules' || id.startsWith('mod:') || id.startsWith('feat:') ? 'Modules' : id === 'problems' ? 'Business Problems' : id === 'solutions' ? 'Solutions' : 'Sales Scenarios')
slides.forEach((s) => { s.group = sectionOf(order[s.n - 1]) })
const nav = [['Home', 'home'], ['Roles', 'roles'], ['Modules', 'modules'], ['Business Problems', 'problems'], ['Solutions', 'solutions'], ['Sales Scenarios', 'scenarios']].map(([label, id]) => ({ label, goto: N(id) }))

/* ---- checks ---- */
slides.sort((a, b) => a.n - b.n)
if (slides.length !== order.length) throw new Error(`built ${slides.length} slides for ${order.length} ids`)
slides.forEach((s, i) => { if (s.n !== i + 1) throw new Error('numbering gap at ' + (i + 1)) })
{
  const have = new Set(slides.map((s) => s.n)); const seen = new Set([1]); const q = [1]
  const out = (s) => [...(s.links || []).filter((l) => l.goto !== undefined).map((l) => l.goto), ...(s.interaction?.kind === 'decision' ? s.interaction.options.map((o) => o.goto) : []), ...(s.next && s.next > 0 ? [s.next] : s.next === undefined && s.n < slides.length ? [s.n + 1] : [])]
  while (q.length) { const c = q.shift(); for (const t of out(slides[c - 1])) { if (!have.has(t)) throw new Error(`slide ${c} points at missing slide ${t}`); if (!seen.has(t)) { seen.add(t); q.push(t) } } }
  const un = slides.filter((s) => !seen.has(s.n)).map((s) => `${s.n} ${order[s.n - 1]}`)
  if (un.length) throw new Error('unreachable: ' + un.join(', '))
  if (slides.length > 40) throw new Error('over 40 slides')
}

const title = 'G2G Sales Presentation'
const deck = {
  version: 3, title, theme: 'professional', accent: '#' + TEAL,
  product: { key: 'sales', name: title, tagline: 'Your people, skills and learning on one platform' },
  chapter: { id: 990000, name: title, number: 1, standard_id: 0, subject_id: 0, standard_name: 'Sales', subject_name: 'G2G' },
  chapter_id: 990000, slide_count: slides.length,
  teaching_strategy: 'Salesperson-led. Start from a role, a module, a business problem, a solution or a live conversation; there is no fixed sequence.',
  nav, outline: [], concepts: {}, slides, concept_slides: {}, taught_by: {}, concept_questions: {},
}
stage('story-scene', svg('G', 'Live conversation', 'Sales conversation - illustration, not a screenshot', TEAL, '075A52'), '.svg', { alt: 'The conversation', tag: 'ILLUSTRATION' })
fs.writeFileSync(path.join(imgDir, 'manifest.json'), JSON.stringify(MANIFEST, null, 1))
// every picture the deck names must be in the manifest
for (const s of slides) if (s.image && !MANIFEST.some((m) => IMG_URL + m.slug === s.image.url)) throw new Error('slide ' + s.n + ' names a picture that is not staged: ' + s.image.url)
fs.mkdirSync(OUT, { recursive: true })
// the old local copies are removed: pictures are served from the database
fs.rmSync(path.join(OUT, 'images'), { recursive: true, force: true })
fs.writeFileSync(path.join(OUT, 'deck.json'), JSON.stringify(deck, null, 1))
fs.writeFileSync(path.join(ROOT, 'public', 'sales-training', 'index.json'), JSON.stringify({ sales: { slides: slides.length, name: title, products: ['G2G'] } }, null, 1))
console.log(`${title}: ${slides.length} slides -> ${OUT}`)
console.log(`${MANIFEST.length} pictures staged in ${imgDir} (load them with: php artisan sales-training:import-images "${imgDir}")`)
