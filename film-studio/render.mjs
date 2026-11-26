// Renders the film frame by frame to H.264: node render.mjs [--out D:/client-presentation-assets/film-out] [--name scholarclone-59s-v2]
//   [--fps 30] [--crf 20] [--maxrate 1700k] [--from 0] [--to 59] [--base http://127.0.0.1:3320]
// Method: the page exposes window.seek(t) (one paused GSAP timeline plus the WebGL composite). For every 1/fps second the script seeks,
// waits two animation frames, captures a PNG through the DevTools protocol and pipes it to ffmpeg (BT.709, yuv420p, faststart, no audio).
// Nothing is recorded in real time, so a render repeats exactly on the same GPU. Uses the installed Google Chrome on the NVIDIA GPU and
// aborts on a software or integrated renderer (the pixels differ between GPUs, so one GPU is locked for the whole film).
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const base = arg('base', 'http://127.0.0.1:3320')
const pagePath = arg('page', '/')   // '/core.html' renders the Scholar Core film
const outDir = arg('out', 'D:/client-presentation-assets/film-out')
const name = arg('name', 'scholarclone-59s-v2')
const fps = Number(arg('fps', 30)), crf = Number(arg('crf', 20)), maxrate = arg('maxrate', '1700k')
const from = Number(arg('from', 0))
mkdirSync(outDir, { recursive: true })

const { chromium } = createRequire('C:/Users/MILAN/Downloads/lms_k12/')('playwright-core')
const ffmpeg = createRequire('D:/client-presentation-assets/_video/')('ffmpeg-static')

const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-angle=d3d11', '--force_high_performance_gpu', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e).slice(0, 240)))
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push('console: ' + m.text().slice(0, 240)) })
await page.goto(`${base}${pagePath}?render=1`, { waitUntil: 'load' })
await page.waitForFunction('window.__ready === true', null, { timeout: 180000 })
const gl = await page.evaluate(() => window.__gl)
console.log('renderer:', gl.renderer)
if (!/nvidia/i.test(gl.renderer) || /swiftshader|microsoft basic|intel/i.test(gl.renderer)) { console.log('FAIL: not the NVIDIA GPU'); await browser.close(); process.exit(1) }
const duration = await page.evaluate(() => window.__duration)
const to = Number(arg('to', duration))
const cdp = await ctx.newCDPSession(page)
const step = async (t) => { await page.evaluate((x) => window.seek(x), t); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))) }
const grab = async () => Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true })).data, 'base64')

const file = join(outDir, `${name}.mp4`)
const lock = join(outDir, `${name}.lock`)
try { writeFileSync(lock, String(process.pid), { flag: 'wx' }) } catch { console.log(`FAIL: ${lock} exists, so another render of this name is running (or crashed). Delete the lock only when no render is running.`); await browser.close(); process.exit(1) }
const vf = 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p'
const args = ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', '-vf', vf, '-r', String(fps),
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', String(crf), '-maxrate', maxrate, '-bufsize', String(parseInt(maxrate) * 2) + 'k',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', file]
const ff = spawn(ffmpeg, args, { stdio: ['pipe', 'ignore', 'pipe'] })
let ffErr = ''
ff.stderr.on('data', (d) => { ffErr += d })
const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c + '\n' + ffErr.slice(-700))))))
const write = async (buf) => { if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r)) }

await step(0); await step(0)                               // warm-up frames
const frames = Math.round((to - from) * fps)
const t0 = Date.now()
for (let i = 0; i < frames; i++) {
  await step(from + i / fps)
  await write(await grab())
  if (i % 60 === 0) {
    const el = (Date.now() - t0) / 1000
    console.log(`frame ${i}/${frames}  t=${(from + i / fps).toFixed(2)}s  ${el.toFixed(0)}s elapsed  eta ${(el / (i + 1) * (frames - i)).toFixed(0)}s`)
    writeFileSync(join(outDir, `${name}.progress.json`), JSON.stringify({ frame: i, frames, elapsed: el }))
  }
}
ff.stdin.end()
await done
await browser.close()
const st = statSync(file)
unlinkSync(lock)
console.log(JSON.stringify({ file, mb: +(st.size / 1048576).toFixed(2), frames, seconds: +(frames / fps).toFixed(2), renderer: gl.renderer, errs }))
