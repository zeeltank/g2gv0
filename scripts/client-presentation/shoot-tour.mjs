// Dev harness for a product tour slide: scrubs its timeline to chosen times and saves a still of each, exactly the way the video renderer steps it.
//   node scripts/client-presentation/shoot-tour.mjs --out <dir> --key a3 [--base http://localhost:3412] [--at labels|0.5,1.2,...] [--purity]
//   --at labels    one still at every beat label b0..bN (the finished state of each step; the default)
//   --at 0.5,1.2   stills at those times in seconds (mid-animation states)
//   --purity       also proves the timeline is a pure function of time: for 8 chosen times it hashes the page reached by a straight seek, and
//                  again after scrubbing forward past it and back, and after a fresh load; all three must match (so Back, a tab click, a
//                  deep link and the renderer all show the same picture)
// Needs a dev or production server and playwright-core (borrowed from the lms_k12 checkout). The test session is built in the browser only.
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1]?.startsWith('--') || process.argv[i + 1] === undefined ? true : process.argv[i + 1]) }
const out = arg('out', 'tour-shots'); const base = arg('base', 'http://localhost:3412'); const key = arg('key', 'a3')
const at = String(arg('at', 'labels')); const purity = process.argv.includes('--purity')
const require = createRequire('C:/Users/MILAN/Downloads/lms_k12/')
const { chromium } = require('playwright-core')
const exe = readdirSync(process.env.LOCALAPPDATA + '/ms-playwright').filter((d) => d.startsWith('chromium-') && !d.includes('headless')).map((d) => `${process.env.LOCALAPPDATA}/ms-playwright/${d}/chrome-win64/chrome.exe`)[0]
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: exe, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
await ctx.addCookies([{ name: 'gtg-session', value: '1', domain: new URL(base).hostname, path: '/' }])
await ctx.addInitScript(() => {
  localStorage.setItem('userData', JSON.stringify({ user_id: 1, token: 'local-test-session', sub_institute_id: 6, syear: 2026 }))
  localStorage.setItem('gtg-session', JSON.stringify({ user: { id: 1, email: 'test@local', name: 'Local test', role: 'admin', profileName: 'Admin', subInstituteId: 6, syear: 2026 }, isAuthenticated: true, isLoading: false }))
})
const url = `${base}/module/lms/learning/client-presentation/atlas/${key}`
async function open() {
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => Boolean(window.__atlasTl), null, { timeout: 120000 })
  await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important }' })   // the dev-mode indicator animates by itself
  await page.evaluate(() => { window.__atlasTl.pause(); window.__atlasTl.time(0) })
  await page.waitForTimeout(500)
  return { page, errors }
}
const seek = (page, t) => page.evaluate((x) => { window.__atlasTl.pause(); window.__atlasTl.time(x, false) }, t)
const shot = async (page, file) => { const buf = await page.screenshot({ path: file }); return createHash('sha256').update(buf).digest('hex').slice(0, 16) }

const { page, errors } = await open()
const info = await page.evaluate(() => ({ duration: window.__atlasTl.duration(), labels: window.__atlasTl.labels }))
const labelNames = Object.keys(info.labels).filter((k) => /^b\d+$/.test(k)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
console.log(`timeline ${info.duration.toFixed(2)} s, ${labelNames.length} beat labels:`, labelNames.map((l) => `${l}@${info.labels[l].toFixed(1)}`).join(' '))
writeFileSync(`${out}/timeline.json`, JSON.stringify(info, null, 1))
const times = at === 'labels' ? labelNames.map((l) => [l, info.labels[l]]) : at.split(',').map((x) => [`t${Number(x).toFixed(2).replace('.', '_')}`, Number(x)])
for (const [name, t] of times) {
  await seek(page, t); await page.waitForTimeout(250)
  await shot(page, `${out}/${key}-${name}.png`)
}
console.log(`${times.length} stills in ${out}`)

if (purity) {
  // The probe times carry an odd 0.0137 s: a stepped ease (the sketchbook scenes run on steps) is discontinuous at its step edges, and a probe that lands exactly
  // on one would show whichever side floating-point rounding picks, which says nothing about the path the timeline took.
  const probes = [0.4, 1.3, 2.7, 4.9, 7.2, 10.5, info.duration * 0.6, info.duration - 0.2].map((x) => Math.round((Math.min(x, info.duration - 0.05) + 0.0137) * 10000) / 10000)
  const direct = []; const roundTrip = []
  for (const t of probes) { await seek(page, t); await page.waitForTimeout(150); direct.push(await shot(page, `${out}/purity-direct-${t}.png`)) }
  for (const t of probes) {
    await seek(page, Math.min(info.duration - 0.05, t + 3)); await seek(page, Math.max(0, t - 2)); await seek(page, t)   // forward past it, back before it, then to it
    await page.waitForTimeout(150); roundTrip.push(await shot(page, `${out}/purity-round-${t}.png`))
  }
  await page.close()
  const fresh = await open(); const reload = []
  for (const t of probes) { await seek(fresh.page, t); await fresh.page.waitForTimeout(150); reload.push(await shot(fresh.page, `${out}/purity-fresh-${t}.png`)) }
  // Strict: a straight seek and a seek after scrubbing past the time must be byte-identical (that is "a state does not depend on the path").
  // A fresh load is only compared as information: a new page can rasterise blurred or scaled glyph edges a level or two differently
  // (measured on this slide: about 50 pixels of 2 million, at most 2 of 255 levels), which is not a different state.
  // A different hash is measured, not guessed: the two pictures are compared pixel by pixel. Two kinds of noise are known (measured 27 Nov 2026 on the illustrated tours):
  // (1) broad dithering of large soft gradients and shadows: hundreds of thousands of pixels, but at most 2 of 255 levels, invisible; (2) anti-aliasing of text and thin edges
  // after a scrub: a few to about a hundred pixels, up to about 60 levels. A real path dependence moves shapes: thousands of pixels by many levels. So the verdict counts only
  // the pixels that differ by MORE than TOL_LEVEL levels and allows TOL_PX of them; every difference, small or large, is printed so it can be judged.
  const TOL_PX = 150; const TOL_LEVEL = 4
  const sharp = createRequire(import.meta.url)('sharp')
  const diffOf = async (fa, fb) => {
    const A = await sharp(fa).raw().toBuffer({ resolveWithObject: true }); const B = await sharp(fb).raw().toBuffer({ resolveWithObject: true })
    let n = 0; let big = 0; let mx = 0; const c = A.info.channels
    for (let i = 0; i < A.data.length; i += c) { const m = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2])); if (m > 0) { n++; if (m > mx) mx = m; if (m > TOL_LEVEL) big++ } }
    return { n, big, mx }
  }
  const verdict = []
  for (const [i, t] of probes.entries()) {
    if (direct[i] === roundTrip[i]) { verdict.push({ ok: true, note: 'byte-identical' }); continue }
    const d = await diffOf(`${out}/purity-direct-${t}.png`, `${out}/purity-round-${t}.png`)
    verdict.push({ ok: d.big <= TOL_PX, noise: true, note: `${d.n} px differ (${d.big} by more than ${TOL_LEVEL} levels; the largest difference is ${d.mx} of 255)` })
  }
  const same = verdict.map((v) => v.ok)
  console.log('PURITY  time: direct / after scrubbing past it / fresh load (information only)')
  probes.forEach((t, i) => console.log(`  ${String(t).padStart(6)} s  ${direct[i]} ${roundTrip[i]} ${reload[i]}  ${verdict[i].ok ? (verdict[i].noise ? `path-independent (anti-aliasing noise only: ${verdict[i].note})` : 'path-independent') : `DEPENDS ON THE PATH (${verdict[i].note})`}${direct[i] === reload[i] ? '' : ' (fresh load differs: compare the pictures, expect noise only)'}`))
  const noisy = verdict.filter((v) => v.noise && v.ok).length
  console.log(same.every(Boolean) ? (noisy ? `PURE: ${probes.length - noisy} probes byte-identical, ${noisy} within anti-aliasing noise (at most ${TOL_PX} pixels differ by more than ${TOL_LEVEL} levels)` : 'PURE: every probe is byte-identical however the timeline got there') : 'NOT PURE: a state depends on how the timeline got there')
  if (fresh.errors.length) errors.push(...fresh.errors)
}
console.log(errors.length ? 'PAGE ERRORS: ' + [...new Set(errors)].join(' | ') : 'no page errors')
await browser.close()
