/* Exports the ScholarClone sales scenario in the same study-deck v3 shape as the G2G one, so the same player plays it.
 *   node export-scholarclone-deck.js [path-to-frontend]   (default: the frontend this folder lives in)
 * Writes <frontend>/public/sales-training/scholarclone/deck.json and images/*.svg, and adds a "scholarclone" entry to
 * <frontend>/public/sales-training/index.json (the G2G entry is left as it is).
 *
 * Content: every product fact comes from content/scholarclone-site.json, which was taken from the ScholarClone product page
 * (its product, role, problem, module, workflow and FAQ tables). The customer's lines and the three endings are fictional
 * training material and are labelled that way on the slides. Nothing here is G2G content.
 *
 * The pictures are static SVG files next to the deck (no database table), so deploying the frontend is enough.
 */
const fs = require('fs')
const path = require('path')
const SITE = require('./content/scholarclone-site.json')

const ROOT = process.argv.slice(2).find((a) => !a.startsWith('--')) || path.resolve(__dirname, '..', '..', '..')
const OUT = path.join(ROOT, 'public', 'sales-training', 'scholarclone')
const IMG_URL = '/sales-training/scholarclone/images/'
const BLUE = '0A6AD0'
const VER = 'ScholarClone - Verified product facts (from the product page)'
const SIM = 'ScholarClone - Live sales conversation (typical situation, not a real customer)'
const END = 'ScholarClone - Ending (fictional training scenario)'

const PRODUCTS = SITE.products
const BY = Object.fromEntries(PRODUCTS.map((p) => [p.key, p]))
const PKEYS = PRODUCTS.map((p) => p.key) // one, core, learn, ccb, insight, compass

// Which products each role in the product page's "See the school through each person's eyes" uses, from what the page says each does.
const ROLE_KEYS = ['trustee', 'teacher', 'student', 'parent']
const ROLE_PRODUCTS = { trustee: ['one', 'insight', 'core'], teacher: ['learn', 'ccb', 'core'], student: ['learn', 'compass'], parent: ['core', 'compass', 'learn'] }
if (SITE.roles.length !== ROLE_KEYS.length) throw new Error('the page has ' + SITE.roles.length + ' roles; this generator maps ' + ROLE_KEYS.length)
const ROLES = SITE.roles.map((r, i) => ({ ...r, key: ROLE_KEYS[i], products: ROLE_PRODUCTS[ROLE_KEYS[i]] }))

// Four live conversations. Each customer answer opens the part of the product that answers it.
const CONVS = [
  { key: 'ops', tile: 'Running the school by hand', color: '4C9A14', ask: 'How do you handle admissions, fee follow-up and report cards today?', c: [
    ['"It is registers, phone calls and a lot of chasing. Fees leak."', 'Scholar Core', 'mod:core'],
    ['"Operations are fine. My worry is students falling behind in class."', 'Scholar Learn', 'mod:learn'],
    ['"I just want one place where I can see the whole school."', 'Scholar Insight', 'mod:insight'],
  ] },
  { key: 'learn', tile: 'Learning gaps found too late', color: BLUE, ask: 'What happens when a student keeps getting the same topic wrong?', c: [
    ['"We only find out after the exam, and by then it is late."', 'Scholar Learn', 'mod:learn'],
    ['"Honestly, our teachers need better training first."', 'Scholar CCB', 'mod:ccb'],
    ['"Parents keep phoning the office to ask about results and fees."', 'Scholar Core', 'mod:core'],
  ] },
  { key: 'people', tile: 'Not knowing where teachers need support', color: '4C9A14', ask: 'How do you know which teachers need support, and what training they should get?', c: [
    ['"Appraisals are a matter of opinion and training is the same for everyone."', 'Scholar CCB', 'mod:ccb'],
    ['"Our students pick streams on peer pressure. That worries me more."', 'Scholar Compass', 'mod:compass'],
    ['"Our data sits in separate systems, so nobody sees the whole picture."', 'Scholar Insight', 'mod:insight'],
  ] },
  { key: 'whole', tile: 'Five systems that do not talk', color: '0B3C73', ask: 'How many separate systems does your school run on today, and who connects them?', c: [
    ['"Five or more, and nothing is connected. We re-enter things all the time."', 'Scholar One', 'mod:one'],
    ['"Just the fee software. We want to fix that first."', 'Scholar Core', 'mod:core'],
    ['"The counsellor keeps her notes in a file in a cupboard."', 'Scholar Compass', 'mod:compass'],
  ] },
]
const CK = CONVS.map((c) => c.key)

const order = [
  'home', 'roles', 'modules', 'problems', 'solutions', 'scenarios',
  ...ROLES.map((r) => 'role:' + r.key),
  ...PKEYS.map((k) => 'mod:' + k),
  ...PKEYS.map((k) => 'feat:' + k),
  ...PKEYS.map((k) => 'flow:' + k),
  ...CK.map((k) => 'conv:' + k),
  'questions', 'closing', 'out:won', 'out:wonConc', 'out:stalled',
]
const N = (id) => { const i = order.indexOf(id); if (i < 0) throw new Error('unknown slide ' + id); return i + 1 }

const base = (id, title, section, content, interaction, extra = {}) => ({
  n: N(id), section, slide_type: extra.slide_type || 'objectives', title, accent: '#' + (extra.color || BLUE),
  concept_ids: [], taught_concept_ids: [], concepts: [], relationship: null,
  content: Object.assign({ body: '', explanations: [], bullets: [], example: null, misconception: null, relationship_note: null, key_idea: null, discussion: null, bloom: 'apply', dok: 2, minutes: 2 }, content),
  question_ids: [], activities: [], interaction, interaction_reason: '', h5p_pattern: null, image_missing: null, image: extra.image || null,
  ...(extra.next !== undefined ? { next: extra.next } : {}),
  ...(extra.product ? { product: extra.product } : {}),
  ...(extra.links ? { links: extra.links } : {}),
})
const grp = (group, links) => links.map((l) => ({ ...l, group }))
const L = (label, id, primary) => ({ label, goto: N(id), ...(primary ? { primary: true } : {}) })
const slides = []
const info = (id, title, content, links, extra = {}) => slides.push(base(id, title, VER, content, null, { next: -1, ...extra, links }))
const rolesOf = (key) => ROLES.filter((r) => r.products.includes(key))
const img = (name, alt, tag = 'ILLUSTRATION - NOT A SCHOLARCLONE SCREEN') => ({ url: IMG_URL + name + '.svg', alt, tag })

/* ---- the six information slides the top bar opens ---- */
slides.push(base('home', 'A school that notices and acts', VER, {
  body: 'Every school day creates information. ScholarClone connects it, so leaders see what matters and teachers know what to do next.',
  bullets: ['Start from a role, a product, a business problem, a solution or a live conversation; there is no fixed order.', 'Take one product on its own, or all five together as Scholar One.'],
}, null, {
  slide_type: 'hook', next: N('roles'), product: { name: 'ScholarClone', tagline: 'A school that notices and acts' },
  links: [L('Roles', 'roles', true), L('Modules', 'modules'), L('Business Problems', 'problems'), L('Solutions', 'solutions'), L('Sales Scenarios', 'scenarios')],
}))
info('roles', 'Roles', { body: 'Who is in the room? Pick the role to see the products it uses.', bullets: [] }, ROLES.map((r) => L(`${r.name}: ${r.summary}`, 'role:' + r.key)))
info('modules', 'Modules', { body: 'Click any product to open its talk track: the problem it solves, how it helps, and the question to ask.', bullets: [] }, PRODUCTS.map((p) => L(`${p.name}: ${p.short || p.sub}`, 'mod:' + p.key)))
info('problems', 'Business problems', { body: 'What hurts most? Open the live conversation, or go to the solution. These are typical situations, not real customers.', bullets: [] },
  [...CONVS.map((c) => L(`Conversation: ${c.tile}`, 'conv:' + c.key)), L('See the solutions', 'solutions')])
info('solutions', 'Solutions', {
  body: 'The shift each product makes, with the value it brings. One row per product.',
  bullets: PRODUCTS.map((p) => `${p.name} (${p.sub}): from "${p.before}" to "${p.after}". Value: ${p.benefits.slice(0, 2).join('; ')}.`),
}, PRODUCTS.flatMap((p) => grp(p.name, [L('Open the talk track', 'mod:' + p.key), L("What's inside", 'feat:' + p.key), L('Workflows to demonstrate', 'flow:' + p.key)])))
info('scenarios', 'Sales scenarios', { body: 'Open a live conversation. Ask the question, then click what the customer says.', bullets: [] },
  [...CONVS.map((c) => L(`Conversation: ${c.ask}`, 'conv:' + c.key)), L('Customer questions: cost, rollout, data', 'questions'), L('Close the meeting: choose the next step', 'closing')])

/* ---- roles ---- */
ROLES.forEach((r) => {
  info('role:' + r.key, r.name, {
    body: `${r.summary} Click a product card to present it for this role.`,
    bullets: r.products.map((k) => `${BY[k].name}: ${BY[k].message}.`),
  }, r.products.map((k) => L(BY[k].name, 'mod:' + k)), { image: img('role-' + r.key, `${r.name} (icon)`, 'ILLUSTRATION') })
})

/* ---- one talk track, one "what's inside" and one "workflows" slide per product ---- */
PRODUCTS.forEach((p) => {
  const others = PKEYS.filter((k) => k !== p.key)
  info('mod:' + p.key, p.name, {
    body: `${p.sub}. ${p.message}.`,
    bullets: [
      ...p.problems.slice(0, 2).map(([problem]) => `Problem it solves: ${problem}`),
      `Why the customer needs it: ${p.pitch}`,
      `Why the customer needs it: Best fit. ${p.fit}`,
      ...p.problems.slice(0, 2).map(([, how]) => `How ScholarClone addresses it: ${how}`),
      ...rolesOf(p.key).slice(0, 3).map((r) => `${r.name} needs: ${r.summary}`),
      ...p.benefits.slice(0, 3).map((b) => `Business value: ${b}`),
      `Ask: Where does your school feel "${p.before.toLowerCase()}" most today?`,
    ],
  }, [
    ...grp("What's inside", [L("What's inside " + p.name, 'feat:' + p.key)]),
    ...grp('Workflows', [L('Workflows to demonstrate', 'flow:' + p.key)]),
    ...grp('Live conversation', [L('Open a live conversation', 'conv:' + (CONVS.find((c) => c.c.some((x) => x[2] === 'mod:' + p.key)) || CONVS[0]).key)]),
    ...grp('Used by', rolesOf(p.key).map((r) => L('Used by: ' + r.name, 'role:' + r.key))),
    ...grp('Related', others.slice(0, 3).map((k) => L(BY[k].name, 'mod:' + k))),
  ], { color: p.color, image: img('prod-' + p.key, `${p.name}: ${p.sub}`) })
})

PRODUCTS.forEach((p) => {
  info('feat:' + p.key, `${p.name}: what is inside`, {
    body: 'The modules this product is made of. Show the ones that answer what the customer just said.',
    bullets: p.modules.map(([name, what]) => `${name}: ${what}`),
  }, [L('Back to the talk track', 'mod:' + p.key, true), L('Workflows to demonstrate', 'flow:' + p.key), ...grp('Used by', rolesOf(p.key).map((r) => L('Used by: ' + r.name, 'role:' + r.key)))], { color: p.color })
})

PRODUCTS.forEach((p) => {
  info('flow:' + p.key, `${p.name}: workflows to demonstrate`, {
    body: 'Walk the customer through these. Each one is a flow described on the product page.',
    bullets: Object.entries(p.workflows).map(([name, steps]) => `${name}. ${steps.map((s, i) => `${i + 1}. ${s}`).join(' ')}`),
  }, [L('Back to the talk track', 'mod:' + p.key, true), L("What's inside", 'feat:' + p.key), ...grp('Also show', PKEYS.filter((k) => k !== p.key).slice(0, 3).map((k) => L('Also show: ' + BY[k].name, 'mod:' + k)))], { color: p.color })
})

/* ---- the live conversations: each customer answer opens a different slide ---- */
CONVS.forEach((cv, i) => {
  slides.push(base('conv:' + cv.key, 'Live conversation: ' + cv.tile, `Decision ${i + 1} of ${CONVS.length} - ${SIM}`, { body: `You ask: ${cv.ask}`, bullets: [] }, {
    kind: 'decision', reason: 'Click what the customer says; each answer opens a different slide.', kicker: `${cv.tile} - you ask`,
    question: `You ask: ${cv.ask}  What does the customer say?`,
    options: cv.c.map(([say, opens, target], j) => ({ id: 'abcd'[j], text: `${say} Opens: ${opens}`, goto: N(target) })),
  }, { slide_type: 'challenge', next: -1, color: cv.color, image: img('story-scene', 'The conversation', 'ILLUSTRATION') }))
})

slides.push(base('questions', 'Customer questions', VER, {
  body: 'Straight answers, using what the product page says.',
  bullets: SITE.faqs.map(([q, a]) => `${q} Say: ${a}`),
}, null, { next: -1, links: [L('Close the meeting: choose the next step', 'closing', true), L('Back to the scenarios', 'scenarios')] }))

/* ---- the close: three endings, each with its own coaching ---- */
slides.push(base('closing', 'Close the meeting', `Decision ${CONVS.length + 1} of ${CONVS.length + 1} - ${SIM}`, {
  body: 'The principal has seen what fits the biggest problem and asks, "So what happens next?"', bullets: [],
}, {
  kind: 'decision', reason: 'Choose how you close; each choice has its own ending.', kicker: 'Close the meeting - what do you do?',
  question: 'The principal asks: "So what happens next?" How do you close?',
  options: [
    { id: 'a', text: 'Suggest a short fit review, then start with the one product that answers the biggest problem, and add the others later.', goto: N('out:won') },
    { id: 'b', text: 'Agree a one-product start today, and promise a price for the other products right now so the school feels it is getting a deal.', goto: N('out:wonConc') },
    { id: 'c', text: 'Propose all five products on day one and say you will email one quote for everything.', goto: N('out:stalled') },
  ],
}, { slide_type: 'challenge', next: -1, image: img('story-scene', 'The conversation', 'ILLUSTRATION') }))

const ending = (id, tone, choiceId, choiceText, title, what, why, extra) => slides.push(base(id, title, END, { body: '', bullets: [] }, {
  kind: 'outcome', tone, choice: { id: choiceId, text: choiceText }, what, why,
  actions: [{ label: 'Return to Home', goto: N('home'), primary: true }, { label: 'Try the conversations again', goto: N('scenarios') }],
}, { slide_type: 'challenge', next: -1, image: img('story-scene', 'The conversation', 'ILLUSTRATION'), ...extra }))
ending('out:won', 'sound', 'won', 'A short fit review, then one product, the others later', 'Deal won',
  'The school agrees to a short fit review and a start with the one product that answers its biggest problem.',
  'This follows how the product page says ScholarClone is sold: pricing depends on the products and the size of the school and is shared in a personal conversation after a short fit review, and a school can start with the layer that fits and add more later. A forward-deployed team then works with the school through rollout.')
ending('out:wonConc', 'caution', 'wonConc', 'Promised a price for the other products on the spot', 'Won, with concessions',
  'The school agrees to a one-product start, but you have committed to a price before the fit review.',
  'The product page says pricing is shared after a short fit review, because it depends on the products and the size of the school. A price promised early is a concession you may not be able to keep, and it weakens the review. Start with the fit review, then discuss price.')
ending('out:stalled', 'caution', 'stalled', 'Five products on day one, one quote by email', 'Deal stalled',
  'The principal says the school will think about it, and the conversation goes quiet.',
  'The product page is clear that a school does not need all five products: start with the layer that fits the biggest problem and add more later; Scholar One is for schools that want the full loop on one platform. Leading with everything hides the problem you were asked to solve.')

/* ---- pictures: one panel per role, per product, and one for the conversation ---- */
const dark = (hex, f) => hex.match(/../g).map((h) => Math.round(parseInt(h, 16) * f).toString(16).padStart(2, '0')).join('')
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const panel = (initial, label, sub, color) => `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#${color}"/><stop offset="1" stop-color="#${dark(color, 0.55)}"/></linearGradient></defs>
<rect width="1280" height="720" fill="url(#g)"/>
<circle cx="640" cy="320" r="270" fill="#ffffff" fill-opacity="0.08"/><circle cx="640" cy="320" r="190" fill="#ffffff" fill-opacity="0.1"/>
<circle cx="640" cy="320" r="110" fill="#ffffff" fill-opacity="0.92"/>
<text x="640" y="358" text-anchor="middle" font-family="Segoe UI,Arial" font-size="110" font-weight="700" fill="#${color}">${esc(initial)}</text>
<text x="640" y="600" text-anchor="middle" font-family="Segoe UI,Arial" font-size="46" font-weight="700" fill="#fff">${esc(label)}</text>
<text x="640" y="650" text-anchor="middle" font-family="Segoe UI,Arial" font-size="24" fill="#fff" fill-opacity="0.85">${esc(sub)}</text>
<text x="640" y="695" text-anchor="middle" font-family="Segoe UI,Arial" font-size="18" fill="#fff" fill-opacity="0.7">Illustration, not a ScholarClone screen</text></svg>`
fs.rmSync(path.join(OUT, 'images'), { recursive: true, force: true })
fs.mkdirSync(path.join(OUT, 'images'), { recursive: true })
const write = (name, svg) => fs.writeFileSync(path.join(OUT, 'images', name + '.svg'), svg)
ROLES.forEach((r) => write('role-' + r.key, panel(r.name[0], r.name, 'Who uses ScholarClone', BLUE)))
PRODUCTS.forEach((p) => write('prod-' + p.key, panel(p.name.replace('Scholar ', '')[0], p.name, p.sub, p.color)))
write('story-scene', panel('S', 'Live conversation', 'Sales conversation - illustration', BLUE))

/* ---- top navigation, as in the G2G deck ---- */
const sectionOf = (id) => (id === 'home' ? 'Home' : id === 'roles' || id.startsWith('role:') ? 'Roles' : id === 'modules' || /^(mod|feat|flow):/.test(id) ? 'Modules' : id === 'problems' ? 'Business Problems' : id === 'solutions' ? 'Solutions' : 'Sales Scenarios')
slides.sort((a, b) => a.n - b.n)
slides.forEach((s) => { s.group = sectionOf(order[s.n - 1]) })
const nav = [['Home', 'home'], ['Roles', 'roles'], ['Modules', 'modules'], ['Business Problems', 'problems'], ['Solutions', 'solutions'], ['Sales Scenarios', 'scenarios']].map(([label, id]) => ({ label, goto: N(id) }))

/* ---- checks: numbering, no dead ends, everything reachable from the cover, a way to every ending ---- */
if (slides.length !== order.length) throw new Error(`built ${slides.length} slides for ${order.length} ids`)
slides.forEach((s, i) => { if (s.n !== i + 1) throw new Error('numbering gap at ' + (i + 1)) })
{
  const have = new Set(slides.map((s) => s.n)); const seen = new Set([1]); const q = [1]
  const out = (s) => [...(s.links || []).filter((l) => l.goto !== undefined).map((l) => l.goto), ...(s.interaction?.kind === 'decision' ? s.interaction.options.map((o) => o.goto) : []), ...(s.interaction?.kind === 'outcome' ? s.interaction.actions.map((a) => a.goto) : []), ...(s.next && s.next > 0 ? [s.next] : s.next === undefined && s.n < slides.length ? [s.n + 1] : [])]
  while (q.length) { const c = q.shift(); for (const t of out(slides[c - 1])) { if (!have.has(t)) throw new Error(`slide ${c} points at missing slide ${t}`); if (!seen.has(t)) { seen.add(t); q.push(t) } } }
  const un = slides.filter((s) => !seen.has(s.n)).map((s) => `${s.n} ${order[s.n - 1]}`)
  if (un.length) throw new Error('unreachable: ' + un.join(', '))
  if (slides.length > 40) throw new Error('over 40 slides')
  for (const s of slides) if (s.next === -1 && !(s.links || []).length && !s.interaction) throw new Error('dead end: slide ' + s.n)
}
for (const s of slides) if (s.image && !fs.existsSync(path.join(OUT, 'images', s.image.url.split('/').pop()))) throw new Error('slide ' + s.n + ' names a picture that was not written: ' + s.image.url)

const title = 'ScholarClone Sales Training'
const deck = {
  version: 3, title, theme: 'professional', accent: '#' + BLUE,
  product: { key: 'scholarclone', name: title, tagline: 'A school that notices and acts' },
  chapter: { id: 990001, name: title, number: 1, standard_id: 0, subject_id: 0, standard_name: 'Sales', subject_name: 'ScholarClone' },
  chapter_id: 990001, slide_count: slides.length,
  teaching_strategy: 'Salesperson-led. Start from a role, a product, a business problem, a solution or a live conversation; there is no fixed sequence.',
  nav, outline: [], concepts: {}, slides, concept_slides: {}, taught_by: {}, concept_questions: {},
}
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'deck.json'), JSON.stringify(deck, null, 1))

const indexFile = path.join(ROOT, 'public', 'sales-training', 'index.json')
const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : {}
index.scholarclone = { slides: slides.length, name: title, products: PRODUCTS.map((p) => p.name) }
fs.writeFileSync(indexFile, JSON.stringify(index, null, 1))
console.log(`${title}: ${slides.length} slides -> ${OUT}`)
