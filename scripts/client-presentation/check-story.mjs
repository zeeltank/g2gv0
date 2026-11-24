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

// Status vocabulary (owner decision 2026-11-24: every product is presented as complete): none of it may reach a customer.
const STATUS_WORDS = /\b(partial|partially|conceptual|in progress|in development|under development|planned|beta|coming soon|roadmap|prototype|not built|not yet built|design intent)\b/i

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

// 3b. No status words anywhere a customer or the presenter's window can read them ('limits' are presenter-only and exempt).
const customerText = [
  ...story.slides.flatMap((s) => [...s.on_slide.map((l) => l.text), s.say, s.ask, s.transition]),
  ...story.scenarios.flatMap((x) => [x.title, x.situation, x.challenge, x.capability, x.next_action, x.value]),
  ...story.short_version.map((x) => x.title),
]
for (const t of customerText) if (t && STATUS_WORDS.test(t)) fail(`status word in customer text: "${t.slice(0, 80)}"`)
// No status badge or mark may exist in the data at all.
for (const s of story.slides) {
  if ('badge' in s) fail(`slide ${s.n} still has a status badge`)
  for (const l of s.on_slide) { if ('badge' in l || 'mark' in l) fail(`slide ${s.n}: "${l.text.slice(0, 40)}" still has a badge or mark`); if (/^legend/.test(l.role)) fail(`slide ${s.n} still has a legend line`) }
}

// 3c. The explainer clips follow the same rules as the slides (docs/client-presentation/content/clips.json).
{
  const clipsPath = join(root, 'docs', 'client-presentation', 'content', 'clips.json')
  let clips = null
  try { clips = JSON.parse(readFileSync(clipsPath, 'utf8')) } catch { fail('clips.json is missing or not valid JSON') }
  if (clips) {
    if (clips.clips.length !== 5) fail('there must be exactly 5 product clips')
    const ids = new Set()
    for (const c of clips.clips) {
      if (ids.has(c.id)) fail(`duplicate clip id ${c.id}`)
      ids.add(c.id)
      const hook = c.lines.filter((l) => l.role === 'hook')
      const out = c.lines.filter((l) => l.role === 'outcome')
      if (hook.length !== 1 || out.length !== 1) fail(`clip ${c.id} needs exactly one hook and one outcome`)
      if (hook[0] && hook[0].text.split(/\s+/).length > 10) fail(`clip ${c.id}: the hook is longer than 10 words`)
      if (out[0] && out[0].text.split(/\s+/).length > 14) fail(`clip ${c.id}: the outcome is longer than 14 words`)
      if (!c.claims?.length) fail(`clip ${c.id} cites no claim`)
      for (const id of c.claims || []) {
        const cl = claims.get(id)
        if (!cl) { fail(`clip ${c.id}: unknown claim ${id}`); continue }
        if (!['verified', 'owner-confirmed'].includes(cl.status)) fail(`clip ${c.id} rests on a ${cl.status} claim (${id})`)
      }
      for (const l of c.lines) {
        if (l.claim && !claims.has(l.claim)) fail(`clip ${c.id}: unknown claim ${l.claim}`)
        if (STATUS_WORDS.test(l.text)) fail(`clip ${c.id}: status word in "${l.text.slice(0, 60)}"`)
        for (const [re, what] of BANNED) if (re.test(l.text)) fail(`clip ${c.id}: ${what} in "${l.text.slice(0, 60)}"`)
        if (/\d{3,}/.test(l.text)) fail(`clip ${c.id}: a long number in "${l.text.slice(0, 60)}"`)
      }
      for (const l of c.lines.filter((x) => ['outcome', 'case-title', 'step'].includes(x.role))) if (!l.claim) fail(`clip ${c.id}: "${l.text.slice(0, 50)}" states a capability with no claim`)
    }
    if (!clips.meta?.disclosure || /real|customer|live data/i.test(clips.meta.disclosure)) fail('clips need the plain disclosure "Illustrative school data"')
  }
}

// 3d. The 59-second film (docs/client-presentation/content/film.json) follows the same rules, and the owner's own words stay exact.
{
  let film = null
  try { film = JSON.parse(readFileSync(join(root, 'docs', 'client-presentation', 'content', 'film.json'), 'utf8')) } catch { fail('film.json is missing or not valid JSON') }
  if (film) {
    const slideTexts = new Set(story.slides.flatMap((s) => s.on_slide.map((l) => l.text)))
    const slideLine = (n, role) => story.slides.find((s) => s.n === n)?.on_slide.find((l) => l.role === role)?.text
    if (film.beats.length !== 9) fail('the film needs exactly 9 beats')
    let at = 0
    for (const b of film.beats) {
      if (b.start !== at) fail(`film beat ${b.id} starts at ${b.start} s, expected ${at} s`)
      at = b.end
      if (b.chapter && (STATUS_WORDS.test(b.chapter) || b.chapter.split(/\s+/).length > 4)) fail(`film beat ${b.id}: the chapter label is a status word or longer than 4 words`)
      const words = b.lines.reduce((a, l) => a + l.text.split(/\s+/).length, 0)
      if (words > 70) fail(`film beat ${b.id} carries ${words} words on screen`)
      for (const id of b.claims || []) {
        const cl = claims.get(id)
        if (!cl) fail(`film beat ${b.id}: unknown claim ${id}`)
        else if (!['verified', 'owner-confirmed'].includes(cl.status)) fail(`film beat ${b.id} rests on a ${cl.status} claim (${id})`)
      }
      const chunkRoles = new Set((b.joins || []).flatMap((j) => j.roles))
      for (const j of b.joins || []) {
        const want = slideLine(j.slide, j.role)
        const got = j.roles.map((r) => b.lines.find((l) => l.role === r)?.text).join(' ')
        if (got !== want) fail(`film beat ${b.id}: the chunks no longer join into slide ${j.slide}'s ${j.role} ("${got.slice(0, 50)}")`)
      }
      for (const l of b.lines) {
        const tag = `film beat ${b.id}: "${l.text.slice(0, 50)}"`
        if (l.claim && !claims.has(l.claim)) fail(`${tag} cites unknown claim ${l.claim}`)
        if (STATUS_WORDS.test(l.text)) fail(`${tag} holds a status word`)
        for (const [re, what] of BANNED) if (re.test(l.text)) fail(`${tag} holds ${what}`)
        if (/\b\d{3,}\b/.test(l.text)) fail(`${tag} holds a long number`)
        if (l.kind === 'fact' && !l.claim) fail(`${tag} states a capability with no claim`)
        if (l.kind === 'approved-copy' && !slideTexts.has(l.text) && !chunkRoles.has(l.role)) fail(`${tag} is marked approved but is not a slide line`)
        if (l.kind !== 'approved-copy' && l.text.split(/\s+/).length > 14) fail(`${tag} is longer than 14 words`)
        if (l.kind === 'approved-copy' && l.text.split(/\s+/).length > 22) fail(`${tag} is longer than 22 words`)
      }
    }
    if (at !== 59) fail(`the film ends at ${at} s, not 59 s`)
    const end = film.beats[film.beats.length - 1]
    if (end.lines.find((l) => l.role === 'invite')?.text !== slideLine(15, 'support')) fail('the film end card must carry the approved invitation exactly')
    if (end.lines.find((l) => l.role === 'close')?.text !== slideLine(15, 'close')) fail('the film end card must carry the approved closing line exactly')
    if (!film.meta?.disclosure || /real|customer|live data/i.test(film.meta.disclosure)) fail('the film needs the plain disclosure "Illustrative school data"')
    if (!film.beats.find((b) => b.id === 'problem')?.lines.some((l) => /illustrative/i.test(l.text))) fail('the film\'s problem beat needs an on-screen illustrative tag')
  }
}

// 3e. The PowerPoint appendix (story.appendix): every row cites a verified or owner-confirmed claim and passes the same wording rules.
for (const a of story.appendix || []) {
  if (!a.lines?.length) fail(`appendix ${a.id} has no lines`)
  for (const l of a.lines || []) {
    const tag = `appendix ${a.id}: "${(l.text || l.q || '').slice(0, 50)}"`
    if (!l.claim) fail(`${tag} cites no claim`)
    else if (!claims.has(l.claim)) fail(`${tag} cites unknown claim ${l.claim}`)
    else if (!['verified', 'owner-confirmed'].includes(claims.get(l.claim).status)) fail(`${tag} rests on a ${claims.get(l.claim).status} claim`)
    for (const t of [l.label, l.text, l.q, l.a]) {
      if (!t) continue
      if (STATUS_WORDS.test(t)) fail(`${tag} holds a status word`)
      for (const [re, what] of BANNED) if (re.test(t)) fail(`${tag} holds ${what}`)
    }
  }
}

// 4. Every fact line cites a known claim; gate on status when shipping.
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
if (story.slides.length < 12 || story.slides.length > 18) fail('master deck must have 12 to 18 slides')

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
    out.push(`## Slide ${s.n}: ${s.id}`, '', `**Takeaway.** ${s.takeaway}`, '', '**On the slide**', '')
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
