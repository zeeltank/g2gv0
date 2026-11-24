// Dev harness: opens the client presentation in a real Chromium, signed in with a local test session, and saves screenshots.
//   node scripts/client-presentation/shoot.mjs --out <dir> [--base http://localhost:3210] [--vp 1920x1080] [--slides 1,4,5] [--beats all|last|0,1,2]
//        [--short] [--reduced] [--live] [--wait 600]
// Needs a dev server running and playwright-core (borrowed from the lms_k12 checkout) with a Chromium in %LOCALAPPDATA%\ms-playwright.
// The test session is built in the browser only (a presence cookie and two local-storage entries, as the app's own gate expects);
// it holds no token and no data, and the deck makes no API calls. Reports console errors and page errors.
import { createRequire } from 'node:module'
import { mkdirSync, readdirSync } from 'node:fs'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1]?.startsWith('--') || process.argv[i + 1] === undefined ? true : process.argv[i + 1]) }
const out = arg('out', 'shots'); const base = arg('base', 'http://localhost:3210')
const [W, H] = String(arg('vp', '1920x1080')).split('x').map(Number)
const slides = String(arg('slides', '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15')).split(',').map(Number)
const beatsArg = String(arg('beats', 'last')); const short = process.argv.includes('--short'); const reduced = process.argv.includes('--reduced'); const live = process.argv.includes('--live')
const settle = Number(arg('wait', 700))
const BEATS = { 1: 2, 2: 2, 3: 2, 4: 8, 5: 2, 6: 4, 7: 3, 8: 7, 9: 2, 10: 6, 11: 3, 12: 3, 13: 3, 14: 5, 15: 1 }

const require = createRequire('C:/Users/MILAN/Downloads/lms_k12/')
const { chromium } = require('playwright-core')
const exe = readdirSync(process.env.LOCALAPPDATA + '/ms-playwright').filter((d) => d.startsWith('chromium-') && !d.includes('headless')).map((d) => `${process.env.LOCALAPPDATA}/ms-playwright/${d}/chrome-win64/chrome.exe`)[0]
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: exe, headless: true })
const ctx = await browser.newContext({ viewport: { width: W, height: H }, reducedMotion: reduced ? 'reduce' : 'no-preference' })
const host = new URL(base).hostname
await ctx.addCookies([{ name: 'gtg-session', value: '1', domain: host, path: '/' }])
await ctx.addInitScript(() => {
  localStorage.setItem('userData', JSON.stringify({ user_id: 1, token: 'local-test-session', sub_institute_id: 6, syear: 2026 }))
  localStorage.setItem('gtg-session', JSON.stringify({ user: { id: 1, email: 'test@local', name: 'Local test', role: 'admin', profileName: 'Admin', subInstituteId: 6, syear: 2026 }, isAuthenticated: true, isLoading: false }))
})
const page = await ctx.newPage()
const problems = []
page.on('pageerror', (e) => problems.push('PAGEERROR ' + String(e).slice(0, 220)))
page.on('console', (m) => { if (m.type() === 'error') problems.push('CONSOLE ' + m.text().slice(0, 220)) })
page.on('requestfailed', (r) => { if (/client-presentation|_next\/static|font/.test(r.url())) problems.push('REQFAILED ' + r.url().slice(0, 140)) })

const press = arg('press', null)
if (press) {
  // Keyboard walk (for scenes with no deep link, such as the five-slide version): open, press Next N times, shoot.
  await page.goto(`${base}/module/lms/learning/client-presentation/scholarclone?mode=short`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForSelector('.cp-scene', { timeout: 90000 })
  for (const k of String(press).split(',').map(Number)) {
    for (let i = 0; i < k; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250) }
    await page.waitForTimeout(settle + 1200)
    const file = `${out}/short-press-${k}.png`
    await page.screenshot({ path: file }); console.log('shot', file)
  }
  console.log(problems.length ? 'PROBLEMS: ' + [...new Set(problems)].join(' | ') : 'no console or page errors')
  await browser.close(); process.exit(0)
}
for (const n of slides) {
  const max = BEATS[n]
  const list = beatsArg === 'all' ? Array.from({ length: max + 1 }, (_, i) => i) : beatsArg === 'last' ? [max] : beatsArg.split(',').map(Number)
  for (const b of list) {
    const url = `${base}/module/lms/learning/client-presentation/scholarclone?slide=${n}&beat=${b}${short ? '&mode=short' : ''}`
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForSelector('.cp-scene', { timeout: 90000 })
    await page.waitForTimeout(live ? 1500 : settle)
    const file = `${out}/s${String(n).padStart(2, '0')}-b${b}${reduced ? '-reduced' : ''}.png`
    await page.screenshot({ path: file })
    console.log('shot', file)
  }
}
console.log(problems.length ? 'PROBLEMS:\n' + [...new Set(problems)].join('\n') : 'no console or page errors')
await browser.close()
