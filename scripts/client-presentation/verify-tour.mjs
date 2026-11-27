// Checks the product tour the way a person uses it, in the real player (not the render route).
//   node scripts/client-presentation/verify-tour.mjs [--base http://localhost:3412] [--family core] [--slide <n>]
// For the first product tour: Next/Back through every beat, a click on every tab, Shift + digit, plain digits 1 to 5 still opening products,
// Back from the next product landing on the tour's last beat, the presenter window showing the script of the tab that is showing, and no page errors.
// Exit code 1 if anything fails. Needs a dev or production server and playwright-core (borrowed from the lms_k12 checkout).
import { createRequire } from 'node:module'
import { readdirSync, readFileSync } from 'node:fs'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const base = arg('base', 'http://localhost:3412')
// The slide positions come from the plan, so adding or removing a slide never makes this script lie. The deck is the 16 story slides, then the
// atlas (its hub is slide 17), then the invitation: the position of atlas key aK is 16 + K and the total is 17 + the atlas length.
const PLAN = JSON.parse(readFileSync(new URL('../../lib/client-presentation/generated/atlas-plan.json', import.meta.url), 'utf8'))
const TOTAL = 17 + PLAN.length
const posOf = (s) => s.pos ?? 16 + Number(s.key.slice(1))
const family = arg('family', 'core')
const tourSlide = PLAN.find((s) => s.kind === 'tour' && s.family === family)
const openerSlide = PLAN.find((s) => s.kind === 'opener' && s.family === family)
const isLast = !PLAN[PLAN.indexOf(tourSlide) + 1]   // the last product has no next product: the closing invitation slide (the last of the deck) follows its tour
const nextOpener = PLAN[PLAN.indexOf(tourSlide) + 1] ?? { title: 'the closing invitation', pos: TOTAL, key: null }
if (!tourSlide || !openerSlide) { console.log(`no tour for ${family}`); process.exit(1) }
const slide = Number(arg('slide', tourSlide.n))
// What the tour holds, read from the same generated files the deck is built from: nothing about a product's tour is typed twice here.
const ATLAS = JSON.parse(readFileSync(new URL('../../lib/client-presentation/generated/atlas.json', import.meta.url), 'utf8'))
const PRESENTER = JSON.parse(readFileSync(new URL('../../lib/client-presentation/generated/atlas-presenter.json', import.meta.url), 'utf8'))[family]
const tour = ATLAS.products.find((p) => p.key === family).tour
const P = (tour.style ?? 'ink') === 'sketchbook' ? 'sk' : 'tr'   // the scene's class prefix
const TABS = ['summary', 'problem', 'intelligence', 'ai', ...(tour.research.items.length ? ['research'] : []), 'features', 'roles']
const STEPS = TABS.flatMap((t) => (t === 'features' ? tour.features.groups.map((_, i) => `features/g${i}`) : t === 'roles' ? tour.roles.map((_, i) => `roles/r${i}`) : [t]))
const LAST_ROLE = tour.roles.length - 1
const norm = (t) => String(t).toLowerCase().replace(/\s+/g, ' ').trim()
const nextKey = isLast ? '1' : String(PLAN.filter((s) => s.kind === 'opener').findIndex((s) => s.key === nextOpener.key) + 1)   // the digit that opens the next product
const coreKey = String(PLAN.filter((s) => s.kind === 'opener').findIndex((s) => s.key === openerSlide.key) + 1)
const here = (s) => new RegExp(`^${posOf(s)}/${TOTAL}$`)
const require = createRequire('C:/Users/MILAN/Downloads/lms_k12/')
const { chromium } = require('playwright-core')
const exe = readdirSync(process.env.LOCALAPPDATA + '/ms-playwright').filter((d) => d.startsWith('chromium-') && !d.includes('headless')).map((d) => `${process.env.LOCALAPPDATA}/ms-playwright/${d}/chrome-win64/chrome.exe`)[0]
const browser = await chromium.launch({ executablePath: exe, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } })
await ctx.addCookies([{ name: 'gtg-session', value: '1', domain: new URL(base).hostname, path: '/' }])
await ctx.addInitScript(() => {
  localStorage.setItem('userData', JSON.stringify({ user_id: 1, token: 'local-test-session', sub_institute_id: 6, syear: 2026 }))
  localStorage.setItem('gtg-session', JSON.stringify({ user: { id: 1, email: 'test@local', name: 'Local test', role: 'admin', profileName: 'Admin', subInstituteId: 6, syear: 2026 }, isAuthenticated: true, isLoading: false }))
})
const blocked = new Set()
await ctx.route('**/*', (route) => { const u = new URL(route.request().url()); if (u.hostname === new URL(base).hostname || ['localhost', '127.0.0.1'].includes(u.hostname)) return route.continue();   // this machine only (the local API runs on 127.0.0.1:8000)
   blocked.add(u.origin); return route.abort() })
const page = await ctx.newPage(); const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
let failed = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`); if (!ok) failed++ }
const settle = (ms = 1800) => page.waitForTimeout(ms)
const counter = () => page.evaluate(() => document.querySelector('.cp-ui-pill span')?.textContent?.trim() ?? '')
// which tab panel is showing, and which group / role inside it
const state = () => page.evaluate((P) => {
  const vis = (el) => { const c = getComputedStyle(el); return c.visibility !== 'hidden' && Number(c.opacity) > 0.85 }
  const panels = [...document.querySelectorAll(`.${P}-panel`)].filter(vis).map((p) => p.dataset.tab)
  const group = [...document.querySelectorAll(`.${P}-group`)].filter(vis).map((g) => Number(g.dataset.i))
  const role = [...document.querySelectorAll(`.${P}-role`)].filter(vis).map((g) => Number(g.dataset.i))
  return { panels, group, role }
}, P)
const open = async (n, beat) => { await page.goto(`${base}/module/lms/learning/client-presentation/scholarclone?slide=${n}${beat ? `&beat=${beat}` : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await page.waitForSelector('.cp-scene', { timeout: 120000 }); await settle(2200) }

await open(slide)
check(`the tour opens on slide ${posOf(tourSlide)} of ${TOTAL}`, here(tourSlide).test(await counter()), await counter())
let s = await state()
check('it opens on the Summary tab', s.panels.join() === 'summary', JSON.stringify(s))
const tabs = await page.evaluate((P) => [...document.querySelectorAll(`.${P}-tab`)].map((t) => t.dataset.tab), P)
check(`the bar shows ${TABS.length} tabs${tour.research.items.length ? ', Research included' : ''}`, tabs.join() === TABS.join(), tabs.join())

// Next through every beat (the richest steps take about 2.6 s to settle, so wait for them)
const seenTabs = []
for (let i = 0; i < STEPS.length - 1; i++) { await page.keyboard.press('ArrowRight'); await settle(i < 4 ? 3200 : 3000); const st = await state(); seenTabs.push(st.panels[0] + (st.group.length ? `/g${st.group[0]}` : '') + (st.role.length ? `/r${st.role[0]}` : '')) }
check(`Next walks the ${STEPS.length - 1} steps in order`, seenTabs.join() === STEPS.slice(1).join(), seenTabs.join(' '))
check(`still the same slide after ${STEPS.length - 1} presses`, here(tourSlide).test(await counter()), await counter())
await page.keyboard.press('ArrowLeft'); await settle(2600)
s = await state()
{ // Back from the last step shows the step before it, whatever that is (a role, a feature group or a tab): read from the step list
  const prev = STEPS[STEPS.length - 2]; const [tab, sub] = prev.split('/')
  const ok = s.panels.join() === tab && (sub?.startsWith('r') ? s.role.join() === sub.slice(1) : sub?.startsWith('g') ? s.group.join() === sub.slice(1) : true)
  check(`Back goes one step back (to ${prev})`, ok, JSON.stringify(s))
}

// Shift + digit: the digit is the tab's number in the bar; visit them in a scrambled order
const order = TABS.map((_, k) => k).sort((a, b) => ((a * 5) % TABS.length) - ((b * 5) % TABS.length) || a - b)
let lastTab = TABS[order[order.length - 1]]
for (const k of order) {
  const tab = TABS[k]
  await page.keyboard.press(`Shift+Digit${k + 1}`); await settle(1500); s = await state()
  check(`Shift + ${k + 1} jumps to ${tab} at once`, s.panels.join() === tab, JSON.stringify(s))
  if (tab === 'research') {
    await settle(2500)   // the rows come in one after another
    const rows = await page.evaluate((P) => [...document.querySelectorAll(`.${P}-ritem`)].map((r) => { const c = getComputedStyle(r); const b = r.getBoundingClientRect(); return { shown: c.visibility !== 'hidden' && Number(c.opacity) > 0.85, text: r.innerText.replace(/\s+/g, ' ').trim(), bottom: Math.round(b.bottom) } }), P)
    const n = tour.research.items.length
    check(`the Research tab shows ${n} rows, each a sentence and its source`, rows.length === n && rows.every((r) => r.shown) && tour.research.items.every((it, x) => norm(rows[x]?.text ?? '').includes(norm(it.source).slice(0, 24))), JSON.stringify(rows.map((r) => r.text.slice(0, 40))))
    check(`the ${n} research rows fit inside the 900 px stage`, rows.every((r) => r.bottom <= 900), JSON.stringify(rows.map((r) => r.bottom)))
  }
}
await page.keyboard.press(`Shift+Digit${TABS.length + 1}`); await settle(900); s = await state()
check(`Shift + ${TABS.length + 1} does nothing (there are ${TABS.length} tabs)`, s.panels.join() === lastTab, JSON.stringify(s))

// a click on a tab jumps without playing the tabs in between
await page.click(`.${P}-tab[data-tab="roles"]`); await settle(300)
const mid = await state()
await settle(1300); s = await state()
check('a click on Roles shows Roles (and the tabs in between never show)', s.panels.join() === 'roles' && !mid.panels.some((p) => ['features', 'intelligence', 'problem'].includes(p)), `soon: ${JSON.stringify(mid)} later: ${JSON.stringify(s)}`)
const roleI = Math.min(3, LAST_ROLE)
await page.click(`.${P}-rolebtn[data-i="${roleI}"]`); await settle(1500); s = await state()
check('a click on a role in the list opens that role', s.role.join() === String(roleI), JSON.stringify(s))
await page.click(`.${P}-tab[data-tab="features"]`); await settle(1500)
const groupI = Math.min(2, tour.features.groups.length - 1)
await page.click(`.${P}-gchip[data-i="${groupI}"]`); await settle(1500); s = await state()
check('a click on a feature group opens that group', s.group.join() === String(groupI), JSON.stringify(s))

// plain digits are still "open this product"
await page.keyboard.press(coreKey); await settle(1500)
check(`plain ${coreKey} still opens Scholar ${family[0].toUpperCase()}${family.slice(1)} (its opener, slide ${posOf(openerSlide)})`, here(openerSlide).test(await counter()), await counter())
if (!isLast) {
  await page.keyboard.press(nextKey); await settle(1500)
  check(`plain ${nextKey} still opens ${nextOpener.title} (its opener, slide ${posOf(nextOpener)})`, here(nextOpener).test(await counter()), await counter())
  await page.keyboard.press('Shift+Digit3'); await settle(800)
  check('Shift + 3 on a slide that is not a tour does nothing', here(nextOpener).test(await counter()), await counter())
  await page.keyboard.press('ArrowLeft'); await settle(2800)
} else {
  // the last product: the plain digit 1 opens the first product; then jump to the last step of this tour, and Next / Back around the closing invitation
  await page.keyboard.press('1'); await settle(1500)
  check('plain 1 still opens the first product from here', /^\d+\/\d+$/.test(await counter()) && !here(openerSlide).test(await counter()), await counter())
  await open(slide, 99)
  await page.keyboard.press('ArrowRight'); await settle(1500)
  check(`Next from the last step leaves for ${nextOpener.title}`, here(nextOpener).test(await counter()), await counter())
  await page.keyboard.press('ArrowLeft'); await settle(2800)
}
s = await state()
check('Back from the next slide lands on the tour at its last step (the last role)', here(tourSlide).test(await counter()) && s.role.join() === String(LAST_ROLE), `${await counter()} ${JSON.stringify(s)}`)
if (!isLast) {
  await page.keyboard.press('ArrowRight'); await settle(1200)
  check(`Next from the last step leaves for ${nextOpener.title}`, here(nextOpener).test(await counter()), await counter())
}

// deep links
const beatG1 = STEPS.indexOf('features/g1')   // the beat of the second feature group (every tour has at least two groups or this check is skipped)
if (beatG1 > 0) {
  await open(slide, beatG1)
  s = await state(); check(`?slide=<n>&beat=${beatG1} opens the Features tab, second group`, s.panels.join() === 'features' && s.group.join() === '1', JSON.stringify(s))
}
await open(slide, 99)
s = await state(); check('a beat past the end is clamped to the last step', s.role.join() === String(LAST_ROLE), JSON.stringify(s))

// presenter window: the script of the tab that is showing
await open(slide)
const popup = ctx.waitForEvent('page', { timeout: 10000 })
await page.keyboard.press('p'); const pres = await popup
await pres.waitForSelector('.cp-presenter', { timeout: 60000 }); await pres.waitForTimeout(2500)
let text = await pres.evaluate(() => document.querySelector('.cp-presenter')?.innerText ?? '')
check('the presenter shows the Summary script and the tab name', norm(text).includes(norm(PRESENTER.summary).slice(0, 40)) && /tab: Summary/i.test(text), text.slice(0, 160).replace(/\s+/g, ' '))
await page.keyboard.press('Shift+Digit3'); await settle(1500); await pres.waitForTimeout(1200)
text = await pres.evaluate(() => document.querySelector('.cp-presenter')?.innerText ?? '')
check('after Shift + 3 the presenter follows to the Intelligence script', norm(text).includes(norm(PRESENTER.intelligence).slice(0, 40)) && /tab: Intelligence/i.test(text), text.slice(0, 160).replace(/\s+/g, ' '))

check('no page errors', errors.length === 0, [...new Set(errors)].join(' | '))
check('nothing tried to leave the local server', blocked.size === 0, [...blocked].join(' '))
await browser.close()
console.log(failed ? `${failed} check(s) FAILED` : 'all checks passed')
process.exit(failed ? 1 : 0)
