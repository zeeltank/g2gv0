// Renders Product Atlas slides to MP4 for the PowerPoint (PowerPoint cannot run the web deck's motion).
//   node scripts/client-presentation/render-atlas.mjs --name atlas-summary --keys a1,a2 [--hold 3.6] [--out D:/client-presentation-assets/atlas-video] [--base http://localhost:3210]
// Each slide is opened on its own page (atlas/[key]), which hands its whole GSAP timeline to window.__atlasTl; this script steps the timeline by time:
// for every beat it plays from the previous label to the next one at natural speed and then holds the finished state, so the video shows each
// step of the slide (and each sub-module of a spotlight) the way a presenter would click through it. Frames are captured through the DevTools
// protocol and piped to ffmpeg (H.264 High, BT.709, yuv420p, faststart, no audio). A <name>.lock file stops two renders of one name at once.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const base = arg('base', 'http://localhost:3210'); const outDir = arg('out', 'D:/client-presentation-assets/atlas-video')
const name = arg('name', null); const keys = arg('keys', '')?.split(',').filter(Boolean)
const holdSubs = Number(arg('hold', 3.6)); const fps = Number(arg('fps', 30)); const crf = Number(arg('crf', 24))
if (!name || !keys.length) { console.log('usage: --name <file> --keys a1,a2'); process.exit(1) }
mkdirSync(outDir, { recursive: true })
const plan = JSON.parse(readFileSync(new URL('../../lib/client-presentation/generated/atlas-plan.json', import.meta.url), 'utf8'))
const HOLD = { hub: 3.5, opener: 4.2, glance: 3.6, subs: holdSubs, gallery: 3.4 }

const require = createRequire('C:/Users/MILAN/Downloads/lms_k12/')
const { chromium } = require('playwright-core')
const ffmpeg = createRequire('D:/client-presentation-assets/_video/')('ffmpeg-static')
const lock = join(outDir, `${name}.lock`)
try { writeFileSync(lock, String(process.pid), { flag: 'wx' }) } catch { console.log(`FAIL: ${lock} exists: another render of this name is running (or crashed)`); process.exit(1) }

// The installed Google Chrome on the NVIDIA GPU (the same flags as film-studio/render.mjs): the web slides use blur, 3D transforms and big images, which crash the software renderer of Playwright's own Chromium when stepped frame by frame.
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-angle=d3d11', '--force_high_performance_gpu', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await ctx.addCookies([{ name: 'gtg-session', value: '1', domain: new URL(base).hostname, path: '/' }])
await ctx.addInitScript(() => {
  localStorage.setItem('userData', JSON.stringify({ user_id: 1, token: 'local-test-session', sub_institute_id: 6, syear: 2026 }))
  localStorage.setItem('gtg-session', JSON.stringify({ user: { id: 1, email: 'test@local', name: 'Local test', role: 'admin', profileName: 'Admin', subInstituteId: 6, syear: 2026 }, isAuthenticated: true, isLoading: false }))
})
const page = await ctx.newPage(); const errs = []
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
const cdp = await ctx.newCDPSession(page)
const grab = async () => Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true })).data, 'base64')

const file = join(outDir, `${name}.mp4`)
const vf = 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p'
const ff = spawn(ffmpeg, ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', '-vf', vf, '-r', String(fps), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', String(crf), '-maxrate', '1100k', '-bufsize', '2200k', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', file], { stdio: ['pipe', 'ignore', 'pipe'] })
let ffErr = ''; ff.stderr.on('data', (d) => { ffErr += d })
const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c + '\n' + ffErr.slice(-600))))))
const write = async (buf) => { if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r)) }

let frames = 0; let posterDone = false
for (const key of keys) {
  const slide = plan.find((s) => s.key === key); if (!slide) throw new Error('no atlas slide ' + key)
  await page.goto(`${base}/module/lms/learning/client-presentation/atlas/${key}`, { waitUntil: 'domcontentloaded', timeout: 180000 })
  try { await page.waitForFunction(() => Boolean(window.__atlasTl), null, { timeout: 120000 }) } catch (e) { await page.screenshot({ path: join(outDir, `${name}-fail.png`) }); console.log('page errors:', errs.join(' | ') || 'none', '| url', page.url(), '| render flag', await page.evaluate(() => String(window.__atlasRender)).catch(() => '?')); throw e }
  await page.evaluate(() => document.fonts.ready); await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))))
  const labels = await page.evaluate(() => { const tl = window.__atlasTl; tl.pause(); return Object.entries(tl.labels).filter(([k]) => /^b\d+$/.test(k)).sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1))).map(([, t]) => t) })
  const times = []; const hold = Math.round((HOLD[slide.kind] ?? 3) * fps)
  let prev = 0
  labels.forEach((t, k) => {
    const n = Math.max(1, Math.round((t - prev) * fps))
    for (let i = 1; i <= n; i++) times.push(prev + ((t - prev) * i) / n)
    for (let i = 0; i < (k === 0 && slide.kind === 'subs' ? Math.round(hold * 0.7) : hold); i++) times.push(t)
    prev = t
  })
  console.log(`${key} ${slide.kind}: ${labels.length} beats, ${times.length} frames`)
  for (let i = 0; i < times.length; i++) {
    await page.evaluate((t) => { window.__atlasTl.time(t, false) }, times[i])      // no return value: a GSAP timeline cannot be serialised back to the script (it crashed the page)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await write(await grab()); frames++
    if (!posterDone && i === Math.round(labels[0] * fps) + 2) { await page.screenshot({ path: join(outDir, `${name}-poster.jpg`), type: 'jpeg', quality: 90 }); posterDone = true }
  }
}
ff.stdin.end(); await done; await browser.close(); unlinkSync(lock)
console.log(JSON.stringify({ file, frames, seconds: +(frames / fps).toFixed(1), errs }))
