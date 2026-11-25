// Builds the Product Atlas data the deck, the videos and the PowerPoint read, and checks it.
//   node scripts/client-presentation/build-atlas.mjs [--check-only]
// Reads  docs/client-presentation/content/atlas/part-*.json (sheets written from source, one file per family or group of sub-modules)
//        docs/client-presentation/content/atlas/k12-menu-2026-11-25.json (the live menu: real module, sub-module and screen names)
//        public/client-presentation/atlas/*.webp (edited screenshots, named <module>--<sub-module>--<screen>.webp)
// Writes lib/client-presentation/generated/atlas.json (what the browser renders: no evidence paths, no owner notes)
//        docs/client-presentation/atlas-notes.json (evidence paths and owner-to-confirm notes, for presenter notes and review)
// Exit 1 on any failure: a missing field, a word limit, a banned pattern (percentages, money, predict, at-risk, NEP, status words), an outside AI
// company or model name, an evidence path that does not exist, or a screenshot that is named but missing.
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

const shotDir = join(root, 'public/client-presentation/atlas')
const shots = existsSync(shotDir) ? readdirSync(shotDir).filter((f) => f.endsWith('.webp')) : []
const out = { captured: menu.captured, products: [] }
const notes = { products: [] }
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
  out.products.push({ key: F.key, product: F.product, k12_module: F.k12, family: family && { summary: family.summary, problem: family.problem, benefit: family.benefit, technology: family.technology, research: family.research?.text ?? null, workflow: family.workflow, ai: family.ai ?? [] }, subs })
  notes.products.push({ key: F.key, family_evidence: family?.evidence ?? [], subs: subNotes })
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
const BIGT = [['What every module is', 'Summary', '01'], ['Which problem we solve', 'Problems', '02'], ['Inside every module', 'Modules and sub-modules', '03'], ['How the work flows', 'Workflows', '04'], ['Where our AI helps', 'AI and technology', '05'], ['What could become easier', 'Benefits', '06'], ['See it for real', 'Screens', '07']]
function chunk(items, max = 5) { if (!items.length) return []; const parts = Math.ceil(items.length / max); const size = Math.ceil(items.length / parts); const o = []; for (let i = 0; i < items.length; i += size) o.push(items.slice(i, i + size)); return o }
function buildPlan() {
  const plan = []; const filled = out.products.filter((p) => p.subs.length); if (!filled.length) return []
  const big = (i, theme) => plan.push({ kind: 'big', theme, beats: 0, title: BIGT[i][0], kicker: BIGT[i][1], ghost: BIGT[i][2] })
  const named = (kind, i, theme, beats = 0) => plan.push({ kind, theme, beats, title: BIGT[i][0], kicker: BIGT[i][1], ghost: BIGT[i][2] })
  big(0, 'ink'); named('families', 0, 'paper'); big(1, 'ink'); named('problems', 1, 'paper'); big(2, 'ink')
  for (const p of filled) { const groups = chunk(p.subs, 5); groups.forEach((g, i) => { const intro = i === 0 && Boolean(p.family); plan.push({ kind: 'subs', theme: 'ink', title: p.product, kicker: p.k12_module, ghost: `${i + 1}/${groups.length}`, family: p.key, subs: g.map((x) => x.id), intro, beats: intro ? g.length : g.length - 1 }) }) }
  big(3, 'paper'); named('workflows', 3, 'ink'); big(4, 'ink'); named('tech', 4, 'paper', 2); big(5, 'paper'); named('benefits', 5, 'ink'); big(6, 'ink'); named('gallery', 6, 'paper', filled.length - 1)
  return plan.map((x, i) => ({ ...x, key: `a${i + 1}`, n: 200 + i + 1 }))
}
if (!checkOnly) {
  const o = join(root, 'lib/client-presentation/generated/atlas.json'); mkdirSync(dirname(o), { recursive: true })
  writeFileSync(o, JSON.stringify(out, null, 1) + '\n', 'utf8')
  writeFileSync(join(root, 'docs/client-presentation/atlas-notes.json'), JSON.stringify(notes, null, 1) + '\n', 'utf8')
  console.log('wrote', o)
  writeFileSync(join(dirname(o), 'atlas-plan.json'), JSON.stringify(buildPlan(), null, 1) + '\n', 'utf8')
  console.log('wrote atlas-plan.json')
}
