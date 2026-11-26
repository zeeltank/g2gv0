// Checks the product tour the way a person uses it, in the real player (not the render route).
//   node scripts/client-presentation/verify-tour.mjs [--base http://127.0.0.1:3412] [--slide 203]
// For the first product tour: Next/Back through every beat, a click on every tab, Shift + digit, plain digits 1 to 5 still opening products,
// Back from the next product landing on the tour's last beat, the presenter window showing the script of the tab that is showing, and no page errors.
// Exit code 1 if anything fails. Needs a dev or production server and playwright-core (borrowed from the lms_k12 checkout).
import { createRequire } from 'node:module'
import { readdirSync } from 'node:fs'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const base = arg('base', 'http://127.0.0.1:3412'); const slide = Number(arg('slide', 203))
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
await ctx.route('**/*', (route) => { const u = new URL(route.request().url()); if (u.hostname === new URL(base).hostname) return route.continue(); blocked.add(u.origin); return route.abort() })
const page = await ctx.newPage(); const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
let failed = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`); if (!ok) failed++ }
const settle = (ms = 1800) => page.waitForTimeout(ms)
const counter = () => page.evaluate(() => document.querySelector('.cp-ui-pill span')?.textContent?.trim() ?? '')
// which tab panel is showing, and which group / role inside it
const state = () => page.evaluate(() => {
  const vis = (el) => { const c = getComputedStyle(el); return c.visibility !== 'hidden' && Number(c.opacity) > 0.85 }
  const panels = [...document.querySelectorAll('.tr-panel')].filter(vis).map((p) => p.dataset.tab)
  const group = [...document.querySelectorAll('.tr-group')].filter(vis).map((g) => Number(g.dataset.i))
  const role = [...document.querySelectorAll('.tr-role')].filter(vis).map((g) => Number(g.dataset.i))
  return { panels, group, role }
})
const open = async (n, beat) => { await page.goto(`${base}/module/lms/learning/client-presentation/scholarclone?slide=${n}${beat ? `&beat=${beat}` : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await page.waitForSelector('.cp-scene', { timeout: 120000 }); await settle(2200) }

await open(slide)
check('the tour opens on slide 19 of 39', /^19\/39$/.test(await counter()), await counter())
let s = await state()
check('it opens on the Summary tab', s.panels.join() === 'summary', JSON.stringify(s))
const tabs = await page.evaluate(() => [...document.querySelectorAll('.tr-tab')].map((t) => t.dataset.tab))
check('the bar shows six tabs (Research is hidden: no data yet)', tabs.join() === 'summary,problem,intelligence,ai,features,roles', tabs.join())

// Next through every beat (the richest steps take about 2.6 s to settle, so wait for them)
const seenTabs = []
for (let i = 0; i < 14; i++) { await page.keyboard.press('ArrowRight'); await settle(i < 4 ? 3200 : 3000); const st = await state(); seenTabs.push(st.panels[0] + (st.group.length ? `/g${st.group[0]}` : '') + (st.role.length ? `/r${st.role[0]}` : '')) }
const want = ['problem', 'intelligence', 'ai', 'features/g0', 'features/g1', 'features/g2', 'features/g3', 'features/g4', 'roles/r0', 'roles/r1', 'roles/r2', 'roles/r3', 'roles/r4', 'roles/r5']
check('Next walks the 14 steps in order: problem, intelligence, AI, five feature groups, six roles', seenTabs.join() === want.join(), seenTabs.join(' '))
check('still the same slide after 14 presses', /^19\/39$/.test(await counter()), await counter())
await page.keyboard.press('ArrowLeft'); await settle(2600)
s = await state(); check('Back goes one step back (role 6 -> role 5)', s.role.join() === '4', JSON.stringify(s))

// Shift + digit
for (const [digit, tab] of [['Digit3', 'intelligence'], ['Digit1', 'summary'], ['Digit5', 'features'], ['Digit6', 'roles'], ['Digit2', 'problem'], ['Digit4', 'ai']]) {
  await page.keyboard.press(`Shift+${digit}`); await settle(1500); s = await state()
  check(`Shift + ${digit.slice(-1)} jumps to ${tab} at once`, s.panels.join() === tab, JSON.stringify(s))
}
await page.keyboard.press('Shift+Digit7'); await settle(900); s = await state()
check('Shift + 7 does nothing (there are six tabs)', s.panels.join() === 'ai', JSON.stringify(s))

// a click on a tab jumps without playing the tabs in between
await page.click('.tr-tab[data-tab="roles"]'); await settle(300)
const mid = await state()
await settle(1300); s = await state()
check('a click on Roles shows Roles (and the tabs in between never show)', s.panels.join() === 'roles' && !mid.panels.some((p) => ['features', 'intelligence', 'problem'].includes(p)), `soon: ${JSON.stringify(mid)} later: ${JSON.stringify(s)}`)
await page.click('.tr-rolebtn[data-i="3"]'); await settle(1500); s = await state()
check('a click on a role in the list opens that role', s.role.join() === '3', JSON.stringify(s))
await page.click('.tr-tab[data-tab="features"]'); await settle(1500)
await page.click('.tr-gchip[data-i="2"]'); await settle(1500); s = await state()
check('a click on a feature group opens that group', s.group.join() === '2', JSON.stringify(s))

// plain digits are still "open this product"
await page.keyboard.press('1'); await settle(1500)
check('plain 1 still opens Scholar Core (its opener, slide 18)', /^18\/39$/.test(await counter()), await counter())
await page.keyboard.press('2'); await settle(1500)
check('plain 2 still opens Scholar Learn (its opener, slide 20)', /^20\/39$/.test(await counter()), await counter())
await page.keyboard.press('Shift+Digit3'); await settle(800)
check('Shift + 3 on a slide that is not a tour does nothing', /^20\/39$/.test(await counter()), await counter())
await page.keyboard.press('ArrowLeft'); await settle(2800)
s = await state()
check('Back from the next product lands on the tour at its last step (role 6)', /^19\/39$/.test(await counter()) && s.role.join() === '5', `${await counter()} ${JSON.stringify(s)}`)
await page.keyboard.press('ArrowRight'); await settle(1200)
check('Next from the last step leaves for Scholar Learn', /^20\/39$/.test(await counter()), await counter())

// deep links
await open(slide, 5)
s = await state(); check('?slide=203&beat=5 opens the Features tab, second group', s.panels.join() === 'features' && s.group.join() === '1', JSON.stringify(s))
await open(slide, 99)
s = await state(); check('a beat past the end is clamped to the last step', s.role.join() === '5', JSON.stringify(s))

// presenter window: the script of the tab that is showing
await open(slide)
const popup = ctx.waitForEvent('page', { timeout: 10000 })
await page.keyboard.press('p'); const pres = await popup
await pres.waitForSelector('.cp-presenter', { timeout: 60000 }); await pres.waitForTimeout(2500)
let text = await pres.evaluate(() => document.querySelector('.cp-presenter')?.innerText ?? '')
check('the presenter shows the Summary script and the tab name', /Let the three lines land one at a time/.test(text) && /tab: Summary/i.test(text), text.slice(0, 160).replace(/\s+/g, ' '))
await page.keyboard.press('Shift+Digit3'); await settle(1500); await pres.waitForTimeout(1200)
text = await pres.evaluate(() => document.querySelector('.cp-presenter')?.innerText ?? '')
check('after Shift + 3 the presenter follows to the Intelligence script', /questions, not predictions/.test(text) && /tab: Intelligence/i.test(text), text.slice(0, 160).replace(/\s+/g, ' '))

check('no page errors', errors.length === 0, [...new Set(errors)].join(' | '))
check('nothing tried to leave the local server', blocked.size === 0, [...blocked].join(' '))
await browser.close()
console.log(failed ? `${failed} check(s) FAILED` : 'all checks passed')
process.exit(failed ? 1 : 0)
