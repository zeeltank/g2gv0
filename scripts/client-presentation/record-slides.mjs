// Records the real, animated web deck slide by slide, for the Motion PowerPoint.
//   node scripts/client-presentation/record-slides.mjs [--base http://localhost:3210] [--out D:/client-presentation-assets/slides-motion] [--width 1600]
// One Chromium window at 1920 x 1080 plays the deck from slide 1 to the end with Next at a steady pace (entrance, then every step),
// while Playwright records the whole run. The run is then cut into one MP4 per slide (H.264, yuv420p, no audio) with a poster from the
// last frame, and the positions of the clickable chips and tiles (slide 4 and slide 6) are written to manifest.json so the PowerPoint can
// link them. Slide 16 ("See it work") is not cut: its clips come from the rendered explainer files.
// The shell's own controls and the dev badge are hidden. Real time, not frame stepping: the deck animates with GSAP and framer-motion on the clock.
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const base = arg('base', 'http://localhost:3210')
const out = arg('out', 'D:/client-presentation-assets/slides-motion')
const outW = Number(arg('width', 1600)); const outH = Math.round((outW * 9) / 16)
const crf = Number(arg('crf', 24))
const ORDER = [1, 2, 3, 4, 5, 6, 16, 7, 8, 9, 10, 11, 12, 13, 14, 15] // slide numbers in the order of play
const BEATS = { 1: 2, 2: 2, 3: 2, 4: 8, 5: 2, 6: 4, 7: 3, 8: 7, 9: 2, 10: 6, 11: 3, 12: 3, 13: 3, 14: 5, 15: 1, 16: 4 }
const ENTRANCE = 2.8; const STEP = 2.2; const HOLD = 2.2

const require = createRequire('C:/Users/MILAN/Downloads/lms_k12/')
const { chromium } = require('playwright-core')
const ffmpeg = createRequire('D:/client-presentation-assets/_video/')('ffmpeg-static')
const exe = readdirSync(process.env.LOCALAPPDATA + '/ms-playwright').filter((d) => d.startsWith('chromium-') && !d.includes('headless')).map((d) => `${process.env.LOCALAPPDATA}/ms-playwright/${d}/chrome-win64/chrome.exe`)[0]
const raw = join(out, 'raw'); mkdirSync(raw, { recursive: true })

const browser = await chromium.launch({ executablePath: exe, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, recordVideo: { dir: raw, size: { width: 1920, height: 1080 } } })
await ctx.addCookies([{ name: 'gtg-session', value: '1', domain: new URL(base).hostname, path: '/' }])
await ctx.addInitScript(() => {
  localStorage.setItem('userData', JSON.stringify({ user_id: 1, token: 'local-test-session', sub_institute_id: 6, syear: 2026 }))
  localStorage.setItem('gtg-session', JSON.stringify({ user: { id: 1, email: 'test@local', name: 'Local test', role: 'admin', profileName: 'Admin', subInstituteId: 6, syear: 2026 }, isAuthenticated: true, isLoading: false }))
})
const t0 = Date.now()
const page = await ctx.newPage()
const now = () => (Date.now() - t0) / 1000
await page.goto(`${base}/module/lms/learning/client-presentation/scholarclone?slide=1&beat=0`, { waitUntil: 'networkidle' })
await page.addStyleTag({ content: '.cp-ui, .cp-progress, nextjs-portal, [data-next-badge-root] { display: none !important }' })
await page.evaluate(() => document.fonts.ready)
await page.mouse.move(5, 5)

const marks = {}; const hotspots = {}
const wait = (s) => page.waitForTimeout(Math.round(s * 1000))
for (let i = 0; i < ORDER.length; i++) {
  const n = ORDER[i]
  marks[n] = { start: now() }
  await wait(ENTRANCE)
  if (n === 16) {
    for (let b = 0; b < BEATS[n]; b++) { await page.keyboard.press('ArrowRight'); await wait(0.3) }
  } else {
    for (let b = 0; b < BEATS[n]; b++) { await page.keyboard.press('ArrowRight'); await wait(STEP) }
  }
  if (n === 4 || n === 6) {
    // The chips (slide 4) and product tiles (slide 6) the PowerPoint links to, in stage pixels.
    hotspots[n] = await page.evaluate(() => [...document.querySelectorAll('.cp-scene button')].map((b) => { const r = b.getBoundingClientRect(); return { text: b.innerText.replace(/\s+/g, ' ').trim().slice(0, 60), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } }).filter((h) => h.w > 80 && h.h > 40))
  }
  await wait(n === 16 ? 0.2 : HOLD)
  marks[n].end = now()
  if (i < ORDER.length - 1) await page.keyboard.press('ArrowRight') // into the next slide (its entrance starts here)
}
const video = page.video()
await ctx.close(); await browser.close()
const rawFile = await video.path()
console.log('raw recording', rawFile, `${(statSync(rawFile).size / 1048576).toFixed(1)} MB`, `${now().toFixed(0)} s`)

const manifest = { recorded: new Date().toISOString().slice(0, 10), width: outW, height: outH, slides: {}, hotspots }
for (const n of ORDER) {
  if (n === 16) continue
  const id = String(n).padStart(2, '0')
  const file = join(out, `s${id}.mp4`); const poster = join(out, `s${id}-poster.jpg`)
  const start = marks[n].start + (n === 1 ? 0.3 : 0.12); const dur = marks[n].end - start
  execFileSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', start.toFixed(2), '-t', dur.toFixed(2), '-i', rawFile, '-vf', `scale=${outW}:${outH}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-r', '30', '-movflags', '+faststart', '-an', file])
  execFileSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', Math.max(0, dur - 0.15).toFixed(2), '-i', file, '-frames:v', '1', '-q:v', '3', poster])
  manifest.slides[n] = { file: `s${id}.mp4`, poster: `s${id}-poster.jpg`, seconds: +dur.toFixed(2), bytes: statSync(file).size }
  console.log(`s${id}  ${dur.toFixed(1)} s  ${(statSync(file).size / 1048576).toFixed(2)} MB`)
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1))
console.log('manifest written;', Object.keys(hotspots).map((k) => `slide ${k}: ${hotspots[k].length} hotspots`).join(', '))
