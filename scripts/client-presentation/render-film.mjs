// Renders the 59-second film (…/client-presentation/film?render=1) frame by frame to H.264.
//   node scripts/client-presentation/render-film.mjs [--base http://localhost:3210] [--out D:/client-presentation-assets/film-out]
//        [--fps 30] [--crf 20] [--blur windows|off] [--stills 2,3.5,7] [--from 0] [--to 59] [--name scholarclone-59s]
// Method: the page exposes window.__clip.seek(t). For every 1/fps second the script seeks, waits two animation frames, screenshots, and
// pipes the JPEG to ffmpeg (BT.709, yuv420p, faststart, no audio). Nothing is recorded in real time, so a render is repeatable.
// --blur windows: inside the fast windows listed in film-scenes.tsx (seams, camera whips) four sub-frames are taken across a 180-degree
// shutter and averaged by ffmpeg (tmix); outside them each frame is repeated four times, so the average is the frame itself.
// --stills: only save PNGs at those seconds, for reviewing the design without encoding. Privacy guard as in render-clip.mjs.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const base = arg('base', 'http://localhost:3210')
const outDir = arg('out', 'D:/client-presentation-assets/film-out')
const fps = Number(arg('fps', 30))
const crf = Number(arg('crf', 20))
const blur = arg('blur', 'off') === 'windows'
const stills = arg('stills', null)?.split(',').map(Number)
const from = Number(arg('from', 0))
const name = arg('name', 'scholarclone-59s')
// Keep in step with FILM_BLUR_WINDOWS in components/domain/lms/client-presentation/film/film-scenes.tsx.
const WINDOWS = [[3.2, 4.0], [9.5, 10.9], [18.0, 19.0], [24.7, 25.3], [32.3, 32.6], [39.7, 40.3], [44.9, 46.0], [51.2, 51.6]]
const inWindow = (t) => WINDOWS.some(([a, b]) => t >= a && t <= b)

const require = createRequire('C:/Users/MILAN/Downloads/lms_k12/')
const { chromium } = require('playwright-core')
const ffmpeg = createRequire('D:/client-presentation-assets/_video/')('ffmpeg-static')
const exe = readdirSync(process.env.LOCALAPPDATA + '/ms-playwright').filter((d) => d.startsWith('chromium-') && !d.includes('headless')).map((d) => `${process.env.LOCALAPPDATA}/ms-playwright/${d}/chrome-win64/chrome.exe`)[0]
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ executablePath: exe, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' })
await ctx.addCookies([{ name: 'gtg-session', value: '1', domain: new URL(base).hostname, path: '/' }])
await ctx.addInitScript(() => {
  localStorage.setItem('userData', JSON.stringify({ user_id: 1, token: 'local-test-session', sub_institute_id: 6, syear: 2026 }))
  localStorage.setItem('gtg-session', JSON.stringify({ user: { id: 1, email: 'test@local', name: 'Local test', role: 'admin', profileName: 'Admin', subInstituteId: 6, syear: 2026 }, isAuthenticated: true, isLoading: false }))
})
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e).slice(0, 240)))
await page.goto(`${base}/module/lms/learning/client-presentation/film?render=1`, { waitUntil: 'networkidle', timeout: 120000 })
await page.waitForFunction(() => window.__clip && window.__clip.ready, null, { timeout: 60000 })
await page.evaluate(() => document.fonts.ready)
await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))))
await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important }' })
const text = await page.evaluate(() => document.body.innerText)
if (/[\w.+-]+@[\w-]+\.[\w.]+|(?:\+?\d[\d\s-]{8,}\d)/.test(text)) throw new Error('privacy guard: the film text holds an e-mail address or a phone number')
const duration = await page.evaluate(() => window.__clip.duration)
const to = Number(arg('to', Math.min(duration, 59)))
const step = async (t) => { await page.evaluate((x) => window.__clip.seek(x), t); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))) }

if (stills) {
  for (const t of stills) { await step(t); await page.screenshot({ path: join(outDir, `${name}-t${String(t).replace('.', '_')}.png`) }) }
  console.log(JSON.stringify({ stills: stills.length, errs }))
  await browser.close(); process.exit(errs.length ? 1 : 0)
}

const file = join(outDir, `${name}.mp4`)
const SUB = blur ? 4 : 1
const vf = blur
  ? `tmix=frames=4:weights='1 1 1 1',select='eq(mod(n\\,4)\\,3)',setpts=N/(${fps}*TB),scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p`
  : 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p'
const args = ['-y', '-f', 'image2pipe', '-framerate', String(fps * SUB), '-c:v', 'mjpeg', '-i', '-', '-vf', vf, '-r', String(fps), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-maxrate', '6M', '-bufsize', '12M', '-movflags', '+faststart', '-an', file]
const ff = spawn(ffmpeg, args, { stdio: ['pipe', 'ignore', 'pipe'] })
let ffErr = ''
ff.stderr.on('data', (d) => { ffErr += d })
const done = new Promise((res, rej) => { ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c + '\n' + ffErr.slice(-700)))) ) })
const write = async (buf) => { if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r)) }
const frames = Math.round((to - from) * fps)
const t0 = Date.now()
let extra = 0
for (let i = 0; i < frames; i++) {
  const t = from + i / fps
  if (blur && inWindow(t)) {
    for (let k = 0; k < SUB; k++) { await step(Math.max(0, t + ((k - 1.5) / SUB) * (0.5 / fps))); await write(await page.screenshot({ type: 'jpeg', quality: 94 })); extra++ }
  } else {
    await step(t)
    const jpg = await page.screenshot({ type: 'jpeg', quality: 94 })
    for (let k = 0; k < SUB; k++) await write(jpg)
  }
  if (i % 150 === 0) console.log(`frame ${i}/${frames}  t=${t.toFixed(1)} s  ${Math.round((Date.now() - t0) / 1000)} s elapsed`)
}
ff.stdin.end()
await done
await step(Math.min(duration - 1.4, 57.6))
await page.screenshot({ path: join(outDir, `${name}-poster.jpg`), type: 'jpeg', quality: 90 })
await browser.close()
const bytes = statSync(file).size
const report = { file, seconds: +(frames / fps).toFixed(2), frames, blurFrames: extra, bytes, mb: +(bytes / 1048576).toFixed(2), took_s: Math.round((Date.now() - t0) / 1000), errs }
writeFileSync(join(outDir, `${name}-render-report.json`), JSON.stringify(report, null, 1))
console.log(JSON.stringify(report))
if (errs.length) process.exit(1)
