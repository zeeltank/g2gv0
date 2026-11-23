// Checks the client-presentation story file against the owner's rules, and renders the storyboard.
//   node scripts/client-presentation/check-story.mjs [--ship] [--render]
// Reads docs/client-presentation/content/scholarclone.story.json. Writes only with --render (docs/client-presentation/03-storyboard.md).
// Exit 1 on any hard failure. --ship also fails on lines whose claim is not yet verified or owner-confirmed.
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const fileArg = process.argv.indexOf('--file')
const storyPath = fileArg > 0 ? process.argv[fileArg + 1] : join(root, 'docs', 'client-presentation', 'content', 'scholarclone.story.json')
const story = JSON.parse(readFileSync(storyPath, 'utf8'))
const ship = process.argv.includes('--ship')
const render = process.argv.includes('--render')

const fails = []
const warns = []
const fail = (m) => fails.push(m)
const warn = (m) => warns.push(m)

// Owner's words for slide 1, exactly as approved.
const HOOK = [
  'What is your school not seeing?',
  'Even when it has the data, the reports and the software.',
  'Discover what becomes possible when your school starts connecting the dots.',
]

// Things the master prompt and the owner forbid, or that the code does not support.
const BANNED = [
  [/\d\s*%/, 'percentage'],
  [/₹|\bRs\.?\s*\d|\$\s*\d|\blakh\b|\bcrore\b/i, 'money'],
  [/\bfree\b/i, 'free'],
  [/guarantee/i, 'guarantee'],
  [/\bROI\b/, 'ROI'],
  [/\bpredict/i, 'predict'],
  [/at-risk/i, 'at-risk (claims early identification)'],
  [/\bNEP\b/, 'NEP (policy, not a certification)'],
  [/one login/i, 'one login (unverified claim)'],
  [/reviewed before/i, 'reviewed-before-students (unverified claim)'],
  [/Anand|Lions/i, 'customer name (needs written permission)'],
  [/testimonial|\bproven\b/i, 'testimonial or proven'],
  [/\bIPIP\b/, 'IPIP (not in the product)'],
]

const claims = new Map(story.claims.map((c) => [c.id, c]))
if (claims.size !== story.claims.length) fail('duplicate claim ids')

const slideText = (s) => [
  s.takeaway, s.say, s.ask, s.transition,
  ...s.on_slide.map((l) => l.text),
]

// 1. Slide 1 is exactly the approved copy and nothing else.
const s1 = story.slides.find((s) => s.n === 1)
const s1text = s1.on_slide.map((l) => l.text)
if (JSON.stringify(s1text) !== JSON.stringify(HOOK)) fail('slide 1 text differs from the approved hook copy')

// 2. Nothing about the product or "intelligence" before slide 5.
for (const s of story.slides.filter((x) => x.n < 5)) {
  for (const t of slideText(s)) {
    if (t && /intelligen|scholar/i.test(t)) fail(`slide ${s.n} uses a product word too early: "${t.slice(0, 60)}"`)
  }
}

// 3. Banned patterns across every audience-facing and presenter text.
const allText = [
  ...story.slides.flatMap((s) => [...slideText(s), s.visual, s.motion].filter(Boolean)),
  ...story.claims.map((c) => c.text),
  ...story.scenarios.flatMap((x) => [x.situation, x.challenge, x.capability, x.next_action, x.value]),
  ...story.alternative_openers.flatMap((o) => [o.visual, o.motion, o.why]),
]
for (const t of allText) for (const [re, why] of BANNED) if (re.test(t)) fail(`banned (${why}): "${t.slice(0, 70)}"`)

// 4. Every fact line cites a known claim; badges match the approved ones; gate on status when shipping.
const APPROVED = { 'Scholar One': 'CONCEPTUAL', 'Scholar Core': 'LIVE', 'Scholar Learn': 'PARTIAL', 'Scholar CCB': 'PARTIAL', 'Scholar Insight': 'PARTIAL', 'Scholar Compass': 'PARTIAL' }
const byStatus = {}
for (const s of story.slides) {
  for (const l of s.on_slide) {
    if (l.kind === 'fact' || l.kind === 'concept' || l.kind === 'invitation') {
      if (!l.claim && !(s.claims || []).length) fail(`slide ${s.n}: ${l.kind} line has no claim: "${l.text.slice(0, 50)}"`)
    }
    if (l.claim) {
      const c = claims.get(l.claim)
      if (!c) { fail(`slide ${s.n}: unknown claim ${l.claim}`); continue }
      byStatus[c.status] = (byStatus[c.status] || 0) + 1
      const ok = c.status === 'verified' || c.status === 'owner-confirmed'
      if (!ok) (ship ? fail : warn)(`slide ${s.n}: "${l.text.slice(0, 48)}" rests on a ${c.status} claim (${c.id})`)
    }
    if (l.badge) {
      const name = Object.keys(APPROVED).find((k) => l.text.startsWith(k))
      if (name && APPROVED[name] !== l.badge) fail(`slide ${s.n}: ${name} badge ${l.badge} differs from approved ${APPROVED[name]}`)
    }
  }
  for (const id of s.claims || []) if (!claims.has(id)) fail(`slide ${s.n}: unknown claim ${id}`)
}

// 5. Short version and scenarios point at real slides.
const nums = new Set(story.slides.map((s) => s.n))
for (const sv of story.short_version) for (const u of sv.uses) if (!nums.has(u)) fail(`short version uses missing slide ${u}`)
if (story.short_version.length !== 5) fail('short version must have 5 slides')
for (const sc of story.scenarios) {
  if (!nums.has(sc.slide)) fail(`scenario ${sc.id} points at missing slide ${sc.slide}`)
  if (sc.label !== 'Illustrative') fail(`scenario ${sc.id} is not labelled Illustrative`)
  for (const id of sc.claims) if (!claims.has(id)) fail(`scenario ${sc.id}: unknown claim ${id}`)
}
if (story.scenarios.length !== 5) fail('need exactly 5 scenarios')
if (story.alternative_openers.length !== 3) fail('need exactly 3 alternative openers')
if (story.slides.length < 12 || story.slides.length > 15) fail('master deck must have 12 to 15 slides')

// 5a. The owner's own words are locked exactly (master prompt Parts 3 to 5, and the approved invitation).
const APPROVED_COPY = {
  1: HOOK,
  2: ['What if the information your school already has could help you see more clearly?'],
  5: [
    'An integrated intelligent K–12 platform designed to help schools connect information, support better decisions and take meaningful action.',
    'School Intelligence means helping a school understand what its information is telling it, where attention is needed and what action may be appropriate next.',
  ],
  15: ["Let's discover what your school could see differently."],
}
for (const s of story.slides) {
  const locked = APPROVED_COPY[s.n] || []
  const present = s.on_slide.filter((l) => l.kind === 'approved-copy').map((l) => l.text)
  for (const t of locked) if (!present.includes(t)) fail(`slide ${s.n} is missing or has changed the owner's approved copy: "${t.slice(0, 60)}"`)
  for (const t of present) if (!locked.includes(t)) fail(`slide ${s.n} has a line marked approved-copy that is not in the owner's list: "${t.slice(0, 60)}"`)
}

// 5b. Owner conditions (2026-11-23).
// Illustrative content is always tagged as illustrative, never presented as a real customer experience.
for (const s of story.slides) {
  const usesIllustration = (s.claims || []).includes('C-ILL') || s.on_slide.some((l) => l.claim === 'C-ILL')
  if (usesIllustration && !s.on_slide.some((l) => /illustrative|typical, to validate/i.test(l.text))) fail(`slide ${s.n} uses an illustration without an on-slide illustrative tag`)
}
// PARTIAL is visibly distinguished from LIVE: every product slide carries a badge, and slide 6 badges all six products.
for (const s of story.slides.filter((x) => x.n >= 7 && x.n <= 13)) if (!s.badge) fail(`slide ${s.n} has no status badge`)
for (const l of story.slides.find((x) => x.n === 6).on_slide.filter((x) => x.role === 'product')) if (!l.badge) fail(`slide 6: "${l.text.slice(0, 30)}" has no badge`)
// Slide 15 is exactly the approved invitation, with no number other than 25 and the list numbers.
const s15 = story.slides.find((x) => x.n === 15).on_slide.map((l) => l.text)
for (const must of ['We would like to talk with you about the Founding 25 Pilot Programme.', 'The next step is a conversation.']) {
  if (!s15.includes(must)) fail(`slide 15 is missing the approved wording: "${must}"`)
}
if (s15.filter((t) => /^[1-4]\. /.test(t)).length !== 4) fail('slide 15 must keep the four discovery items')
for (const t of s15) if (/\d/.test(t.replace(/^[1-4]\. /, '').replace('Founding 25', ''))) fail(`slide 15 contains a number (no dates, prices or seat counts): "${t}"`)
// A claim the owner removed may not come back.
const NOT_USED = story.claims.filter((c) => c.status === 'not-used').map((c) => c.id)
for (const s of story.slides) for (const l of s.on_slide) if (l.claim && NOT_USED.includes(l.claim)) fail(`slide ${s.n} uses a removed claim ${l.claim}`)
if (/mastery paths/i.test(JSON.stringify(story.slides))) fail('the mastery-paths line was removed by the owner and must not reappear')
// The existing Sales Training deck stays completely untouched (git sees no change under its paths).
try {
  const touched = execSync('git status --porcelain -- lib/sales-training components/domain/lms/sales-training public/sales-training scripts/sales-training app/module/lms/learning/sales-training app/api/sales-training', { cwd: root }).toString().trim()
  if (touched) fail('the existing Sales Training deck has changes:\n' + touched)
} catch (e) { warn('could not run git to confirm the old deck is untouched: ' + String(e.message).slice(0, 80)) }

// 6. Minimal text per slide.
for (const s of story.slides) {
  const words = s.on_slide.map((l) => l.text).join(' ').split(/\s+/).length
  if (words > 130) warn(`slide ${s.n} has ${words} words on slide; trim or move to notes`)
}

// 7. Slots: every screenshot is a labelled placeholder until supplied.
const slots = story.slides.flatMap((s) => s.slots.map((x) => ({ ...x, slide: s.n })))
const shots = slots.filter((x) => x.type === 'screenshot')

console.log(`slides ${story.slides.length}  claims ${story.claims.length}  scenarios ${story.scenarios.length}  openers ${story.alternative_openers.length}`)
console.log(`slots ${slots.length} (screenshots ${shots.length}, all placeholders until supplied)`)
console.log('fact/claim lines by claim status:', JSON.stringify(byStatus))
for (const w of warns) console.log('WARN  ' + w)
for (const f of fails) console.log('FAIL  ' + f)
console.log(fails.length ? `\n${fails.length} failure(s)` : `\nOK (${warns.length} warning(s)${ship ? '' : '; run with --ship to make them failures'})`)

if (render) {
  const out = ['# 03 Storyboard: ScholarClone client presentation (Slice 1 draft)', '',
    'Generated from `content/scholarclone.story.json` by `scripts/client-presentation/check-story.mjs --render`. Edit the JSON, not this file.', '',
    '**Owner decisions applied**', '', ...story.meta.owner_decisions.map((d) => `- ${d}`), '']
  for (const s of story.slides) {
    out.push(`## Slide ${s.n}: ${s.id}${s.badge ? `  [${s.badge}]` : ''}`, '', `**Takeaway.** ${s.takeaway}`, '', '**On the slide**', '')
    for (const l of s.on_slide) out.push(`- ${l.mark ? `(${l.mark}) ` : ''}${l.text}${l.claim ? `  _[${l.claim}: ${claims.get(l.claim)?.status}]_` : ''}`)
    out.push('', `**Visual.** ${s.visual}`, '', `**Motion (and what it means).** ${s.motion}`, '', `**Say.** ${s.say}`, '', `**Ask.** ${s.ask}`)
    if (s.transition) out.push('', `**Transition.** ${s.transition}`)
    if (s.slots.length) out.push('', '**Image slots.** ' + s.slots.map((x) => `${x.id} (${x.type}): ${x.brief}`).join(' | '))
    out.push('')
  }
  out.push('## Five-slide version', '', ...story.short_version.map((x) => `${x.n}. ${x.title} (uses slide ${x.uses.join(' + ')})${x.note ? `: ${x.note}` : ''}`), '')
  out.push('## Scenario library (all illustrative)', '')
  for (const sc of story.scenarios) {
    out.push(`### ${sc.n}. ${sc.title}  _[${sc.label}, slide ${sc.slide}]_`, '', `- **Situation:** ${sc.situation}`, `- **Current challenge:** ${sc.challenge}`, `- **ScholarClone capability:** ${sc.capability}`, `- **Possible next action:** ${sc.next_action}`, `- **Value:** ${sc.value}`, '')
  }
  out.push('## Alternative openers (comparison only; the approved headline does not change)', '')
  for (const o of story.alternative_openers) out.push(`### ${o.name}`, '', `- **Visual:** ${o.visual}`, `- **Motion:** ${o.motion}`, `- **Why:** ${o.why}`, '')
  writeFileSync(join(root, 'docs', 'client-presentation', '03-storyboard.md'), out.join('\n'), 'utf8')
  const pg = ['# 04 Presenter guide: ScholarClone client presentation', '', 'Generated from `content/scholarclone.story.json` by `scripts/client-presentation/check-story.mjs --render`. Edit the JSON, not this file.', '',
    'Keys in the web deck: Right / Space / Enter = next step, Left / Backspace = back, P = presenter notes window, M = five-slide version, F = full screen, C = image credits, Escape = leave a scenario and return to the journey.', '']
  for (const sl of story.slides) pg.push(`## ${sl.n}. ${sl.on_slide.find((l) => l.role === 'headline')?.text ?? sl.id}${sl.badge ? `  [${sl.badge}]` : ''}`, '', `**Main message.** ${sl.takeaway}`, '', `**Say.** ${sl.say}`, '', `**Ask.** ${sl.ask}`, ...(sl.transition ? ['', `**Then.** ${sl.transition}`] : []), '')
  writeFileSync(join(root, 'docs', 'client-presentation', '04-presenter-guide.md'), pg.join('\n'), 'utf8')
  console.log('rendered docs/client-presentation/03-storyboard.md and 04-presenter-guide.md')
}

process.exit(fails.length ? 1 : 0)
