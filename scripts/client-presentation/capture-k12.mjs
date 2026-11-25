// Captures screens of the K12 app for the Product Atlas slides. READ-ONLY: it signs in, opens pages by URL and takes screenshots. It never clicks,
// types (except the sign-in form), submits or sends anything, and it aborts any write request to a URL that looks like a save, delete or send.
//   K12_USER=... K12_PASS=... node scripts/client-presentation/capture-k12.mjs [--ids id1,id2] [--per-sub 1] [--limit 5] [--out D:/client-presentation-incoming/k12]
// The login is read from the environment only (never stored in a file). The browser session is kept outside the repo.
// PERSONAL DATA: the live school holds real student and staff data, so every page is masked IN THE PAGE before the screenshot is taken:
// names in name-like table columns and under role labels are replaced with fictional names, other capitalised phrases that are not known UI words
// are blurred, photos and avatars are blurred, e-mails, phone numbers and long id numbers are replaced. No unmasked image or page text is written.
// The run records counts per page in manifest.json; a page whose masked text still matches an e-mail, phone or long number is flagged and not kept.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const BASE = process.env.K12_BASE || 'https://k12.scholarclone.com'
const OUT = arg('out', 'D:/client-presentation-incoming/k12')
const STATE = join(OUT, '..', '.k12-session.json')
const offset = Number(arg('offset', 0)); const onlySubs = arg('only-subs', null)?.split(',').map((x) => x.trim()); const perSub = Number(arg('per-sub', 1)); const limit = Number(arg('limit', 9999)); const only = arg('ids', null)?.split(',')
if (!process.env.K12_USER || !process.env.K12_PASS) { console.log('Set K12_USER and K12_PASS in the environment.'); process.exit(1) }
mkdirSync(OUT, { recursive: true })

const { chromium } = createRequire('C:/Users/MILAN/Downloads/lms_k12/')('playwright-core')
const tree = JSON.parse(readFileSync(join(root, 'docs/client-presentation/content/atlas/k12-menu-2026-11-25.json'), 'utf8'))
const slug = (s) => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/* the list of screens to capture */
const jobs = []
for (const m of tree.modules) for (const s of m.subs) {
  if (onlySubs && !onlySubs.includes(s.name)) continue
  const screens = s.screens.filter((c) => c.href && c.href !== '#' && !/delete/i.test(c.name))
  const picks = screens.length ? screens.slice(offset, offset + perSub) : (s.href ? [{ name: s.name, href: s.href }] : [])
  for (const c of picks) jobs.push({ id: `${slug(m.name)}--${slug(s.name)}--${slug(c.name)}`, module: m.name, sub: s.name, screen: c.name, href: c.href })
}
// --urls "id=module|sub|screen|/path;id2=..." adds screens that are not in the menu file (a route found in the front end, or a replacement for a page that showed an error)
for (const part of (arg('urls', '') || '').split(';').filter(Boolean)) { const [id, rest] = part.split('='); const [module, sub, screen, href] = rest.split('|'); jobs.push({ id, module, sub, screen, href }) }
if (!only || only.includes('home--dashboard')) jobs.unshift({ id: 'home--dashboard', module: 'Home', sub: 'Dashboard', screen: 'Dashboard', href: '/dashboard' })
const todo = jobs.filter((j) => !only || only.includes(j.id)).slice(0, limit)
console.log(`${todo.length} screens to capture`)

/* ---- the in-page masker (runs before every screenshot): DEFAULT-DENY. Data areas are blurred unless the text is a known interface word, a number or a date. ---- */
const MASKER = (me) => {
  const stats = { blurred: 0, scrubbed: 0, replaced: 0 }
  const textNodes = (el) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const a = []; let n; while ((n = w.nextNode())) a.push(n); return a }
  /* 1 e-mails, phones, long numbers anywhere */
  for (const n of textNodes(document.body)) {
    const p = n.parentElement; if (!p || /SCRIPT|STYLE|NOSCRIPT/.test(p.tagName)) continue
    let t = n.nodeValue; const o = t
    t = t.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, 'name@school.example').replace(/(\+?\d[\d ]{8,}\d)/g, '98XXXXXX10').replace(/\b\d{6,}\b/g, '••••••')
    if (t !== o) { n.nodeValue = t; stats.scrubbed++ }
  }
  /* 2 the signed-in user */
  const meRe = me && me.length > 2 ? new RegExp(me.replace(/[^a-z0-9]/gi, '.'), 'gi') : null      // the signed-in user's name, any punctuation matches any character
  if (meRe) for (const n of textNodes(document.body)) if (meRe.test(n.nodeValue)) { meRe.lastIndex = 0; n.nodeValue = n.nodeValue.replace(meRe, 'Admin'); stats.replaced++ }
  /* 3 vocabulary: words the interface itself uses (menu words, headings, labels, buttons, tabs, headers, options, placeholders) */
  const KNOWN = new Set(((window.__knownWords) || []).map((w) => w.toLowerCase()))
  const addWords = (t) => String(t).toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 1).forEach((w) => KNOWN.add(w))
  document.querySelectorAll('h1,h2,th,label,legend,[role="tab"],nav *,aside *,header *').forEach((e) => { if (e.children.length === 0 && !e.closest('tbody, li, [role="row"], [role="listitem"]')) addWords(e.innerText) })
  document.querySelectorAll('[placeholder]').forEach((e) => addWords(e.getAttribute('placeholder')))
  const COMMON = 'total students student fees fee class classes attendance today week month year staff report reports master add edit search new collect cancel refund circular other title mapping approved approval request requests list view details summary dashboard setting settings user users role roles permission academic term session section sections subject subjects exam exams result results mark marks entry upload download print export import send message messages notification calendar leave application applications library book books issue return transport route routes vehicle driver inventory item items purchase order orders hostel room allocation admission inquiry registration confirmation enquiry follow up quick actions needs attention open tasks complaints visitors parent parents communication timetable teacher teachers admin document documents template templates certificate certificates alumni event events survey surveys donation donations batch batches directory mentorship jobs engagement career careers learning plan plans lesson curriculum assessment homework assignment worksheet project quiz online progress competency capability talent organization department employee payroll task knowledge graph insight insights analytics automation foundation overview intelligence loop account all none select filter apply reset save close back next previous page rows per showing entries from status active inactive pending completed due overdue paid unpaid balance amount date time name code number type category group level grade standard stage shift house division roll gr no mobile email username profile actions id complete incomplete present absent late half full day days hours minutes ago min hr hrs yes not marked unmarked docs documents girls boys male female other sports colour color enrolment enrollment strength change changes join joined left transfer transferred records record and or the of in on for to by with at as is are was were has have had be been this that these those you your we our it its if then than there their they them what when where which who whom whose how why can will would should could may might must shall do does did done a an'.split(' ')
  COMMON.forEach((w) => KNOWN.add(w))
  const tokens = (t) => t.split(/[\s,;:()[\]{}/|+&=<>"“”‘’!?*#~^%$@]+/).map((w) => w.replace(/^[.\-–'’_]+|[.\-–'’_]+$/g, '')).filter(Boolean)
  const isNum = (w) => /^[\d.,:\-–/%]+$/.test(w) || /^\d+(st|nd|rd|th)$/i.test(w)
  /* a token is safe if it is a number, a one-letter/two-digit code, or a known interface word (any case) */
  const safeToken = (w) => isNum(w) || w.length === 1 || KNOWN.has(w.toLowerCase()) || /^(am|pm|[a-z]{1,2}\d*)$/i.test(w) && w.length <= 2
  const safeSentence = (w) => w.length >= 3 && /^[A-Z][a-z]+$/.test(w[0]) && w.slice(1).every((x) => /^[a-z]+$/.test(x) || isNum(x) || /^(Grade|AY|[A-Z])$/.test(x))
  const unsafe = (t) => {
    if (/[._]/.test(t.replace(/\.$/, '')) && /[A-Za-z]/.test(t) && !/\s/.test(t.trim()) && !/^[\d.,]+$/.test(t.trim())) return true       // usernames and dotted ids
    const tk = tokens(t)
    if (safeSentence(tk)) return false
    return tk.some((w) => !safeToken(w))
  }
  const blur = (el) => { if (!el.style.filter) { el.style.filter = 'blur(6px)'; stats.blurred++ } }
  /* 4 every leaf of text in the page body that is not interface chrome */
  const skip = (el) => el.closest('script,style,noscript,svg,canvas,nav,aside,header,thead,th,[role="tab"],[role="tablist"],option,select') || (el.closest('h1,h2,label,legend') && !el.closest('tbody, li, [role="row"], [role="listitem"]'))
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue
    if (skip(el)) continue
    const r = el.getBoundingClientRect(); if (r.top < 168 || r.right < 84) continue      // header, tab strip and sidebar rail are interface chrome
    const t = (el.innerText || '').trim(); if (!t) continue
    if (unsafe(t)) blur(el)
  }
  /* 5 table cells under unsafe headers are blurred as a whole column, even if a cell looks safe */
  const SAFE_COL = /^(id|#|sr|sr\.?\s*no|s\.?\s*no|class|standard|division|section|grade|status|profile|role|date|time|amount|total|balance|due|paid|type|mode|category|count|qty|quantity|price|rate|house|shift|route|vehicle|subject|exam|term|year|actions?|roll|attendance|documents?|priority|stage|session|day|month|week|marks?|score|result|percentage|percent|capacity|seats|occupied|available|fees?|fee type|installment)\b/i
  for (const table of document.querySelectorAll('table')) {
    const heads = [...table.querySelectorAll('thead th, thead td')].map((h) => h.innerText.trim())
    const freeText = heads.some((h) => /description|file name|from place|remarks|title|name of/i.test(h))      // free-text tables (letters, files): a Subject column is free text too
    heads.forEach((h, ci) => {
      if (h && SAFE_COL.test(h) && !(freeText && /^subject/i.test(h))) return
      for (const row of table.querySelectorAll('tbody tr')) { const c = row.children[ci]; if (c && (c.innerText || '').trim() && !/^[\d.,:\-–/%₹ ]+$/.test(c.innerText.trim())) blur(c) }
    })
  }
  /* 5b outside AI, messaging, payment and cloud company names are never shown */
  const VENDOR = /(openai|chatgpt|gpt-?\d|claude|anthropic|gemini|deepseek|llama|mistral|copilot|bard|perplexity|cohere|groq|grok|qwen|hugging ?face|bedrock|vertex|gamma|twilio|razorpay|payu|ccavenue|paytm|stripe|msg91|gupshup|interakt|google|microsoft|azure|aws)/i
  for (const el of document.querySelectorAll('body *')) { if (el.children.length === 0 && VENDOR.test(el.innerText || '') && !el.closest('script,style')) blur(el) }
  /* 6 photos, avatars and initial chips */
  for (const img of document.querySelectorAll('img')) {
    const src = (img.currentSrc || img.src || '').toLowerCase(); const alt = (img.alt || '').toLowerCase()
    if (/logo|scholar_clone|brand|favicon|icon/.test(src + ' ' + alt)) continue
    if (img.naturalWidth && img.naturalWidth > 900 && img.naturalHeight > 500) continue
    blur(img)
  }
  for (const el of document.querySelectorAll('body *')) { if (el.children.length === 0 && /^[A-Z]{1,2}$/.test((el.innerText || '').trim()) && el.closest('[class*="rounded-full"], [class*="avatar" i]')) blur(el.closest('[class*="rounded-full"], [class*="avatar" i]')) }
  return stats
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, storageState: existsSync(STATE) ? STATE : undefined })
const page = await ctx.newPage()
page.on('dialog', (d) => d.dismiss().catch(() => {}))
// safety net: no write-looking request leaves the browser after sign-in
const WRITE = /(delete|destroy|remove|save|store|update|create|send|submit|approve|reject|cancel|import|upload|mark|assign|rollover|transfer|pay|collect|issue)/i
let signedIn = false
await page.route('**/*', (route) => {
  const r = route.request(); const m = r.method()
  if (signedIn && m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && /\/api\//.test(r.url()) && WRITE.test(new URL(r.url()).pathname)) { blocked.push(m + ' ' + new URL(r.url()).pathname); return route.abort() }
  return route.continue()
})
const blocked = []

async function signIn() {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForTimeout(3000)
  if (!page.url().includes('/login')) { signedIn = true; return }
  await page.waitForSelector('#email', { timeout: 60000 })
  await page.fill('#email', process.env.K12_USER); await page.fill('#password', process.env.K12_PASS)
  await page.click('button:has-text("Sign in")')
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 120000 })
  await page.waitForTimeout(8000)
  await ctx.storageState({ path: STATE })
  signedIn = true
}
await signIn()

/* words that appear in the menu are interface words, not names */
const known = [...new Set(tree.modules.flatMap((m) => [m.name, ...m.subs.flatMap((s) => [s.name, ...s.screens.map((c) => c.name)])]).flatMap((x) => x.split(/[\s/&+-]+/)).filter((w) => w.length > 1))]
await page.addInitScript((k) => { window.__knownWords = k }, known)

async function settle() {
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  for (let i = 0; i < 12; i++) {
    const loading = await page.evaluate(() => document.querySelectorAll('[class*="animate-pulse"], [class*="skeleton" i], [aria-busy="true"]').length)
    if (!loading) break
    await page.waitForTimeout(1500)
  }
  await page.waitForTimeout(1500)
}

const manifest = []
for (const j of todo) {
  const t0 = Date.now(); const rec = { ...j, ok: false }
  try {
    await page.goto(new URL(j.href, BASE).toString(), { waitUntil: 'domcontentloaded', timeout: 90000 })
    if (page.url().includes('/login')) { await signIn(); await page.goto(new URL(j.href, BASE).toString(), { waitUntil: 'domcontentloaded', timeout: 90000 }) }
    await settle()
    const stats = await page.evaluate(MASKER, process.env.K12_USER.split('@')[0])
    await page.waitForTimeout(400)
    const left = await page.evaluate(() => {
      // text that is still readable: leaves that are not blurred, and are not inside a blurred element
      const parts = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n
      while ((n = w.nextNode())) { const p = n.parentElement; if (!p || /SCRIPT|STYLE|NOSCRIPT|OPTION/.test(p.tagName) || p.closest('select, [style*="blur"]')) continue; parts.push(n.nodeValue) }
      const t = parts.join(' | ').replace(/name@school\.example|98XXXXXX10|••••••/g, '')
      const visible = [...new Set(parts.map((x) => x.trim()).filter((x) => x.length >= 3))].slice(0, 500)
      return { email: /[\w.+-]+@[\w-]+(\.[\w-]+)+/.test(t), phone: /(\+?\d[\d ]{8,}\d)/.test(t), long: /\d{6,}/.test(t), visible }
    })
    const { visible, ...flags } = left
    Object.assign(rec, { finalUrl: new URL(page.url()).pathname, masked: stats, left: flags, visible })
    if (flags.email || flags.phone || flags.long) { rec.error = 'personal-data pattern left after masking: not kept' }
    else { const file = join(OUT, `${j.id}.png`); await page.screenshot({ path: file }); rec.file = file; rec.ok = true }
  } catch (e) { rec.error = String(e).slice(0, 160) }
  rec.ms = Date.now() - t0; manifest.push(rec)
  console.log(`${rec.ok ? 'ok ' : 'ERR'} ${j.id} ${rec.ms}ms ${rec.masked ? JSON.stringify(rec.masked) : ''} ${rec.error ?? ''}`)
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ base: BASE, blocked, items: manifest }, null, 1))
  await page.waitForTimeout(1500)
}
await browser.close()
console.log(`done: ${manifest.filter((m) => m.ok).length}/${manifest.length} kept, ${blocked.length} write requests blocked`)
