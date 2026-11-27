// Layout lint for the Scholar Core film: measures every visible caption against the grid (src/core/story.js: SLOT, ANCHOR, layouts).
//   node lint-core.mjs [--base http://127.0.0.1:3321] [--step 0.25] [--out dir]
// For every sampled time it seeks the film, reads each caption (data-slot) that is on screen (opacity over 0.6) and fails on:
//   x      the left edge is not the slot's x (140), or a right-aligned slot's right edge is not 1780                       (tolerance 2 px)
//   y      the top of the first line is not the slot's y (list rows: y + row * pitch)                                        (tolerance 12 px for the line box)
//   width  the text is wider than its slot
//   zone   in the SPLIT layout a caption crosses x 904 (it must stay in the left five columns); in any layout it passes y 1012
//   clash  two visible captions overlap
// Exit 1 on any failure. selfTest() first proves the checker fails on a caption that is 10 px off, one that is too wide and two that overlap.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const base = arg('base', 'http://127.0.0.1:3321'); const step = Number(arg('step', 0.25)); const out = arg('out', 'D:/client-presentation-assets/tour-core/film-lint')
mkdirSync(out, { recursive: true })

export function check(items, layout, slots) {
  const bad = []
  const fail = (kind, it, msg) => bad.push({ kind, slot: it.slot, text: it.text.slice(0, 40), msg })
  for (const it of items) {
    const s = slots[it.slot]; if (!s) { fail('unknown', it, 'no such slot'); continue }
    if (s.align === 'right') { if (Math.abs(it.right - 1780) > 2) fail('x', it, `right edge ${it.right.toFixed(0)} is not 1780`) }
    else if (Math.abs(it.left - s.x) > 2) fail('x', it, `left edge ${it.left.toFixed(0)} is not ${s.x}`)
    let wantTop = s.y
    if (s.pitch) { const k = Math.max(0, Math.round((it.top - s.y) / s.pitch)); wantTop = s.y + k * s.pitch }
    if (Math.abs(it.top - wantTop) > 12) fail('y', it, `top ${it.top.toFixed(0)} is not ${wantTop}`)
    if (s.w && it.width > s.w + 4) fail('width', it, `width ${it.width.toFixed(0)} is over ${s.w}`)
    if (layout === 'SPLIT' && it.right > 904) fail('zone', it, `right edge ${it.right.toFixed(0)} is inside the subject zone (over 904)`)
    if (it.bottom > 1012) fail('zone', it, `bottom ${it.bottom.toFixed(0)} is under the safe edge (1012)`)
  }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i]; const b = items[j]
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left); const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
    if (w > 3 && h > 3) bad.push({ kind: 'clash', slot: `${a.slot}+${b.slot}`, text: `${a.text.slice(0, 18)} | ${b.text.slice(0, 18)}`, msg: `overlap ${w.toFixed(0)} x ${h.toFixed(0)} px` })
  }
  return bad
}

function selfTest(slots) {
  const mk = (slot, left, top, width, height) => ({ slot, text: 't', left, top, width, height, right: left + width, bottom: top + height })
  const ok = check([mk('HEAD', 140, 540, 500, 100), mk('BODY', 140, 780, 600, 120)], 'SPLIT', slots)
  const off = check([mk('HEAD', 150, 540, 500, 100)], 'SPLIT', slots)
  const wide = check([mk('BODY', 140, 780, 900, 100)], 'SPLIT', slots)
  const clash = check([mk('HEAD', 140, 540, 500, 100), mk('BODY', 140, 600, 600, 100)], 'SPLIT', slots)
  const low = check([mk('FOOT', 140, 960, 400, 90)], 'SPLIT', slots)
  const verdict = ok.length === 0 && off.some((b) => b.kind === 'x') && wide.some((b) => b.kind === 'width') && wide.some((b) => b.kind === 'zone') && clash.some((b) => b.kind === 'clash') && low.some((b) => b.kind === 'zone')
  console.log(`self-test: a clean pair passes, and a caption 10 px off, one too wide, one overlapping and one past the foot are each caught: ${verdict ? 'ok' : 'FAILED'}`)
  if (!verdict) process.exit(2)
}

const { chromium } = createRequire('C:/Users/MILAN/Downloads/lms_k12/')('playwright-core')
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-angle=d3d11', '--force_high_performance_gpu', '--ignore-gpu-blocklist'] })
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage()
await page.goto(`${base}/core.html?render=1`, { waitUntil: 'load' })
await page.waitForFunction('window.__ready === true', null, { timeout: 180000 })
const { layouts, slots, length } = await page.evaluate(() => ({ layouts: window.film.layouts, slots: window.film.slots, length: window.film.length }))
selfTest(slots)
const layoutAt = (t) => (layouts.find(([a, b]) => t >= a && t < b) ?? [0, 0, 'FULL'])[2]
const read = () => page.evaluate(() => [...document.querySelectorAll('[data-slot]')].map((e) => { const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { slot: e.dataset.slot, text: e.textContent, opacity: Number(c.opacity), left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom } }).filter((x) => x.opacity > 0.6 && x.width > 0))
const all = []; let samples = 0; let seen = 0
for (let t = 0.3; t < length - 0.2; t += step) {
  await page.evaluate((x) => window.seek(x), t)
  const items = await read(); samples++; seen += items.length
  for (const b of check(items, layoutAt(t), slots)) all.push({ t: +t.toFixed(2), layout: layoutAt(t), ...b })
}
await browser.close()
const bySlot = {}; for (const b of all) { const k = `${b.kind} ${b.slot}`; bySlot[k] = (bySlot[k] ?? 0) + 1 }
writeFileSync(join(out, 'lint.json'), JSON.stringify({ samples, seen, failures: all }, null, 1))
console.log(`${samples} times sampled, ${seen} caption readings, ${all.length} failure(s)`)
const uniq = new Map(); for (const b of all) { const k = `${b.kind}|${b.slot}|${b.text}`; if (!uniq.has(k)) uniq.set(k, b) }
for (const b of [...uniq.values()].slice(0, 25)) console.log(`  t=${b.t} ${b.layout} ${b.kind} ${b.slot}: "${b.text}" ${b.msg}`)
if (Object.keys(bySlot).length) console.log('by kind and slot:', JSON.stringify(bySlot))
process.exit(all.length ? 1 : 0)
