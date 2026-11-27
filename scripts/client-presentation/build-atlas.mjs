// Builds the Product Atlas data the deck, the videos and the PowerPoint read, and checks it.
//   node scripts/client-presentation/build-atlas.mjs [--check-only]
// Reads  docs/client-presentation/content/atlas/part-*.json (sheets written from source, one file per family or group of sub-modules)
//        docs/client-presentation/content/atlas/k12-menu-2026-11-25.json (the live menu: real module, sub-module and screen names)
//        public/client-presentation/atlas/*.webp (edited screenshots, named <module>--<sub-module>--<screen>.webp)
//        docs/client-presentation/content/atlas/tour-<family>.json (the seven-tab product tour of a family, when it has one)
// Writes lib/client-presentation/generated/atlas.json (what the browser renders: no evidence paths, no owner notes)
//        lib/client-presentation/generated/atlas-presenter.json (the presenter script per tour tab: imported ONLY by the signed-in presenter window)
//        docs/client-presentation/atlas-notes.json (evidence paths and owner-to-confirm notes, for presenter notes and review)
// Exit 1 on any failure: a missing field, a word limit, a banned pattern (percentages, money, predict, at-risk, NEP, status words), an outside AI
// company or model name, an evidence path that does not exist, or a screenshot that is named but missing.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DL = join(root, '..')                       // C:/Users/MILAN/Downloads: the sibling repos live here
const dir = join(root, 'docs/client-presentation/content/atlas')
const menu = JSON.parse(readFileSync(join(dir, 'k12-menu-2026-11-25.json'), 'utf8'))
const checkOnly = process.argv.includes('--check-only')

const FAMILIES = [
  { key: 'core', product: 'Scholar Core', k12: 'Institute ERP', files: ['part-core-1.json', 'part-core-2.json', 'part-core-3.json', 'part-core-family.json'] },
  { key: 'learn', product: 'Scholar Learn', k12: 'LMS + PAL', files: ['part-learn.json'] },
  { key: 'ccb', product: 'Scholar CCB', k12: 'People & Competency', files: ['part-ccb.json'] },
  { key: 'insight', product: 'Scholar Insight', k12: 'Enterprise Brain', files: ['part-insight.json'] },
  { key: 'compass', product: 'Scholar Compass', k12: 'Career Counseling', files: ['part-compass.json'] },
]
const BANNED = [
  [/\d\s*%|\bpercent/i, 'percentage'], [/₹|\bRs\.?\s*\d|\$\s*\d|\blakh\b|\bcrore\b/i, 'money'], [/\bfree\b/i, 'free'], [/guarantee/i, 'guarantee'], [/\bROI\b/, 'ROI'],
  [/\bpredict/i, 'predict'], [/at-risk/i, 'at-risk'], [/\bNEP\b/, 'NEP'], [/one login/i, 'one login'], [/Anand|Lions/i, 'customer name'], [/testimonial|\bproven\b/i, 'testimonial or proven'],
  [/\bresearch-backed\b|\bvalidated\b/i, 'research-backed or validated'], [/learning styles?/i, 'learning styles'], [/Teach Connect/i, 'old brand name'],
]
const STATUS = /\b(partial|partially|conceptual|in progress|in development|under development|planned|beta|coming soon|roadmap|prototype|not built|not yet built|design intent)\b/i
const VENDOR = /\b(openai|chatgpt|gpt-?\d|claude|anthropic|gemini|deepseek|llama|mistral|copilot|bard|perplexity|cohere|groq|grok|qwen|hugging ?face|azure openai|bedrock|vertex|gamma|twilio|razorpay|payu|ccavenue|paytm|stripe|msg91|gupshup|interakt)\b/i
const fails = []; const warns = []
const fail = (m) => fails.push(m)
const words = (t) => String(t).trim().split(/\s+/).filter(Boolean).length
const slug = (s) => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const norm = (s) => String(s).toLowerCase().replace(/assesment/g, 'assessment').replace(/[^a-z0-9]+/g, ' ').replace(/\band\b/g, ' ').replace(/\s+/g, ' ').trim()

function checkText(where, t, max) {
  if (typeof t !== 'string' || !t.trim()) return fail(`${where}: empty`)
  if (max && words(t) > max) fail(`${where}: ${words(t)} words, limit ${max}: "${t}"`)
  for (const [re, name] of BANNED) if (re.test(t)) fail(`${where}: banned (${name}): "${t}"`)
  if (STATUS.test(t)) fail(`${where}: status word: "${t}"`)
  if (VENDOR.test(t)) fail(`${where}: outside vendor or model name: "${t}"`)
}
const evidencePath = (p) => { const q = p.replace(/^Downloads\//, ''); const m = /^(lms_k12|next_lms_erp|g2gv0|hp_erp)\/(.+)$/.exec(q); return m ? join(DL, m[1], m[2]) : join(DL, q) }
function checkEvidence(where, list, min) {
  if (!Array.isArray(list) || list.length < min) return fail(`${where}: needs at least ${min} evidence paths`)
  for (const p of list) if (!existsSync(evidencePath(p))) fail(`${where}: evidence path does not exist: ${p}`)
}
function checkSheet(where, x, limits) {
  checkText(`${where}.summary`, x.summary, limits.summary); checkText(`${where}.problem`, x.problem, limits.problem); checkText(`${where}.benefit`, x.benefit, limits.benefit)
  if (!Array.isArray(x.technology) || x.technology.length < 1 || x.technology.length > 4) fail(`${where}.technology: needs 1 to 4 items`)
  else x.technology.forEach((t, i) => checkText(`${where}.technology[${i}]`, t, 9))
  if (!Array.isArray(x.workflow) || x.workflow.length < 3 || x.workflow.length > 6) fail(`${where}.workflow: needs 3 to 6 steps`)
  else x.workflow.forEach((t, i) => checkText(`${where}.workflow[${i}]`, t, 4))
  if (x.research) { checkText(`${where}.research.text`, x.research.text, 24); checkEvidence(`${where}.research.evidence`, x.research.evidence, 1) }
}

// ---- the product tour: seven tabs for a family that has a tour-<family>.json (see lib/client-presentation/tour.ts) ----
// A tour has a STYLE, which says which scene plays it. 'ink' is the Core scene (the default: a tour that names no style is ink). 'sketchbook' is the
// illustrated scene (paper, cut-outs, stop-motion). The caps are what each scene's layout can hold; the validator enforces them so a long list cannot
// overflow a fixed layout.
const STYLES = { ink: { insights: [1, 8], uses: [1, 6], research: 6 }, sketchbook: { insights: [1, 4], uses: [1, 5], research: 6 } }
const NO_AI_WORDS = /\bAI\b|machine learning|artificial intelligence/i   // the Intelligence tab is about rules and records, never about AI
const IMAGE_KINDS = ['photo', 'cartoon', 'sketch']
// The pictures of the illustrated tours: docs/client-presentation/assets/tour-art.json (id, family, kind, file, size, alt, provenance, sha256).
// A tour names the pictures it uses by id in its `art` map; every id must exist, belong to the family, have its file on disk with the recorded hash,
// and carry its provenance (a photo its source page and licence check; a generated image its tool, prompt and terms).
const artFile = join(root, 'docs/client-presentation/assets/tour-art.json')
const artRegister = existsSync(artFile) ? JSON.parse(readFileSync(artFile, 'utf8')).images ?? [] : []
function resolveArt(F, w, spec) {
  const out = {}
  for (const [slot, ids] of Object.entries(spec ?? {})) {
    out[slot] = (Array.isArray(ids) ? ids : [ids]).map((id) => {
      const im = artRegister.find((x) => x.id === id)
      if (!im) { fail(`${w}.art.${slot}: unknown image id "${id}" (not in assets/tour-art.json)`); return null }
      const at = `${w}.art.${slot}[${id}]`
      if (im.family !== F.key) fail(`${at}: belongs to "${im.family}", not "${F.key}"`)
      if (!IMAGE_KINDS.includes(im.kind)) fail(`${at}: kind must be one of ${IMAGE_KINDS.join(', ')}`)
      checkText(`${at}.alt`, im.alt, 24)
      const path = join(root, 'public/client-presentation/tour', F.key, im.file ?? '')
      if (!im.file || !existsSync(path)) fail(`${at}: file not found: public/client-presentation/tour/${F.key}/${im.file}`)
      else if (im.sha256 && createHash('sha256').update(readFileSync(path)).digest('hex') !== im.sha256) fail(`${at}: the file differs from the hash in the register`)
      else if (!im.sha256) fail(`${at}: no sha256 in the register`)
      if (!(im.w > 0 && im.h > 0)) fail(`${at}: needs w and h`)
      // provenance: a downloaded file (every photo, and a licensed cartoon or sketch) records where it came from and the licence line read on the date;
      // a generated one (origin: "generated") records the tool, the prompt and the provider's terms, and waits for the owner's approval
      if (im.origin === 'generated') {
        if (im.kind === 'photo') fail(`${at}: a photo is never generated`)
        if (!im.tool || !im.prompt || !im.terms) fail(`${at}: a generated image needs tool, prompt and terms`)
        if (im.owner_approved !== true) warns.push(`${at}: generated image not yet approved by the owner (owner_approved is not true)`)
      } else if (!im.source_url || !im.licence || !im.licence_checked) fail(`${at}: a downloaded image needs source_url, licence (the exact line) and licence_checked`)
      return { id, kind: im.kind, src: `/client-presentation/tour/${F.key}/${im.file}`, w: im.w, h: im.h, alt: im.alt }
    }).filter(Boolean)
  }
  return out
}

function buildTour(F, subs) {
  const file = join(process.env.ATLAS_TOUR_DIR ?? dir, `tour-${F.key}.json`)   // ATLAS_TOUR_DIR: a scratch folder, so the validator can be tried with corrupted copies (mutation checks)
  if (!existsSync(file)) return null
  const t = JSON.parse(readFileSync(file, 'utf8'))
  const w = `${F.key}.tour`
  const style = t.style ?? 'ink'
  if (!STYLES[style]) fail(`${w}.style: must be one of ${Object.keys(STYLES).join(', ')}`)
  const caps = STYLES[style] ?? STYLES.ink
  const byId = new Map(subs.map((x) => [x.id, x]))
  const need = (where, id) => { if (!byId.has(id)) { fail(`${where}: unknown sub-module id "${id}"`); return null } return byId.get(id) }
  const list = (where, a, min, max) => { if (!Array.isArray(a) || a.length < min || a.length > max) { fail(`${where}: needs ${min} to ${max} items`); return [] } return a }

  const sum = list(`${w}.summary.lines`, t.summary?.lines, 3, 3); sum.forEach((l, i) => checkText(`${w}.summary.lines[${i}]`, l, 24)); checkEvidence(`${w}.summary.evidence`, t.summary?.evidence, 1)

  checkText(`${w}.problem.label`, t.problem?.label, 8)
  if (t.problem?.illustrative !== true) fail(`${w}.problem: must be marked "illustrative": true (a situation is always tagged as an illustration)`)
  const beats = list(`${w}.problem.beats`, t.problem?.beats, 3, 5); beats.forEach((l, i) => checkText(`${w}.problem.beats[${i}]`, l, 24))
  checkText(`${w}.problem.turn`, t.problem?.turn, 16); checkEvidence(`${w}.problem.evidence`, t.problem?.evidence, 1)
  const scattered = list(`${w}.problem.scattered`, t.problem?.scattered, 3, 3); scattered.forEach((l, i) => checkText(`${w}.problem.scattered[${i}]`, l, 3)); checkText(`${w}.problem.record`, t.problem?.record, 3)

  checkText(`${w}.intelligence.lead`, t.intelligence?.lead, 24); checkText(`${w}.intelligence.close`, t.intelligence?.close, 16)
  const insights = list(`${w}.intelligence.modules`, t.intelligence?.modules, ...caps.insights).map((m, i) => {
    const sub = need(`${w}.intelligence.modules[${i}]`, m.id); checkText(`${w}.intelligence.modules[${i}].asks`, m.asks, 16)
    // a module may only be named here for what its own sheet says it does. Each module states its BASIS: a line that must appear in its sheet's technology
    // list. Core says nothing and gets "rule-based insights" (its six AI-insights modules); Learn names "Rules and adaptive practice" or "Knowledge graph ...".
    const basis = String(m.basis ?? 'rule-based insights')
    if (style !== 'ink' && !m.basis) fail(`${w}.intelligence.modules[${i}]: a ${style} tour must name the basis of each module (a technology line of its sheet)`)
    if (sub && !sub.technology.some((x) => x.toLowerCase().includes(basis.toLowerCase()))) fail(`${w}.intelligence.modules[${i}]: ${m.id} has no "${basis}" in its sheet`)
    return sub && { id: m.id, name: sub.name, asks: m.asks }
  }).filter(Boolean)
  for (const [k, v] of [['lead', t.intelligence?.lead], ['close', t.intelligence?.close], ...(t.intelligence?.modules ?? []).map((m, i) => [`modules[${i}].asks`, m.asks])]) if (NO_AI_WORDS.test(String(v ?? ''))) fail(`${w}.intelligence.${k}: the Intelligence tab never says AI or machine learning`)
  checkEvidence(`${w}.intelligence.evidence`, t.intelligence?.evidence, insights.length || 1)

  checkText(`${w}.ai.lead`, t.ai?.lead, 24); checkText(`${w}.ai.guard`, t.ai?.guard, 16); checkText(`${w}.ai.control`, t.ai?.control, 12)
  const uses = list(`${w}.ai.uses`, t.ai?.uses, ...caps.uses); uses.forEach((u, i) => { checkText(`${w}.ai.uses[${i}].name`, u.name, 4); checkText(`${w}.ai.uses[${i}].line`, u.line, 14) })
  checkEvidence(`${w}.ai.evidence`, t.ai?.evidence, 2)
  checkText(`${w}.ai.sample.label`, t.ai?.sample?.label, 6); checkText(`${w}.ai.sample.text`, t.ai?.sample?.text, 32)
  if (!/illustrative/i.test(t.ai?.sample?.label ?? '')) fail(`${w}.ai.sample.label: a sample draft must say it is illustrative`)

  // research is optional: the tab stays hidden until there is at least one item, and every item needs a source and an evidence path
  if (t.research?.lead !== undefined) checkText(`${w}.research.lead`, t.research.lead, 5)
  if ((t.research?.items ?? []).length > caps.research) fail(`${w}.research.items: a ${style} tour holds at most ${caps.research} rows`)
  const items = (t.research?.items ?? []).map((r, i) => { checkText(`${w}.research.items[${i}].text`, r.text, 24); checkText(`${w}.research.items[${i}].source`, r.source, 12); checkEvidence(`${w}.research.items[${i}].evidence`, r.evidence, 1); return { text: r.text, source: r.source } })

  const groups = list(`${w}.features.groups`, t.features?.groups, 1, 6)
  const placed = []
  const outGroups = groups.map((g, gi) => {
    checkText(`${w}.features.groups[${gi}].title`, g.title, 5)
    const gs = list(`${w}.features.groups[${gi}].subs`, g.subs, 3, 7).map((x, xi) => {
      const sub = need(`${w}.features.groups[${gi}].subs[${xi}]`, x.id); placed.push(x.id)
      checkText(`${w}.features.groups[${gi}].subs[${xi}].tagline`, x.tagline, 10)
      return sub && { id: x.id, name: sub.name, tagline: x.tagline, shot: sub.shots[0] ?? null }
    }).filter(Boolean)
    return { title: g.title, subs: gs }
  })
  for (const x of subs) if (!placed.includes(x.id)) fail(`${w}.features: sub-module ${x.id} is in no group`)
  if (new Set(placed).size !== placed.length) fail(`${w}.features: a sub-module is in two groups`)
  checkEvidence(`${w}.features.evidence`, t.features?.evidence, 1)

  const roles = list(`${w}.roles`, t.roles, style === 'sketchbook' ? 1 : 3, 6).map((r, i) => {
    checkText(`${w}.roles[${i}].role`, r.role, 5); checkText(`${w}.roles[${i}].who`, r.who, 8); checkText(`${w}.roles[${i}].use`, r.use, 24)
    list(`${w}.roles[${i}].benefits`, r.benefits, 3, 3).forEach((b, j) => checkText(`${w}.roles[${i}].benefits[${j}]`, b, 18))
    const modules = list(`${w}.roles[${i}].modules`, r.modules, 1, 6).map((id) => { const sub = need(`${w}.roles[${i}].modules`, id); return sub && { id, name: sub.name } }).filter(Boolean)
    return { role: r.role, who: r.who, benefits: r.benefits, use: r.use, modules }
  })
  // the wording the illustrated scene prints on its own (the Core scene has its own words built in): short, same banned-word rules
  let labels = null
  if (t.labels) {
    labels = {}
    for (const k of ['draft', 'apply', 'discard']) if (t.labels[k] !== undefined) { checkText(`${w}.labels.${k}`, t.labels[k], 3); labels[k] = t.labels[k] }
    if (!labels.draft) fail(`${w}.labels.draft: the heading of the sample card is missing`)
    if (!!labels.apply !== !!labels.discard) fail(`${w}.labels: give both apply and discard, or neither (the buttons exist only where the product has them)`)
  } else if (style === 'sketchbook') fail(`${w}.labels: a sketchbook tour needs labels.draft (and labels.apply + labels.discard where the product has those buttons)`)
  const art = resolveArt(F, w, t.art)
  if (style === 'sketchbook' && !Object.keys(art).length) fail(`${w}.art: a sketchbook tour needs pictures (docs/client-presentation/assets/tour-art.json)`)
  const TABS = ['summary', 'problem', 'intelligence', 'ai', 'research', 'features', 'roles']
  for (const tab of TABS) if (typeof t.notes?.[tab] !== 'string' || !t.notes[tab].trim()) fail(`${w}.notes.${tab}: the presenter script for this tab is missing`)
  const notes = { evidence: Object.fromEntries(TABS.map((k) => [k, t[k]?.evidence ?? null])), owner_to_confirm: t.owner_to_confirm ?? [] }
  return {
    tour: { ...(t.style ? { style } : {}), ...(labels ? { labels } : {}), ...(Object.keys(art).length ? { art } : {}), summary: { lines: sum }, problem: { label: t.problem.label, beats, turn: t.problem.turn, scattered, record: t.problem.record }, intelligence: { lead: t.intelligence.lead, modules: insights, close: t.intelligence.close }, ai: { lead: t.ai.lead, uses, guard: t.ai.guard, control: t.ai.control, sample: { label: t.ai.sample.label, text: t.ai.sample.text } }, research: { ...(t.research?.lead ? { lead: t.research.lead } : {}), items }, features: { groups: outGroups }, roles },
    notes,
    presenter: t.notes,
  }
}

const shotDir = join(root, 'public/client-presentation/atlas')
const shots = existsSync(shotDir) ? readdirSync(shotDir).filter((f) => f.endsWith('.webp')) : []
const out = { captured: menu.captured, products: [] }
const notes = { products: [] }
const presenter = {}
for (const F of FAMILIES) {
  const live = menu.modules.find((m) => m.name === F.k12)
  if (!live) { fail(`${F.key}: module ${F.k12} not in the live menu file`); continue }
  const items = []; let family = null
  for (const f of F.files) {
    const p = join(dir, f)
    if (!existsSync(p)) { if (f !== 'part-core-family.json') warns.push(`${F.key}: ${f} not written yet`); continue }
    const d = JSON.parse(readFileSync(p, 'utf8'))
    if (d.family_sheet) family = d.family_sheet
    if (d.family_sheet && !d.items) continue
    items.push(...(d.items || []))
  }
  const seen = new Set()
  const subs = []; const subNotes = []
  for (const it of items) {
    if (seen.has(it.id)) fail(`${it.id}: duplicate id`); seen.add(it.id)
    for (const k of ['id', 'name', 'k12_menu', 'summary', 'problem', 'features', 'technology', 'benefit', 'workflow', 'data', 'evidence']) if (it[k] === undefined) fail(`${it.id}: missing ${k}`)
    checkSheet(it.id, it, { summary: 24, problem: 24, benefit: 24 })
    if (!Array.isArray(it.features) || it.features.length < 3 || it.features.length > 5) fail(`${it.id}.features: needs 3 to 5`)
    else it.features.forEach((t, i) => checkText(`${it.id}.features[${i}]`, t, 10))
    checkEvidence(`${it.id}.evidence`, it.evidence, 2)
    // real screen names come from the live menu, not from the older documents
    const subName = (it.k12_menu.split('>').pop() || it.name).trim()
    const liveSub = live.subs.find((s) => norm(s.name) === norm(subName)) || live.subs.find((s) => norm(s.name).startsWith(norm(it.name)))
    const screens = liveSub && liveSub.screens.length ? liveSub.screens.map((c) => c.name) : (it.screens || [])
    if (!liveSub && !/^learn-pal-/.test(it.id)) warns.push(`${it.id}: no live sub-module "${subName}"; screens taken from the sheet`)
    const subSlug = liveSub ? slug(liveSub.name) : slug(subName)
    const mine = shots.filter((s) => s.startsWith(`${slug(F.k12)}--${subSlug}--`)).sort()
    subs.push({
      id: it.id, name: it.name, screens, screen_count: screens.length, summary: it.summary, problem: it.problem, features: it.features,
      research: it.research ? it.research.text : null, technology: it.technology, benefit: it.benefit, workflow: it.workflow, data: it.data,
      shots: mine.map((s) => `/client-presentation/atlas/${s}`),
    })
    subNotes.push({ id: it.id, evidence: it.evidence, research_evidence: it.research?.evidence ?? [], owner_to_confirm: it.owner_to_confirm ?? [] })
  }
  const liveNames = new Set(live.subs.map((s) => norm(s.name)))
  for (const s of live.subs) if (!subs.some((x) => norm(x.name) === norm(s.name) || norm(s.name).startsWith(norm(x.name)))) warns.push(`${F.key}: live sub-module "${s.name}" has no sheet`)
  if (family) { checkSheet(`${F.key}.family`, family, { summary: 28, problem: 28, benefit: 28 }); checkEvidence(`${F.key}.family.evidence`, family.evidence, 1); (family.ai || []).forEach((t, i) => checkText(`${F.key}.family.ai[${i}]`, t, 14)) }
  else warns.push(`${F.key}: no family sheet`)
  const built = buildTour(F, subs)
  if (built) presenter[F.key] = built.presenter
  out.products.push({ key: F.key, product: F.product, k12_module: F.k12, family: family && { summary: family.summary, problem: family.problem, benefit: family.benefit, technology: family.technology, research: family.research?.text ?? null, workflow: family.workflow, ai: family.ai ?? [] }, subs, ...(built ? { tour: built.tour } : {}) })
  notes.products.push({ key: F.key, family_evidence: family?.evidence ?? [], subs: subNotes, ...(built ? { tour: built.notes } : {}) })
}
// cross-cutting technology and design basis (tech.json)
const techPath = join(dir, 'tech.json')
if (existsSync(techPath)) {
  const t = JSON.parse(readFileSync(techPath, 'utf8'))
  t.pillars.forEach((p, i) => { checkText(`tech.pillars[${i}].name`, p.name, 4); p.lines.forEach((l, j) => checkText(`tech.pillars[${i}].lines[${j}]`, l, 12)); checkEvidence(`tech.pillars[${i}].evidence`, p.evidence, 1) })
  t.designed_from.items.forEach((l, j) => checkText(`tech.designed_from[${j}]`, l, 6)); checkEvidence('tech.designed_from.evidence', t.designed_from.evidence, 1)
  out.tech = { pillars: t.pillars.map((p) => ({ name: p.name, lines: p.lines })), designed_from: t.designed_from.items }
  notes.tech = { pillars: t.pillars.map((p) => ({ name: p.name, evidence: p.evidence })), designed_from_evidence: t.designed_from.evidence }
} else warns.push('tech.json not written')
for (const w of warns) console.log('warn ' + w)
if (fails.length) { for (const f of fails) console.log('FAIL ' + f); console.log(`${fails.length} failure(s)`); process.exit(1) }
const n = out.products.reduce((a, p) => a + p.subs.length, 0)
console.log(`ok   ${out.products.length} families, ${n} sub-module sheets, ${out.products.reduce((a, p) => a + p.subs.filter((s) => s.shots.length).length, 0)} with screenshots`)
// the plan of atlas slides (the same rules as buildAtlasPlan in lib/client-presentation/atlas.ts; atlas.test.ts checks that the two agree)
function chunk(items, max = 5) { if (!items.length) return []; const parts = Math.ceil(items.length / max); const size = Math.ceil(items.length / parts); const o = []; for (let i = 0; i < items.length; i += size) o.push(items.slice(i, i + size)); return o }
// the beat count of a tour and the slide slugs follow the same rules as lib/client-presentation/tour.ts and atlas.ts (atlas.test.ts checks that the plan files agree)
const tourBeats = (t) => Math.max(0, 1 + 1 + 1 + 1 + (t.research.items.length ? 1 : 0) + t.features.groups.length + t.roles.length - 1)
function slugs(plan) {
  const id = (s) => (s.kind === 'hub' ? 'hub' : `${s.family}-${s.kind}`); const count = new Map(); const seen = new Map()
  for (const s of plan) count.set(id(s), (count.get(id(s)) ?? 0) + 1)
  return plan.map((s) => { const b = id(s); const i = (seen.get(b) ?? 0) + 1; seen.set(b, i); return (count.get(b) ?? 1) > 1 ? `${b}-${i}` : b })
}
function buildPlan() {
  const filled = out.products.filter((p) => p.subs.length); if (!filled.length) return []
  const plan = [{ kind: 'hub', theme: 'ink', title: 'Choose a product', kicker: 'Products', ghost: '', beats: 0 }]
  for (const p of filled) {
    plan.push({ kind: 'opener', theme: 'ink', title: p.product, kicker: p.k12_module, ghost: '', family: p.key, beats: 0 })
    if (p.tour) { plan.push({ kind: 'tour', theme: 'ink', title: p.product, kicker: p.k12_module, ghost: '', family: p.key, beats: tourBeats(p.tour) }); continue }
    const groups = chunk(p.subs, 5)
    groups.forEach((g, i) => plan.push({ kind: 'subs', theme: 'ink', title: p.product, kicker: p.k12_module, ghost: `${i + 1}/${groups.length}`, family: p.key, subs: g.map((x) => x.id), beats: g.length - 1 }))
    plan.push({ kind: 'glance', theme: 'paper', title: p.product, kicker: p.k12_module, ghost: '', family: p.key, beats: 0 })
    const gal = chunk(p.subs.filter((x) => x.shots.length), 9)
    gal.forEach((g, i) => plan.push({ kind: 'gallery', theme: 'paper', title: p.product, kicker: p.k12_module, ghost: gal.length > 1 ? `${i + 1}/${gal.length}` : '', family: p.key, subs: g.map((x) => x.id), beats: 0 }))
  }
  const names = slugs(plan)
  return plan.map((x, i) => ({ ...x, key: `a${i + 1}`, n: 200 + i + 1, slug: names[i] }))
}
if (!checkOnly) {
  const o = join(root, 'lib/client-presentation/generated/atlas.json'); mkdirSync(dirname(o), { recursive: true })
  writeFileSync(o, JSON.stringify(out, null, 1) + '\n', 'utf8')
  writeFileSync(join(root, 'docs/client-presentation/atlas-notes.json'), JSON.stringify(notes, null, 1) + '\n', 'utf8')
  console.log('wrote', o)
  writeFileSync(join(dirname(o), 'atlas-plan.json'), JSON.stringify(buildPlan(), null, 1) + '\n', 'utf8')
  console.log('wrote atlas-plan.json')
  writeFileSync(join(dirname(o), 'atlas-presenter.json'), JSON.stringify(presenter, null, 1) + '\n', 'utf8')
  console.log('wrote atlas-presenter.json')
}
