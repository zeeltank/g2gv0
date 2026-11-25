// Fast layout tester for the client presentation: finds what a human spots in a screenshot (overlaps, clipped or crossing text,
// text outside the stage, cramped margins, near-miss alignment, tiny type) and saves an annotated screenshot of every problem.
//   node scripts/client-presentation/layout-lint.mjs [--base http://localhost:3210] [--out <dir>] [--slides 1,2,3] [--strict]
// FAIL = text over text, text crossing a box edge, text outside the 1920 x 1080 stage.  WARN = cramped margin, near-aligned edges (2 to 10 px
// apart), type under 20 px.  Exit 1 on any FAIL (and on WARN with --strict). Runs every slide at every beat at 1920 x 1080 (the stage scales).
import { createRequire } from 'node:module'
import { mkdirSync, readdirSync } from 'node:fs'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const base = arg('base', 'http://localhost:3210'); const out = arg('out', 'layout-shots')
const only = arg('slides', null)?.split(',').map(Number)
const strict = process.argv.includes('--strict')
const BEATS = { 1: 2, 2: 2, 3: 2, 4: 8, 5: 2, 6: 4, 7: 3, 8: 7, 9: 2, 10: 6, 11: 3, 12: 3, 13: 3, 14: 5, 15: 1, 16: 4, 17: 0 }
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
const page = await ctx.newPage()

// Runs in the page. Returns { fails: [], warns: [], boxes: [{x,y,w,h,kind}] } in stage pixels.
const analyse = () => {
  const frame = document.querySelector('.cp-frame'); const fr = frame.getBoundingClientRect(); const sc = fr.width / 1920
  const st = (r) => ({ x: (r.left - fr.left) / sc, y: (r.top - fr.top) / sc, w: r.width / sc, h: r.height / sc })
  const scene = document.querySelector('.cp-scene')
  const visible = (e) => { for (let n = e; n && n !== scene.parentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (parseFloat(cs.opacity) < 0.6 || cs.visibility === 'hidden' || cs.display === 'none') return false } return true }
  const rotated = (e) => { for (let n = e; n && n !== scene.parentElement; n = n.parentElement) { const t = getComputedStyle(n).transform; if (t && t !== 'none') { const m = t.match(/matrix\(([^)]+)\)/); if (m) { const v = m[1].split(',').map(Number); if (Math.abs(v[1]) > 0.002 || Math.abs(v[2]) > 0.002) return true } } } return false }
  // Text items: the real painted rectangle of each text node (not the element box).
  const items = []
  const walker = document.createTreeWalker(scene, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const txt = n.textContent.trim(); const el = n.parentElement
    if (!txt || !el || el.closest('.cp-sr, .cp-ui, svg, script, style, .cl-root') || !visible(el)) continue
    const rg = document.createRange(); rg.selectNodeContents(n)
    const cs0 = getComputedStyle(el); const fsz = parseFloat(cs0.fontSize); const lh = cs0.lineHeight === 'normal' ? fsz * 1.2 : parseFloat(cs0.lineHeight)
    // One rectangle per painted line, trimmed to the line box (a glyph box taller than the line height is not an overlap).
    const lines = []
    for (const r of rg.getClientRects()) {
      if (r.width < 2 || r.height < 2) continue
      const trim = Math.max(0, r.height - lh) / 2
      const top = r.top + trim; const height = Math.min(r.height, lh)
      const same = lines.find((l) => Math.abs(l.top - top) < 3 && Math.abs(l.height - height) < 3)
      if (same) { same.left = Math.min(same.left, r.left); same.right = Math.max(same.right, r.right) } else lines.push({ left: r.left, right: r.right, top, height })
    }
    for (const l of lines) {
      const b = st({ left: l.left, top: l.top, width: l.right - l.left, height: l.height })
      items.push({ el, txt: txt.slice(0, 28), ...b, fs: fsz, rot: rotated(el) })
    }
  }
  const fails = []; const warns = []; const boxes = []
  const flag = (list, kind, msg, rects) => { list.push(`${kind}: ${msg}`); rects.forEach((r) => boxes.push({ ...r, kind: list === fails ? 'f' : 'w' })) }
  const inter = (a, b) => { const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x); const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); return w > 0 && h > 0 ? { w, h, area: w * h } : null }
  // 1. text over text
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i]; const b = items[j]
    if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue
    const x = inter(a, b); if (!x) continue
    if (x.area > 60 && x.w > 6 && x.h > 6) flag(fails, 'text-over-text', `"${a.txt}" x "${b.txt}" (${Math.round(x.w)}x${Math.round(x.h)}px)`, [a, b])
  }
  // 2. text crossing a box edge (box = element with a border or a visible background, 60 px or larger), where the text is not inside the box
  const boxEls = [...scene.querySelectorAll('*')].filter((e) => {
    if (e.closest('.cp-sr, .cp-ui, svg, .cl-root') || e.classList.contains('cp-scene') || !visible(e)) return false
    const cs = getComputedStyle(e); const r = e.getBoundingClientRect()
    if (r.width / sc < 60 || r.height / sc < 30 || r.width / sc > 1700 && r.height / sc > 900) return false
    const border = ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs['border' + s + 'Width']) >= 1.5 && cs['border' + s + 'Style'] !== 'none')
    const bg = cs.backgroundColor && !/rgba?\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) && parseFloat((cs.backgroundColor.match(/,\s*([\d.]+)\)$/) || [0, 1])[1]) > 0.25
    return border || bg
  })
  const ownBox = (el) => { let best = null; for (const be of boxEls) if (be.contains(el) && (!best || best.contains(be))) best = be; return best }
  for (const be of boxEls) {
    const br = st(be.getBoundingClientRect())
    for (const t of items) {
      if (be.contains(t.el)) { // inside: must be fully inside the box (text spilling out of its own panel)
        if (t.x < br.x - 2 || t.y < br.y - 2 || t.x + t.w > br.x + br.w + 2 || t.y + t.h > br.y + br.h + 2) flag(fails, 'text-spills-out-of-box', `"${t.txt}" leaves its box`, [t, br])
      } else {
        // Deliberate layering (paper slips in a stack, a label tab sitting on a frame): the text's own box overlaps this box, so skip.
        const ob = ownBox(t.el); if (ob && ob !== be && inter(st(ob.getBoundingClientRect()), br)) continue
        const x = inter(t, br)
        if (x && x.area > 120 && !(t.x >= br.x && t.y >= br.y && t.x + t.w <= br.x + br.w && t.y + t.h <= br.y + br.h)) flag(fails, 'text-crosses-box-edge', `"${t.txt}" crosses a box (${Math.round(x.w)}x${Math.round(x.h)}px)`, [t, br])
      }
    }
  }
  // 3. outside the stage, 4. cramped margins
  for (const t of items) {
    if (t.x < -2 || t.y < -2 || t.x + t.w > 1922 || t.y + t.h > 1082) flag(fails, 'outside-stage', `"${t.txt}"`, [t])
    else if (!t.el.closest('.cp-credit') && (t.x < 70 || t.x + t.w > 1850 || t.y < 28 || t.y + t.h > 1052)) flag(warns, 'cramped-margin', `"${t.txt}" at ${Math.round(t.x)},${Math.round(t.y)}`, [t])
    if (t.fs < 20 && !t.el.closest('.cp-credit')) flag(warns, 'tiny-type', `"${t.txt}" ${t.fs.toFixed(0)}px`, [t])
  }
  // 5. near-miss alignment: left edges 2 to 10 px apart between text blocks that are close in height and not rotated
  const blocks = items.filter((t) => !t.rot && t.w > 60 && !t.el.closest('.cp-badge, .cp-credit, .cp-shot, svg'))
  const seen = new Set()
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    const a = blocks[i]; const b = blocks[j]; const d = Math.abs(a.x - b.x)
    if (d >= 2 && d <= 10 && Math.abs(a.y - b.y) < 700 && a.el.parentElement !== b.el.parentElement) {
      const key = `${Math.round(a.x / 4)}:${Math.round(b.x / 4)}`; if (seen.has(key)) continue; seen.add(key)
      flag(warns, 'near-aligned', `"${a.txt}" and "${b.txt}" left edges ${d.toFixed(0)}px apart`, [a, b])
    }
  }
  return { fails, warns, boxes }
}

let totalF = 0; let totalW = 0
for (let n = 1; n <= 17; n++) {
  if (only && !only.includes(n)) continue
  for (let b = 0; b <= BEATS[n]; b++) {
    await page.goto(`${base}/module/lms/learning/client-presentation/scholarclone?slide=${n}&beat=${b}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForSelector('.cp-scene', { timeout: 90000 })
    await page.waitForTimeout(b === 0 ? 4200 : 900) // beat 0 plays its entrance (jump entry seeks to b0 at once, but fonts and images need a moment)
    const r = await page.evaluate(analyse)
    totalF += r.fails.length; totalW += r.warns.length
    const tag = `s${String(n).padStart(2, '0')}-b${b}`
    if (r.fails.length || r.warns.length) {
      console.log(`${tag}  ${r.fails.length} fail, ${r.warns.length} warn`)
      for (const f of r.fails) console.log('   FAIL ' + f)
      for (const w of r.warns.slice(0, 6)) console.log('   warn ' + w)
      await page.evaluate((boxes) => {
        const frame = document.querySelector('.cp-frame')
        boxes.forEach((bx) => { const d = document.createElement('div'); d.style.cssText = `position:absolute;left:${bx.x}px;top:${bx.y}px;width:${bx.w}px;height:${bx.h}px;outline:3px solid ${bx.kind === 'f' ? '#ff2d55' : '#ffb800'};z-index:99;pointer-events:none`; frame.appendChild(d) })
      }, r.boxes)
      await page.screenshot({ path: `${out}/${tag}.png` })
    }
  }
}
await browser.close()
console.log(`\nlayout lint: ${totalF} fail(s), ${totalW} warning(s). Annotated screenshots (red = fail, amber = warn) in ${out}`)
process.exit(totalF || (strict && totalW) ? 1 : 0)
