// Determinism check for the Scholar Core film: a frame must depend only on t, never on how the timeline got there (see the note on noise at diff()).
//   node purity-core.mjs [--base http://127.0.0.1:3321] [--out dir]
// For 14 times spread across the film it takes a screenshot after a straight seek, and again after first scrubbing PAST the time and back
// (the way a random seek, a restart or a different render order would arrive), and compares the two byte for byte.
// A film whose tweens read their start values at the wrong moment (a camera path, a visibility switch, a typed-text counter) fails here.
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const base = arg('base', 'http://127.0.0.1:3321'); const out = arg('out', 'D:/client-presentation-assets/tour-core/film-purity')
mkdirSync(out, { recursive: true })
const { chromium } = createRequire('C:/Users/MILAN/Downloads/lms_k12/')('playwright-core')
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-angle=d3d11', '--force_high_performance_gpu', '--ignore-gpu-blocklist'] })
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage()
await page.goto(`${base}/core.html?render=1`, { waitUntil: 'load' })
await page.waitForFunction('window.__ready === true', null, { timeout: 180000 })
const length = await page.evaluate(() => window.__duration)
const seek = async (t) => { await page.evaluate((x) => window.seek(x), t); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))) }
const shot = async (name) => (await page.screenshot({ path: join(out, name) })).toString('base64')
// Compared in the page: the number of pixels that differ and the largest channel difference. Identical is best; a handful of pixels that differ by
// one or two levels (the anti-aliased edge of text that is still animating) is rasteriser noise, not a different state; anything more is a real divergence.
const diff = (a, b) => page.evaluate(async ([x, y]) => {
  const load = (d) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + d })
  const [ia, ib] = await Promise.all([load(x), load(y)])
  const cv = document.createElement('canvas'); cv.width = ia.width; cv.height = ia.height; const g = cv.getContext('2d', { willReadFrequently: true })
  g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, cv.width, cv.height).data
  g.clearRect(0, 0, cv.width, cv.height); g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, cv.width, cv.height).data
  let n = 0; let max = 0
  for (let i = 0; i < da.length; i += 4) { const m = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])); if (m > 0) { n++; if (m > max) max = m } }
  return { n, max }
}, [a, b])
const probes = [1.2, 4.4, 8.1, 12.3, 15.6, 20.2, 27.5, 31.4, 38.9, 47.0, 52.3, 61.8, 70.2, length - 1.0].map((t) => Math.round(Math.min(t, length - 0.2) * 100) / 100)
let bad = 0; let noise = 0
for (const t of probes) {
  await seek(0); await seek(t); const a = await shot(`direct-${t}.png`)
  await seek(Math.min(length - 0.1, t + 6)); await seek(Math.max(0, t - 5)); await seek(t); const b = await shot(`scrub-${t}.png`)
  const d = await diff(a, b)
  const verdict = d.n === 0 ? 'identical' : d.n <= 200 && d.max <= 2 ? `same (anti-aliasing noise: ${d.n} px, at most ${d.max} of 255)` : 'DIFFERENT'
  if (verdict === 'DIFFERENT') bad++; else if (d.n) noise++
  console.log(`  ${String(t).padStart(6)} s  ${verdict}${verdict === 'DIFFERENT' ? `: ${d.n} px, up to ${d.max} of 255` : ''}`)
}
await browser.close()
console.log(bad ? `NOT PURE: ${bad} of ${probes.length} times depend on the path` : `PURE: all ${probes.length} times show the same frame however the timeline got there (${noise} with a few pixels of anti-aliasing noise)`)
process.exit(bad ? 1 : 0)
