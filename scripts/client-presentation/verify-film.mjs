// Plays the film as the deck does (slide 6 of 17) in the installed Google Chrome, which decodes H.264 (the Chromium that Playwright ships does not).
//   node scripts/client-presentation/verify-film.mjs [--base http://localhost:3210] [--out <dir for two screenshots>]
// Checks, at 1920x1080 and at 1100x620: the video starts by itself (not paused, time advancing), is 1920x1080 and about 59 s long, and fills the
// stage. Exit 1 on any failure. Needs public/client-presentation/film/scholarclone-59s.mp4 (register-film.mjs --publish).
import { createRequire } from 'node:module'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const base = arg('base', 'http://localhost:3210'); const out = arg('out', null)
const require = createRequire('C:/Users/MILAN/Downloads/lms_k12/')
const { chromium } = require('playwright-core')
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
if (!exe) { console.log('FAIL no Chrome or Edge found'); process.exit(1) }
if (out) mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: exe, headless: true })
const fails = []
for (const vp of [{ width: 1920, height: 1080 }, { width: 1100, height: 620 }]) {
  const ctx = await browser.newContext({ viewport: vp })
  await ctx.addCookies([{ name: 'gtg-session', value: '1', domain: new URL(base).hostname, path: '/' }])
  await ctx.addInitScript(() => {
    localStorage.setItem('userData', JSON.stringify({ user_id: 1, token: 'local-test-session', sub_institute_id: 6, syear: 2026 }))
    localStorage.setItem('gtg-session', JSON.stringify({ user: { id: 1, email: 'test@local', name: 'Local test', role: 'admin', profileName: 'Admin', subInstituteId: 6, syear: 2026 }, isAuthenticated: true, isLoading: false }))
  })
  const page = await ctx.newPage()
  await page.goto(`${base}/module/lms/learning/client-presentation/scholarclone?slide=17&beat=0`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForSelector('.s17-video', { timeout: 30000 })
  await page.waitForTimeout(3500)
  const a = await page.evaluate(() => { const v = document.querySelector('.s17-video'); const fr = document.querySelector('.cp-frame').getBoundingClientRect(); const r = v.getBoundingClientRect(); return { t: v.currentTime, paused: v.paused, ready: v.readyState, w: v.videoWidth, h: v.videoHeight, d: v.duration, err: v.error && v.error.code, dw: Math.abs(fr.width - r.width), dh: Math.abs(fr.height - r.height) } })
  const tag = `${vp.width}x${vp.height}`
  if (a.err) fails.push(`${tag}: the video reports error ${a.err}`)
  if (a.paused || a.t < 1.5) fails.push(`${tag}: the film did not start by itself (paused ${a.paused}, time ${a.t.toFixed(2)})`)
  if (a.w !== 1920 || a.h !== 1080) fails.push(`${tag}: video is ${a.w}x${a.h}`)
  if (Math.abs(a.d - 59) > 0.3) fails.push(`${tag}: duration ${a.d}`)
  if (a.dw > 2 || a.dh > 2) fails.push(`${tag}: the video does not fill the stage (off by ${a.dw.toFixed(0)} x ${a.dh.toFixed(0)} px)`)
  console.log(tag, JSON.stringify(a))
  if (out && vp.width === 1100) {
    await page.screenshot({ path: join(out, 'film-in-deck-1100.png') })
    await page.evaluate(() => { const v = document.querySelector('.s17-video'); v.currentTime = 36; }); await page.waitForTimeout(1200)
    await page.screenshot({ path: join(out, 'film-in-deck-1100-t36.png') })
  }
  await ctx.close()
}
await browser.close()
if (fails.length) { for (const f of fails) console.log('FAIL ' + f); process.exit(1) }
console.log('film plays by itself and fits: ok')
