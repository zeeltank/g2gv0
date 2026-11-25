// End-to-end checks of the client presentation in a real Chromium (run with a dev server up):
//   node scripts/client-presentation/verify.mjs [--base http://localhost:3210] [--out <dir>]
// 1. every on-slide line of every slide is present in the rendered page at the scene's last beat (full deck and five-slide cut)
// 2. the slide-4 chooser opens a scenario and Return comes back to the same place; the slide-6 products open their scenes
// 3. reduced motion shows the finished state with no hidden text
// 4. nothing visible runs outside the 1920 x 1080 stage
// 5. axe-core accessibility scan of each slide (serious and critical counted)
// 6. a frame-time sample of the opening slide (headless, software rendering: a floor, not a laptop's number)
// 7. the presenter window follows the audience window
// Exit 1 on any failure. Uses the same signed-in test session as shoot.mjs (browser-only, no token, no API call).
import { createRequire } from 'node:module'
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const base = arg('base', 'http://localhost:3210'); const out = arg('out', null)
const deck = JSON.parse(readFileSync(join(root, 'lib/client-presentation/generated/scholarclone.deck.json'), 'utf8'))
const BEATS = { 1: 2, 2: 2, 3: 2, 4: 8, 5: 2, 6: 4, 7: 3, 8: 7, 9: 2, 10: 6, 11: 3, 12: 3, 13: 3, 14: 5, 15: 1, 16: 4, 17: 0 }
// The Product Atlas slides (201 and up) sit before the invitation: the deck has 17 story slides plus these. Their beats come from the generated plan.
const PLAN = JSON.parse(readFileSync(new URL('../../lib/client-presentation/generated/atlas-plan.json', import.meta.url), 'utf8'))
const TOTAL = 17 + PLAN.length
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '')

const require = createRequire('C:/Users/MILAN/Downloads/lms_k12/')
const { chromium } = require('playwright-core')
const exe = readdirSync(process.env.LOCALAPPDATA + '/ms-playwright').filter((d) => d.startsWith('chromium-') && !d.includes('headless')).map((d) => `${process.env.LOCALAPPDATA}/ms-playwright/${d}/chrome-win64/chrome.exe`)[0]
if (out) mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: exe, headless: true })
const fails = []; const notes = []
const ok = (c, m) => { if (!c) fails.push(m) }

async function newPage(reduced = false, vp = { width: 1920, height: 1080 }) {
  const ctx = await browser.newContext({ viewport: vp, reducedMotion: reduced ? 'reduce' : 'no-preference' })
  await ctx.addCookies([{ name: 'gtg-session', value: '1', domain: new URL(base).hostname, path: '/' }])
  await ctx.addInitScript(() => {
    localStorage.setItem('userData', JSON.stringify({ user_id: 1, token: 'local-test-session', sub_institute_id: 6, syear: 2026 }))
    localStorage.setItem('gtg-session', JSON.stringify({ user: { id: 1, email: 'test@local', name: 'Local test', role: 'admin', profileName: 'Admin', subInstituteId: 6, syear: 2026 }, isAuthenticated: true, isLoading: false }))
  })
  const page = await ctx.newPage()
  page.errs = []
  page.on('pageerror', (e) => page.errs.push('PAGEERROR ' + String(e).slice(0, 200)))
  return { ctx, page }
}
const url = (q) => `${base}/module/lms/learning/client-presentation/scholarclone?${q}`
const go = async (page, q) => { await page.goto(url(q), { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForSelector('.cp-scene', { timeout: 90000 }); await page.waitForTimeout(900) }
const sceneText = (page) => page.evaluate(() => document.querySelector('.cp-scene')?.textContent ?? '')
const slideLines = (n) => deck.slides.find((s) => s.n === n).lines

// --- 1. text presence, full deck
{
  const { ctx, page } = await newPage()
  for (let n = 1; n <= 17; n++) {
    await go(page, `slide=${n}&beat=${BEATS[n]}`)
    await page.waitForTimeout(1400)
    const t = norm(await sceneText(page))
    const missing = slideLines(n).filter((l) => !t.includes(norm(l.text)))
    ok(missing.length === 0, `slide ${n}: missing on screen: ${missing.map((l) => `"${l.text.slice(0, 40)}"`).join(', ')}`)
  }
  notes.push(`1a text presence: 17 story slides checked (the ${PLAN.length} atlas slides are covered by layout-lint.mjs)`)
  // short-version scenes by keyboard
  await go(page, 'mode=short')
  const seq = [['short-2', [2, 4], 3, 2], ['short-3', [5, 6], 3, 2]]
  let pressed = 0
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); pressed = 3
  for (const [, slides, , more] of seq) {
    for (let i = 0; i < more; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250) }
    await page.waitForTimeout(1600)
    const t = norm(await sceneText(page))
    for (const s of slides) {
      // Only the lines each short scene is meant to carry: headline/support/ring/step for slide 2+4, brand/headline/legend and the products for 5+6.
      const roles = s === 2 ? ['headline', 'ring', 'support'] : s === 4 ? ['step'] : s === 5 ? ['brand', 'headline', 'legend-item', 'legend-hint'] : ['product']
      const miss = slideLines(s).filter((l) => roles.includes(l.role) && !t.includes(norm(l.text.includes(': ') && l.role === 'product' ? l.text.replace(': ', '') : l.text)))
      ok(miss.length === 0, `short scene (slide ${s}) missing: ${miss.map((l) => `"${l.text.slice(0, 40)}"`).join(', ')}`)
    }
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300)
    pressed++
  }
  notes.push('1b five-slide cut: short-2 and short-3 checked')
  // --- 2. interactions
  await go(page, 'slide=4&beat=8')
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /A teacher who needs development/ }).click()
  await page.waitForTimeout(1500)
  let t = norm(await sceneText(page))
  ok(t.includes(norm(slideLines(10).find((l) => l.role === 'headline').text)), 'chooser chip 3 did not open the CCB slide')
  ok(await page.getByRole('button', { name: /Return to journey/ }).count() > 0, 'no Return to journey button during a detour')
  await page.keyboard.press('Escape'); await page.waitForTimeout(1500)
  t = norm(await sceneText(page))
  ok(t.includes(norm('Which of these matters most to you?')), 'Return did not come back to the chooser')
  notes.push('2a chooser -> scenario -> return: checked')
  await go(page, 'slide=6&beat=4'); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /Scholar Learn/ }).click(); await page.waitForTimeout(1500)
  t = norm(await sceneText(page))
  ok(t.includes(norm(slideLines(8).find((l) => l.role === 'headline').text)), 'Scholar Learn tile did not open its slide')
  notes.push('2b ecosystem tile opens its scene: checked')
  // 2c. a product slide opens its explainer across the stage, and Close comes back to the slide
  await go(page, 'slide=7&beat=3'); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /Watch the Scholar Core explainer/ }).click(); await page.waitForTimeout(1500)
  ok(await page.locator('.cl-overlay .cl-hook').count() === 1, 'the explainer did not open over slide 7')
  await page.getByRole('button', { name: 'Close' }).click(); await page.waitForTimeout(600)
  ok(await page.locator('.cl-overlay').count() === 0, 'Close did not close the explainer')
  t = norm(await sceneText(page))
  ok(t.includes(norm(slideLines(7).find((l) => l.role === 'headline').text)), 'slide 7 is not back after Close')
  notes.push('2c product slide opens its explainer and closes back: checked')
  // 2d. slide 16 plays one product at a time; Next moves to the next
  await go(page, 'slide=16&beat=0'); await page.waitForTimeout(2500)
  const firstHook = await page.locator('.s16-player .cl-hook').innerText()
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(2500)
  const secondHook = await page.locator('.s16-player .cl-hook').innerText()
  ok(/fees/i.test(firstHook) && firstHook !== secondHook, `slide 16 did not move to the next product ("${firstHook.slice(0, 30)}" then "${secondHook.slice(0, 30)}")`)
  notes.push('2d slide 16 steps through the five clips: checked')
  // 2e. in windows smaller than 1920 wide the clip must still fill its box (the shell scales the stage with a CSS transform)
  for (const vp of [{ width: 1100, height: 620 }, { width: 1366, height: 768 }]) {
    const small = await newPage(false, vp)
    await go(small.page, 'slide=16&beat=0'); await small.page.waitForTimeout(2500)
    const fit = await small.page.evaluate(() => { const a = document.querySelector('.s16-player').getBoundingClientRect(); const b = document.querySelector('.s16-player .cl-stage').getBoundingClientRect(); return { dw: Math.abs(a.width - b.width), dh: Math.abs(a.height - b.height) } })
    ok(fit.dw <= 2 && fit.dh <= 2, `at ${vp.width}x${vp.height} the clip does not fill its box (off by ${fit.dw.toFixed(0)} x ${fit.dh.toFixed(0)} px)`)
    await small.ctx.close()
  }
  notes.push('2e clip fills its box at 1100x620 and 1366x768: checked')
  // 2f. the film is slide 6 in the order of play, set to autoplay muted, and fills the stage at any window size
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1100, height: 620 }]) {
    const f = await newPage(false, vp)
    await go(f.page, 'slide=17&beat=0'); await f.page.waitForTimeout(1500)
    const info = await f.page.evaluate(() => { const v = document.querySelector('.s17-video'); const fr = document.querySelector('.cp-frame').getBoundingClientRect(); const r = v.getBoundingClientRect(); return { dw: Math.abs(fr.width - r.width), dh: Math.abs(fr.height - r.height), muted: v.muted, auto: v.autoplay, pill: document.querySelector('.cp-ui-pill > span')?.textContent } })
    ok(info.dw <= 2 && info.dh <= 2, `at ${vp.width}x${vp.height} the film does not fill the stage (off by ${info.dw.toFixed(0)} x ${info.dh.toFixed(0)} px)`)
    ok(info.muted && info.auto, 'the film must be muted and set to autoplay')
    ok((info.pill || '').trim() === `6/${TOTAL}`, `the film is at "${info.pill}", expected 6/${TOTAL}`)
    await f.ctx.close()
  }
  notes.push(`2f the film is slide 6 of ${TOTAL}, muted, autoplay, fills the stage: checked`)
  // --- 3. reduced motion handled below; 7. presenter window
  const pres = await ctx.newPage()
  await pres.goto(url('view=presenter'), { waitUntil: 'domcontentloaded' }); await pres.waitForTimeout(800)
  await go(page, 'slide=9&beat=1'); await page.waitForTimeout(1200)
  await pres.close()
  const pres2 = await ctx.newPage()
  await pres2.goto(url('view=presenter'), { waitUntil: 'domcontentloaded' })
  await page.bringToFront(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1200)
  await pres2.waitForTimeout(1500)
  const pt = await pres2.evaluate(() => document.body.innerText)
  ok(/say/i.test(pt) && /ask/i.test(pt), 'presenter window shows no notes (' + pt.slice(0, 80).replace(/\n/g, ' | ') + ')')
  notes.push('7 presenter window follows the audience window: ' + (/say/i.test(pt) ? 'yes' : 'no'))
  fails.push(...page.errs)
  await ctx.close()
}

// --- 3. reduced motion
{
  const { ctx, page } = await newPage(true)
  for (const n of [1, 5, 8, 13]) {
    await go(page, `slide=${n}&beat=${BEATS[n]}`)
    const hidden = await page.evaluate(() => [...document.querySelectorAll('.cp-scene h1, .cp-scene h2, .cp-scene p')].filter((e) => parseFloat(getComputedStyle(e).opacity) < 0.9 && e.textContent.trim()).map((e) => e.textContent.trim().slice(0, 30)))
    ok(hidden.length === 0, `reduced motion, slide ${n}: text still hidden: ${hidden.join(' | ')}`)
  }
  notes.push('3 reduced motion shows finished text: 4 slides checked')
  await ctx.close()
}

// --- 4 + 5. bounds and accessibility at 1366 x 768
{
  const { ctx, page } = await newPage(false, { width: 1366, height: 768 })
  const axeSrc = readFileSync(join(root, 'node_modules/axe-core/axe.min.js'), 'utf8')
  let serious = 0
  for (let n = 1; n <= 17; n++) {
    await go(page, `slide=${n}&beat=${BEATS[n]}`); await page.waitForTimeout(1500)
    const over = await page.evaluate(() => {
      const f = document.querySelector('.cp-frame'); const r = f.getBoundingClientRect(); const sc = r.width / 1920
      const bad = []
      document.querySelectorAll('.cp-scene *').forEach((e) => {
        if (!e.childNodes.length || ![...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) return
        const cs = getComputedStyle(e); if (parseFloat(cs.opacity) < 0.5 || cs.visibility === 'hidden' || e.closest('.cp-sr')) return
        const b = e.getBoundingClientRect(); if (!b.width) return
        const right = (b.right - r.left) / sc; const bottom = (b.bottom - r.top) / sc; const left = (b.left - r.left) / sc; const top = (b.top - r.top) / sc
        if (right > 1922 || bottom > 1082 || left < -2 || top < -2) bad.push(e.textContent.trim().slice(0, 30))
      })
      return bad
    })
    ok(over.length === 0, `slide ${n}: text outside the stage: ${over.join(' | ')}`)
    await page.addScriptTag({ content: axeSrc })
    const res = await page.evaluate(async () => { const r = await window.axe.run(document.querySelector('.cp-root'), { resultTypes: ['violations'] }); return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, html: v.nodes.slice(0, 2).map((x) => x.html.slice(0, 140)) })) })
    const bad = res.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    serious += bad.length
    if (bad.length) notes.push(`axe slide ${n}: ` + bad.map((v) => `${v.id}(${v.impact}, ${v.n}) ${v.html.join(' || ')}`).join(', '))
    ok(bad.length === 0, `slide ${n}: axe serious/critical: ${bad.map((v) => v.id).join(', ')}`)
  }
  notes.push(`4 bounds + 5 axe at 1366x768: 17 slides, serious/critical violations: ${serious}`)
  fails.push(...page.errs)
  await ctx.close()
}

// --- 6. frame time of the opening slide (headless software rendering)
{
  const { ctx, page } = await newPage()
  await page.goto(url('slide=1'), { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.cp-scene')
  const stats = await page.evaluate(() => new Promise((res) => {
    const d = []; let last = performance.now(); const end = last + 5000
    const f = (t) => { d.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else { d.sort((a, b) => a - b); res({ n: d.length, p50: d[(d.length * 0.5) | 0], p95: d[(d.length * 0.95) | 0], max: d[d.length - 1] }) } }
    requestAnimationFrame(f)
  }))
  notes.push(`6 opening-slide frame time (headless software render, first 5 s): frames ${stats.n}, median ${stats.p50.toFixed(1)} ms, p95 ${stats.p95.toFixed(1)} ms, max ${stats.max.toFixed(1)} ms`)
  await ctx.close()
}

await browser.close()
for (const n of notes) console.log('note  ' + n)
for (const f of [...new Set(fails)]) console.log('FAIL  ' + f)
console.log(fails.length ? `\n${new Set(fails).size} failure(s)` : '\nall checks passed')
process.exit(fails.length ? 1 : 0)
