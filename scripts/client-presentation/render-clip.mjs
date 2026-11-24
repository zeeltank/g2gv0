// Renders the product explainer clips to video, frame by frame, from the same React + GSAP page the slides use.
//   node scripts/client-presentation/render-clip.mjs [--clip core|learn|ccb|insight|compass|all] [--ratio v|h|both] [--ui hidden|shown|both]
//        [--base http://localhost:3210] [--out D:/client-presentation-assets/clips-out] [--fps 30] [--stills 1,4,8,12] [--crf 24]
// Method: the clip page (…/client-presentation/clip/<id>?render=1) exposes window.__clip.seek(t). The script opens it at the exact stage
// size (1080 x 1920 or 1920 x 1080), seeks to every 1/fps second, screenshots the page and pipes the JPEGs to ffmpeg (H.264, yuv420p,
// faststart, no audio). Nothing is recorded from a running product and no clock is involved, so every render is identical.
// --stills only saves PNGs at the given seconds (for reviewing a design without encoding).
// A privacy guard runs first: a page whose text holds an e-mail address or a phone number is not rendered.
// Needs: a dev server on --base, playwright-core from the lms_k12 checkout, ffmpeg-static installed in D:/client-presentation-assets/_video.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const base = arg('base', 'http://localhost:3210')
const outDir = arg('out', 'D:/client-presentation-assets/clips-out')
const fps = Number(arg('fps', 30))
const crf = Number(arg('crf', 20))
const stills = arg('stills', null)?.split(',').map(Number)
const IDS = ['core', 'learn', 'ccb', 'insight', 'compass']
const clips = arg('clip', 'all') === 'all' ? IDS : arg('clip', 'all').split(',')
const ratios = arg('ratio', 'both') === 'both' ? ['v', 'h'] : [arg('ratio', 'both')]
const uis = arg('ui', 'hidden') === 'both' ? ['hidden', 'shown'] : [arg('ui', 'hidden')]
const SIZE = { v: { width: 1080, height: 1920 }, h: { width: 1920, height: 1080 } }

const require = createRequire('C:/Users/MILAN/Downloads/lms_k12/')
const { chromium } = require('playwright-core')
const ffmpeg = createRequire('D:/client-presentation-assets/_video/')('ffmpeg-static')
const exe = readdirSync(process.env.LOCALAPPDATA + '/ms-playwright').filter((d) => d.startsWith('chromium-') && !d.includes('headless')).map((d) => `${process.env.LOCALAPPDATA}/ms-playwright/${d}/chrome-win64/chrome.exe`)[0]
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ executablePath: exe, headless: true })
const PRIVACY = /[\w.+-]+@[\w-]+\.[\w.]+|(?:\+?\d[\d\s-]{8,}\d)/
const report = []

async function oneRender(id, ratio, ui) {
  const ctx = await browser.newContext({ viewport: SIZE[ratio], deviceScaleFactor: 1, reducedMotion: 'no-preference' })
  await ctx.addCookies([{ name: 'gtg-session', value: '1', domain: new URL(base).hostname, path: '/' }])
  await ctx.addInitScript(() => {
    localStorage.setItem('userData', JSON.stringify({ user_id: 1, token: 'local-test-session', sub_institute_id: 6, syear: 2026 }))
    localStorage.setItem('gtg-session', JSON.stringify({ user: { id: 1, email: 'test@local', name: 'Local test', role: 'admin', profileName: 'Admin', subInstituteId: 6, syear: 2026 }, isAuthenticated: true, isLoading: false }))
  })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await page.goto(`${base}/module/lms/learning/client-presentation/clip/${id}?ratio=${ratio}&ui=${ui}&render=1`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__clip && window.__clip.ready, null, { timeout: 30000 })
  await page.evaluate(() => document.fonts.ready)
  await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important }' })
  const text = await page.evaluate(() => document.body.innerText)
  if (PRIVACY.test(text)) throw new Error(`privacy guard: ${id} text holds an e-mail address or a phone number`)
  const duration = await page.evaluate(() => window.__clip.duration)
  const step = async (t) => { await page.evaluate((x) => window.__clip.seek(x), t); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))) }
  const tag = `${id}-${ratio}-${ui}`

  if (stills) {
    for (const t of stills) { await step(t); await page.screenshot({ path: join(outDir, `${tag}-t${String(t).replace('.', '_')}.png`) }) }
    await ctx.close(); return { tag, stills: stills.length, errs }
  }

  const file = join(outDir, `${tag}.mp4`)
  const args = ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-maxrate', '2.4M', '-bufsize', '4M', '-movflags', '+faststart', '-an', file]
  const ff = spawn(ffmpeg, args, { stdio: ['pipe', 'ignore', 'pipe'] })
  let ffErr = ''
  ff.stderr.on('data', (d) => { ffErr += d })
  const done = new Promise((res, rej) => { ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c + '\n' + ffErr.slice(-600))))) })
  const frames = Math.round(duration * fps)
  for (let i = 0; i < frames; i++) {
    await step(i / fps)
    const jpg = await page.screenshot({ type: 'jpeg', quality: 94 })
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r))
  }
  ff.stdin.end()
  await done
  await step(12.2)
  await page.screenshot({ path: join(outDir, `${tag}-poster.jpg`), type: 'jpeg', quality: 90 })
  await ctx.close()
  const bytes = statSync(file).size
  return { tag, file, seconds: +duration.toFixed(2), frames, bytes, mb: +(bytes / 1048576).toFixed(2), errs }
}

for (const id of clips) for (const ratio of ratios) for (const ui of uis) {
  const t0 = Date.now()
  const r = await oneRender(id, ratio, ui)
  r.took_s = Math.round((Date.now() - t0) / 1000)
  report.push(r)
  console.log(JSON.stringify(r))
}
await browser.close()
writeFileSync(join(outDir, 'render-report.json'), JSON.stringify(report, null, 1))
const bad = report.filter((r) => r.errs.length)
if (bad.length) { console.log('PAGE ERRORS', JSON.stringify(bad.map((b) => [b.tag, b.errs]))); process.exit(1) }
