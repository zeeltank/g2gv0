// Stills of the film for design review: node shot.mjs --times 1,2.5,3.6 [--out dir] [--only 1] [--base http://127.0.0.1:3320]
// Uses the installed Google Chrome on the NVIDIA GPU (the flags found by the research); aborts if the renderer is a software one.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const { chromium } = createRequire('C:/Users/MILAN/Downloads/lms_k12/')('playwright-core')
const times = arg('times', '0').split(',').map(Number)
const out = arg('out', 'out/stills'); mkdirSync(out, { recursive: true })
const base = arg('base', 'http://127.0.0.1:3320'); const only = arg('only', null)
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-angle=d3d11', '--force_high_performance_gpu', '--ignore-gpu-blocklist'] })
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)))
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)) })
await page.goto(`${base}/?render=1${only ? '&only=' + only : ''}`, { waitUntil: 'load' })
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 })
const gl = await page.evaluate(() => window.__gl)
console.log('renderer:', gl.renderer)
if (/swiftshader|microsoft basic/i.test(gl.renderer)) { console.log('FAIL software renderer'); process.exit(1) }
for (const t of times) {
  const t0 = Date.now()
  await page.evaluate((x) => window.seek(x), t)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await page.screenshot({ path: join(out, `t${String(t).replace('.', '_')}.png`) })
  console.log('t', t, Date.now() - t0, 'ms')
}
if (errs.length) console.log('ERRORS', errs.join('\n'))
await browser.close()
